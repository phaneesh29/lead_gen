import { and, desc, eq, sql } from "drizzle-orm";
import { getOrm } from "./index.js";
import { businesses, crawlRuns, emails } from "./schema.js";

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function toBusinessValues(input) {
  return {
    placeId: normalizeText(input.placeId),
    name: normalizeText(input.name),
    category: normalizeText(input.category),
    phone: normalizeText(input.phone),
    website: normalizeText(input.website),
    address: normalizeText(input.address),
    city: normalizeText(input.city),
    state: normalizeText(input.state),
    country: normalizeText(input.country),
    rating: input.rating ?? null,
    mapsUrl: normalizeText(input.mapsUrl),
    leadStatus: normalizeText(input.leadStatus) ?? "new",
    notes: normalizeText(input.notes),
  };
}

export function createBusiness(input) {
  const db = getOrm();
  const values = toBusinessValues(input);

  const result = db.insert(businesses).values(values).returning().get();
  return result;
}

export function upsertBusiness(input) {
  const db = getOrm();
  const values = toBusinessValues(input);

  db.insert(businesses)
    .values(values)
    .onConflictDoUpdate({
      target: businesses.placeId,
      set: {
        name: values.name,
        category: sql`coalesce(excluded.category, ${businesses.category})`,
        phone: sql`coalesce(excluded.phone, ${businesses.phone})`,
        website: sql`coalesce(excluded.website, ${businesses.website})`,
        address: sql`coalesce(excluded.address, ${businesses.address})`,
        city: sql`coalesce(excluded.city, ${businesses.city})`,
        state: sql`coalesce(excluded.state, ${businesses.state})`,
        country: sql`coalesce(excluded.country, ${businesses.country})`,
        rating: sql`coalesce(excluded.rating, ${businesses.rating})`,
        mapsUrl: sql`coalesce(excluded.maps_url, ${businesses.mapsUrl})`,
        leadStatus: sql`coalesce(excluded.lead_status, ${businesses.leadStatus})`,
        notes: sql`coalesce(excluded.notes, ${businesses.notes})`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    })
    .run();

  return db
    .select()
    .from(businesses)
    .where(eq(businesses.placeId, values.placeId))
    .get();
}

export function addEmailToBusiness({
  businessId,
  email,
  sourceUrl = null,
  sourceType = "website",
  confidence = 0.5,
  isPrimary = false,
}) {
  const db = getOrm();
  const normalizedEmail = normalizeEmail(email);

  db.insert(emails)
    .values({
      businessId,
      email: normalizedEmail,
      sourceUrl: normalizeText(sourceUrl),
      sourceType: normalizeText(sourceType),
      confidence,
      isPrimary,
    })
    .onConflictDoUpdate({
      target: [emails.businessId, emails.email],
      set: {
        sourceUrl: sql`coalesce(excluded.source_url, ${emails.sourceUrl})`,
        sourceType: sql`coalesce(excluded.source_type, ${emails.sourceType})`,
        confidence: sql`max(${emails.confidence}, excluded.confidence)`,
        isPrimary: sql`case when excluded.is_primary = 1 then 1 else ${emails.isPrimary} end`,
      },
    })
    .run();

  return db
    .select()
    .from(emails)
    .where(and(eq(emails.businessId, businessId), eq(emails.email, normalizedEmail)))
    .get();
}

export function createCrawlRun({
  query,
  location,
  source = "google_places",
  status = "pending",
}) {
  const db = getOrm();

  const result = db
    .insert(crawlRuns)
    .values({
      query: normalizeText(query),
      location: normalizeText(location),
      source: normalizeText(source) ?? "google_places",
      status: normalizeText(status) ?? "pending",
    })
    .returning()
    .get();

  return result;
}

export function finishCrawlRun({
  crawlRunId,
  status = "completed",
  resultCount = 0,
  errorMessage = null,
}) {
  const db = getOrm();

  db.update(crawlRuns)
    .set({
      status: normalizeText(status) ?? "completed",
      resultCount,
      errorMessage: normalizeText(errorMessage),
      finishedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(crawlRuns.id, crawlRunId))
    .run();

  return db.select().from(crawlRuns).where(eq(crawlRuns.id, crawlRunId)).get();
}

export function getBusinessByPlaceId(placeId) {
  const db = getOrm();
  return db
    .select()
    .from(businesses)
    .where(eq(businesses.placeId, normalizeText(placeId)))
    .get();
}

export function listBusinesses({ city = null, leadStatus = null, limit = 50 } = {}) {
  const db = getOrm();
  const conditions = [];

  if (normalizeText(city)) {
    conditions.push(eq(businesses.city, normalizeText(city)));
  }

  if (normalizeText(leadStatus)) {
    conditions.push(eq(businesses.leadStatus, normalizeText(leadStatus)));
  }

  const query = db
    .select()
    .from(businesses)
    .orderBy(desc(businesses.createdAt), desc(businesses.id))
    .limit(limit);

  if (conditions.length > 0) {
    return query.where(and(...conditions)).all();
  }

  return query.all();
}

export function getBusinessDetails(businessId) {
  const db = getOrm();
  const business = db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .get();

  if (!business) {
    return null;
  }

  const businessEmails = db
    .select()
    .from(emails)
    .where(eq(emails.businessId, businessId))
    .orderBy(desc(emails.isPrimary), desc(emails.confidence), emails.id)
    .all();

  return {
    ...business,
    emails: businessEmails,
  };
}
