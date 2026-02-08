CREATE TABLE `insurers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`website` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `insurers_name_unique` ON `insurers` (`name`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`relation` text NOT NULL,
	`gender` text,
	`birth_date` text,
	`id_card` text,
	`phone` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_members`("id", "name", "relation", "gender", "birth_date", "id_card", "phone", "created_at", "updated_at") SELECT "id", "name", "relation", "gender", "birth_date", "id_card", "phone", "created_at", "updated_at" FROM `members`;--> statement-breakpoint
DROP TABLE `members`;--> statement-breakpoint
ALTER TABLE `__new_members` RENAME TO `members`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_policies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`applicant_id` integer NOT NULL,
	`insured_type` text NOT NULL,
	`insured_member_id` integer,
	`insured_asset_id` integer,
	`category` text NOT NULL,
	`sub_category` text,
	`insurer_id` integer,
	`insurer_name` text NOT NULL,
	`product_name` text NOT NULL,
	`policy_number` text NOT NULL,
	`channel` text,
	`sum_assured` real NOT NULL,
	`premium` real NOT NULL,
	`payment_frequency` text NOT NULL,
	`payment_years` integer,
	`total_payments` integer,
	`renewal_type` text,
	`payment_account` text,
	`next_due_date` text,
	`effective_date` text NOT NULL,
	`expiry_date` text,
	`hesitation_end_date` text,
	`waiting_days` integer,
	`status` text DEFAULT 'Active' NOT NULL,
	`death_benefit` text,
	`archived` integer DEFAULT false,
	`policy_file_path` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`applicant_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`insured_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`insured_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`insurer_id`) REFERENCES `insurers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_policies`("id", "applicant_id", "insured_type", "insured_member_id", "insured_asset_id", "category", "sub_category", "insurer_id", "insurer_name", "product_name", "policy_number", "channel", "sum_assured", "premium", "payment_frequency", "payment_years", "total_payments", "renewal_type", "payment_account", "next_due_date", "effective_date", "expiry_date", "hesitation_end_date", "waiting_days", "status", "death_benefit", "archived", "policy_file_path", "notes", "created_at", "updated_at") SELECT "id", "applicant_id", "insured_type", "insured_member_id", "insured_asset_id", "category", "sub_category", "insurer_id", "insurer_name", "product_name", "policy_number", "channel", "sum_assured", "premium", "payment_frequency", "payment_years", "total_payments", "renewal_type", "payment_account", "next_due_date", "effective_date", "expiry_date", "hesitation_end_date", "waiting_days", "status", "death_benefit", "archived", "policy_file_path", "notes", "created_at", "updated_at" FROM `policies`;--> statement-breakpoint
DROP TABLE `policies`;--> statement-breakpoint
ALTER TABLE `__new_policies` RENAME TO `policies`;--> statement-breakpoint
CREATE UNIQUE INDEX `policies_policy_number_unique` ON `policies` (`policy_number`);