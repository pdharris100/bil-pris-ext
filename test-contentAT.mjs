// test-contentAT.mjs
// Runs the AutoTrader scraper from contentAT.js against a tiny synthetic DOM.

import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';

const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /></head>
  <body>
    <main data-testid="search">
      <article>
        <a href="/car-details/123456789012345">Porsche Taycan 4S, £64,995</a>
        <div>12,000 miles</div>
        <div>2024 (73 reg)</div>
      </article>
      <article>
        <a href="/car-details/987654321098765">Porsche Taycan, £31,450</a>
        <div>135,000 miles</div>
        <div>2021 (21 reg)</div>
      </article>
      <article>
        <a href="/car-details/111111111111111">Porsche Taycan, £45,795</a>
        <div>12,000 miles</div>
        <div>69 reg</div>
      </article>
    </main>
  </body>
</html>`;

// Keep console quiet in CI / local runs.
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', () => {});

const dom = new JSDOM(html, {
  url: 'https://www.autotrader.co.uk/car-search',
  runScripts: 'outside-only',
  virtualConsole,
});

const { window } = dom;

// Stub chrome APIs used by the content script.
window.chrome = { runtime: { onMessage: { addListener: () => {} } } };

// Load and execute the real content script in the jsdom window.
const contentScript = fs.readFileSync(new URL('./contentAT.js', import.meta.url), 'utf8');
window.eval(contentScript);

assert.equal(typeof window.getDetails, 'function', 'contentAT.js should define getDetails()');

const cars = await new Promise((resolve) => {
  window.getDetails({ action: 'getDetails' }, {}, resolve);
});

assert.ok(Array.isArray(cars), 'getDetails() should respond with an array');
assert.equal(cars.length, 3);

const byId = new Map(cars.map((c) => [c.id, c]));

// 2024 (73 reg) should resolve into year 2024 (73 plates can be Jan/Feb 2024)
{
  const car = byId.get(123456789012345);
  assert.ok(car, 'expected car 123456789012345');
  const dt = new Date(car.year);
  assert.equal(dt.getUTCFullYear(), 2024);
  assert.equal(dt.getUTCMonth(), 0, '73 reg + display year 2024 => Jan (approx)');
}

// 2021 (21 reg) is Mar–Aug 2021; we use mid-window (Jun)
{
  const car = byId.get(987654321098765);
  assert.ok(car, 'expected car 987654321098765');
  const dt = new Date(car.year);
  assert.equal(dt.getUTCFullYear(), 2021);
  assert.equal(dt.getUTCMonth(), 5, '21 reg => Jun (approx)');
}

// "69 reg" without a display year should map to 2019 (Sep 2019–Feb 2020); we use Nov of base year.
{
  const car = byId.get(111111111111111);
  assert.ok(car, 'expected car 111111111111111');
  const dt = new Date(car.year);
  assert.equal(dt.getUTCFullYear(), 2019);
  assert.equal(dt.getUTCMonth(), 10, '69 reg => Nov 2019 (approx)');
}

console.log(`Test passed: extracted ${cars.length} cars.`);
