CREATE TABLE `call_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` varchar(100) NOT NULL,
	`portal_user_id` int NOT NULL,
	`ghl_contact_id` varchar(100),
	`ghl_location_id` varchar(100),
	`ghl_opportunity_id` varchar(100),
	`elevenlabs_conversation_id` varchar(100),
	`elevenlabs_agent_id` varchar(100),
	`status` enum('active','completed','failed','synced') NOT NULL DEFAULT 'active',
	`call_duration_seconds` int,
	`call_start_time` timestamp,
	`call_end_time` timestamp,
	`safety_result` enum('SAFE','CAUTION','UNSAFE'),
	`safety_flag_type` varchar(50),
	`topic_classified` varchar(100),
	`callback_requested` boolean DEFAULT false,
	`consent_verbally_confirmed` boolean DEFAULT false,
	`consent_timestamp` timestamp,
	`whatsapp_summary_requested` boolean DEFAULT false,
	`call_summary` text,
	`resolution_type` varchar(50),
	`escalation_triggered` boolean DEFAULT false,
	`asr_confidence` varchar(20),
	`transcript_raw` text,
	`ghl_synced` boolean DEFAULT false,
	`ghl_synced_at` timestamp,
	`ghl_sync_error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `call_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `call_sessions_session_id_unique` UNIQUE(`session_id`)
);
--> statement-breakpoint
CREATE TABLE `call_transcripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` varchar(100) NOT NULL,
	`elevenlabs_conversation_id` varchar(100),
	`speaker` enum('agent','user') NOT NULL,
	`text` text NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`is_safety_flagged` boolean DEFAULT false,
	CONSTRAINT `call_transcripts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `failed_sync_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversation_id` varchar(100) NOT NULL,
	`webhook_type` enum('post_call','consent') NOT NULL,
	`payload` json NOT NULL,
	`error_message` text,
	`retry_count` int DEFAULT 0,
	`last_retry_at` timestamp,
	`resolved` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `failed_sync_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_identity_map` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portal_user_id` int NOT NULL,
	`ghl_contact_id` varchar(100),
	`ghl_location_id` varchar(100),
	`elevenlabs_agent_id` varchar(100),
	`phone_number` varchar(30),
	`preferred_language` varchar(20) DEFAULT 'en',
	`consent_given` boolean DEFAULT false,
	`consent_timestamp` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_identity_map_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_identity_map_portal_user_id_unique` UNIQUE(`portal_user_id`)
);
