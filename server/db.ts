import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  aiChatConversations,
  aiChatMessages,
  callbackAttempts,
  callSessions,
  callTranscripts,
  failedSyncQueue,
  InsertAIChatConversation,
  InsertAIChatMessage,
  InsertCallbackAttempt,
  InsertCallSession,
  InsertCallTranscript,
  InsertFailedSyncQueue,
  InsertUser,
  InsertUserIdentityMap,
  userIdentityMap,
  users,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Identity Map Operations ─────────────────────────────────────────────────

export async function getIdentityByUserId(portalUserId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(userIdentityMap)
    .where(eq(userIdentityMap.portalUserId, portalUserId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getIdentityByGhlContactId(ghlContactId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(userIdentityMap)
    .where(eq(userIdentityMap.ghlContactId, ghlContactId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getIdentityByPhoneNumber(phoneNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalizedDigits = phoneNumber.replace(/\D/g, "");
  if (!normalizedDigits) return undefined;

  const result = await db
    .select()
    .from(userIdentityMap)
    .where(sql`regexp_replace(${userIdentityMap.phoneNumber}, '[^0-9]', '') = ${normalizedDigits}`)
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertIdentityMap(data: InsertUserIdentityMap): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const updateSet: Partial<InsertUserIdentityMap> = {};
  if (data.ghlContactId !== undefined) updateSet.ghlContactId = data.ghlContactId;
  if (data.ghlLocationId !== undefined) updateSet.ghlLocationId = data.ghlLocationId;
  if (data.elevenlabsAgentId !== undefined) updateSet.elevenlabsAgentId = data.elevenlabsAgentId;
  if (data.phoneNumber !== undefined) updateSet.phoneNumber = data.phoneNumber;
  if (data.preferredLanguage !== undefined) updateSet.preferredLanguage = data.preferredLanguage;
  if (data.consentGiven !== undefined) updateSet.consentGiven = data.consentGiven;
  if (data.consentTimestamp !== undefined) updateSet.consentTimestamp = data.consentTimestamp;
  await db.insert(userIdentityMap).values(data).onDuplicateKeyUpdate({ set: updateSet });
}

export async function updateConsentForContact(
  ghlContactId: string,
  consentTimestamp: Date
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(userIdentityMap)
    .set({ consentGiven: true, consentTimestamp })
    .where(eq(userIdentityMap.ghlContactId, ghlContactId));
}

// ─── Call Session Operations ──────────────────────────────────────────────────

export async function createCallSession(data: InsertCallSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(callSessions).values(data);
}

export async function getCallSessionBySessionId(sessionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(callSessions)
    .where(eq(callSessions.sessionId, sessionId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCallSessionByConversationId(conversationId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(callSessions)
    .where(eq(callSessions.elevenlabsConversationId, conversationId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCallSessionsByUserId(portalUserId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(callSessions)
    .where(eq(callSessions.portalUserId, portalUserId))
    .orderBy(desc(callSessions.createdAt))
    .limit(limit);
}

export async function updateCallSession(
  sessionId: string,
  updates: Partial<InsertCallSession>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(callSessions).set(updates).where(eq(callSessions.sessionId, sessionId));
}

export async function updateCallSessionByConversationId(
  conversationId: string,
  updates: Partial<InsertCallSession>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(callSessions)
    .set(updates)
    .where(eq(callSessions.elevenlabsConversationId, conversationId));
}

// ─── Transcript Operations ────────────────────────────────────────────────────

export async function insertTranscriptChunk(data: InsertCallTranscript): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(callTranscripts).values(data);
}

export async function getTranscriptsBySessionId(sessionId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(callTranscripts)
    .where(eq(callTranscripts.sessionId, sessionId))
    .orderBy(callTranscripts.timestamp);
}

// ─── Failed Sync Queue Operations ────────────────────────────────────────────

export async function queueFailedSync(data: InsertFailedSyncQueue): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(failedSyncQueue).values(data);
}

export async function getPendingFailedSyncs(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(failedSyncQueue)
    .where(and(eq(failedSyncQueue.resolved, false)))
    .orderBy(failedSyncQueue.createdAt)
    .limit(limit);
}

export async function markSyncResolved(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(failedSyncQueue).set({ resolved: true }).where(eq(failedSyncQueue.id, id));
}

export async function recordSyncRetryAttempt(
  id: number,
  retryCount: number,
  errorMessage?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(failedSyncQueue)
    .set({
      retryCount,
      lastRetryAt: new Date(),
      errorMessage,
    })
    .where(eq(failedSyncQueue.id, id));
}

// AI Chat Operations

export async function getActiveAIChatConversationByUserId(portalUserId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(aiChatConversations)
    .where(
      and(
        eq(aiChatConversations.portalUserId, portalUserId),
        eq(aiChatConversations.status, "active")
      )
    )
    .orderBy(desc(aiChatConversations.updatedAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAIChatConversationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(aiChatConversations)
    .where(eq(aiChatConversations.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createAIChatConversation(data: InsertAIChatConversation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(aiChatConversations).values(data).$returningId();
  return result[0]?.id;
}

export async function getAIChatConversationsByUserId(portalUserId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(aiChatConversations)
    .where(eq(aiChatConversations.portalUserId, portalUserId))
    .orderBy(desc(aiChatConversations.updatedAt))
    .limit(limit);
}

export async function touchAIChatConversation(conversationId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(aiChatConversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(aiChatConversations.id, conversationId));
}

export async function updateAIChatConversation(
  conversationId: number,
  updates: Partial<InsertAIChatConversation>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(aiChatConversations)
    .set(updates)
    .where(eq(aiChatConversations.id, conversationId));
}

export async function createAIChatMessage(data: InsertAIChatMessage): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(aiChatMessages).values(data);
}

export async function getAIChatMessagesByConversationId(conversationId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(aiChatMessages)
    .where(eq(aiChatMessages.conversationId, conversationId))
    .orderBy(aiChatMessages.createdAt)
    .limit(limit);
}

export async function createCallbackAttempt(data: InsertCallbackAttempt) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(callbackAttempts).values(data).$returningId();
  return result[0]?.id;
}

export async function getCallbackAttemptsForCase(params: {
  portalUserId: number;
  conversationId?: number | null;
  sessionId?: string | null;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const limit = params.limit ?? 50;
  const filters = [eq(callbackAttempts.portalUserId, params.portalUserId)];

  if (params.conversationId) {
    filters.push(eq(callbackAttempts.conversationId, params.conversationId));
  }
  if (params.sessionId) {
    filters.push(eq(callbackAttempts.sessionId, params.sessionId));
  }

  return db
    .select({
      attempt: callbackAttempts,
      staffUser: users,
    })
    .from(callbackAttempts)
    .leftJoin(users, eq(users.id, callbackAttempts.staffUserId))
    .where(and(...filters))
    .orderBy(desc(callbackAttempts.createdAt))
    .limit(limit);
}

export async function getSupportConversationCase(conversationId: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select({
      conversation: aiChatConversations,
      caregiver: users,
      identity: userIdentityMap,
    })
    .from(aiChatConversations)
    .leftJoin(users, eq(users.id, aiChatConversations.portalUserId))
    .leftJoin(userIdentityMap, eq(userIdentityMap.portalUserId, aiChatConversations.portalUserId))
    .where(eq(aiChatConversations.id, conversationId))
    .limit(1);

  if (!rows[0]) return null;

  const [messages, callbacks, assignedStaff] = await Promise.all([
    getAIChatMessagesByConversationId(conversationId, 200),
    getCallbackAttemptsForCase({
      portalUserId: rows[0].conversation.portalUserId,
      conversationId,
      limit: 100,
    }),
    rows[0].conversation.assignedStaffUserId
      ? getUserById(rows[0].conversation.assignedStaffUserId)
      : Promise.resolve(undefined),
  ]);

  return {
    ...rows[0],
    assignedStaff,
    messages,
    callbacks,
  };
}

export async function getSupportCallCase(sessionId: string) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select({
      session: callSessions,
      caregiver: users,
      identity: userIdentityMap,
    })
    .from(callSessions)
    .leftJoin(users, eq(users.id, callSessions.portalUserId))
    .leftJoin(userIdentityMap, eq(userIdentityMap.portalUserId, callSessions.portalUserId))
    .where(eq(callSessions.sessionId, sessionId))
    .limit(1);

  if (!rows[0]) return null;

  const [callbacks, transcriptChunks, assignedStaff] = await Promise.all([
    getCallbackAttemptsForCase({
      portalUserId: rows[0].session.portalUserId,
      sessionId,
      limit: 100,
    }),
    getTranscriptsBySessionId(sessionId),
    rows[0].session.assignedStaffUserId
      ? getUserById(rows[0].session.assignedStaffUserId)
      : Promise.resolve(undefined),
  ]);

  return {
    ...rows[0],
    assignedStaff,
    transcriptChunks,
    callbacks,
  };
}

// Admin Operations

export async function getAdminOverviewStats() {
  const db = await getDb();
  if (!db) {
    return {
      totalUsers: 0,
      adminUsers: 0,
      linkedUsers: 0,
      consentedUsers: 0,
      totalCalls: 0,
      activeCalls: 0,
      syncedCalls: 0,
      aiConversations: 0,
      pendingSyncs: 0,
    };
  }

  const [
    [userStats],
    [identityStats],
    [callStats],
    [chatStats],
    [syncStats],
  ] = await Promise.all([
    db
      .select({
        totalUsers: sql<number>`count(*)`,
        adminUsers: sql<number>`sum(case when ${users.role} = 'admin' then 1 else 0 end)`,
      })
      .from(users),
    db
      .select({
        linkedUsers: sql<number>`sum(case when ${userIdentityMap.ghlContactId} is not null then 1 else 0 end)`,
        consentedUsers: sql<number>`sum(case when ${userIdentityMap.consentGiven} = true then 1 else 0 end)`,
      })
      .from(userIdentityMap),
    db
      .select({
        totalCalls: sql<number>`count(*)`,
        activeCalls: sql<number>`sum(case when ${callSessions.status} = 'active' then 1 else 0 end)`,
        syncedCalls: sql<number>`sum(case when ${callSessions.ghlSynced} = true then 1 else 0 end)`,
      })
      .from(callSessions),
    db
      .select({
        aiConversations: sql<number>`count(*)`,
      })
      .from(aiChatConversations),
    db
      .select({
        pendingSyncs: sql<number>`sum(case when ${failedSyncQueue.resolved} = false then 1 else 0 end)`,
      })
      .from(failedSyncQueue),
  ]);

  return {
    totalUsers: Number(userStats?.totalUsers ?? 0),
    adminUsers: Number(userStats?.adminUsers ?? 0),
    linkedUsers: Number(identityStats?.linkedUsers ?? 0),
    consentedUsers: Number(identityStats?.consentedUsers ?? 0),
    totalCalls: Number(callStats?.totalCalls ?? 0),
    activeCalls: Number(callStats?.activeCalls ?? 0),
    syncedCalls: Number(callStats?.syncedCalls ?? 0),
    aiConversations: Number(chatStats?.aiConversations ?? 0),
    pendingSyncs: Number(syncStats?.pendingSyncs ?? 0),
  };
}

export async function getAdminUsers(params?: { search?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];

  const limit = params?.limit ?? 50;
  const search = params?.search?.trim();
  const searchTerm = search ? `%${search}%` : undefined;

  const query = db
    .select({
      user: users,
      identity: userIdentityMap,
    })
    .from(users)
    .leftJoin(userIdentityMap, eq(userIdentityMap.portalUserId, users.id))
    .orderBy(desc(users.createdAt))
    .limit(limit);

  if (!searchTerm) {
    return query;
  }

  return db
    .select({
      user: users,
      identity: userIdentityMap,
    })
    .from(users)
    .leftJoin(userIdentityMap, eq(userIdentityMap.portalUserId, users.id))
    .where(
      or(
        like(users.name, searchTerm),
        like(users.email, searchTerm),
        like(users.openId, searchTerm),
        like(userIdentityMap.phoneNumber, searchTerm),
        like(userIdentityMap.ghlContactId, searchTerm)
      )
    )
    .orderBy(desc(users.createdAt))
    .limit(limit);
}

export async function getAdminUserDetail(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const [userRow, calls, conversations] = await Promise.all([
    db
      .select({
        user: users,
        identity: userIdentityMap,
      })
      .from(users)
      .leftJoin(userIdentityMap, eq(userIdentityMap.portalUserId, users.id))
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select()
      .from(callSessions)
      .where(eq(callSessions.portalUserId, userId))
      .orderBy(desc(callSessions.createdAt))
      .limit(20),
    db
      .select()
      .from(aiChatConversations)
      .where(eq(aiChatConversations.portalUserId, userId))
      .orderBy(desc(aiChatConversations.updatedAt))
      .limit(10),
  ]);

  if (!userRow[0]) return null;

  const conversationsWithMessages = await Promise.all(
    conversations.map(async (conversation) => ({
      conversation,
      messages: await getAIChatMessagesByConversationId(conversation.id, 30),
    }))
  );

  return {
    user: userRow[0].user,
    identity: userRow[0].identity,
    calls,
    conversations: conversationsWithMessages.filter((item) => item.messages.length > 0),
  };
}

export async function getAdminRecentCallSessions(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      call: callSessions,
      user: users,
    })
    .from(callSessions)
    .leftJoin(users, eq(users.id, callSessions.portalUserId))
    .orderBy(desc(callSessions.createdAt))
    .limit(limit);
}

export async function getAdminRecentAIConversations(limit = 20) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      conversation: aiChatConversations,
      user: users,
    })
    .from(aiChatConversations)
    .leftJoin(users, eq(users.id, aiChatConversations.portalUserId))
    .orderBy(desc(aiChatConversations.updatedAt))
    .limit(limit);

  const hydrated = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      messages: await getAIChatMessagesByConversationId(row.conversation.id, 1),
    }))
  );

  return hydrated.filter((row) => row.messages.length > 0);
}

export async function getAdminStaffDashboard(limit = 50) {
  const db = await getDb();
  if (!db) {
    return {
      urgentCalls: [],
      callbackCalls: [],
      activeCalls: [],
      unsafeChats: [],
      chatSupportQueue: [],
      needsStaffTotal: 0,
    };
  }

  const [callRows, chatRows] = await Promise.all([
    db
      .select({
        call: callSessions,
        user: users,
      })
      .from(callSessions)
      .leftJoin(users, eq(users.id, callSessions.portalUserId))
      .orderBy(desc(callSessions.updatedAt))
      .limit(limit),
    db
      .select({
        conversation: aiChatConversations,
        user: users,
      })
      .from(aiChatConversations)
      .leftJoin(users, eq(users.id, aiChatConversations.portalUserId))
      .orderBy(desc(aiChatConversations.updatedAt))
      .limit(limit),
  ]);

  const chatsWithMessages = await Promise.all(
    chatRows.map(async (row) => ({
      ...row,
      messages: await getAIChatMessagesByConversationId(row.conversation.id, 1),
    }))
  );

  const needsStaffCall = (row: (typeof callRows)[number]) =>
    row.call.safetyResult === "UNSAFE" ||
    row.call.safetyResult === "CAUTION" ||
    Boolean(row.call.callbackRequested) ||
    Boolean(row.call.escalationTriggered) ||
    row.call.status === "active" ||
    (!!row.call.resolutionType && row.call.resolutionType !== "self_serve");

  const needsStaffChat = (row: (typeof chatsWithMessages)[number]) =>
    row.conversation.safetyResult === "UNSAFE" ||
    row.conversation.safetyResult === "CAUTION" ||
    Boolean(row.conversation.callbackRequested) ||
    Boolean(row.conversation.escalationTriggered) ||
    row.conversation.status === "active" ||
    (!!row.conversation.resolutionType && row.conversation.resolutionType !== "self_serve");

  const urgentCalls = callRows.filter(
    (row) => row.call.safetyResult === "UNSAFE" || Boolean(row.call.escalationTriggered)
  );
  const callbackCalls = callRows.filter((row) => Boolean(row.call.callbackRequested));
  const activeCalls = callRows.filter((row) => row.call.status === "active");
  const unsafeChats = chatsWithMessages.filter(
    (row) =>
      row.conversation.safetyResult === "UNSAFE" || Boolean(row.conversation.escalationTriggered)
  );
  const chatSupportQueue = chatsWithMessages.filter(needsStaffChat);

  return {
    urgentCalls,
    callbackCalls,
    activeCalls,
    unsafeChats,
    chatSupportQueue,
    needsStaffTotal:
      callRows.filter(needsStaffCall).length + chatsWithMessages.filter(needsStaffChat).length,
  };
}
