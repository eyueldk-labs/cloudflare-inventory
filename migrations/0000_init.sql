CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `field_edit` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`target_code` text DEFAULT '' NOT NULL,
	`target_name` text NOT NULL,
	`field` text NOT NULL,
	`old_value` text NOT NULL,
	`new_value` text NOT NULL,
	`by_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `field_edit_target_idx` ON `field_edit` (`target_id`);--> statement-breakpoint
CREATE INDEX `field_edit_org_idx` ON `field_edit` (`org_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `input` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`on_hand` integer DEFAULT 0 NOT NULL,
	`unit_cost` integer DEFAULT 0 NOT NULL,
	`low_level` integer,
	`archived` integer DEFAULT false NOT NULL,
	`archive_reason` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "input_on_hand_ok" CHECK("input"."on_hand" >= 0),
	CONSTRAINT "input_cost_ok" CHECK("input"."unit_cost" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `input_code_uq` ON `input` (`org_id`,`code`);--> statement-breakpoint
CREATE TABLE `input_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`input_id` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`unit_cost` integer,
	`note` text DEFAULT '' NOT NULL,
	`by_name` text NOT NULL,
	`product_entry_id` text,
	`corrects_id` text,
	`voided_at` integer,
	`void_reason` text DEFAULT '' NOT NULL,
	`void_by_name` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`input_id`) REFERENCES `input`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `input_entry_input_idx` ON `input_entry` (`input_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `input_entry_org_date_idx` ON `input_entry` (`org_id`,`date`);--> statement-breakpoint
CREATE INDEX `input_entry_production_idx` ON `input_entry` (`product_entry_id`);--> statement-breakpoint
CREATE TABLE `invite` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`org_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invite_token_hash_unique` ON `invite` (`token_hash`);--> statement-breakpoint
CREATE INDEX `invite_org_idx` ON `invite` (`org_id`);--> statement-breakpoint
CREATE TABLE `member` (
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`org_id`, `user_id`),
	FOREIGN KEY (`org_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_user_idx` ON `member` (`user_id`);--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text NOT NULL,
	`color` text NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`contact_email` text DEFAULT '' NOT NULL,
	`contact_phone` text DEFAULT '' NOT NULL,
	`invoice_address` text DEFAULT '' NOT NULL,
	`mat_seq` integer DEFAULT 0 NOT NULL,
	`pak_seq` integer DEFAULT 0 NOT NULL,
	`pro_seq` integer DEFAULT 0 NOT NULL,
	`sal_seq` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pricing_scheme` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pricing_scheme_name_uq` ON `pricing_scheme` (`org_id`,lower("name"));--> statement-breakpoint
CREATE TABLE `product` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`on_hand` integer DEFAULT 0 NOT NULL,
	`low_level` integer,
	`default_scheme_id` text NOT NULL,
	`prices` text NOT NULL,
	`version_id` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archive_reason` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "product_on_hand_ok" CHECK("product"."on_hand" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_code_uq` ON `product` (`org_id`,`code`);--> statement-breakpoint
CREATE TABLE `product_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`product_id` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`units` integer NOT NULL,
	`version_id` text,
	`sale_id` text,
	`note` text DEFAULT '' NOT NULL,
	`by_name` text NOT NULL,
	`corrects_id` text,
	`voided_at` integer,
	`void_reason` text DEFAULT '' NOT NULL,
	`void_by_name` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `product_entry_product_idx` ON `product_entry` (`product_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `product_entry_org_date_idx` ON `product_entry` (`org_id`,`date`);--> statement-breakpoint
CREATE INDEX `product_entry_sale_idx` ON `product_entry` (`sale_id`);--> statement-breakpoint
CREATE TABLE `product_version` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`product_id` text NOT NULL,
	`version` integer NOT NULL,
	`lines` text NOT NULL,
	`additional_cost` integer DEFAULT 0 NOT NULL,
	`by_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `product_version_product_idx` ON `product_version` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_version_org_idx` ON `product_version` (`org_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limit` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limit_key_unique` ON `rate_limit` (`key`);--> statement-breakpoint
CREATE TABLE `sale` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`code` text NOT NULL,
	`date` text NOT NULL,
	`buyer_note` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`lines` text NOT NULL,
	`total` integer NOT NULL,
	`cost` integer NOT NULL,
	`qty` integer NOT NULL,
	`by_name` text NOT NULL,
	`corrects_id` text,
	`voided_at` integer,
	`void_reason` text DEFAULT '' NOT NULL,
	`void_by_name` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sale_code_uq` ON `sale` (`org_id`,`code`);--> statement-breakpoint
CREATE INDEX `sale_org_date_idx` ON `sale` (`org_id`,`date`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `void_lock` (
	`id` text PRIMARY KEY NOT NULL
);
