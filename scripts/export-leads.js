import fs from "node:fs";
import path from "node:path";
import { getDbPath } from "../db/index.js";
import { listBusinessDetails } from "../db/leads.js";

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function cleanPhone(value) {
  const normalized = normalizeText(value);
  if (!normalized || /^send to phone$/i.test(normalized)) {
    return null;
  }
  return normalized;
}

function buildLeadRecord(business) {
  const primaryEmail = business.emails.find((email) => email.isPrimary) ?? business.emails[0] ?? null;
  const hasOwnWebsite = business.website && !/wa\.me|wa\.link|practo\.com|fresha\.com|cult\.fit/i.test(business.website);
  const qualityFlags = [];
  const phone = cleanPhone(business.phone);

  if (!business.website) {
    qualityFlags.push("no_website");
  }

  if (business.website && !hasOwnWebsite) {
    qualityFlags.push("third_party_website");
  }

  if (!primaryEmail) {
    qualityFlags.push("no_email");
  }

  if (!phone) {
    qualityFlags.push("no_phone");
  }

  return {
    id: business.id,
    placeId: business.placeId,
    name: business.name,
    category: business.category,
    phone,
    website: business.website,
    address: business.address,
    city: business.city,
    state: business.state,
    country: business.country,
    rating: business.rating,
    mapsUrl: business.mapsUrl,
    leadStatus: business.leadStatus,
    enrichmentStatus: business.enrichmentStatus,
    lastEnrichedAt: business.lastEnrichedAt,
    notes: business.notes,
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
    primaryEmail,
    emails: business.emails,
    hasOwnWebsite,
    qualityFlags,
  };
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  npm run leads:export -- --format json",
      "",
      "Options:",
      "  --format             Only json is supported right now",
      "  --limit              Max businesses to export (default: 250)",
      "  --city               Filter by city",
      "  --status             Filter by lead status",
      "  --enrichment-status  Filter by enrichment status",
      "  --output             Output JSON path",
    ].join("\n"),
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  const format = normalizeText(args.format) ?? "json";

  if (format !== "json") {
    throw new Error("Only --format json is currently supported.");
  }

  const limit = toInteger(args.limit, 250);
  const city = normalizeText(args.city);
  const leadStatus = normalizeText(args.status);
  const enrichmentStatus = normalizeText(args["enrichment-status"]);
  const outputPath = path.resolve(
    process.cwd(),
    normalizeText(args.output) ?? "data/exports/leads.json",
  );

  ensureDir(path.dirname(outputPath));

  const businesses = listBusinessDetails({
    city,
    leadStatus,
    enrichmentStatus,
    limit,
  });

  const leads = businesses.map(buildLeadRecord);
  const payload = {
    generatedAt: new Date().toISOString(),
    databasePath: getDbPath(),
    filters: {
      city,
      leadStatus,
      enrichmentStatus,
      limit,
    },
    summary: {
      totalLeads: leads.length,
      withWebsite: leads.filter((lead) => Boolean(lead.website)).length,
      withOwnWebsite: leads.filter((lead) => lead.hasOwnWebsite).length,
      withEmail: leads.filter((lead) => Boolean(lead.primaryEmail)).length,
      withPhone: leads.filter((lead) => Boolean(lead.phone)).length,
    },
    leads,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        outputPath,
        summary: payload.summary,
      },
      null,
      2,
    ),
  );
}

main();
