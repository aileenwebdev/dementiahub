import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: text("passwordHash"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "staff", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Identity mapping table — links portal users to GHL contacts and ElevenLabs agents.
 * This is the core identity bridge between the three systems.
 */
export const userIdentityMap = mysqlTable("user_identity_map", {
  id: int("id").autoincrement().primaryKey(),
  portalUserId: int("portal_user_id").notNull().unique(),
  ghlContactId: varchar("ghl_contact_id", { length: 100 }),
  ghlLocationId: varchar("ghl_location_id", { length: 100 }),
  elevenlabsAgentId: varchar("elevenlabs_agent_id", { length: 100 }),
  phoneNumber: varchar("phone_number", { length: 30 }),
  preferredLanguage: varchar("preferred_language", { length: 20 }).default("en"),
  consentGiven: boolean("consent_given").default(false),
  consentTimestamp: timestamp("consent_timestamp"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserIdentityMap = typeof userIdentityMap.$inferSelect;
export type InsertUserIdentityMap = typeof userIdentityMap.$inferInsert;

/**
 * Call sessions table — tracks each ElevenLabs conversation from initiation to completion.
 */
export const callSessions = mysqlTable("call_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("session_id", { length: 100 }).notNull().unique(),
  portalUserId: int("portal_user_id").notNull(),
  ghlContactId: varchar("ghl_contact_id", { length: 100 }),
  ghlLocationId: varchar("ghl_location_id", { length: 100 }),
  ghlOpportunityId: varchar("ghl_opportunity_id", { length: 100 }),
  elevenlabsConversationId: varchar("elevenlabs_conversation_id", { length: 100 }),
  elevenlabsAgentId: varchar("elevenlabs_agent_id", { length: 100 }),
  status: mysqlEnum("status", ["active", "completed", "failed", "synced"]).default("active").notNull(),
  callDurationSeconds: int("call_duration_seconds"),
  callStartTime: timestamp("call_start_time"),
  callEndTime: timestamp("call_end_time"),
  // Call outcome fields (populated after post-call webhook)
  safetyResult: mysqlEnum("safety_result", ["SAFE", "CAUTION", "UNSAFE"]),
  safetyFlagType: varchar("safety_flag_type", { length: 50 }),
  topicClassified: varchar("topic_classified", { length: 100 }),
  callbackRequested: boolean("callback_requested").default(false),
  consentVerballyConfirmed: boolean("consent_verbally_confirmed").default(false),
  consentTimestamp: timestamp("consent_timestamp"),
  whatsappSummaryRequested: boolean("whatsapp_summary_requested").default(false),
  callSummary: text("call_summary"),
  resolutionType: varchar("resolution_type", { length: 50 }),
  escalationTriggered: boolean("escalation_triggered").default(false),
  caseStatus: mysqlEnum("case_status", [
    "new",
    "open",
    "in_progress",
    "pending_callback",
    "pending_caregiver",
    "pending_internal",
    "resolved",
    "closed",
    "escalated",
  ]).default("new").notNull(),
  casePriority: mysqlEnum("case_priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  assignedStaffUserId: int("assigned_staff_user_id"),
  humanTakeover: boolean("human_takeover").default(false).notNull(),
  humanTakeoverAt: timestamp("human_takeover_at"),
  lastStaffResponseAt: timestamp("last_staff_response_at"),
  lastCaregiverResponseAt: timestamp("last_caregiver_response_at"),
  resolutionNotes: text("resolution_notes"),
  resolvedAt: timestamp("resolved_at"),
  asrConfidence: varchar("asr_confidence", { length: 20 }),
  transcriptRaw: text("transcript_raw"),
  // Sync status
  ghlSynced: boolean("ghl_synced").default(false),
  ghlSyncedAt: timestamp("ghl_synced_at"),
  ghlSyncError: text("ghl_sync_error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CallSession = typeof callSessions.$inferSelect;
export type InsertCallSession = typeof callSessions.$inferInsert;

/**
 * Real-time transcript chunks captured via WebSocket during active calls.
 */
export const callTranscripts = mysqlTable("call_transcripts", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("session_id", { length: 100 }).notNull(),
  elevenlabsConversationId: varchar("elevenlabs_conversation_id", { length: 100 }),
  speaker: mysqlEnum("speaker", ["agent", "user"]).notNull(),
  text: text("text").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  isSafetyFlagged: boolean("is_safety_flagged").default(false),
});

export type CallTranscript = typeof callTranscripts.$inferSelect;
export type InsertCallTranscript = typeof callTranscripts.$inferInsert;

/**
 * Failed webhook sync queue — stores payloads that failed to sync to GHL for retry.
 */
export const failedSyncQueue = mysqlTable("failed_sync_queue", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: varchar("conversation_id", { length: 100 }).notNull(),
  webhookType: mysqlEnum("webhook_type", ["post_call", "consent"]).notNull(),
  payload: json("payload").notNull(),
  errorMessage: text("error_message"),
  retryCount: int("retry_count").default(0),
  lastRetryAt: timestamp("last_retry_at"),
  resolved: boolean("resolved").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FailedSyncQueue = typeof failedSyncQueue.$inferSelect;
export type InsertFailedSyncQueue = typeof failedSyncQueue.$inferInsert;

/**
 * Caregiver AI chat conversations.
 * Keeps a stable conversation thread for each logged-in portal user.
 */
export const aiChatConversations = mysqlTable("ai_chat_conversations", {
  id: int("id").autoincrement().primaryKey(),
  portalUserId: int("portal_user_id").notNull(),
  title: varchar("title", { length: 255 }),
  elevenlabsConversationId: varchar("elevenlabs_conversation_id", { length: 100 }),
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
  safetyResult: mysqlEnum("safety_result", ["SAFE", "CAUTION", "UNSAFE"]),
  safetyFlagType: varchar("safety_flag_type", { length: 50 }),
  topicClassified: varchar("topic_classified", { length: 100 }),
  callbackRequested: boolean("callback_requested").default(false),
  consentVerballyConfirmed: boolean("consent_verbally_confirmed").default(false),
  conversationSummary: text("conversation_summary"),
  resolutionType: varchar("resolution_type", { length: 50 }),
  escalationTriggered: boolean("escalation_triggered").default(false),
  caseStatus: mysqlEnum("case_status", [
    "new",
    "open",
    "in_progress",
    "pending_callback",
    "pending_caregiver",
    "pending_internal",
    "resolved",
    "closed",
    "escalated",
  ]).default("new").notNull(),
  casePriority: mysqlEnum("case_priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  assignedStaffUserId: int("assigned_staff_user_id"),
  humanTakeover: boolean("human_takeover").default(false).notNull(),
  humanTakeoverAt: timestamp("human_takeover_at"),
  lastStaffResponseAt: timestamp("last_staff_response_at"),
  lastCaregiverResponseAt: timestamp("last_caregiver_response_at"),
  resolutionNotes: text("resolution_notes"),
  resolvedAt: timestamp("resolved_at"),
  ghlSynced: boolean("ghl_synced").default(false),
  ghlSyncedAt: timestamp("ghl_synced_at"),
  ghlSyncError: text("ghl_sync_error"),
  lastSyncedMessageCount: int("last_synced_message_count").default(0),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AIChatConversation = typeof aiChatConversations.$inferSelect;
export type InsertAIChatConversation = typeof aiChatConversations.$inferInsert;

/**
 * Caregiver AI chat messages stored inside the portal.
 */
export const aiChatMessages = mysqlTable("ai_chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversation_id").notNull(),
  portalUserId: int("portal_user_id").notNull(),
  role: mysqlEnum("role", ["system", "user", "assistant", "staff"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AIChatMessage = typeof aiChatMessages.$inferSelect;
export type InsertAIChatMessage = typeof aiChatMessages.$inferInsert;

/**
 * Callback attempts logged by staff when they follow up with a caregiver by phone.
 */
export const callbackAttempts = mysqlTable("callback_attempts", {
  id: int("id").autoincrement().primaryKey(),
  portalUserId: int("portal_user_id").notNull(),
  staffUserId: int("staff_user_id"),
  conversationId: int("conversation_id"),
  sessionId: varchar("session_id", { length: 100 }),
  phoneNumber: varchar("phone_number", { length: 30 }).notNull(),
  status: mysqlEnum("status", [
    "scheduled",
    "attempted",
    "connected",
    "no_answer",
    "left_voicemail",
    "invalid_number",
    "cancelled",
  ]).default("attempted").notNull(),
  notes: text("notes"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CallbackAttempt = typeof callbackAttempts.$inferSelect;
export type InsertCallbackAttempt = typeof callbackAttempts.$inferInsert;
