# Car Price Estimator (Chrome Extension)

A small Chrome/Chromium extension that runs on **bilbasen.dk** and **autotrader.co.uk** search result pages, scrapes car listing cards (title, asking price, and an approximate registration date), and shows a simple price-vs-age chart with an exponential trendline in the extension popup.

## What it does

- Scrapes multiple listings from the active tab (Bilbasen SRP listings; AutoTrader `/car-search` results).
- Extracts per-car data: `title`, `price` (DKK for Bilbasen, GBP for AutoTrader), and `year` as a UTC timestamp (ms).
- Plots a scatter chart of asking prices and overlays an exponential regression “Trend” line.
- Lets you change how many years to extrapolate the trend (stored via `chrome.storage.sync`).
- Allows removing an outlier by clicking a point in the scatter series (it’s removed locally for the current popup session).

## Install (unpacked / local dev)

### Requirements

- Node.js 18+ (used for the build script and `jsdom` tests)
- Chrome/Chromium (Manifest V3 extension)

1. Install dependencies:

	```bash
	npm install
	```

2. Build the unpacked extension into `dist/`:

	```bash
	npm run build
	```

3. Load into Chrome:

	- Open `chrome://extensions`
	- Enable **Developer mode**
	- Click **Load unpacked**
	- Select the `dist/` folder

## Usage

1. Open a supported search results page:

	- Bilbasen: `https://www.bilbasen.dk/...`
	- AutoTrader: `https://www.autotrader.co.uk/car-search...`

2. Click the extension icon.
3. The popup will render a chart:

	- Blue points: asking price per listing
	- Red line: exponential regression trend

Use the **Extrapolate** dropdown to extend the trendline by N years.

If the popup stays empty, the active tab likely isn’t a supported results page or the site markup changed so the scraper can’t find listing cards.

## Development

### Project layout

- `manifest.json` — Manifest V3 configuration (content scripts + permissions).
- `content.js` — Bilbasen content script; scrapes listing cards into `{ id, title, year, price }`.
- `contentAT.js` — AutoTrader content script; scrapes `/car-search` results into `{ id, title, year, price }`.
- `popup.html`, `popup.js` — popup UI (chart + regression + settings).
- `vendor/` — vendored runtime dependencies (`Chart.js`, `moment`, `regression`).
- `scripts/build-dist.mjs` — build script that copies runtime files into `dist/`.

### Rebuilding

Re-run:

```bash
npm run build
```

Then in `chrome://extensions`, click **Reload** on the extension.

## Testing

There are small Node-based tests that run the real scrapers using `jsdom`:

```bash
npm test
```

- `test-content.mjs` runs the Bilbasen scraper against `sample-bilbasen.html`.
- `test-contentAT.mjs` runs the AutoTrader scraper against a small synthetic HTML fixture.

## Permissions & privacy

From `manifest.json`:

- `host_permissions`:
	- `https://www.bilbasen.dk/*`
	- `https://www.autotrader.co.uk/*`
- `permissions`:
	- `activeTab` (read the current page DOM)
	- `storage` (persist the extrapolation setting)

The extension only reads listing data from the currently active supported tab to compute and display the popup chart. No backend is used.

## Troubleshooting

- **Popup shows no chart**: open a supported results page (AutoTrader must be under `/car-search`).
- **Works on some pages only**: both sites can be client-rendered; the scrapers retry briefly, but markup changes may break selectors.
- **Trend looks skewed**: click obvious outliers (blue points) to remove them from the current popup view.

## Contributing

Issues and pull requests are welcome.

When contributing:

- Keep changes small and focused.
- Prefer updating/adding fixtures + `npm test` coverage when changing scraping logic.

## License

No license file is currently included in this repository. If you intend this to be open source, add a `LICENSE` file (for example MIT) and update this section.

## Disclaimer

This project is provided “as is”. Scraping and derived values may be incomplete or incorrect and may break if Bilbasen/AutoTrader change their DOM.
