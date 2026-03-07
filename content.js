console.log("Registering listener in content script");
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.action === "getDetails") {
            getDetails(request, sender, sendResponse);
            // this is required to use sendResponse asynchronously
            return true;
        }
    }
);

function getDetails(request, sender, sendResponse) {
    const normalizeWhitespace = (value) => (value ?? '').replace(/\s+/g, ' ').trim();

    const parsePriceDkk = (priceText) => {
        const digitsOnly = (priceText ?? '').replace(/[^0-9]/g, '');
        if (!digitsOnly) return NaN;
        return parseInt(digitsOnly, 10);
    };

    const parseMonthYearToUtcMs = (monthYearText) => {
        const match = (monthYearText ?? '').match(/(\d{1,2})\s*\/\s*(\d{4})/);
        if (!match) return NaN;
        const month = parseInt(match[1], 10);
        const year = parseInt(match[2], 10);
        if (!Number.isFinite(month) || month < 1 || month > 12) return NaN;
        if (!Number.isFinite(year) || year < 1900) return NaN;

        // Use a UTC timestamp to keep tests and charting timezone-stable.
        return Date.UTC(year, month - 1, 15, 12, 0, 0, 0);
    };

    const findFirstTextMatch = (rootEl, selector, regex) => {
        const candidates = Array.from(rootEl.querySelectorAll(selector));
        for (const el of candidates) {
            const text = normalizeWhitespace(el.textContent);
            if (!text) continue;
            if (regex.test(text)) return text;
        }
        return '';
    };

    const extractListingId = (listingEl, fallbackId) => {
        const link = listingEl.querySelector('a[class*="Listing_link__"][href]')
            ?? listingEl.querySelector('a[href*="/brugt/bil/"][href]')
            ?? listingEl.querySelector('a[href][aria-label]')
            ?? listingEl.querySelector('a[href]');
        const href = link?.getAttribute('href');
        if (href) {
            try {
                const url = new URL(href, document.baseURI);
                const segments = url.pathname.split('/').filter(Boolean);
                const last = segments[segments.length - 1];
                if (/^\d+$/.test(last)) return parseInt(last, 10);
            } catch {
                // ignore and fall back
            }

            const match = href.match(/\/(\d+)(?:[/?#]|$)/);
            if (match) return parseInt(match[1], 10);
        }

        return fallbackId;
    };

    const extractTitle = (listingEl) => {
        const makeModel = listingEl.querySelector('[class*="Listing_makeModel__"]');
        if (!makeModel) {
            const h3 = listingEl.querySelector('h3');
            if (h3) return normalizeWhitespace(h3.textContent);

            const imgAlt = normalizeWhitespace(listingEl.querySelector('img[alt]')?.getAttribute('alt'));
            if (imgAlt) return imgAlt;

            const ariaLabel = normalizeWhitespace(listingEl.querySelector('a[href][aria-label]')?.getAttribute('aria-label'));
            if (ariaLabel) return ariaLabel;

            return '';
        }

        const h3 = makeModel.querySelector('h3');
        if (!h3) return normalizeWhitespace(makeModel.textContent);

        const base = normalizeWhitespace(h3.textContent);
        const container = h3.parentNode;
        if (!container) return base;

        const siblingsAfter = Array.from(container.childNodes)
            .slice(Array.from(container.childNodes).indexOf(h3) + 1)
            .map((n) => n.textContent ?? '')
            .join(' ');

        const rest = normalizeWhitespace(siblingsAfter);
        return normalizeWhitespace([base, rest].filter(Boolean).join(' '));
    };

    const extractPrice = (listingEl) => {
        const priceContainer = listingEl.querySelector('[class*="Listing_price__"]');
        if (priceContainer) return parsePriceDkk(normalizeWhitespace(priceContainer.textContent));

        const priceText = findFirstTextMatch(listingEl, 'h1,h2,h3,h4,h5,span,div,p,li', /\d[\d\s.]*\s*kr/i);
        return parsePriceDkk(priceText);
    };

    const extractYear = (listingEl) => {
        const dateLi = listingEl.querySelector('[class*="Listing_details__"] li[class*="ListingDetails_listItem__"]')
            ?? listingEl.querySelector('li[class*="ListingDetails_listItem__"]');
        const fromLi = parseMonthYearToUtcMs(normalizeWhitespace(dateLi?.textContent));
        if (!Number.isNaN(fromLi)) return fromLi;

        const monthYearText = findFirstTextMatch(listingEl, 'li,span,div,p', /(\d{1,2})\s*\/\s*(\d{4})/);
        return parseMonthYearToUtcMs(monthYearText);
    };

    const findListingArticles = () => {
        const classBased = Array.from(document.querySelectorAll('article[class*="Listing_listing__"]'));
        if (classBased.length > 0) return classBased;

        // Fallback for markup changes: find articles that look like listing cards.
        const articles = Array.from(document.querySelectorAll('article'));
        return articles.filter((a) => a.querySelector('a[href*="/brugt/bil/"]'));
    };

    const scrapeOnce = () => {
        const listingArticles = findListingArticles();
        const cars = [];

        for (let i = 0; i < listingArticles.length; i++) {
            const listing = listingArticles[i];

            const title = extractTitle(listing);
            const price = extractPrice(listing);
            const year = extractYear(listing);
            const id = extractListingId(listing, i);

            if (!title || Number.isNaN(price) || Number.isNaN(year)) {
                continue;
            }

            cars.push({ id, title, year, price });
        }

        return cars;
    };

    // Bilbasen pages can be client-rendered; retry briefly if listings aren't in the DOM yet.
    const maxWaitMs = 3000;
    const intervalMs = 200;
    const start = Date.now();

    const respondWhenReady = () => {
        const cars = scrapeOnce();
        if (cars.length > 0 || Date.now() - start >= maxWaitMs) {
            console.log('cars', cars);
            sendResponse(cars);
            return;
        }

        setTimeout(respondWhenReady, intervalMs);
    };

    respondWhenReady();
}
