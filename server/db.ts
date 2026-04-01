import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  callSessions,
  callTranscripts,
  failedSyncQueue,
  InsertCallSession,
  InsertCallTranscript,
  InsertFailedSyncQueue,
  InsertUser,
  InsertUserIdentityMap,
  userIdentityMap,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

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

    const textFields = ["name", "email", "loginMethod"] as const;
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
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
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
