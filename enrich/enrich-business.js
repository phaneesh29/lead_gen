import {
  addEmailToBusiness,
  updateBusinessEnrichment,
} from "../db/leads.js";
import { extractEmailsFromHtml } from "./extract-emails.js";
import { buildCandidateUrls, fetchPage } from "./fetch-page.js";

function mergeEmail(existing, incoming) {
  if (!existing) {
    return incoming;
  }

  return {
    ...existing,
    confidence: Math.max(existing.confidence, incoming.confidence),
    sourceType: incoming.sourceType === "mailto" ? "mailto" : existing.sourceType,
    sourceUrl: existing.sourceUrl ?? incoming.sourceUrl,
  };
}

export async function enrichBusiness(business, { raw = false } = {}) {
  if (!business?.website) {
    updateBusinessEnrichment({
      businessId: business.id,
      status: "no_website",
    });

    return {
      businessId: business?.id ?? null,
      businessName: business?.name ?? null,
      status: "no_website",
      pagesAttempted: 0,
      pagesFetched: 0,
      emailsSaved: 0,
      emailsFound: [],
      pageResults: [],
    };
  }

  updateBusinessEnrichment({
    businessId: business.id,
    status: "in_progress",
  });

  const candidateUrls = buildCandidateUrls(business.website);
  const emailsByAddress = new Map();
  const pageResults = [];
  let pagesFetched = 0;
  let lastError = null;

  for (const url of candidateUrls) {
    const page = await fetchPage(url);

    if (!page.ok) {
      lastError = page.error;
      pageResults.push({
        url,
        ok: false,
        error: page.error,
        status: page.status ?? null,
      });
      continue;
    }

    pagesFetched += 1;
    const extracted = extractEmailsFromHtml({
      html: page.html,
      pageUrl: page.url,
      websiteUrl: business.website,
    });

    for (const emailEntry of extracted) {
      emailsByAddress.set(
        emailEntry.email,
        mergeEmail(emailsByAddress.get(emailEntry.email), emailEntry),
      );
    }

    pageResults.push({
      url: page.url,
      ok: true,
      emailCount: extracted.length,
    });
  }

  const emailsFound = Array.from(emailsByAddress.values()).sort(
    (left, right) => right.confidence - left.confidence,
  );

  emailsFound.forEach((entry, index) => {
    addEmailToBusiness({
      businessId: business.id,
      email: entry.email,
      sourceUrl: entry.sourceUrl,
      sourceType: entry.sourceType,
      confidence: entry.confidence,
      isPrimary: index === 0,
    });
  });

  const status = pagesFetched === 0 ? "failed" : "completed";
  updateBusinessEnrichment({
    businessId: business.id,
    status,
  });

  return {
    businessId: business.id,
    businessName: business.name,
    status,
    pagesAttempted: candidateUrls.length,
    pagesFetched,
    emailsSaved: emailsFound.length,
    emailsFound,
    pageResults: raw ? pageResults : undefined,
    error: pagesFetched === 0 ? lastError : null,
  };
}
