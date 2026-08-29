CREATE TABLE `caseNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`authorId` int,
	`note` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `caseNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` varchar(32) NOT NULL,
	`title` varchar(255) NOT NULL,
	`status` enum('open','in_review','closed') NOT NULL DEFAULT 'open',
	`riskLevel` enum('low','medium','high','inconclusive') NOT NULL DEFAULT 'inconclusive',
	`riskScore` int NOT NULL DEFAULT 0,
	`confidence` int NOT NULL DEFAULT 0,
	`completeness` int NOT NULL DEFAULT 0,
	`ownerId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cases_id` PRIMARY KEY(`id`),
	CONSTRAINT `cases_caseId_unique` UNIQUE(`caseId`)
);
--> statement-breakpoint
CREATE TABLE `claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`claimId` varchar(32) NOT NULL,
	`evidenceId` int NOT NULL,
	`claimType` varchar(80) NOT NULL,
	`rawText` text NOT NULL,
	`normalizedValue` text NOT NULL,
	`sourceLocation` json,
	`ocrConfidence` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `claims_id` PRIMARY KEY(`id`),
	CONSTRAINT `claims_claimId_unique` UNIQUE(`claimId`)
);
--> statement-breakpoint
CREATE TABLE `documentFingerprints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evidenceId` int NOT NULL,
	`fileDna` varchar(128) NOT NULL,
	`visualDna` varchar(128),
	`perceptualHash` varchar(128),
	`ocrTextDna` varchar(128),
	`layoutDna` varchar(128),
	`templateDna` varchar(128),
	`entityDna` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documentFingerprints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`normalizedValue` varchar(512) NOT NULL,
	`displayValue` varchar(512) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `entities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entityRelationships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`entityId` int NOT NULL,
	`relationshipType` varchar(100) NOT NULL,
	`evidenceReference` varchar(64),
	`strength` enum('low','medium','high','inconclusive') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `entityRelationships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evidenceId` varchar(32) NOT NULL,
	`caseId` int NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`sha256` varchar(64) NOT NULL,
	`fileSize` int NOT NULL,
	`width` int,
	`height` int,
	`pageCount` int,
	`quality` enum('good','fair','poor','inconclusive') NOT NULL DEFAULT 'inconclusive',
	`ocrReliability` enum('high','medium','low','inconclusive') NOT NULL DEFAULT 'inconclusive',
	`forensicReliability` enum('high','medium','low','inconclusive') NOT NULL DEFAULT 'inconclusive',
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`immutableAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `evidence_evidenceId_unique` UNIQUE(`evidenceId`)
);
--> statement-breakpoint
CREATE TABLE `forensicResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evidenceId` int NOT NULL,
	`detector` varchar(100) NOT NULL,
	`finding` text NOT NULL,
	`strength` enum('low','medium','high','not_available') NOT NULL,
	`confidence` int NOT NULL DEFAULT 0,
	`reliability` enum('high','medium','low','inconclusive') NOT NULL,
	`limitations` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `forensicResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `investigatorFindings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`summary` text NOT NULL,
	`evidenceReferences` json,
	`limitations` text NOT NULL,
	`recommendedAction` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `investigatorFindings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ocrResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evidenceId` int NOT NULL,
	`fullText` text NOT NULL,
	`blocks` json,
	`tables` json,
	`headings` json,
	`averageConfidence` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ocrResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `relatedCases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceCaseId` int NOT NULL,
	`relatedCaseId` int NOT NULL,
	`similarityType` varchar(100) NOT NULL,
	`similarityScore` int NOT NULL,
	`evidenceReference` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `relatedCases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`reportKey` varchar(512),
	`format` varchar(20) NOT NULL DEFAULT 'pdf',
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sourceRegistry` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization` varchar(255) NOT NULL,
	`officialDomain` varchar(255) NOT NULL,
	`recruitmentPortal` varchar(255),
	`officialApi` varchar(512),
	`contactInfo` json,
	`knownPatterns` json,
	`active` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sourceRegistry_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `timelineEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`detail` text NOT NULL,
	`evidenceReference` varchar(64),
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`immutableAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `timelineEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `verificationResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`claimId` int NOT NULL,
	`status` enum('verified','contradicted','unverified','inconclusive','not_applicable') NOT NULL,
	`evidenceReference` text,
	`sourceUrl` varchar(512),
	`reason` text NOT NULL,
	`confidence` int NOT NULL DEFAULT 0,
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verificationResults_id` PRIMARY KEY(`id`)
);
