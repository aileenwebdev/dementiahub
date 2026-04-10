import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useCallSocket } from "@/hooks/useCallSocket";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Globe,
  Loader2,
  Mic,
  Radio,
  Shield,
  User,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../components/DashboardLayout";

type DemoChunk = {
  speaker: "agent" | "user";
  text: string;
  timestamp: number;
};

const DEMO_SCRIPT: Array<{ speaker: "agent" | "user"; text: string; delayMs: number }> = [
  { speaker: "agent", text: "Hello, thank you for calling Dementia Singapore support. I am here to help you today.", delayMs: 800 },
  { speaker: "user", text: "I have been feeling overwhelmed caring for my mum and I am not sure what support is available.", delayMs: 1900 },
  { speaker: "agent", text: "I am sorry it has been such a heavy week. I can share caregiver support options and practical next steps.", delayMs: 3200 },
  { speaker: "user", text: "That would help. I would also like to know whether there are programmes near me.", delayMs: 4700 },
  { speaker: "agent", text: "I can point you to caregiver support programmes, resources, and follow-up services near your location.", delayMs: 6200 },
  { speaker: "user", text: "Thank you. A self-serve summary would be enough for now.", delayMs: 7600 },
];

export default function LiveCallPage() {
  const params = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const sessionId = params.sessionId;
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const timerRefs = useRef<number[]>([]);

  const { data: session } = trpc.calls.getCallDetails.useQuery(
    { sessionId: sessionId ?? "" },
    { enabled: Boolean(sessionId), refetchInterval: 5000 }
  );

  const isDemoSession = Boolean(sessionId?.startsWith("web_"));
  const { connected, transcriptChunks, callStatus, consentVerified, error } =
    useCallSocket(isDemoSession ? null : sessionId);

  const [demoStarted, setDemoStarted] = useState(false);
  const [demoTranscript, setDemoTranscript] = useState<DemoChunk[]>([]);
  const [demoFinished, setDemoFinished] = useState(false);

  const completeWebCallDemo = trpc.calls.completeWebCallDemo.useMutation({
    onSuccess: () => {
      toast.success("Browser demo call saved");
      setLocation(`/call/${sessionId}`);
    },
    onError: (err) => {
      toast.error("Failed to save browser demo call", { description: err.message });
    },
  });

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptChunks, demoTranscript]);

  useEffect(() => {
    return () => {
      timerRefs.current.forEach((timer) => window.clearTimeout(timer));
      timerRefs.current = [];
    };
  }, []);

  const startDemoConversation = () => {
    if (demoStarted) return;
    setDemoStarted(true);
    const base = Date.now();

    DEMO_SCRIPT.forEach((item, index) => {
      const timer = window.setTimeout(() => {
        setDemoTranscript((prev) => [
          ...prev,
          {
            speaker: item.speaker,
            text: item.text,
            timestamp: base + item.delayMs,
          },
        ]);
        if (index === DEMO_SCRIPT.length - 1) {
          setDemoFinished(true);
        }
      }, item.delayMs);
      timerRefs.current.push(timer);
    });
  };

  const handleSaveDemo = () => {
    if (!sessionId || demoTranscript.length === 0) return;
    completeWebCallDemo.mutate({
      sessionId,
      transcript: demoTranscript,
      callSummary:
        "Caregiver shared stress and requested nearby support options. The assistant provided self-serve guidance and programme direction without escalation.",
      topicClassified: "caregiver_stress",
      resolutionType: "self_serve",
      safetyResult: "SAFE",
      callbackRequested: false,
      consentVerballyConfirmed: true,
    });
  };

  const displayTranscript = useMemo(
    () =>
      isDemoSession
        ? demoTranscript.map((chunk) => ({
            speaker: chunk.speaker,
            text: chunk.text,
            timestamp: chunk.timestamp,
          }))
        : transcriptChunks,
    [demoTranscript, isDemoSession, transcriptChunks]
  );

  const liveStatus = isDemoSession ? (demoStarted ? (demoFinished ? "ready to save" : "browser demo live") : "waiting") : callStatus ?? session?.session.status ?? "unknown";
  const isActive = isDemoSession ? demoStarted && !demoFinished : callStatus === "active" || session?.session.status === "active";

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
              <h1 className="text-2xl font-bold tracking-tight">
                {isDemoSession ? "Browser Demo Call" : "Live Call Monitor"}
              </h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{sessionId}</p>
            </div>
            <div className="flex items-center gap-2">
              {isDemoSession ? (
                <Badge className="gap-1.5 bg-[#1d4e4b]/10 text-[#1d4e4b] hover:bg-[#1d4e4b]/10">
                  <Globe className="h-3 w-3" />
                  Browser demo
                </Badge>
              ) : connected ? (
                <Badge className="gap-1.5 bg-emerald-100 text-emerald-800">
                  <Wifi className="h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1.5">
                  <WifiOff className="h-3 w-3" />
                  Disconnected
                </Badge>
              )}
              {isActive && (
                <Badge className="gap-1.5 bg-blue-100 text-blue-800 animate-pulse">
                  <Radio className="h-3 w-3" />
                  Live
                </Badge>
              )}
            </div>
          </div>
        </div>

        {error && !isDemoSession && (
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
          {(consentVerified || isDemoSession) && (
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-700">Consent verified</span>
            </div>
          )}
          {!isDemoSession && !connected && !error && (
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Connecting...</span>
            </div>
          )}
        </div>

        {isDemoSession && (
          <Card className="border-[#ddd3c4] bg-[#ede7dc]/60">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#0f2e2c]">Demo web call mode</p>
                <p className="text-xs leading-6 text-muted-foreground">
                  This demo runs in the browser, then saves the transcript and outcome into portal history.
                </p>
              </div>
              {!demoStarted ? (
                <Button className="rounded-2xl bg-[#1d4e4b] hover:bg-[#0f2e2c]" onClick={startDemoConversation}>
                  <Mic className="mr-2 h-4 w-4" />
                  Start Demo Conversation
                </Button>
              ) : demoFinished ? (
                <Button
                  className="rounded-2xl bg-[#1d4e4b] hover:bg-[#0f2e2c]"
                  onClick={handleSaveDemo}
                  disabled={completeWebCallDemo.isPending}
                >
                  {completeWebCallDemo.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving demo call...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Save Demo Call
                    </>
                  )}
                </Button>
              ) : (
                <Badge variant="secondary" className="rounded-full px-3 py-1">Conversation in progress</Badge>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Radio className="h-4 w-4 text-primary" />
              {isDemoSession ? "Demo Transcript" : "Live Transcript"}
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
                  {isDemoSession ? (
                    <>
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#1d4e4b]/10">
                        <Globe className="h-5 w-5 text-[#1d4e4b]" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">Ready for your browser demo</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Start the scripted conversation to simulate a caregiver support call.
                      </p>
                    </>
                  ) : connected ? (
                    <>
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <Radio className="h-5 w-5 animate-pulse text-primary" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">Waiting for transcript...</p>
                      <p className="mt-1 text-xs text-muted-foreground">Messages will appear here as the call progresses.</p>
                    </>
                  ) : (
                    <>
                      <Loader2 className="mb-3 h-8 w-8 animate-spin text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Connecting to live stream...</p>
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

        {(consentVerified || isDemoSession) && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="flex items-center gap-3 py-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-900">Consent verified during this call</p>
                <p className="text-xs text-emerald-700">
                  {isDemoSession
                    ? "This browser demo will be saved into the caregiver's portal history."
                    : 'The linked Wibiz contact has been tagged with "Consent Verified".'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
