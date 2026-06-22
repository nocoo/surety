-- Custom SQL migration file, put your code below! -----
ALTER TABLE `policies` ADD COLUMN `terminated_at` TEXT;--> statement-breakpoint
ALTER TABLE `policies` ADD COLUMN `termination_reason` TEXT;--> statement-breakpoint
ALTER TABLE `policies` ADD COLUMN `planned_surrender_at` TEXT;--> statement-breakpoint
ALTER TABLE `policies` ADD COLUMN `planned_surrender_note` TEXT;
