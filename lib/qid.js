'use strict';

const fullPathRE = /https?:\/\/www\.wikidata\.org\/(?:wiki|entity)\/(?:Property:|Lexeme:)?/;
const qidRE = /^[QPL]\d+$/;
const qidScanRE = /(?:https?:\/\/www\.wikidata\.org\/(?:wiki|entity)\/(?:Property:|Lexeme:)?)?[QPL]\d+/g;

function extractQid(word) {
	if (!word) {
		return null;
	}
	const stripped = word.replace(fullPathRE, '');
	return qidRE.test(stripped) ? stripped : null;
}

function entityKind(qid) {
	const c = qid.charAt(0);
	if (c === 'P') return 'property';
	if (c === 'L') return 'lexeme';
	return 'entity';
}

function entityUrl(qid) {
	const kind = entityKind(qid);
	if (kind === 'property') return `https://www.wikidata.org/wiki/Property:${qid}`;
	if (kind === 'lexeme') return `https://www.wikidata.org/wiki/Lexeme:${qid}`;
	return `https://www.wikidata.org/wiki/${qid}`;
}

function entityPrefix(kind) {
	if (kind === 'property') return '(prop.) ';
	if (kind === 'lexeme') return '(lex.) ';
	return '';
}

function capitalizeFirstLetter(string) {
	if (!string) {
		return '';
	}
	return string.charAt(0).toUpperCase() + string.slice(1);
}

function getFieldByLangPriority(entity, fieldName, languages) {
	const field = entity[fieldName];
	if (!field) {
		return null;
	}
	for (const lang of languages.split('|')) {
		if (lang in field) {
			return field[lang].value;
		}
	}
	return null;
}

function collectByLang(field, languages) {
	const out = {};
	if (!field) {
		return out;
	}
	for (const lang of languages.split('|')) {
		if (field[lang] && field[lang].value) {
			out[lang] = field[lang].value;
		}
	}
	return out;
}

function* scanQids(text) {
	qidScanRE.lastIndex = 0;
	let match;
	while ((match = qidScanRE.exec(text)) !== null) {
		const qid = extractQid(match[0]);
		if (qid) {
			yield { qid, index: match.index, length: match[0].length };
		}
	}
}

module.exports = {
	fullPathRE,
	qidRE,
	qidScanRE,
	extractQid,
	entityKind,
	entityUrl,
	entityPrefix,
	capitalizeFirstLetter,
	getFieldByLangPriority,
	collectByLang,
	scanQids,
};
