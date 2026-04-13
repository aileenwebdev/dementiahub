/**
 * ElevenLabsVoiceWidget
 *
 * Uses the @elevenlabs/client SDK (not the passive HTML embed) so every event
 * is wired back to the portal:
 *   - onConnect  → bindBrowserConversation (saves conv_id to DB session)
 *   - onMessage  → appendBrowserTranscriptChunk (saves each line in real time)
 *   - onDisconnect → completeBrowserVoiceCall (marks session complete + triage)
 */

import { useConversation } from "@elevenlabs/client";
import { Bot, Loader2, Mic, MicOff, Phone, PhoneOff, User } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  sessionId: string;
  signedUrl: string;
  dynamicVariables: Record<string, string>;
  overridePrompt?: string;
  overrideFirstMessage?: string;
  className?: string;
};

type TranscriptLine = {
  speaker: "agent" | "user";
  text: string;
  timestamp: number;
};

export function ElevenLabsVoiceWidget({
  sessionId,
  signedUrl,
  dynamicVariables,
  overridePrompt,
  overrideFirstMessage,
  className,
}: Props) {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [callEnded, setCallEnded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const conversationIdRef = useRef<string | null>(null);

  const bindConversation = trpc.calls.bindBrowserConversation.useMutation();
  const appendChunk = trpc.calls.appendBrowserTranscriptChunk.useMutation();
  const completeCall = trpc.calls.completeBrowserVoiceCall.useMutation();

  const handleConnect = useCallback(
    ({ conversationId }: { conversationId: string }) => {
      conversationIdRef.current = conversationId;
      void bindConversation.mutateAsync({ sessionId, conversationId }).catch((err) => {
        console.error("[VoiceWidget] bindBrowserConversation failed:", err);
      });
    },
    [sessionId, bindConversation]
  );

  const handleMessage = useCallback(
    ({ message, source }: { message: string; source: string }) => {
      const speaker: "agent" | "user" = source === "ai" ? "agent" : "user";
      const timestamp = Date.now();

      setTranscript((prev) => [...prev, { speaker, text: message, timestamp }]);

      void appendChunk
        .mutateAsync({
          sessionId,
          conversationId: conversationIdRef.current ?? undefined,
          speaker,
          text: message,
          timestamp,
        })
        .catch((err) => {
          console.error("[VoiceWidget] appendBrowserTranscriptChunk failed:", err);
        });
    },
    [sessionId, appendChunk]
  );

  const handleDisconnect = useCallback(async () => {
    if (callEnded) return;
    setCallEnded(true);
    setCompleting(true);
    try {
      await completeCall.mutateAsync({ sessionId });
      toast.success("Call saved", {
        description: "Transcript and summary have been saved to your history.",
      });
    } catch (err: any) {
      console.error("[VoiceWidget] completeBrowserVoiceCall failed:", err);
      toast.error("Could not save call", { description: err?.message });
    } finally {
      setCompleting(false);
    }
  }, [sessionId, completeCall, callEnded]);

  const conversation = useConversation({
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onMessage: handleMessage,
    onError: (message: string) => {
      console.error("[VoiceWidget] ElevenLabs error:", message);
      toast.error("Voice call error", { description: message });
    },
  });

  const isConnecting = conversation.status === "connecting";
  const isConnected = conversation.status === "connected";
  const isActive = isConnecting || isConnected;

  const handleStart = async () => {
    try {
      await conversation.startSession({
        signedUrl,
        dynamicVariables,
        ...(overridePrompt || overrideFirstMessage
          ? {
              overrides: {
                agent: {
                  ...(overridePrompt ? { prompt: { prompt: overridePrompt } } : {}),
                  ...(overrideFirstMessage ? { firstMessage: overrideFirstMessage } : {}),
                },
              },
            }
          : {}),
      });
    } catch (err: any) {
      console.error("[VoiceWidget] startSession failed:", err);
      toast.error("Could not start voice call", { description: err?.message });
    }
  };

  const handleStop = async () => {
    try {
      await conversation.endSession();
    } catch (err: any) {
      console.error("[VoiceWidget] endSession failed:", err);
    }
  };

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {/* Status + controls */}
      <div className="flex flex-col items-center gap-4 rounded-[1.5rem] border border-[#ddd3c4] bg-[#fffdf9] p-8">
        {/* Orb */}
        <div
          className={cn(
            "flex h-24 w-24 items-center justify-center rounded-full transition-all duration-500",
            isConnected && conversation.isSpeaking
              ? "animate-pulse bg-[#1d4e4b] shadow-[0_0_40px_rgba(29,78,75,0.35)]"
              : isConnected
                ? "bg-[#1d4e4b]/20 shadow-[0_0_20px_rgba(29,78,75,0.15)]"
                : "bg-muted"
          )}
        >
          {isConnecting ? (
            <Loader2 className="h-10 w-10 animate-spin text-[#1d4e4b]" />
          ) : isConnected ? (
            conversation.isSpeaking ? (
              <Bot className="h-10 w-10 text-white" />
            ) : (
              <Mic className="h-10 w-10 text-[#1d4e4b]" />
            )
          ) : callEnded ? (
            <PhoneOff className="h-10 w-10 text-muted-foreground" />
          ) : (
            <Phone className="h-10 w-10 text-muted-foreground" />
          )}
        </div>

        {/* Status text */}
        <div className="text-center">
          {isConnecting && (
            <p className="text-sm font-medium text-[#1d4e4b]">Connecting to DementiaHub voice agent…</p>
          )}
          {isConnected && (
            <div className="flex flex-col items-center gap-1">
              <Badge className="gap-1.5 bg-[#1d4e4b]/10 text-[#1d4e4b] hover:bg-[#1d4e4b]/10">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1d4e4b] animate-pulse" />
                {conversation.isSpeaking ? "Agent speaking" : "Listening…"}
              </Badge>
              {conversationIdRef.current && (
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {conversationIdRef.current}
                </p>
              )}
            </div>
          )}
          {!isActive && !callEnded && (
            <p className="text-sm text-muted-foreground">
              Click the button below to connect your microphone and start talking.
            </p>
          )}
          {callEnded && (
            <p className="text-sm text-muted-foreground">
              {completing ? "Saving your call…" : "Call ended and saved to your history."}
            </p>
          )}
        </div>

        {/* Action button */}
        {!callEnded && (
          <div className="flex gap-3">
            {!isActive ? (
              <Button
                className="gap-2 rounded-2xl bg-[#1d4e4b] px-8 hover:bg-[#0f2e2c]"
                onClick={handleStart}
                disabled={isConnecting}
              >
                <Mic className="h-4 w-4" />
                Connect Mic & Start Call
              </Button>
            ) : (
              <Button
                variant="outline"
                className="gap-2 rounded-2xl border-red-200 px-8 text-red-700 hover:bg-red-50"
                onClick={handleStop}
                disabled={isConnecting}
              >
                <MicOff className="h-4 w-4" />
                End Call
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Live transcript */}
      {transcript.length > 0 && (
        <div className="rounded-[1.5rem] border border-[#ddd3c4] bg-[#fffdf9] p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Live Transcript
          </p>
          <div className="flex max-h-[360px] flex-col gap-3 overflow-y-auto pr-1">
            {transcript.map((line, i) => (
              <div
                key={i}
                className={cn("flex gap-3", line.speaker !== "agent" && "flex-row-reverse")}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    line.speaker === "agent" ? "bg-primary/10" : "bg-secondary"
                  )}
                >
                  {line.speaker === "agent" ? (
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                    line.speaker === "agent"
                      ? "rounded-tl-sm bg-muted text-foreground"
                      : "rounded-tr-sm bg-primary text-primary-foreground"
                  )}
                >
                  {line.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
