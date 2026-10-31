import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { Script } from 'node:vm';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sources = [
    'core',
    'features/download',
    'features/home',
    'features/signin',
    'features/chrome',
    'features/topbar',
    'features/links',
    'features/homelogo',
    'features/fit',
    'features/coursebar',
    'features/todo',
    'settings',
    'guide',
    'startup',
];
const output = 'XMU-TronClass-Helper.user.js';
const bundle = [
    read('src/metadata.js').trimEnd(),
    '',
    '(() => {',
    "  'use strict';",
    '',
    `  const STYLES = ${JSON.stringify(read('XMU-TronClass-Helper.css'))};`,
    '',
    sources.map((name) => read(`src/${name}.js`).trimEnd()).join('\n\n'),
    '})();',
    '',
].join('\n');

new Script(bundle, { filename: output });
if (process.argv.includes('--check')) {
    assert.ok(read(output) === bundle, 'Bundle is outdated. Run: node build.mjs');
    console.log('PASS: bundle syntax and source consistency');
} else {
    writeFileSync(new URL(output, import.meta.url), bundle);
    console.log(`Built ${output}`);
}