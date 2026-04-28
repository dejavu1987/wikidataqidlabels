'use strict';

const vscode = require('vscode');
const {
	extractQid,
	entityKind,
	entityUrl,
	entityPrefix,
	capitalizeFirstLetter,
	getFieldByLangPriority,
	collectByLang,
	scanQids,
} = require('./lib/qid');

const POSITIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 1000;
const PERSIST_DEBOUNCE_MS = 5000;
const MAX_CACHE_ENTRIES = 1000;
const BATCH_SIZE = 50;
const PERSIST_KEY = 'wikidataqidlabels.cache.v1';

let extensionContext = null;
let disposables = [];
// Map<cacheKey, { promise: Promise<Entity|null>, value?: Entity|null, expiresAt?: number }>
const cache = new Map();
let persistTimer = null;

function activate(context) {
	extensionContext = context;
	hydrateCache(context);
	setupProviders();
	prefetchVisible();

	context.subscriptions.push(
		vscode.commands.registerCommand('wikidataqidlabels.enableHover', () => {
			vscode.workspace.getConfiguration('wikidataqidlabels').update('enableExtension', true, true);
			vscode.window.showInformationMessage('wikidataqidlabels enabled!');
		}),
		vscode.commands.registerCommand('wikidataqidlabels.disableHover', () => {
			vscode.workspace.getConfiguration('wikidataqidlabels').update('enableExtension', false, true);
			vscode.window.showInformationMessage('wikidataqidlabels disabled!');
		}),
		vscode.commands.registerCommand('wikidataqidlabels.copyQid', async (qid) => {
			const target = await resolveQidArg(qid);
			if (!target) {
				return;
			}
			await vscode.env.clipboard.writeText(target);
			vscode.window.setStatusBarMessage(`Copied ${target}`, 2000);
		}),
		vscode.commands.registerCommand('wikidataqidlabels.openInWikidata', async (qid) => {
			const target = await resolveQidArg(qid);
			if (!target) {
				return;
			}
			await vscode.env.openExternal(vscode.Uri.parse(entityUrl(target)));
		}),
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (!e.affectsConfiguration('wikidataqidlabels')) {
				return;
			}
			disposeAll();
			setupProviders();
			prefetchVisible();
		}),
		vscode.window.onDidChangeVisibleTextEditors(() => prefetchVisible()),
		vscode.workspace.onDidOpenTextDocument((doc) => prefetchDocument(doc)),
	);
}

function deactivate() {
	disposeAll();
	flushPersist();
	cache.clear();
}

module.exports = { activate, deactivate };

function setupProviders() {
	const cfg = vscode.workspace.getConfiguration('wikidataqidlabels');
	if (!cfg.get('enableExtension', true)) {
		return;
	}
	const patterns = cfg.get('documentSelector', ['**']);
	const selector = patterns.map((pattern) => ({ pattern }));

	disposables.push(
		vscode.languages.registerHoverProvider(selector, {
			async provideHover(document, position, token) {
				const range = document.getWordRangeAtPosition(position);
				if (!range) {
					return undefined;
				}
				const qid = extractQid(document.getText(range).replace(/['"]/g, ''));
				if (!qid) {
					return undefined;
				}
				const entity = await getLabel(qid, token);
				if (!entity || (token && token.isCancellationRequested)) {
					return undefined;
				}
				return new vscode.Hover(createHoverText(entity));
			},
		}),
		vscode.languages.registerDocumentLinkProvider(selector, {
			provideDocumentLinks(document, token) {
				return findQidRanges(document, token).map(({ qid, range }) => {
					const link = new vscode.DocumentLink(range, vscode.Uri.parse(entityUrl(qid)));
					link.tooltip = `Open ${qid} on Wikidata`;
					return link;
				});
			},
		}),
		vscode.languages.registerCodeActionsProvider(selector, {
			provideCodeActions(document, range) {
				const wordRange = document.getWordRangeAtPosition(range.start);
				if (!wordRange) {
					return undefined;
				}
				const qid = extractQid(document.getText(wordRange).replace(/['"]/g, ''));
				if (!qid) {
					return undefined;
				}
				const copy = new vscode.CodeAction(`Copy ${qid}`, vscode.CodeActionKind.Empty);
				copy.command = {
					title: copy.title,
					command: 'wikidataqidlabels.copyQid',
					arguments: [qid],
				};
				const open = new vscode.CodeAction(`Open ${qid} in Wikidata`, vscode.CodeActionKind.Empty);
				open.command = {
					title: open.title,
					command: 'wikidataqidlabels.openInWikidata',
					arguments: [qid],
				};
				return [copy, open];
			},
		}),
	);
}

function disposeAll() {
	for (const d of disposables) {
		d.dispose();
	}
	disposables = [];
}

function findQidRanges(document, token) {
	const results = [];
	for (let line = 0; line < document.lineCount; line++) {
		if (token && token.isCancellationRequested) {
			break;
		}
		const text = document.lineAt(line).text;
		for (const { qid, index, length } of scanQids(text)) {
			const start = new vscode.Position(line, index);
			const end = new vscode.Position(line, index + length);
			results.push({ qid, range: new vscode.Range(start, end) });
		}
	}
	return results;
}

async function resolveQidArg(arg) {
	if (typeof arg === 'string') {
		const qid = extractQid(arg);
		if (qid) {
			return qid;
		}
	}
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return null;
	}
	const range = editor.document.getWordRangeAtPosition(editor.selection.active);
	if (!range) {
		return null;
	}
	return extractQid(editor.document.getText(range).replace(/['"]/g, ''));
}

function createHoverText(obj) {
	const cfg = vscode.workspace.getConfiguration('wikidataqidlabels');
	const addLink = cfg.get('addLinkToEntity', true);
	const showAll = cfg.get('showAllLanguages', false);
	const prefix = entityPrefix(obj.type);
	const url = entityUrl(obj.qid);

	if (showAll && obj.labelByLang && Object.keys(obj.labelByLang).length > 0) {
		const lines = [];
		for (const [lang, label] of Object.entries(obj.labelByLang)) {
			const heading = addLink
				? `[${prefix}${capitalizeFirstLetter(label)}](${url}) _(${lang})_`
				: `${prefix}${capitalizeFirstLetter(label)} _(${lang})_`;
			const desc = obj.descriptionByLang ? capitalizeFirstLetter(obj.descriptionByLang[lang]) : '';
			lines.push(desc ? `${heading}\n\n${desc}` : heading);
		}
		return lines.join('\n\n---\n\n');
	}

	const labelText = `${prefix}${capitalizeFirstLetter(obj.label) || obj.qid}`;
	const heading = addLink ? `[${labelText}](${url})` : labelText;
	const description = capitalizeFirstLetter(obj.description);
	return description ? `${heading}\n\n${description}` : heading;
}

function configuredLanguages() {
	return vscode.workspace.getConfiguration('wikidataqidlabels').get('wikidataLanguages', 'en|ru');
}

function cacheKeyOf(qid, langs) {
	return `${qid}::${langs}`;
}

async function getLabel(qid, token) {
	const langs = configuredLanguages();
	const key = cacheKeyOf(qid, langs);
	const cached = cache.get(key);
	if (cached && (cached.expiresAt === undefined || cached.expiresAt > Date.now())) {
		return cached.promise;
	}
	const entry = { promise: null };
	const promise = fetchSingle(qid, langs).then(
		(value) => {
			entry.value = value;
			entry.expiresAt = Date.now() + (value ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS);
			if (value) {
				schedulePersist();
			}
			trimCache();
			return value;
		},
		(err) => {
			console.log(`wikidataqidlabels: ${err}`);
			entry.value = null;
			entry.expiresAt = Date.now() + NEGATIVE_TTL_MS;
			return null;
		},
	);
	entry.promise = promise;
	cache.set(key, entry);
	const result = await promise;
	if (token && token.isCancellationRequested) {
		return null;
	}
	return result;
}

async function fetchSingle(qid, langs) {
	const entities = await fetchEntities([qid], langs);
	return entities.get(qid) || null;
}

async function fetchEntities(qids, langs) {
	const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels|descriptions&ids=${qids.map(encodeURIComponent).join('|')}&languages=${encodeURIComponent(langs)}&format=json`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}
	const json = await response.json();
	const out = new Map();
	if (!json || !json.entities) {
		return out;
	}
	for (const qid of qids) {
		const entity = json.entities[qid];
		if (!entity || entity.missing !== undefined) {
			continue;
		}
		out.set(qid, {
			qid,
			type: entityKind(qid),
			label: getFieldByLangPriority(entity, 'labels', langs),
			description: getFieldByLangPriority(entity, 'descriptions', langs),
			labelByLang: collectByLang(entity.labels, langs),
			descriptionByLang: collectByLang(entity.descriptions, langs),
		});
	}
	return out;
}

function prefetchVisible() {
	for (const editor of vscode.window.visibleTextEditors) {
		prefetchDocument(editor.document);
	}
}

async function prefetchDocument(document) {
	if (!document) {
		return;
	}
	const cfg = vscode.workspace.getConfiguration('wikidataqidlabels');
	if (!cfg.get('enableExtension', true)) {
		return;
	}
	const langs = configuredLanguages();
	const ranges = findQidRanges(document, undefined);
	const unique = new Set();
	for (const { qid } of ranges) {
		if (cache.has(cacheKeyOf(qid, langs))) {
			continue;
		}
		unique.add(qid);
	}
	if (unique.size === 0) {
		return;
	}
	const all = Array.from(unique);
	for (let i = 0; i < all.length; i += BATCH_SIZE) {
		const batch = all.slice(i, i + BATCH_SIZE);
		const placeholders = batch.map((qid) => {
			const entry = { promise: null };
			const placeholder = new Promise((resolve) => {
				entry._resolve = resolve;
			});
			entry.promise = placeholder;
			cache.set(cacheKeyOf(qid, langs), entry);
			return entry;
		});
		try {
			const result = await fetchEntities(batch, langs);
			batch.forEach((qid, idx) => {
				const entity = result.get(qid) || null;
				const entry = placeholders[idx];
				entry.value = entity;
				entry.expiresAt = Date.now() + (entity ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS);
				entry._resolve(entity);
				delete entry._resolve;
			});
			schedulePersist();
		} catch (err) {
			console.log(`wikidataqidlabels: prefetch ${err}`);
			batch.forEach((qid, idx) => {
				const entry = placeholders[idx];
				entry.value = null;
				entry.expiresAt = Date.now() + NEGATIVE_TTL_MS;
				entry._resolve(null);
				delete entry._resolve;
			});
		}
	}
	trimCache();
}

function hydrateCache(context) {
	const stored = context.globalState.get(PERSIST_KEY, {});
	const now = Date.now();
	for (const [key, raw] of Object.entries(stored)) {
		if (!raw || typeof raw !== 'object') {
			continue;
		}
		if (raw.expiresAt && raw.expiresAt > now && raw.value) {
			cache.set(key, {
				promise: Promise.resolve(raw.value),
				value: raw.value,
				expiresAt: raw.expiresAt,
			});
		}
	}
}

function schedulePersist() {
	if (!extensionContext || persistTimer) {
		return;
	}
	persistTimer = setTimeout(() => {
		persistTimer = null;
		flushPersist();
	}, PERSIST_DEBOUNCE_MS);
}

function flushPersist() {
	if (!extensionContext) {
		return;
	}
	if (persistTimer) {
		clearTimeout(persistTimer);
		persistTimer = null;
	}
	const out = {};
	for (const [key, entry] of cache.entries()) {
		if (entry.value && entry.expiresAt && entry.expiresAt > Date.now()) {
			out[key] = { value: entry.value, expiresAt: entry.expiresAt };
		}
	}
	extensionContext.globalState.update(PERSIST_KEY, out);
}

function trimCache() {
	if (cache.size <= MAX_CACHE_ENTRIES) {
		return;
	}
	const overflow = cache.size - MAX_CACHE_ENTRIES;
	const it = cache.keys();
	for (let i = 0; i < overflow; i++) {
		const key = it.next().value;
		if (key !== undefined) {
			cache.delete(key);
		}
	}
}
