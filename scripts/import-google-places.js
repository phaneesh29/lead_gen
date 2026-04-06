import { loadEnvFile } from "../lib/env.js";
import { createCrawlRun, finishCrawlRun, upsertBusiness } from "../db/leads.js";
import { scrapeGoogleMapsLeads } from "../google/maps.js";

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

function toBoolean(value, fallback = false) {
  if (value === true) {
    return true;
  }

  if (value === false || value === undefined || value === null) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["1", "true", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "n"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function printUsage() {
  console.log(
    [
      "Usage:",
      '  npm run leads:import -- --query "web design agencies" --location "Austin" --max-results 20',
      "",
      "Options:",
      "  --query         Required search phrase",
      "  --location      Optional location appended to the search",
      "  --max-results   Max number of business detail pages to scrape (default: 20)",
      "  --headful       Launch Chrome visibly instead of headless",
      "  --raw           Include scrape progress data in the output",
      "",
      "Notes:",
      "  This importer scrapes Google Maps with Puppeteer instead of using the Places API.",
      "  Install the `puppeteer` package before running it.",
    ].join("\n"),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  const query = typeof args.query === "string" ? args.query.trim() : "";
  const location = typeof args.location === "string" ? args.location.trim() : "";
  const maxResults = toInteger(args["max-results"], 20);
  const raw = Boolean(args.raw);
  const headless = !toBoolean(args.headful, false);

  if (!query) {
    throw new Error("Missing --query. Run with --help for an example.");
  }

  const crawlRun = createCrawlRun({
    query,
    location: location || "global",
    source: "google_maps_scrape",
  });

  try {
    const progress = [];
    const result = await scrapeGoogleMapsLeads({
      query,
      location,
      maxResults,
      headless,
      onProgress: (entry) => {
        if (raw) {
          progress.push(entry);
        }
      },
    });

    const importedBusinesses = [];
    let skippedCount = 0;

    for (const businessInput of result.leads) {
      if (!businessInput.name || !businessInput.placeId) {
        skippedCount += 1;
        continue;
      }

      const business = upsertBusiness(businessInput);
      importedBusinesses.push({
        id: business.id,
        placeId: business.placeId,
        name: business.name,
        website: business.website,
        city: business.city,
        enrichmentStatus: business.enrichmentStatus,
      });
    }

    const completedRun = finishCrawlRun({
      crawlRunId: crawlRun.id,
      status: "completed",
      resultCount: importedBusinesses.length,
    });

    console.log(
      JSON.stringify(
        {
          crawlRun: completedRun,
          request: {
            query,
            location,
            maxResults,
            headless,
          },
          summary: {
            collectedCount: result.collectedCount,
            importedCount: importedBusinesses.length,
            skippedCount,
          },
          searchUrl: result.searchUrl,
          progress: raw ? progress : undefined,
          businesses: importedBusinesses,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    finishCrawlRun({
      crawlRunId: crawlRun.id,
      status: "failed",
      errorMessage: error.message,
    });

    throw error;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
