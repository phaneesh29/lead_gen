const DEFAULT_PATHS = ["/", "/contact", "/contact-us", "/about", "/about-us", "/team"];
const DEFAULT_TIMEOUT_MS = 10000;

function withProtocol(url) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `https://${url}`;
}

function normalizeHost(hostname) {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

function isAllowedHost(candidateUrl, rootUrl) {
  return normalizeHost(candidateUrl.hostname) === normalizeHost(rootUrl.hostname);
}

export function normalizeWebsiteUrl(website) {
  try {
    return new URL(withProtocol(String(website).trim()));
  } catch {
    return null;
  }
}

export function buildCandidateUrls(website, paths = DEFAULT_PATHS) {
  const rootUrl = normalizeWebsiteUrl(website);

  if (!rootUrl) {
    return [];
  }

  const seen = new Set();
  const candidates = [];

  for (const pathname of paths) {
    const candidate = new URL(pathname, rootUrl);

    if (!isAllowedHost(candidate, rootUrl)) {
      continue;
    }

    const key = candidate.toString();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    candidates.push(candidate.toString());
  }

  return candidates;
}

export async function fetchPage(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const rootUrl = normalizeWebsiteUrl(url);

  if (!rootUrl) {
    return {
      ok: false,
      url,
      error: "Invalid URL.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(rootUrl, {
      headers: {
        "Accept": "text/html,application/xhtml+xml",
        "User-Agent": "lead-gen-bot/1.0 (+local enrichment)",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    const finalUrl = new URL(response.url);

    if (!isAllowedHost(finalUrl, rootUrl)) {
      return {
        ok: false,
        url: response.url,
        status: response.status,
        error: `Redirected to a different host: ${finalUrl.hostname}`,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        url: response.url,
        status: response.status,
        error: `HTTP ${response.status}`,
      };
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes("text/html")) {
      return {
        ok: false,
        url: response.url,
        status: response.status,
        error: `Unsupported content type: ${contentType || "unknown"}`,
      };
    }

    const html = await response.text();

    return {
      ok: true,
      url: response.url,
      status: response.status,
      contentType,
      html,
    };
  } catch (error) {
    const message = error?.name === "AbortError" ? "Request timed out" : error.message;

    return {
      ok: false,
      url: rootUrl.toString(),
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}
