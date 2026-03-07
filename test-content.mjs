// test-content.mjs
// Runs the real Bilbasen scraper from content.js against html.html (saved SRP HTML)

import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';

const html = fs.readFileSync(new URL('./html.html', import.meta.url), 'utf8');

// Silence noisy CSS parsing errors from the saved page HTML.
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (err) => {
    if (err?.message?.includes('Could not parse CSS stylesheet')) return;
    // Forward other jsdom errors to stderr to avoid hiding real problems.
    console.error(err);
});

const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    virtualConsole,
});

const { window } = dom;

// Stub chrome APIs used by the content script.
window.chrome = { runtime: { onMessage: { addListener: () => { } } } };

// Load and execute the real content script in the jsdom window.
const contentScript = fs.readFileSync(new URL('./content.js', import.meta.url), 'utf8');
window.eval(contentScript);

assert.equal(typeof window.getDetails, 'function', 'content.js should define getDetails()');

const cars = await new Promise((resolve) => {
    window.getDetails({ action: 'getDetails' }, {}, resolve);
});

assert.ok(Array.isArray(cars), 'getDetails() should respond with an array');
assert.ok(cars.length > 0, 'should extract at least one car');

const first = cars[0];
assert.equal(typeof first.title, 'string');
assert.ok(first.title.length > 0, 'title should be non-empty');
assert.equal(typeof first.price, 'number');
assert.ok(Number.isFinite(first.price) && first.price > 0, 'price should be a positive number');
assert.equal(typeof first.year, 'number');
assert.ok(Number.isFinite(first.year) && first.year > 0, 'year should be a timestamp in ms');

// Sanity check against the first listing in html.html
assert.equal(first.price, 569900);
assert.equal(new Date(first.year).getUTCFullYear(), 2020);

console.log(`Test passed: extracted ${cars.length} cars.`);
