'use strict';

const assert = require('assert');
const {
	extractQid,
	entityKind,
	entityUrl,
	entityPrefix,
	capitalizeFirstLetter,
	getFieldByLangPriority,
	collectByLang,
	scanQids,
} = require('../../lib/qid');

describe('extractQid', () => {
	it('matches bare QIDs', () => {
		assert.strictEqual(extractQid('Q42'), 'Q42');
		assert.strictEqual(extractQid('P31'), 'P31');
		assert.strictEqual(extractQid('L123'), 'L123');
	});
	it('strips wiki and entity URL prefixes', () => {
		assert.strictEqual(extractQid('https://www.wikidata.org/wiki/Q42'), 'Q42');
		assert.strictEqual(extractQid('http://www.wikidata.org/entity/Q42'), 'Q42');
		assert.strictEqual(extractQid('https://www.wikidata.org/wiki/Property:P31'), 'P31');
		assert.strictEqual(extractQid('https://www.wikidata.org/wiki/Lexeme:L123'), 'L123');
	});
	it('rejects junk and unanchored matches', () => {
		assert.strictEqual(extractQid(''), null);
		assert.strictEqual(extractQid(null), null);
		assert.strictEqual(extractQid('Q'), null);
		assert.strictEqual(extractQid('Q42abc'), null);
		assert.strictEqual(extractQid('fooQ42'), null);
		assert.strictEqual(extractQid('X42'), null);
	});
});

describe('entityKind / entityUrl / entityPrefix', () => {
	it('classifies entities, properties, and lexemes', () => {
		assert.strictEqual(entityKind('Q42'), 'entity');
		assert.strictEqual(entityKind('P31'), 'property');
		assert.strictEqual(entityKind('L123'), 'lexeme');
	});
	it('builds the right URL per kind', () => {
		assert.strictEqual(entityUrl('Q42'), 'https://www.wikidata.org/wiki/Q42');
		assert.strictEqual(entityUrl('P31'), 'https://www.wikidata.org/wiki/Property:P31');
		assert.strictEqual(entityUrl('L123'), 'https://www.wikidata.org/wiki/Lexeme:L123');
	});
	it('prefixes property and lexeme labels', () => {
		assert.strictEqual(entityPrefix('entity'), '');
		assert.strictEqual(entityPrefix('property'), '(prop.) ');
		assert.strictEqual(entityPrefix('lexeme'), '(lex.) ');
	});
});

describe('capitalizeFirstLetter', () => {
	it('uppercases the first letter only', () => {
		assert.strictEqual(capitalizeFirstLetter('hello world'), 'Hello world');
	});
	it('returns empty string for null/undefined/empty', () => {
		assert.strictEqual(capitalizeFirstLetter(null), '');
		assert.strictEqual(capitalizeFirstLetter(undefined), '');
		assert.strictEqual(capitalizeFirstLetter(''), '');
	});
});

describe('getFieldByLangPriority', () => {
	const entity = {
		labels: {
			en: { language: 'en', value: 'Douglas Adams' },
			ru: { language: 'ru', value: 'Дуглас Адамс' },
		},
		descriptions: {},
	};

	it('returns the first available language in priority order', () => {
		assert.strictEqual(getFieldByLangPriority(entity, 'labels', 'ru|en'), 'Дуглас Адамс');
		assert.strictEqual(getFieldByLangPriority(entity, 'labels', 'en|ru'), 'Douglas Adams');
	});
	it('falls through to later languages when the first is missing', () => {
		assert.strictEqual(getFieldByLangPriority(entity, 'labels', 'fr|en'), 'Douglas Adams');
	});
	it('returns null when no language matches', () => {
		assert.strictEqual(getFieldByLangPriority(entity, 'labels', 'fr|de'), null);
		assert.strictEqual(getFieldByLangPriority(entity, 'descriptions', 'en'), null);
	});
	it('returns null when the field is missing entirely', () => {
		assert.strictEqual(getFieldByLangPriority({}, 'labels', 'en'), null);
	});
});

describe('collectByLang', () => {
	it('returns a map of every configured language that has a value', () => {
		const result = collectByLang({
			en: { value: 'Earth' },
			ru: { value: 'Земля' },
		}, 'en|ru|fr');
		assert.deepStrictEqual(result, { en: 'Earth', ru: 'Земля' });
	});
	it('returns {} for missing fields', () => {
		assert.deepStrictEqual(collectByLang(undefined, 'en'), {});
		assert.deepStrictEqual(collectByLang(null, 'en'), {});
	});
});

describe('scanQids', () => {
	it('finds bare QIDs and URL forms with positions', () => {
		const text = 'see Q42 and https://www.wikidata.org/wiki/Property:P31 plus garbage Q.';
		const matches = Array.from(scanQids(text));
		assert.strictEqual(matches.length, 2);
		assert.strictEqual(matches[0].qid, 'Q42');
		assert.strictEqual(matches[0].index, text.indexOf('Q42'));
		assert.strictEqual(matches[1].qid, 'P31');
		assert.strictEqual(text.slice(matches[1].index, matches[1].index + matches[1].length),
			'https://www.wikidata.org/wiki/Property:P31');
	});
});
