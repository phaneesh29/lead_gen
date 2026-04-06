import {
  createCrawlRun,
  finishCrawlRun,
  listBusinessesForEnrichment,
} from "../db/leads.js";
import { enrichBusiness } from "../enrich/enrich-business.js";

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

function printUsage() {
  console.log(
    [
      "Usage:",
      "  npm run enrich:emails",
      "  npm run enrich:emails -- --limit 10",
      "  npm run enrich:emails -- --business-id 12 --raw",
      "",
      "Options:",
      "  --limit              Maximum businesses to process (default: 25)",
      "  --business-id        Enrich only one business id",
      "  --include-completed  Re-run businesses already marked completed",
      "  --raw                Include per-page fetch metadata",
    ].join("\n"),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  const limit = toInteger(args.limit, 25);
  const businessId = args["business-id"] ? Number(args["business-id"]) : null;
  const includeCompleted = Boolean(args["include-completed"]);
  const raw = Boolean(args.raw);

  const crawlRun = createCrawlRun({
    query: businessId ? `business:${businessId}` : "website_email_enrichment",
    location: "local",
    source: "website_enrichment",
  });

  try {
    const businesses = listBusinessesForEnrichment({
      limit,
      businessId,
      includeCompleted,
    });

    const results = [];

    for (const business of businesses) {
      const result = await enrichBusiness(business, { raw });
      results.push(result);
    }

    const completedRun = finishCrawlRun({
      crawlRunId: crawlRun.id,
      status: "completed",
      resultCount: results.length,
    });

    console.log(
      JSON.stringify(
        {
          crawlRun: completedRun,
          request: {
            limit,
            businessId,
            includeCompleted,
          },
          summary: {
            businessesProcessed: results.length,
            businessesCompleted: results.filter((result) => result.status === "completed").length,
            businessesFailed: results.filter((result) => result.status === "failed").length,
            emailsSaved: results.reduce((sum, result) => sum + result.emailsSaved, 0),
          },
          results,
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
