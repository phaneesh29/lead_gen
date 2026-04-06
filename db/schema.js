import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const businesses = sqliteTable(
  "businesses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    placeId: text("place_id").unique(),
    name: text("name").notNull(),
    category: text("category"),
    phone: text("phone"),
    website: text("website"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    country: text("country"),
    rating: real("rating"),
    mapsUrl: text("maps_url"),
    leadStatus: text("lead_status").default("new"),
    notes: text("notes"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    nameIndex: index("idx_businesses_name").on(table.name),
    cityIndex: index("idx_businesses_city").on(table.city),
    leadStatusIndex: index("idx_businesses_lead_status").on(table.leadStatus),
  }),
);

export const emails = sqliteTable(
  "emails",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    businessId: integer("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    sourceUrl: text("source_url"),
    sourceType: text("source_type"),
    confidence: real("confidence").default(0.5),
    isPrimary: integer("is_primary", { mode: "boolean" }).default(false),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    businessEmailUnique: uniqueIndex("emails_business_email_unique").on(
      table.businessId,
      table.email,
    ),
    emailIndex: index("idx_emails_email").on(table.email),
    businessIdIndex: index("idx_emails_business_id").on(table.businessId),
  }),
);

export const crawlRuns = sqliteTable("crawl_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  query: text("query").notNull(),
  location: text("location").notNull(),
  source: text("source").default("google_places"),
  status: text("status").default("pending"),
  resultCount: integer("result_count").default(0),
  errorMessage: text("error_message"),
  startedAt: text("started_at").default(sql`CURRENT_TIMESTAMP`),
  finishedAt: text("finished_at"),
});
