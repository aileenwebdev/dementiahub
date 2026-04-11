ALTER TABLE `ai_chat_conversations`
  ADD `elevenlabs_conversation_id` varchar(100),
  ADD `safety_result` enum('SAFE','CAUTION','UNSAFE'),
  ADD `safety_flag_type` varchar(50),
  ADD `topic_classified` varchar(100),
  ADD `callback_requested` boolean DEFAULT false,
  ADD `consent_verbally_confirmed` boolean DEFAULT false,
  ADD `conversation_summary` text,
  ADD `resolution_type` varchar(50),
  ADD `escalation_triggered` boolean DEFAULT false,
  ADD `ghl_synced` boolean DEFAULT false,
  ADD `ghl_synced_at` timestamp NULL,
  ADD `ghl_sync_error` text,
  ADD `last_synced_message_count` int DEFAULT 0;
