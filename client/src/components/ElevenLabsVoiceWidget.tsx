/**
 * ElevenLabsVoiceWidget
 *
 * Uses the @elevenlabs/client SDK (Conversation.startSession) so every event
 * is wired back to the portal:
 *   onConnect -> bindBrowserConversation (saves conv_id to DB session)
 *   onMessage -> appendBrowserTranscriptChunk (saves each line in real time)
 *   onDisconnect -> completeBrowserVoiceCall (marks session complete + triage)
 */

import { Conversation } from "@elevenlabs/client";
import { Bot, Loader2, Mic, MicOff, Phone, PhoneOff, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

type CallStatus = "idle" | "connecting" | "connected" | "disconnecting" | "ended";

export function ElevenLabsVoiceWidget({
  sessionId,
  signedUrl,
  dynamicVariables,
  overridePrompt,
  overrideFirstMessage,
  className,
}: Props) {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [completing, setCompleting] = useState(false);
  const conversationRef = useRef<Awaited<ReturnType<typeof Conversation.startSession>> | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const endedRef = useRef(false);
  const transcriptViewportRef = useRef<HTMLDivElement | null>(null);

  const bindConversation = trpc.calls.bindBrowserConversation.useMutation();
  const appendChunk = trpc.calls.appendBrowserTranscriptChunk.useMutation();
  const completeCall = trpc.calls.completeBrowserVoiceCall.useMutation();

  const handleDisconnect = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    setCallStatus("ended");
    setCompleting(true);
    try {
      await completeCall.mutateAsync({ sessionId });
      toast.success("Call saved", {
        description: "Transcript and summary saved to your history.",
      });
    } catch (err: any) {
      console.error("[VoiceWidget] completeBrowserVoiceCall failed:", err);
      toast.error("Could not finalise call", { description: err?.message });
    } finally {
      setCompleting(false);
    }
  }, [sessionId, completeCall]);

  const handleStart = async () => {
    try {
      setCallStatus("connecting");
      endedRef.current = false;

      const conv = await Conversation.startSession({
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
        onConnect: ({ conversationId }) => {
          conversationIdRef.current = conversationId;
          setCallStatus("connected");
          void bindConversation
            .mutateAsync({ sessionId, conversationId })
            .catch((err) => console.error("[VoiceWidget] bindBrowserConversation failed:", err));
        },
        onDisconnect: () => {
          void handleDisconnect();
        },
        onMessage: ({ message, source }: { message: string; source: string }) => {
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
            .catch((err) => console.error("[VoiceWidget] appendBrowserTranscriptChunk failed:", err));
        },
        onModeChange: ({ mode }: { mode: string }) => {
          setIsSpeaking(mode === "speaking");
        },
        onStatusChange: ({ status }: { status: string }) => {
          if (status === "disconnecting") setCallStatus("disconnecting");
        },
        onError: (message: string) => {
          console.error("[VoiceWidget] ElevenLabs error:", message);
          toast.error("Voice call error", { description: message });
        },
      });

      conversationRef.current = conv;
    } catch (err: any) {
      console.error("[VoiceWidget] startSession failed:", err);
      setCallStatus("idle");
      toast.error("Could not start voice call", { description: err?.message });
    }
  };

  const handleStop = async () => {
    try {
      setCallStatus("disconnecting");
      await conversationRef.current?.endSession();
    } catch (err: any) {
      console.error("[VoiceWidget] endSession failed:", err);
      void handleDisconnect();
    }
  };

  const isConnecting = callStatus === "connecting";
  const isConnected = callStatus === "connected";
  const isActive = isConnecting || isConnected || callStatus === "disconnecting";
  const isEnded = callStatus === "ended";

  useEffect(() => {
    if (!transcriptViewportRef.current) return;
    transcriptViewportRef.current.scrollTop = transcriptViewportRef.current.scrollHeight;
  }, [transcript]);

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div className="rounded-[1.75rem] border border-[#ddd3c4] bg-gradient-to-b from-[#fffdf9] to-[#f7f0e6] p-6 sm:p-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d9cbb7] bg-white/85 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[#6f6658]">
            Browser Voice Session
          </div>

          <div
            className={cn(
              "flex h-24 w-24 items-center justify-center rounded-full transition-all duration-500",
              isConnected && isSpeaking
                ? "animate-pulse bg-[#1d4e4b] shadow-[0_0_40px_rgba(29,78,75,0.35)]"
                : isConnected
                  ? "bg-[#1d4e4b]/20 shadow-[0_0_20px_rgba(29,78,75,0.15)]"
                  : "bg-muted"
            )}
          >
            {isConnecting ? (
              <Loader2 className="h-10 w-10 animate-spin text-[#1d4e4b]" />
            ) : isConnected ? (
              isSpeaking ? (
                <Bot className="h-10 w-10 text-white" />
              ) : (
                <Mic className="h-10 w-10 text-[#1d4e4b]" />
              )
            ) : isEnded ? (
              <PhoneOff className="h-10 w-10 text-muted-foreground" />
            ) : (
              <Phone className="h-10 w-10 text-muted-foreground" />
            )}
          </div>

          <div className="space-y-2">
            {isConnecting && (
              <p className="text-sm font-medium text-[#1d4e4b]">Connecting to DementiaHub voice agent...</p>
            )}
            {isConnected && (
              <div className="flex flex-col items-center gap-2">
                <Badge className="gap-1.5 rounded-full bg-[#1d4e4b]/10 px-3 py-1 text-[#1d4e4b] hover:bg-[#1d4e4b]/10">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1d4e4b]" />
                  {isSpeaking ? "Agent speaking" : "Listening..."}
                </Badge>
                {conversationIdRef.current && (
                  <p className="max-w-full break-all rounded-full bg-white/80 px-3 py-1 font-mono text-[10px] text-muted-foreground">
                    {conversationIdRef.current}
                  </p>
                )}
              </div>
            )}
            {callStatus === "disconnecting" && (
              <p className="text-sm text-muted-foreground">Ending call...</p>
            )}
            {!isActive && !isEnded && (
              <div className="space-y-1">
                <p className="text-base font-semibold text-[#0f2e2c]">Ready to start your live support call</p>
                <p className="text-sm text-muted-foreground">
                  Connect your microphone and speak naturally. The live transcript will appear below in a cleaner chat view.
                </p>
              </div>
            )}
            {isEnded && (
              <p className="text-sm text-muted-foreground">
                {completing ? "Saving your call..." : "Call ended and saved to your history."}
              </p>
            )}
          </div>

          {!isEnded && (
            <div className="flex flex-wrap justify-center gap-3">
              {callStatus === "idle" ? (
                <Button
                  className="gap-2 rounded-2xl bg-[#1d4e4b] px-8 hover:bg-[#0f2e2c]"
                  onClick={handleStart}
                >
                  <Mic className="h-4 w-4" />
                  Connect Mic & Start Call
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="gap-2 rounded-2xl border-red-200 px-8 text-red-700 hover:bg-red-50"
                  onClick={handleStop}
                  disabled={callStatus === "disconnecting"}
                >
                  <MicOff className="h-4 w-4" />
                  End Call
                </Button>
              )}
            </div>
          )}

          <div className="grid w-full max-w-2xl gap-3 pt-2 sm:grid-cols-3">
            <div className="rounded-[1.1rem] border border-[#dfd2c2] bg-white/80 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#7b6e5d]">Status</p>
              <p className="mt-1 text-sm font-semibold capitalize text-[#0f2e2c]">
                {isConnected ? (isSpeaking ? "Agent speaking" : "Listening") : callStatus}
              </p>
            </div>
            <div className="rounded-[1.1rem] border border-[#dfd2c2] bg-white/80 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#7b6e5d]">Transcript</p>
              <p className="mt-1 text-sm font-semibold text-[#0f2e2c]">{transcript.length} lines saved</p>
            </div>
            <div className="rounded-[1.1rem] border border-[#dfd2c2] bg-white/80 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#7b6e5d]">Session</p>
              <p className="mt-1 truncate text-sm font-semibold text-[#0f2e2c]">{sessionId}</p>
            </div>
          </div>
        </div>
      </div>

      {transcript.length > 0 && (
        <div className="rounded-[1.75rem] border border-[#ddd3c4] bg-[#fffdf9] p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#efe6d9] pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Live Transcript
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                New lines are saved to the portal as the conversation happens.
              </p>
            </div>
            <Badge variant="outline" className="rounded-full border-[#ddd3c4] bg-[#faf6ef] text-[#5b5146]">
              {transcript.length} {transcript.length === 1 ? "line" : "lines"}
            </Badge>
          </div>

          <div
            ref={transcriptViewportRef}
            className="flex max-h-[460px] flex-col gap-4 overflow-y-auto pr-1"
          >
            {transcript.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3",
                  line.speaker === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                    line.speaker === "agent"
                      ? "border-[#cfe0da] bg-[#e6f0ed]"
                      : "order-2 border-[#eadfcd] bg-[#f6efe5]"
                  )}
                >
                  {line.speaker === "agent" ? (
                    <Bot className="h-3.5 w-3.5 text-[#1d4e4b]" />
                  ) : (
                    <User className="h-3.5 w-3.5 text-[#7b6e5d]" />
                  )}
                </div>

                <div
                  className={cn(
                    "flex max-w-[min(100%,42rem)] flex-col gap-1",
                    line.speaker === "user" && "items-end"
                  )}
                >
                  <div className="px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#7b6e5d]">
                    {line.speaker === "agent" ? "DementiaHub Agent" : "You"}
                  </div>
                  <div
                    className={cn(
                      "w-fit max-w-full whitespace-pre-wrap break-words rounded-[1.3rem] px-4 py-3 text-sm leading-6 shadow-sm",
                      line.speaker === "agent"
                        ? "rounded-tl-sm bg-[#efe5d6] text-[#2f271f]"
                        : "rounded-tr-sm bg-[#1d4e4b] text-white"
                    )}
                  >
                    {line.text}
                  </div>
                  <div className="px-1 text-[11px] text-muted-foreground">
                    {new Date(line.timestamp).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
