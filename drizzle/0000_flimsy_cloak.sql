CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`identifier` text NOT NULL,
	`owner_id` integer,
	`details` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `beneficiaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`policy_id` integer NOT NULL,
	`member_id` integer,
	`external_name` text,
	`external_id_card` text,
	`share_percent` real NOT NULL,
	`rank_order` integer NOT NULL,
	FOREIGN KEY (`policy_id`) REFERENCES `policies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cash_values` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`policy_id` integer NOT NULL,
	`policy_year` integer NOT NULL,
	`value` real NOT NULL,
	FOREIGN KEY (`policy_id`) REFERENCES `policies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`relation` text NOT NULL,
	`gender` text,
	`birth_date` text NOT NULL,
	`id_card` text,
	`phone` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`policy_id` integer NOT NULL,
	`period_number` integer NOT NULL,
	`due_date` text NOT NULL,
	`amount` real NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`paid_date` text,
	`paid_amount` real,
	FOREIGN KEY (`policy_id`) REFERENCES `policies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `policies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`applicant_id` integer NOT NULL,
	`insured_type` text NOT NULL,
	`insured_member_id` integer,
	`insured_asset_id` integer,
	`category` text NOT NULL,
	`insurer_name` text NOT NULL,
	`product_name` text NOT NULL,
	`policy_number` text NOT NULL,
	`sum_assured` real NOT NULL,
	`premium` real NOT NULL,
	`payment_frequency` text NOT NULL,
	`payment_years` integer NOT NULL,
	`total_payments` integer NOT NULL,
	`effective_date` text NOT NULL,
	`expiry_date` text,
	`hesitation_end_date` text,
	`waiting_days` integer,
	`status` text DEFAULT 'Active' NOT NULL,
	`policy_file_path` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`applicant_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`insured_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`insured_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `policies_policy_number_unique` ON `policies` (`policy_number`);--> statement-breakpoint
CREATE TABLE `policy_extensions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`policy_id` integer NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`policy_id`) REFERENCES `policies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `policy_extensions_policy_id_unique` ON `policy_extensions` (`policy_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
