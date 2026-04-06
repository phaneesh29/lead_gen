ALTER TABLE `businesses` ADD `enrichment_status` text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `businesses` ADD `last_enriched_at` text;--> statement-breakpoint
CREATE INDEX `idx_businesses_enrichment_status` ON `businesses` (`enrichment_status`);--> statement-breakpoint
ALTER TABLE `emails` ADD `is_verified` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `emails` ADD `verification_notes` text;