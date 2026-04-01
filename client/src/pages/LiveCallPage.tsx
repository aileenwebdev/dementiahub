/**
 * LiveCallPage — Real-time call monitor with live transcript streaming.
 * Accessible at /call/:sessionId/live
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useCallSocket } from "@/hooks/useCallSocket";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Loader2,
  Radio,
  Shield,
  User,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../components/DashboardLayout";

export default function LiveCallPage() {
  const params = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const sessionId = params.sessionId;
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const { data: session } = trpc.calls.getCallDetails.useQuery(
    { sessionId: sessionId ?? "" },
    { enabled: Boolean(sessionId), refetchInterval: 5000 }
  );

  const { connected, transcriptChunks, callStatus, consentVerified, error } =
    useCallSocket(sessionId);

  // Auto-scroll to bottom of transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptChunks]);

  const isActive = callStatus === "active" || session?.session.status === "active";

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/call/${sessionId}`)}
            className="gap-2 mb-3 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Details
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Live Call Monitor</h1>
              <p className="text-muted-foreground mt-1 text-sm font-mono text-xs">
                {sessionId}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {connected ? (
                <Badge className="bg-emerald-100 text-emerald-800 gap-1.5">
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
                <Badge className="bg-blue-100 text-blue-800 gap-1.5 animate-pulse">
                  <Radio className="h-3 w-3" />
                  Live
                </Badge>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Status bar */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Call Status:</span>
            <Badge variant="outline" className="text-xs capitalize">
              {callStatus ?? session?.session.status ?? "unknown"}
            </Badge>
          </div>
          {consentVerified && (
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs text-emerald-700 font-medium">Consent Verified</span>
            </div>
          )}
          {!connected && !error && (
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Connecting...</span>
            </div>
          )}
        </div>

        {/* Live Transcript */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              Live Transcript
              {transcriptChunks.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-auto">
                  {transcriptChunks.length} messages
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 min-h-[300px] max-h-[500px] overflow-y-auto pr-1">
              {transcriptChunks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[280px] text-center">
                  {connected ? (
                    <>
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                        <Radio className="h-5 w-5 text-primary animate-pulse" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Waiting for transcript...
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Messages will appear here as the call progresses
                      </p>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">Connecting to live stream...</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {transcriptChunks.map((chunk, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 ${chunk.speaker === "agent" ? "" : "flex-row-reverse"}`}
                    >
                      <div
                        className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
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
                            ? "bg-muted text-foreground rounded-tl-sm"
                            : "bg-primary text-primary-foreground rounded-tr-sm"
                        }`}
                      >
                        <p>{chunk.text}</p>
                        <p
                          className={`text-[10px] mt-1 opacity-60 ${
                            chunk.speaker !== "agent" ? "text-right" : ""
                          }`}
                        >
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

        {/* Consent indicator */}
        {consentVerified && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="flex items-center gap-3 py-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-900">Consent verified during this call</p>
                <p className="text-xs text-emerald-700">GHL contact has been tagged with "Consent Verified"</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
