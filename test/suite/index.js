'use strict';

const path = require('path');
const Mocha = require('mocha');
const { glob } = require('glob');

async function run() {
	const mocha = new Mocha({ ui: 'tdd', color: true });
	const testsRoot = path.resolve(__dirname, '..');
	const files = await glob('suite/**/*.test.js', { cwd: testsRoot });
	for (const f of files) {
		mocha.addFile(path.resolve(testsRoot, f));
	}
	return new Promise((resolve, reject) => {
		try {
			mocha.run((failures) => {
				if (failures > 0) {
					reject(new Error(`${failures} tests failed.`));
				} else {
					resolve();
				}
			});
		} catch (err) {
			reject(err);
		}
	});
}

module.exports = { run };
