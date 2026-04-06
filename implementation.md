# Lead Gen Implementation Plan

## Goal

Build a local lead-generation system for a web/app development agency that:

1. Pulls business leads from Google Places.
2. Stores them in a local SQLite database via Drizzle ORM.
3. Enriches each business with website-based contact emails.
4. Supports review, filtering, export, and future outreach workflows.

The project should stay simple, local-first, and easy to extend.

---

## Current State

The project already has:

- Drizzle ORM schema and migration setup
- SQLite database using `better-sqlite3`
- Lead repository helpers in `db/leads.js`
- Google Places import script scaffold
- Crawl run tracking in the database

Current folders:

- `db/`
- `drizzle/`
- `google/`
- `scripts/`

---

## Target Architecture

### Data Flow

1. User runs a lead import command.
2. Google Places returns business records.
3. Business records are normalized and upserted into SQLite.
4. Website URLs are queued for enrichment.
5. Website pages are crawled.
6. Emails are extracted and stored in the `emails` table.
7. Leads are reviewed, filtered, and exported for outreach.

### Main Modules

- `db/schema.js`
  Drizzle schema definition

- `db/leads.js`
  Business, email, and crawl-run persistence helpers

- `google/places.js`
  Google Places Text Search client and response mapping

- `scripts/import-google-places.js`
  CLI entrypoint for lead import

- future `enrich/website-emails.js`
  Website crawling and email extraction

- future `scripts/enrich-emails.js`
  CLI entrypoint for enrichment

- future `scripts/export-leads.js`
  CSV/JSON export

---

## Database Plan

### Existing Tables

#### `businesses`

Stores one row per lead/business.

Key fields:

- `place_id`
- `name`
- `category`
- `phone`
- `website`
- `address`
- `city`
- `state`
- `country`
- `rating`
- `maps_url`
- `lead_status`
- `notes`

#### `emails`

Stores one or more emails per business.

Key fields:

- `business_id`
- `email`
- `source_url`
- `source_type`
- `confidence`
- `is_primary`

#### `crawl_runs`

Tracks import/enrichment jobs.

Key fields:

- `query`
- `location`
- `source`
- `status`
- `result_count`
- `error_message`

### Recommended Next Schema Changes

These are worth adding in later migrations:

#### Add `businesses.last_enriched_at`

Purpose:
Track when website/email enrichment was last attempted.

#### Add `businesses.enrichment_status`

Suggested values:

- `pending`
- `in_progress`
- `completed`
- `failed`
- `no_website`

#### Add `emails.is_verified`

Purpose:
Separate raw extracted emails from manually verified ones.

#### Add `emails.verification_notes`

Purpose:
Record why an email looks trustworthy or suspicious.

#### Optional `business_web_pages`

Purpose:
Store crawled page URLs and extraction metadata if enrichment gets more advanced.

---

## Phase Plan

## Phase 1: Stable Google Places Import

### Objective

Get reliable business leads into the database from Google Places.

### Tasks

1. Finalize `.env` usage for `GOOGLE_MAPS_API_KEY`.
2. Improve CLI argument handling in `scripts/import-google-places.js`.
3. Support:
   - `--query`
   - `--location`
   - `--max-results`
   - `--language`
4. Add stronger API error handling and response logging.
5. Store all imported businesses with `upsertBusiness`.
6. Mark crawl runs as `completed` or `failed`.

### Deliverable

A command like this should work:

```bash
npm run leads:import -- --query "web design agencies" --location "Austin" --max-results 20
```

### Success Criteria

- Businesses are stored correctly.
- Duplicate imports do not create duplicate business rows.
- Failed API calls are visible in `crawl_runs`.

---

## Phase 2: Website Email Enrichment

### Objective

Extract contact emails from each business website and store them in the `emails` table.

### Rules

Only crawl the business's own website.

Do not guess emails.

Do not scrape personal data from unrelated sites.

### Target Pages

For each website, try a small set of likely paths:

- `/`
- `/contact`
- `/contact-us`
- `/about`
- `/about-us`
- `/team`

### Extraction Strategy

1. Fetch page HTML.
2. Extract:
   - visible emails
   - `mailto:` links
3. Normalize to lowercase.
4. Filter obvious junk:
   - image filenames
   - tracking addresses
   - placeholders
5. Save via `addEmailToBusiness`.

### Recommended New Files

- `enrich/fetch-page.js`
- `enrich/extract-emails.js`
- `enrich/enrich-business.js`
- `scripts/enrich-emails.js`

### Deliverable

A command like:

```bash
npm run enrich:emails
```

### Success Criteria

- Businesses with websites get enrichment attempts.
- Emails are deduplicated.
- Source URLs are stored.
- Confidence values are assigned.

---

## Phase 3: Lead Review Workflow

### Objective

Make the DB practically usable for selecting outreach candidates.

### Add Lead Status Workflow

Suggested `lead_status` values:

- `new`
- `reviewed`
- `qualified`
- `contacted`
- `rejected`

### Needed Features

1. Add helper functions to update lead status.
2. Add filtering by:
   - city
   - category
   - has website
   - has email
   - lead status
3. Add a script to list leads for manual review.

### Recommended New Files

- `scripts/list-leads.js`
- `scripts/update-lead-status.js`

### Deliverable

Simple commands for:

- listing leads
- qualifying/rejecting leads

### Success Criteria

- You can review and classify leads without opening SQLite manually.

---

## Phase 4: Export for Outreach

### Objective

Export qualified leads into CSV or JSON for outreach and CRM usage.

### Export Fields

Recommended export columns:

- `name`
- `category`
- `website`
- `phone`
- `email`
- `city`
- `state`
- `country`
- `rating`
- `maps_url`
- `lead_status`

### Recommended New File

- `scripts/export-leads.js`

### Export Formats

- CSV for spreadsheets
- JSON for automation

### Success Criteria

- You can export only `qualified` or `reviewed` leads.
- Primary email is included when available.

---

## Phase 5: Quality and Safety Improvements

### Objective

Prevent the database from filling with weak or noisy leads.

### Quality Rules

1. Skip businesses with no name.
2. Prefer businesses with websites.
3. Flag leads with no website as lower priority.
4. Add heuristics for business relevance.

Examples:

- business category matches agency ICP
- city is in target market
- rating above threshold
- website exists

### Email Quality Rules

Give higher confidence to:

- `mailto:` emails
- emails found on `/contact`
- domain-matching addresses

Give lower confidence to:

- generic scraped strings
- unrelated domains
- suspicious throwaway addresses

### Optional Spam Filtering

Ignore addresses like:

- `example@example.com`
- `test@test.com`
- `noreply@...`

---

## Phase 6: Automation and Scheduling

### Objective

Run the pipeline repeatedly without manual effort.

### Options

1. Manual local CLI commands
2. Windows Task Scheduler
3. A single orchestrator script

### Suggested Orchestrator

Create:

- `scripts/run-pipeline.js`

This script can:

1. import Google leads
2. enrich emails
3. export qualified results

### Example Flow

```bash
npm run pipeline -- --query "software companies" --location "Dallas"
```

---

## Implementation Order

This is the recommended build order from here:

1. Finalize Google Places import script
2. Add website email extraction helpers
3. Add enrichment status fields
4. Create `enrich-emails` script
5. Add lead review scripts
6. Add export script
7. Add orchestrator script

---

## Concrete Next Tasks

### Task 1

Improve Google import script:

- stronger CLI parsing
- better output summary
- optional `--raw` debug mode

### Task 2

Create email extractor:

- regex extraction
- `mailto:` extraction
- normalization
- confidence scoring

### Task 3

Create enrichment runner:

- fetch businesses with website and no completed enrichment
- crawl target pages
- store emails
- update enrichment state

### Task 4

Create export script:

- export qualified leads
- choose CSV or JSON

---

## Suggested Commands To End Up With

```bash
npm run db:init
npm run leads:import -- --query "web design agencies" --location "Austin" --max-results 20
npm run enrich:emails
npm run leads:export -- --status qualified --format csv
```

---

## Risks and Notes

### Google API Cost

Google Places requests cost money, so:

- keep field masks tight
- cap results
- avoid unnecessary retries

### Website Crawling

Some sites will block bots or fail TLS checks.

The enrichment flow should:

- fail gracefully
- record failures
- continue with the next lead

### Data Cleanliness

Email extraction will always include some noise, so confidence scores and manual review matter.

---

## Definition of Done

The project will be in a strong usable state when:

1. Leads can be imported from Google Places.
2. Businesses are deduplicated in SQLite.
3. Emails can be extracted from websites.
4. Leads can be reviewed and status-updated.
5. Qualified leads can be exported cleanly.
6. The whole flow can be run from CLI commands locally.

---

## Immediate Recommendation

The best next implementation step is:

Build the website email enrichment module and `scripts/enrich-emails.js`.

That unlocks the actual business value of the lead DB, because imported businesses become contactable leads instead of just business listings.
