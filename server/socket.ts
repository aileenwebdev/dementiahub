/**
 * Socket.IO server for real-time transcript streaming.
 *
 * Clients join a room keyed by sessionId. When ElevenLabs sends transcript
 * chunks via the post-call webhook (or a streaming endpoint), the server
 * broadcasts them to all connected clients in that room.
 *
 * Events emitted to clients:
 *   transcript:chunk  — { speaker, text, timestamp }
 *   call:status       — { status, sessionId }
 *   consent:verified  — { sessionId, timestamp }
 */

import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { getCallSessionBySessionId, insertTranscriptChunk } from "./db";

let io: SocketIOServer | null = null;

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/api/socket.io",
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Client joins a session room to receive transcript updates
    socket.on("join:session", async (sessionId: string) => {
      if (!sessionId) return;

      // Validate session exists
      const session = await getCallSessionBySessionId(sessionId).catch(() => null);
      if (!session) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      socket.join(`session:${sessionId}`);
      console.log(`[Socket.IO] ${socket.id} joined session: ${sessionId}`);
      socket.emit("joined", { sessionId, status: session.status });
    });

    socket.on("leave:session", (sessionId: string) => {
      socket.leave(`session:${sessionId}`);
      console.log(`[Socket.IO] ${socket.id} left session: ${sessionId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  console.log("[Socket.IO] Server initialized on /api/socket.io");
  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

/**
 * Broadcast a transcript chunk to all clients watching a session.
 * Also persists the chunk to the call_transcripts table.
 */
export async function broadcastTranscriptChunk(
  sessionId: string,
  chunk: { speaker: string; text: string; timestamp: number }
) {
  if (!io) return;
  io.to(`session:${sessionId}`).emit("transcript:chunk", { sessionId, ...chunk });

  // Persist to DB
  {
    try {
      const speakerValue = (chunk.speaker === "agent" || chunk.speaker === "user")
        ? chunk.speaker as "agent" | "user"
        : "user" as const;
      await insertTranscriptChunk({
        sessionId: sessionId,
        speaker: speakerValue,
        text: chunk.text,
        timestamp: new Date(chunk.timestamp),
      });
    } catch (err) {
      console.error("[Socket.IO] Failed to persist transcript chunk:", err);
    }
  }
}

/**
 * Broadcast a call status update (e.g., completed, synced).
 */
export function broadcastCallStatus(sessionId: string, status: string) {
  if (!io) return;
  io.to(`session:${sessionId}`).emit("call:status", { sessionId, status });
}

/**
 * Broadcast consent verification event.
 */
export function broadcastConsentVerified(sessionId: string) {
  if (!io) return;
  io.to(`session:${sessionId}`).emit("consent:verified", {
    sessionId,
    timestamp: Date.now(),
  });
}
