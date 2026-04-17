ALTER TABLE `call_sessions`
  ADD COLUMN `case_status` enum(
    'new',
    'open',
    'in_progress',
    'pending_callback',
    'pending_caregiver',
    'pending_internal',
    'resolved',
    'closed',
    'escalated'
  ) NOT NULL DEFAULT 'new',
  ADD COLUMN `case_priority` enum('low', 'normal', 'high', 'urgent') NOT NULL DEFAULT 'normal',
  ADD COLUMN `assigned_staff_user_id` int,
  ADD COLUMN `human_takeover` boolean NOT NULL DEFAULT false,
  ADD COLUMN `human_takeover_at` timestamp NULL,
  ADD COLUMN `last_staff_response_at` timestamp NULL,
  ADD COLUMN `last_caregiver_response_at` timestamp NULL,
  ADD COLUMN `resolution_notes` text,
  ADD COLUMN `resolved_at` timestamp NULL;

ALTER TABLE `ai_chat_conversations`
  ADD COLUMN `case_status` enum(
    'new',
    'open',
    'in_progress',
    'pending_callback',
    'pending_caregiver',
    'pending_internal',
    'resolved',
    'closed',
    'escalated'
  ) NOT NULL DEFAULT 'new',
  ADD COLUMN `case_priority` enum('low', 'normal', 'high', 'urgent') NOT NULL DEFAULT 'normal',
  ADD COLUMN `assigned_staff_user_id` int,
  ADD COLUMN `human_takeover` boolean NOT NULL DEFAULT false,
  ADD COLUMN `human_takeover_at` timestamp NULL,
  ADD COLUMN `last_staff_response_at` timestamp NULL,
  ADD COLUMN `last_caregiver_response_at` timestamp NULL,
  ADD COLUMN `resolution_notes` text,
  ADD COLUMN `resolved_at` timestamp NULL;

ALTER TABLE `ai_chat_messages`
  MODIFY COLUMN `role` enum('system', 'user', 'assistant', 'staff') NOT NULL;

CREATE TABLE `callback_attempts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `portal_user_id` int NOT NULL,
  `staff_user_id` int,
  `conversation_id` int,
  `session_id` varchar(100),
  `phone_number` varchar(30) NOT NULL,
  `status` enum(
    'scheduled',
    'attempted',
    'connected',
    'no_answer',
    'left_voicemail',
    'invalid_number',
    'cancelled'
  ) NOT NULL DEFAULT 'attempted',
  `notes` text,
  `started_at` timestamp NULL,
  `ended_at` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `callback_attempts_id` PRIMARY KEY(`id`)
);
