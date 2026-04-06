import { createCrawlRun, finishCrawlRun, upsertBusiness } from "../db/leads.js";
import { mapPlaceToBusiness, searchAllPlaces } from "../google/places.js";

function parseArgs(argv) {
  const options = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const value = argv[i + 1];
    options[key] = value;
    i += 1;
  }

  return options;
}

function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const query = args.query;
  const location = args.location ?? "";
  const maxResults = toInteger(args["max-results"], 20);
  const languageCode = args.language ?? "en";

  if (!query) {
    throw new Error("Missing --query. Example: npm run leads:import -- --query \"web design agencies\" --location \"Austin\"");
  }

  const textQuery = location ? `${query} in ${location}` : query;
  const crawlRun = createCrawlRun({
    query,
    location: location || "global",
  });

  try {
    const places = await searchAllPlaces({
      textQuery,
      maxResults,
      languageCode,
    });

    const importedBusinesses = [];

    for (const place of places) {
      const businessInput = mapPlaceToBusiness(place);

      if (!businessInput.name || !businessInput.placeId) {
        continue;
      }

      const business = upsertBusiness(businessInput);
      importedBusinesses.push({
        id: business.id,
        placeId: business.placeId,
        name: business.name,
        website: business.website,
        city: business.city,
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
          importedCount: importedBusinesses.length,
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
