CREATE TABLE `businesses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`place_id` text,
	`name` text NOT NULL,
	`category` text,
	`phone` text,
	`website` text,
	`address` text,
	`city` text,
	`state` text,
	`country` text,
	`rating` real,
	`maps_url` text,
	`lead_status` text DEFAULT 'new',
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `businesses_place_id_unique` ON `businesses` (`place_id`);--> statement-breakpoint
CREATE INDEX `idx_businesses_name` ON `businesses` (`name`);--> statement-breakpoint
CREATE INDEX `idx_businesses_city` ON `businesses` (`city`);--> statement-breakpoint
CREATE INDEX `idx_businesses_lead_status` ON `businesses` (`lead_status`);--> statement-breakpoint
CREATE TABLE `crawl_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`query` text NOT NULL,
	`location` text NOT NULL,
	`source` text DEFAULT 'google_places',
	`status` text DEFAULT 'pending',
	`result_count` integer DEFAULT 0,
	`error_message` text,
	`started_at` text DEFAULT CURRENT_TIMESTAMP,
	`finished_at` text
);
--> statement-breakpoint
CREATE TABLE `emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_id` integer NOT NULL,
	`email` text NOT NULL,
	`source_url` text,
	`source_type` text,
	`confidence` real DEFAULT 0.5,
	`is_primary` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emails_business_email_unique` ON `emails` (`business_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_emails_email` ON `emails` (`email`);--> statement-breakpoint
CREATE INDEX `idx_emails_business_id` ON `emails` (`business_id`);