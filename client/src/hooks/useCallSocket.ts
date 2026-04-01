/**
 * useCallSocket — React hook for real-time call transcript streaming via Socket.IO.
 *
 * Usage:
 *   const { transcriptChunks, callStatus, consentVerified, connected } = useCallSocket(sessionId);
 */

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export type TranscriptChunk = {
  speaker: string;
  text: string;
  timestamp: number;
};

export type CallSocketState = {
  connected: boolean;
  transcriptChunks: TranscriptChunk[];
  callStatus: string | null;
  consentVerified: boolean;
  error: string | null;
};

export function useCallSocket(sessionId: string | null | undefined): CallSocketState {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [consentVerified, setConsentVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    // Connect to the Socket.IO server
    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setError(null);
      // Join the session room
      socket.emit("join:session", sessionId);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("connect_error", (err) => {
      setError(`Connection error: ${err.message}`);
      setConnected(false);
    });

    socket.on("joined", ({ status }: { sessionId: string; status: string }) => {
      setCallStatus(status);
    });

    socket.on("transcript:chunk", (chunk: TranscriptChunk & { sessionId: string }) => {
      setTranscriptChunks((prev) => [
        ...prev,
        { speaker: chunk.speaker, text: chunk.text, timestamp: chunk.timestamp },
      ]);
    });

    socket.on("call:status", ({ status }: { sessionId: string; status: string }) => {
      setCallStatus(status);
    });

    socket.on("consent:verified", () => {
      setConsentVerified(true);
    });

    socket.on("error", ({ message }: { message: string }) => {
      setError(message);
    });

    return () => {
      socket.emit("leave:session", sessionId);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [sessionId]);

  return { connected, transcriptChunks, callStatus, consentVerified, error };
}
