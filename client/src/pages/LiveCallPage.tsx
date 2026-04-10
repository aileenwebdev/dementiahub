import { VoiceConversation, type Status } from "@elevenlabs/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  Shield,
  User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../components/DashboardLayout";

type BrowserChunk = {
  speaker: "agent" | "user";
  text: string;
  timestamp: number;
};

export default function LiveCallPage() {
  const params = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const sessionId = params.sessionId;
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<VoiceConversation | null>(null);
  const boundConversationIdRef = useRef<string | null>(null);
  const seenEventIdsRef = useRef<Set<string>>(new Set());

  const [status, setStatus] = useState<Status>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState<BrowserChunk[]>([]);

  const sessionQuery = trpc.calls.getBrowserCallSession.useQuery(
    { sessionId: sessionId ?? "" },
    {
      enabled: Boolean(sessionId),
      staleTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );
  const detailsQuery = trpc.calls.getCallDetails.useQuery(
    { sessionId: sessionId ?? "" },
    {
      enabled: Boolean(sessionId),
      staleTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );
  const bindConversation = trpc.calls.bindBrowserConversation.useMutation();
  const appendTranscriptChunk = trpc.calls.appendBrowserTranscriptChunk.useMutation();
  const completeBrowserCall = trpc.calls.completeBrowserVoiceCall.useMutation({
    onSuccess: () => {
      toast.success("Browser voice call saved");
      setLocation(`/call/${sessionId}`);
    },
    onError: (err) => {
      toast.error("Failed to save browser voice call", { description: err.message });
    },
  });

  useEffect(() => {
    const dbTranscript = detailsQuery.data?.transcriptChunks ?? [];
    if (dbTranscript.length === 0) return;
    setTranscript((prev) => {
      if (prev.length > 0) return prev;
      return dbTranscript.map((chunk) => ({
        speaker: (chunk.speaker === "agent" ? "agent" : "user") as "agent" | "user",
        text: chunk.text,
        timestamp: Number(chunk.timestamp),
      }));
    });
  }, [detailsQuery.data?.transcriptChunks]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    const session = sessionQuery.data;
    if (!sessionId || !session?.signedUrl || conversationRef.current) {
      return;
    }

    let cancelled = false;

    const startBrowserVoiceCall = async () => {
      try {
        setBooting(true);
        setError(null);

        const conversation = await VoiceConversation.startSession({
          signedUrl: session.signedUrl,
          dynamicVariables: session.dynamicVariables,
          userId: sessionId,
          onStatusChange: ({ status: nextStatus }) => {
            if (!cancelled) {
              setStatus(nextStatus);
            }
          },
          onConnect: () => {
            if (!cancelled) {
              setStatus("connected");
              setError(null);
            }
          },
          onDisconnect: (details) => {
            if (!cancelled) {
              setStatus("disconnected");
              if (details.reason === "error") {
                setError(details.message);
              }
            }
          },
          onError: (message) => {
            if (!cancelled) {
              setError(message);
            }
          },
          onMessage: ({ message, role, event_id }) => {
            if (cancelled || !sessionId) return;
            if (typeof event_id === "number") {
              const dedupeKey = `${role}:${event_id}`;
              if (seenEventIdsRef.current.has(dedupeKey)) return;
              seenEventIdsRef.current.add(dedupeKey);
            }

            const speaker = role === "agent" ? "agent" : "user";
            const nextChunk = {
              speaker,
              text: message,
              timestamp: Date.now(),
            } satisfies BrowserChunk;

            setTranscript((prev) => [...prev, nextChunk]);
            appendTranscriptChunk.mutate({
              sessionId,
              conversationId: boundConversationIdRef.current ?? conversation.getId(),
              speaker,
              text: message,
              timestamp: nextChunk.timestamp,
            });
          },
        });

        if (cancelled) {
          await conversation.endSession();
          return;
        }

        conversationRef.current = conversation;
        const conversationId = conversation.getId();
        boundConversationIdRef.current = conversationId;
        await bindConversation.mutateAsync({ sessionId, conversationId });
        conversation.sendContextualUpdate(session.contextualMemory);
      } catch (err) {
        if (!cancelled) {
          setStatus("disconnected");
          setError(err instanceof Error ? err.message : "Failed to start browser voice call");
        }
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    };

    void startBrowserVoiceCall();

    return () => {
      cancelled = true;
      const activeConversation = conversationRef.current;
      conversationRef.current = null;
      boundConversationIdRef.current = null;
      seenEventIdsRef.current.clear();
      if (activeConversation) {
        void activeConversation.endSession();
      }
    };
  }, [bindConversation, sessionId, sessionQuery.data]);

  const handleEndCall = async () => {
    const activeConversation = conversationRef.current;
    conversationRef.current = null;
    if (activeConversation) {
      await activeConversation.endSession();
    }
    if (sessionId) {
      completeBrowserCall.mutate({ sessionId });
    }
  };

  const toggleMute = () => {
    const activeConversation = conversationRef.current;
    if (!activeConversation) return;
    const nextMuted = !muted;
    activeConversation.setMicMuted(nextMuted);
    setMuted(nextMuted);
  };

  const liveStatus = status === "connected" ? "browser voice live" : booting ? "connecting" : "offline";
  const displayTranscript = useMemo(() => transcript, [transcript]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/call/${sessionId}`)}
            className="mb-3 -ml-2 gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Details
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Live Browser Voice Call</h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{sessionId}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="gap-1.5 bg-[#1d4e4b]/10 text-[#1d4e4b] hover:bg-[#1d4e4b]/10">
                <Mic className="h-3 w-3" />
                ElevenLabs browser voice
              </Badge>
              {status === "connected" && (
                <Badge className="gap-1.5 bg-blue-100 text-blue-800 animate-pulse">
                  <Radio className="h-3 w-3" />
                  Live
                </Badge>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Call Status:</span>
            <Badge variant="outline" className="text-xs capitalize">
              {liveStatus}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-700">Logged-in caregiver context attached</span>
          </div>
          {booting && (
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Connecting to ElevenLabs voice agent...</span>
            </div>
          )}
        </div>

        <Card className="border-[#ddd3c4] bg-[#ede7dc]/60">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0f2e2c]">Actual ElevenLabs voice agent</p>
              <p className="text-xs leading-6 text-muted-foreground">
                This browser call uses the real ElevenLabs voice session with the logged-in caregiver identity from the portal.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={toggleMute}
                disabled={!conversationRef.current || status !== "connected"}
              >
                {muted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                {muted ? "Unmute" : "Mute"}
              </Button>
              <Button
                className="rounded-2xl bg-[#1d4e4b] hover:bg-[#0f2e2c]"
                onClick={handleEndCall}
                disabled={completeBrowserCall.isPending}
              >
                {completeBrowserCall.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving call...
                  </>
                ) : (
                  <>
                    <PhoneOff className="mr-2 h-4 w-4" />
                    End & Save Call
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Radio className="h-4 w-4 text-primary" />
              Live Transcript
              {displayTranscript.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {displayTranscript.length} messages
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="min-h-[300px] max-h-[500px] space-y-3 overflow-y-auto pr-1">
              {displayTranscript.length === 0 ? (
                <div className="flex h-[280px] flex-col items-center justify-center text-center">
                  {booting ? (
                    <>
                      <Loader2 className="mb-3 h-8 w-8 animate-spin text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Connecting microphone and live agent...</p>
                    </>
                  ) : (
                    <>
                      <Mic className="mb-3 h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Start speaking when the agent is live.</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {displayTranscript.map((chunk, i) => (
                    <div
                      key={`${chunk.timestamp}-${i}`}
                      className={`flex gap-3 ${chunk.speaker === "agent" ? "" : "flex-row-reverse"}`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          chunk.speaker === "agent" ? "bg-primary/10" : "bg-secondary"
                        }`}
                      >
                        {chunk.speaker === "agent" ? (
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                          chunk.speaker === "agent"
                            ? "rounded-tl-sm bg-muted text-foreground"
                            : "rounded-tr-sm bg-primary text-primary-foreground"
                        }`}
                      >
                        <p>{chunk.text}</p>
                        <p className={`mt-1 text-[10px] opacity-60 ${chunk.speaker !== "agent" ? "text-right" : ""}`}>
                          {new Date(chunk.timestamp).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={transcriptEndRef} />
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-3 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-900">Browser voice session is tied to the logged-in portal user</p>
              <p className="text-xs text-emerald-700">
                Transcript and session history will stay attached to this caregiver account.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
