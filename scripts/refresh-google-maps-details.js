import { loadEnvFile } from "../lib/env.js";
import { listBusinesses, upsertBusiness } from "../db/leads.js";
import { scrapeGoogleMapsPlace } from "../google/maps.js";

loadEnvFile();

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

function needsPhoneRefresh(business) {
  return !business.phone || /^send to phone$/i.test(String(business.phone).trim());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const limit = toInteger(args.limit, 25);
  const headless = !args.headful;

  const candidates = listBusinesses({ limit: 1000 })
    .filter((business) => business.mapsUrl)
    .filter(needsPhoneRefresh)
    .slice(0, limit);

  const results = [];

  for (const business of candidates) {
    try {
      const refreshed = await scrapeGoogleMapsPlace({
        placeUrl: business.mapsUrl,
        headless,
      });

      const saved = upsertBusiness({
        ...business,
        ...refreshed,
      });

      results.push({
        id: saved.id,
        name: saved.name,
        phone: saved.phone,
        city: saved.city,
      });
    } catch (error) {
      results.push({
        id: business.id,
        name: business.name,
        error: error.message,
      });
    }
  }

  console.log(JSON.stringify({ processed: candidates.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
