console.log("Registering listener in content script");

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "getDetails") {
    getDetails(request, sender, sendResponse);
    // required to use sendResponse asynchronously
    return true;
  }
});

function getDetails(request, sender, sendResponse) {
  const normalizeWhitespace = (value) =>
    (value ?? "").replaceAll(/\s+/g, " ").trim();

  if (!location.pathname.startsWith("/car-search")) {
    sendResponse([]);
    return;
  }

  const extractCarDetailsIdFromHref = (href) => {
    if (!href) return Number.NaN;

    const fromPath = (path) => {
      const match = (path ?? "").match(/\/car-details\/(\d{5,})(?:[/?#]|$)/);
      if (!match) return Number.NaN;
      return Number.parseInt(match[1], 10);
    };

    try {
      const url = new URL(href, document.baseURI);
      const idFromUrl = fromPath(url.pathname);
      if (!Number.isNaN(idFromUrl)) return idFromUrl;
    } catch {
      // ignore and try raw string below
    }

    return fromPath(href);
  };

  const getAnchorLabel = (a) =>
    normalizeWhitespace(a.getAttribute("aria-label") || a.textContent);

  const extractTitleFromLabel = (label) => {
    const cleaned = normalizeWhitespace(label)
      .replace(/\s*,?\s*£\s*[\d,]+.*$/i, "")
      .replace(/\s*,\s*$/, "")
      .trim();

    if (!cleaned) return "";
    if (/^image\s+\d+/i.test(cleaned)) return "";
    return cleaned;
  };

  const parseFirstGbp = (text) => {
    const match = normalizeWhitespace(text).match(/£\s*([\d,]+)/);
    if (!match) return Number.NaN;
    return Number.parseInt(match[1].replaceAll(",", ""), 10);
  };

  const parseMaxGbp = (text) => {
    const matches = Array.from(normalizeWhitespace(text).matchAll(/£\s*([\d,]+)/g));
    const values = matches
      .map((m) => Number.parseInt(m[1].replaceAll(",", ""), 10))
      .filter((n) => Number.isFinite(n));

    if (values.length === 0) return Number.NaN;
    return Math.max(...values);
  };

  const plateYearToUtcMs = (plateYearText) => {
    const match = normalizeWhitespace(plateYearText).match(/\b(\d{2})\s*reg\b/i);
    if (!match) return Number.NaN;

    const reg = Number.parseInt(match[1], 10);
    if (!Number.isFinite(reg) || reg < 0 || reg > 99) return Number.NaN;

    const year = 2000 + (reg >= 50 ? reg - 50 : reg);
    // Use the mid-point of the possible reg window to reduce systematic skew.
    // - 21 reg => Mar–Aug 2021 => use Jun
    // - 71 reg => Sep 2021–Feb 2022 => use Nov (of base year)
    const monthIndex = reg >= 50 ? 10 : 5; // Nov : Jun
    return Date.UTC(year, monthIndex, 15, 12, 0, 0, 0);
  };

  const monthIndexForYearAndPlate = (displayYear, reg) => {
    if (!Number.isFinite(reg)) return 6; // Jul

    // Mar–Aug plates.
    if (reg < 50) {
      const baseYear = 2000 + reg;
      if (Number.isFinite(displayYear) && displayYear !== baseYear) return 6; // Jul
      return 5; // Jun (mid-window)
    }

    // Sep–Feb plates (crosses year boundary).
    const baseYear = 2000 + (reg - 50);
    if (Number.isFinite(displayYear)) {
      if (displayYear === baseYear) return 10; // Nov (mid-window in Sep–Dec)
      if (displayYear === baseYear + 1) return 0; // Jan (mid-window in Jan–Feb)
      return 6; // Jul (don't guess)
    }

    return 10; // Nov of base year
  };

  const parseYearRegToUtcMs = (text) => {
    const normalized = normalizeWhitespace(text);

    // Prefer the explicit pattern shown on cards: "2021 (21 reg)".
    const explicit = normalized.match(
      /\b((?:19|20)\d{2})\s*\(\s*(\d{2})\s*reg\s*\)/i
    );
    if (explicit) {
      const displayYear = Number.parseInt(explicit[1], 10);
      const reg = Number.parseInt(explicit[2], 10);
      if (!Number.isFinite(displayYear) || displayYear < 1900 || displayYear > 2100) {
        return Number.NaN;
      }
      if (!Number.isFinite(reg) || reg < 0 || reg > 99) return Number.NaN;

      const monthIndex = monthIndexForYearAndPlate(displayYear, reg);
      return Date.UTC(displayYear, monthIndex, 15, 12, 0, 0, 0);
    }

    const yearMatch = normalized.match(/\b(19|20)\d{2}\b/);
    const regMatch = normalized.match(/\b(\d{2})\s*reg\b/i);

    // If we have a 4-digit year, use it; optionally refine month using the reg code.
    if (yearMatch) {
      const displayYear = Number.parseInt(yearMatch[0], 10);
      if (!Number.isFinite(displayYear) || displayYear < 1900 || displayYear > 2100) {
        return Number.NaN;
      }

      let monthIndex = 6; // Jul
      if (regMatch) {
        const reg = Number.parseInt(regMatch[1], 10);
        if (Number.isFinite(reg) && reg >= 0 && reg <= 99) {
          monthIndex = monthIndexForYearAndPlate(displayYear, reg);
        }
      }

      return Date.UTC(displayYear, monthIndex, 15, 12, 0, 0, 0);
    }

    // Fallback: sometimes listings show only the 2-digit plate year (e.g. "69 reg").
    return plateYearToUtcMs(normalized);
  };

  const looksLikeListingText = (text) => {
    const t = normalizeWhitespace(text);
    return (
      /£\s*[\d,]+/.test(t) &&
      (/\b(19|20)\d{2}\b/.test(t) || /\b\d{2}\s*reg\b/i.test(t))
    );
  };

  const collectUniqueIdsIn = (rootEl, maxUnique = 2) => {
    const ids = new Set();
    const links = rootEl.querySelectorAll('a[href*="/car-details/"]');

    for (const link of links) {
      const id = extractCarDetailsIdFromHref(link.getAttribute("href"));
      if (Number.isNaN(id)) continue;

      ids.add(id);
      if (ids.size > maxUnique) break;
    }

    return ids;
  };

  const findListingContainerForId = (anchor, targetId) => {
    let el = anchor;

    for (let depth = 0; depth < 12 && el && el !== document.body; depth++) {
      const text = normalizeWhitespace(el.textContent);

      if (text && looksLikeListingText(text)) {
        const ids = collectUniqueIdsIn(el, 1);
        if (ids.size === 1 && ids.has(targetId)) return el;
      }

      el = el.parentElement;
    }

    return (
      anchor.closest("article") ||
      anchor.closest("li") ||
      anchor.parentElement ||
      document.body
    );
  };

  const scrapeOnce = () => {
    const searchRoot =
      document.querySelector('[data-testid="search"]') ||
      document.querySelector("main") ||
      document;

    const anchors = Array.from(
      searchRoot.querySelectorAll('a[href*="/car-details/"]')
    );
    const bestById = new Map();

    for (const anchor of anchors) {
      const id = extractCarDetailsIdFromHref(anchor.getAttribute("href"));
      if (Number.isNaN(id)) continue;

      const label = getAnchorLabel(anchor);
      const score =
        (label?.length ?? 0) +
        (label.includes("£") ? 50 : 0) -
        (/^image\s+\d+/i.test(label) ? 100 : 0);

      const prev = bestById.get(id);
      if (!prev || score > prev.score) {
        bestById.set(id, { anchor, label, score });
      }
    }

    const cars = [];

    for (const [id, info] of bestById.entries()) {
      const container = findListingContainerForId(info.anchor, id);
      const containerText = normalizeWhitespace(container.textContent);

      const title =
        extractTitleFromLabel(info.label) ||
        extractTitleFromLabel(
          normalizeWhitespace(container.querySelector("h2,h3")?.textContent)
        );

      const price =
        parseFirstGbp(info.label) ||
        parseFirstGbp(containerText) ||
        parseMaxGbp(containerText);

      const year = parseYearRegToUtcMs(containerText);

      if (!title || !Number.isFinite(price) || !Number.isFinite(year)) continue;

      cars.push({ id, title, year, price });
    }

    return cars;
  };

  // AutoTrader can be client-rendered; retry briefly if results aren't ready yet.
  const maxWaitMs = 15000;
  const pollIntervalMs = 500;
  const start = Date.now();

  let settled = false;
  let pollTimer = null;
  let maxTimer = null;
  let observer = null;
  let mutationDebounce = null;

  const cleanup = () => {
    if (observer) observer.disconnect();
    observer = null;

    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;

    if (maxTimer) clearTimeout(maxTimer);
    maxTimer = null;

    if (mutationDebounce) clearTimeout(mutationDebounce);
    mutationDebounce = null;
  };

  const settle = (cars) => {
    if (settled) return;
    settled = true;
    cleanup();
    console.log("cars", cars);
    sendResponse(cars);
  };

  const check = () => {
    if (settled) return;

    const cars = scrapeOnce();
    if (cars.length > 0) {
      settle(cars);
      return;
    }

    if (Date.now() - start >= maxWaitMs) {
      settle(cars);
      return;
    }

    if (!pollTimer) {
      pollTimer = setTimeout(() => {
        pollTimer = null;
        check();
      }, pollIntervalMs);
    }
  };

  observer = new MutationObserver(() => {
    if (settled) return;
    if (mutationDebounce) return;
    mutationDebounce = setTimeout(() => {
      mutationDebounce = null;
      check();
    }, 50);
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  maxTimer = setTimeout(() => {
    check();
  }, maxWaitMs);

  check();
}