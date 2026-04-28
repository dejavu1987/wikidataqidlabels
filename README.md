# Wikidata QID Labels

VS Code extension that surfaces Wikidata entity, property, and lexeme labels and descriptions on hover. Uses the public [Wikidata API](https://www.wikidata.org/w/api.php) — no API keys required.

![demo](./images/feature.gif)

## Features

- **Hover** — hover any QID (e.g. `Q42`), property ID (`P31`), or lexeme ID (`L123`) and see its label and description in your preferred languages. Full Wikidata URLs (`https://www.wikidata.org/wiki/Q42`, `…/entity/Q42`, `…/Property:P31`, `…/Lexeme:L123`) are detected too.
- **Clickable links** — QIDs in your files become document links (`Cmd`/`Ctrl`+click opens Wikidata).
- **Code actions** — the lightbulb on a QID offers *Copy QID* and *Open in Wikidata*.
- **Multi-language** — show labels in every configured language at once with `showAllLanguages`.
- **Batched + cached** — when a file opens, all QIDs in it are fetched in batches (≤50 per request). Results are cached for 7 days in `globalState`, so labels stay instant across reloads.
- **Property and lexeme aware** — properties render as `(prop.) Label`, lexemes as `(lex.) Label`, with the correct Wikidata URL per kind.

## Requirements

- VS Code ≥ 1.82 (which ships Node ≥ 18; required for the built-in `fetch`).
- Network access to `www.wikidata.org`.

## Settings

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `wikidataqidlabels.enableExtension` | boolean | `true` | Enable or disable all providers. |
| `wikidataqidlabels.wikidataLanguages` | string | `"en\|ru"` | Pipe-separated language codes in priority order. The first language that has a value wins (unless `showAllLanguages` is on). See the [`wbgetentities` docs](https://www.wikidata.org/w/api.php?action=help&modules=wbgetentities). |
| `wikidataqidlabels.addLinkToEntity` | boolean | `true` | Render the hover heading as a markdown link to Wikidata. |
| `wikidataqidlabels.showAllLanguages` | boolean | `false` | When true, the hover lists every configured language that returned a value (separated by a horizontal rule), instead of only the first match. |
| `wikidataqidlabels.documentSelector` | string[] | `["**"]` | Glob patterns the providers attach to. Narrow this if you only want hovers in specific file types — e.g. `["**/*.json", "**/*.md"]`. |

## Commands

All four commands are available from the Command Palette:

- **Wikidata QID Labels: Enable** / **Disable** — toggle `enableExtension`.
- **Wikidata QID Labels: Copy QID** — copies the QID under the cursor to the clipboard.
- **Wikidata QID Labels: Open in Wikidata** — opens the QID under the cursor in your browser.

The Copy / Open commands are also exposed as code actions (lightbulb) when the cursor is on a QID.

## Changelog

### 1.3.0

- Property and lexeme support (`P…`, `L…`); URL detection for `Property:` and `Lexeme:` paths.
- Clickable document links and *Copy QID* / *Open in Wikidata* code actions.
- New `showAllLanguages` setting renders every configured language in the hover.
- New `documentSelector` setting limits the providers to specific glob patterns.
- Batched lookups (≤50 IDs per request) and on-open prefetch.
- Persistent cache in `globalState` with a 7-day TTL; in-flight requests are deduped.
- Activation event changed from `*` to `onStartupFinished` for lighter startup.
- Anchored QID regex (substrings like `fooQ42` no longer match) and several correctness fixes for concurrent hovers, cancellation, and missing descriptions.
- Dropped `node-fetch` in favor of the built-in `fetch`. Requires VS Code ≥ 1.82.

### 1.2.3

Hotfix for VS Code (the hover stopped showing up after the update for 1.52).

### 1.2.2

QID test updated so it can capture different URI formats (contributed by [@AtilioA](https://github.com/AtilioA)).

### 1.2.1

Set English as the default language.

### 1.2.0

Fixes for entities which don't have a description.

### 1.1.0

Added links to entities in hover text. Improved handling of quoted QIDs in JSON files.

### 1.0.0

Initial release of the extension.
