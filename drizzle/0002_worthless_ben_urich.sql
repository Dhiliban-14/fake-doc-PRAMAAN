ALTER TABLE `evidence` ADD `recordHash` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `timelineEvents` ADD `previousHash` varchar(64);--> statement-breakpoint
ALTER TABLE `timelineEvents` ADD `recordHash` varchar(64) NOT NULL;