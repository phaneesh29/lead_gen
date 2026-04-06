import { URL } from "node:url";
import puppeteer from "puppeteer";

const GOOGLE_HOST_PATTERN = /(^|\.)google\./i;
const DEFAULT_TIMEOUT_MS = 20000;
const SEARCH_SCROLL_DELAY_MS = 1200;
const SEARCH_SCROLL_ITERATIONS = 25;

function buildSearchTerm({ query, location }) {
  return location ? `${query} in ${location}` : query;
}

function buildSearchUrl({ query, location }) {
  const textQuery = buildSearchTerm({ query, location });
  return `https://www.google.com/maps/search/${encodeURIComponent(textQuery)}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function parseAddress(address) {
  const normalizedAddress = normalizeText(address);

  if (!normalizedAddress) {
    return {
      address: null,
      city: null,
      state: null,
      country: null,
    };
  }

  const parts = normalizedAddress.split(",").map((part) => part.trim()).filter(Boolean);
  const country = parts.length >= 1 ? parts.at(-1) : null;
  const city = parts.length >= 3 ? parts.at(-3) : parts.length >= 2 ? parts.at(-2) : null;
  const statePart = parts.length >= 2 ? parts.at(-2) : null;
  const stateMatch = statePart?.match(/([A-Za-z]{2,})(?:\s+\d{4,6})?$/);

  return {
    address: normalizedAddress,
    city,
    state: stateMatch ? stateMatch[1] : statePart,
    country,
  };
}

function extractPlaceId(placeUrl) {
  const normalizedUrl = normalizeText(placeUrl);

  if (!normalizedUrl) {
    return null;
  }

  const match = normalizedUrl.match(/!1s([^!]+)!/);
  return match ? match[1] : normalizedUrl;
}

function coerceRating(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number.parseFloat(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function pickWebsiteUrl(candidates) {
  for (const candidate of candidates ?? []) {
    const normalized = normalizeText(candidate);

    if (!normalized) {
      continue;
    }

    try {
      const url = new URL(normalized);

      if (GOOGLE_HOST_PATTERN.test(url.hostname)) {
        continue;
      }

      return url.toString();
    } catch {
      continue;
    }
  }

  return null;
}

function getLaunchOptions(headless) {
  const executablePath = normalizeText(process.env.PUPPETEER_EXECUTABLE_PATH);
  const options = { headless };

  if (executablePath) {
    options.executablePath = executablePath;
  }

  return options;
}

async function collectPlaceLinks(page, maxResults) {
  await page.waitForSelector('a[href*="/place/"]', { timeout: DEFAULT_TIMEOUT_MS });

  const collected = new Map();

  for (let index = 0; index < SEARCH_SCROLL_ITERATIONS && collected.size < maxResults; index += 1) {
    const batch = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/place/"]'));

      return links
        .map((link) => ({
          name: link.getAttribute("aria-label") || link.textContent || null,
          url: link.href || null,
        }))
        .filter((entry) => entry.url);
    });

    for (const entry of batch) {
      if (!collected.has(entry.url)) {
        collected.set(entry.url, {
          name: normalizeText(entry.name),
          url: entry.url,
        });
      }
    }

    if (collected.size >= maxResults) {
      break;
    }

    await page.evaluate(() => {
      const scroller = document.querySelector('div[role="feed"]')
        ?? Array.from(document.querySelectorAll("div")).find((element) => element.scrollHeight > element.clientHeight + 200);

      if (scroller) {
        scroller.scrollBy(0, Math.max(800, scroller.clientHeight));
      } else {
        window.scrollBy(0, window.innerHeight);
      }
    });

    await delay(SEARCH_SCROLL_DELAY_MS);
  }

  return Array.from(collected.values()).slice(0, maxResults);
}

async function scrapePlaceDetail(browser, placeLink) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1024 });

  try {
    await page.goto(placeLink.url, {
      waitUntil: "domcontentloaded",
      timeout: DEFAULT_TIMEOUT_MS,
    });

    await page.waitForSelector("h1", { timeout: DEFAULT_TIMEOUT_MS });
    await delay(1200);

    const detail = await page.evaluate(() => {
      function textContent(selector) {
        const element = document.querySelector(selector);
        return element ? element.textContent : null;
      }

      function firstButtonText(matchers) {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const button = buttons.find((element) => {
          const text = `${element.getAttribute("aria-label") || ""} ${element.textContent || ""}`.toLowerCase();
          return matchers.some((matcher) => text.includes(matcher));
        });

        return button ? button.getAttribute("aria-label") || button.textContent : null;
      }

      const websiteCandidates = Array.from(document.querySelectorAll('a[href^="http"]')).map((link) => link.href);
      const name = textContent("h1");
      const ratingLabel = Array.from(document.querySelectorAll('[role="img"]'))
        .map((element) => element.getAttribute("aria-label"))
        .find((label) => label && /stars?/i.test(label));

      return {
        name,
        category: textContent('button[jsaction*="category"]') || textContent('div[role="main"] button') || null,
        websiteCandidates,
        phone: firstButtonText(["phone", "call"]),
        address: firstButtonText(["address"]),
        ratingLabel,
        pageUrl: location.href,
      };
    });

    const addressBits = parseAddress(detail.address?.replace(/^Address:?\s*/i, ""));
    const phone = normalizeText(detail.phone?.replace(/^Phone:?\s*/i, ""));

    return {
      placeId: extractPlaceId(detail.pageUrl || placeLink.url),
      name: normalizeText(detail.name) ?? placeLink.name,
      category: normalizeText(detail.category),
      phone,
      website: pickWebsiteUrl(detail.websiteCandidates),
      address: addressBits.address,
      city: addressBits.city,
      state: addressBits.state,
      country: addressBits.country,
      rating: coerceRating(detail.ratingLabel),
      mapsUrl: normalizeText(detail.pageUrl || placeLink.url),
    };
  } finally {
    await page.close();
  }
}

export async function scrapeGoogleMapsLeads({
  query,
  location = "",
  maxResults = 20,
  headless = true,
  onProgress,
} = {}) {
  if (!normalizeText(query)) {
    throw new Error("Missing query for Google Maps scraping.");
  }

  const browser = await puppeteer.launch(getLaunchOptions(headless));

  try {
    const searchPage = await browser.newPage();
    await searchPage.setViewport({ width: 1440, height: 1024 });

    const searchUrl = buildSearchUrl({ query, location });
    await searchPage.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: DEFAULT_TIMEOUT_MS,
    });

    await delay(2500);

    const placeLinks = await collectPlaceLinks(searchPage, maxResults);
    await searchPage.close();

    const leads = [];

    for (let index = 0; index < placeLinks.length; index += 1) {
      const lead = await scrapePlaceDetail(browser, placeLinks[index]);
      leads.push(lead);

      if (typeof onProgress === "function") {
        onProgress({
          index: index + 1,
          total: placeLinks.length,
          lead,
        });
      }
    }

    return {
      searchUrl,
      collectedCount: placeLinks.length,
      leads,
    };
  } finally {
    await browser.close();
  }
}
