# Change Log

All notable changes to the "wikidataqidlabels" extension are documented in this file. The format follows [Keep a Changelog](http://keepachangelog.com/).

## [1.3.0]

### Added

- Lexeme support (`L\d+`) and detection of `Property:` / `Lexeme:` Wikidata URLs.
- DocumentLink provider — QIDs in any file are clickable.
- *Copy QID* and *Open in Wikidata* commands and code actions.
- `wikidataqidlabels.showAllLanguages` setting to render every configured language in the hover.
- `wikidataqidlabels.documentSelector` setting to scope the providers to specific globs.
- Batched `wbgetentities` lookups (up to 50 IDs per request) with on-open prefetch of every QID in the document.
- Persistent label cache in `context.globalState` with a 7-day TTL and debounced writes.

### Changed

- Activation event from `*` to `onStartupFinished` for lighter startup cost.
- Hover provider deduplicates concurrent requests via the in-flight promise cache and honors the cancellation token.
- QID regex is anchored (`^[QPL]\d+$`); substrings like `fooQ42` no longer match.
- `onDidChangeConfiguration` only re-registers when a `wikidataqidlabels.*` setting changes.
- Dropped `node-fetch` — uses the built-in global `fetch`. **Requires VS Code ≥ 1.82.**
- Test suite split into fast unit tests (`npm run test:unit`) and the VS Code host suite (`npm run test:e2e`).

### Fixed

- Several implicit-global assignments in the previous code that could interleave between concurrent hovers.
- Hover no longer crashes when the entity has no description in any configured language.
- Failed lookups are cached briefly (60s) so they don't refire on every hover.

## [1.2.3]

- Hotfix for VS Code 1.52 — the hover stopped showing up.

## [1.2.2]

- QID test updated so it can capture different URI formats (contributed by [@AtilioA](https://github.com/AtilioA)).

## [1.2.1]

- Set English as the default language.

## [1.2.0]

- Fixes for entities which don't have a description.

## [1.1.0]

- Added links to entities in hover text.
- Improved handling of quoted QIDs in JSON files.

## [1.0.0]

- Initial release.
