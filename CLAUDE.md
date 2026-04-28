# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run lint` — ESLint over the repo (`.eslintrc.json`).
- `npm run test:unit` — pure-Node Mocha against `test/unit/**/*.test.js`. Fast; no VS Code download.
- `npm run test:e2e` — downloads a sandboxed VS Code via `@vscode/test-electron` and runs `test/suite/**/*.test.js` (tdd UI, loaded by `test/suite/index.js`).
- `npm test` — lint, then unit, then e2e.
- F5 in VS Code launches the Extension Development Host.

## Architecture

Plain CommonJS extension (no build step). Two source files:

- `lib/qid.js` — pure helpers with no `vscode` import: QID parsing (`extractQid`, `scanQids`), URL/prefix builders (`entityKind`, `entityUrl`, `entityPrefix`), and label-language helpers (`getFieldByLangPriority`, `collectByLang`). Importable from plain Node, which is why unit tests can run without spawning VS Code.
- `extension.js` — VS Code glue. Registers four providers/commands, wires events, and owns the cache.

### Activation flow

1. `activate()` hydrates the cache from `globalState[PERSIST_KEY]`, calls `setupProviders()`, and prefetches QIDs in already-visible editors.
2. `setupProviders()` reads `wikidataqidlabels.documentSelector` (default `["**"]`), builds a selector array, and registers a HoverProvider, DocumentLinkProvider, and CodeActionProvider against that selector. Disposables go into the module-level `disposables` array.
3. `onDidChangeConfiguration` is filtered with `e.affectsConfiguration('wikidataqidlabels')` — only our own settings trigger a re-register.
4. `onDidChangeVisibleTextEditors` and `onDidOpenTextDocument` call `prefetchDocument`, which scans for QIDs and batches lookups via `wbgetentities` (≤50 IDs per request).

### QID detection

`extractQid` strips an optional `https://www.wikidata.org/(wiki|entity)/(Property:|Lexeme:)?` prefix, then matches against `^[QPL]\d+$` (anchored — substrings like `fooQ42` are rejected). `scanQids` uses the unanchored variant with the same prefix to find QIDs anywhere in a line and yields `{ qid, index, length }`. Both supported in three flavors: entities (`Q…`), properties (`P…`), lexemes (`L…`).

### Cache

Module-level `Map<cacheKey, { promise, value?, expiresAt? }>` keyed by `${qid}::${langs}`. The cache stores in-flight promises so concurrent hovers / prefetches dedupe automatically. Successful lookups expire after `POSITIVE_TTL_MS` (7d) and are persisted to `context.globalState` via a debounced `schedulePersist()` (5s window). Negative results expire after `NEGATIVE_TTL_MS` (60s) and are not persisted. `trimCache()` drops oldest entries above `MAX_CACHE_ENTRIES` (1000) using insertion order.

Hydration on activate filters expired entries and rewraps each value as `Promise.resolve(value)` so the rest of the code can treat hydrated and freshly-fetched entries uniformly.

### Network

`fetchEntities(qids, langs)` uses the global `fetch` (Node ≥18, VS Code ≥1.82 — both pinned in `engines`). It calls `https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels|descriptions&ids=…&languages=…&format=json`, skips entities that return `missing`, and returns a `Map<qid, Entity>`.

### Settings (`wikidataqidlabels.*`)

- `enableExtension` (bool) — toggles the providers.
- `wikidataLanguages` (string, pipe-separated, default `en|ru`) — language priority for label/description lookup.
- `addLinkToEntity` (bool) — wraps the heading in a markdown link to Wikidata.
- `showAllLanguages` (bool) — when true, the hover lists every configured language that returned a value (separated by `---`) instead of only the first match.
- `documentSelector` (string[], default `["**"]`) — glob patterns the providers attach to.

### Commands

`enableHover`, `disableHover` (toggle the setting), `copyQid` (writes to clipboard via `vscode.env.clipboard`), `openInWikidata` (opens the URL via `vscode.env.openExternal`). `copyQid` and `openInWikidata` accept a QID arg from CodeAction invocations and otherwise fall back to the word at the active cursor.
