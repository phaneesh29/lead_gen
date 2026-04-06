const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MAILTO_PATTERN = /mailto:([^"'\s?#>]+)/gi;
const BLOCKED_EXACT = new Set([
  "example@example.com",
  "test@test.com",
  "noreply@example.com",
]);
const BLOCKED_LOCAL_PARTS = new Set([
  "example",
  "test",
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
]);
const BLOCKED_DOMAIN_PARTS = ["example.", "invalid", "localhost"];
const FILE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|svg|webp|avif|css|js)$/i;

function normalizeEmail(email) {
  return email
    .trim()
    .toLowerCase()
    .replace(/^[<(\[{\s]+/, "")
    .replace(/[>)}\],;:.\s]+$/, "");
}

function normalizeHost(hostname) {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

function getRootDomain(hostname) {
  const parts = normalizeHost(hostname).split(".");
  return parts.slice(-2).join(".");
}

function isJunkEmail(email) {
  if (!email || !email.includes("@")) {
    return true;
  }

  if (BLOCKED_EXACT.has(email)) {
    return true;
  }

  if (FILE_EXTENSION_PATTERN.test(email)) {
    return true;
  }

  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return true;
  }

  if (BLOCKED_LOCAL_PARTS.has(localPart)) {
    return true;
  }

  if (BLOCKED_DOMAIN_PARTS.some((part) => domain.includes(part))) {
    return true;
  }

  return false;
}

function domainFromEmail(email) {
  return email.split("@")[1] ?? "";
}

function scoreEmail({ email, sourceType, pageUrl, websiteUrl }) {
  let score = sourceType === "mailto" ? 0.8 : 0.6;

  try {
    const page = new URL(pageUrl);
    const website = new URL(websiteUrl);
    const pagePath = page.pathname.toLowerCase();

    if (pagePath === "/contact" || pagePath === "/contact-us") {
      score += 0.1;
    }

    if (pagePath === "/" || pagePath.startsWith("/about") || pagePath === "/team") {
      score += 0.05;
    }

    if (getRootDomain(domainFromEmail(email)) === getRootDomain(website.hostname)) {
      score += 0.1;
    } else {
      score -= 0.1;
    }
  } catch {
    score -= 0.05;
  }

  if (/^(hello|info|contact|support|sales|team)@/i.test(email)) {
    score += 0.03;
  }

  return Math.max(0.1, Math.min(0.99, Number(score.toFixed(2))));
}

function collectMatches(pattern, content) {
  return Array.from(content.matchAll(pattern), (match) => match[0]);
}

function collectMailtoMatches(content) {
  return Array.from(content.matchAll(MAILTO_PATTERN), (match) => match[1]);
}

function decodeMailtoValue(candidate) {
  try {
    return decodeURIComponent(candidate.split("?")[0]);
  } catch {
    return candidate.split("?")[0];
  }
}

export function extractEmailsFromHtml({ html, pageUrl, websiteUrl }) {
  const found = new Map();

  for (const candidate of collectMatches(EMAIL_PATTERN, html)) {
    const email = normalizeEmail(candidate);

    if (isJunkEmail(email)) {
      continue;
    }

    found.set(email, {
      email,
      sourceType: "visible_text",
      sourceUrl: pageUrl,
      confidence: scoreEmail({
        email,
        sourceType: "visible_text",
        pageUrl,
        websiteUrl,
      }),
    });
  }

  for (const candidate of collectMailtoMatches(html)) {
    const email = normalizeEmail(decodeMailtoValue(candidate));

    if (isJunkEmail(email)) {
      continue;
    }

    const confidence = scoreEmail({
      email,
      sourceType: "mailto",
      pageUrl,
      websiteUrl,
    });
    const existing = found.get(email);

    found.set(email, {
      email,
      sourceType: "mailto",
      sourceUrl: pageUrl,
      confidence: existing ? Math.max(existing.confidence, confidence) : confidence,
    });
  }

  return Array.from(found.values()).sort((left, right) => right.confidence - left.confidence);
}
