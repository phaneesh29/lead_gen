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

function getDefaultEnrichmentStatus(website, enrichmentStatus) {
  if (normalizeText(enrichmentStatus)) {
    return normalizeText(enrichmentStatus);
  }

  return normalizeText(website) ? "pending" : "no_website";
}

function toBusinessValues(input) {
  const website = normalizeText(input.website);

  return {
    placeId: normalizeText(input.placeId),
    name: normalizeText(input.name),
    category: normalizeText(input.category),
    phone: normalizeText(input.phone),
    website,
    address: normalizeText(input.address),
    city: normalizeText(input.city),
    state: normalizeText(input.state),
    country: normalizeText(input.country),
    rating: input.rating ?? null,
    mapsUrl: normalizeText(input.mapsUrl),
    leadStatus: normalizeText(input.leadStatus) ?? "new",
    enrichmentStatus: getDefaultEnrichmentStatus(website, input.enrichmentStatus),
    lastEnrichedAt: normalizeText(input.lastEnrichedAt),
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
        enrichmentStatus: sql`
          case
            when coalesce(excluded.website, ${businesses.website}) is null then 'no_website'
            when ${businesses.enrichmentStatus} is null then coalesce(excluded.enrichment_status, 'pending')
            when ${businesses.enrichmentStatus} = 'no_website' and excluded.website is not null then 'pending'
            else ${businesses.enrichmentStatus}
          end
        `,
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
  isVerified = false,
  verificationNotes = null,
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
      isVerified,
      verificationNotes: normalizeText(verificationNotes),
    })
    .onConflictDoUpdate({
      target: [emails.businessId, emails.email],
      set: {
        sourceUrl: sql`coalesce(excluded.source_url, ${emails.sourceUrl})`,
        sourceType: sql`coalesce(excluded.source_type, ${emails.sourceType})`,
        confidence: sql`max(${emails.confidence}, excluded.confidence)`,
        isPrimary: sql`case when excluded.is_primary = 1 then 1 else ${emails.isPrimary} end`,
        isVerified: sql`case when excluded.is_verified = 1 then 1 else ${emails.isVerified} end`,
        verificationNotes: sql`coalesce(excluded.verification_notes, ${emails.verificationNotes})`,
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

export function getBusinessById(businessId) {
  const db = getOrm();
  return db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
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

export function listBusinessesForEnrichment({
  limit = 25,
  businessId = null,
  includeCompleted = false,
} = {}) {
  const db = getOrm();
  const normalizedBusinessId = businessId ? Number(businessId) : null;
  const normalizedLimit = Math.max(1, Number(limit) || 25);

  if (normalizedBusinessId) {
    return db
      .select()
      .from(businesses)
      .where(eq(businesses.id, normalizedBusinessId))
      .limit(1)
      .all();
  }

  const conditions = [sql`${businesses.website} is not null`, sql`trim(${businesses.website}) != ''`];

  if (!includeCompleted) {
    conditions.push(
      sql`${businesses.enrichmentStatus} is null or ${businesses.enrichmentStatus} in ('pending', 'failed')`,
    );
  }

  return db
    .select()
    .from(businesses)
    .where(and(...conditions))
    .orderBy(desc(businesses.updatedAt), desc(businesses.id))
    .limit(normalizedLimit)
    .all();
}

export function updateBusinessEnrichment({
  businessId,
  status,
  lastEnrichedAt = new Date().toISOString(),
}) {
  const db = getOrm();

  db.update(businesses)
    .set({
      enrichmentStatus: normalizeText(status),
      lastEnrichedAt: normalizeText(lastEnrichedAt),
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(businesses.id, businessId))
    .run();

  return getBusinessById(businessId);
}

export function updateLeadStatus({ businessId, leadStatus }) {
  const db = getOrm();

  db.update(businesses)
    .set({
      leadStatus: normalizeText(leadStatus),
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(businesses.id, businessId))
    .run();

  return getBusinessById(businessId);
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

export function listBusinessDetails({
  city = null,
  leadStatus = null,
  enrichmentStatus = null,
  limit = 250,
} = {}) {
  const rows = listBusinesses({ city, leadStatus, limit });

  return rows
    .map((business) => getBusinessDetails(business.id))
    .filter((business) => {
      if (!business) {
        return false;
      }

      if (normalizeText(enrichmentStatus)) {
        return business.enrichmentStatus === normalizeText(enrichmentStatus);
      }

      return true;
    });
}
