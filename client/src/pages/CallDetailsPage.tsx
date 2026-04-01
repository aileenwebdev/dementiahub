import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MessageSquare,
  Phone,
  Radio,
  Shield,
  User,
  XCircle,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../components/DashboardLayout";

function SafetyBadge({ result }: { result?: string | null }) {
  if (!result) return <Badge variant="secondary">Pending</Badge>;
  if (result === "SAFE") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Safe</Badge>;
  if (result === "CAUTION") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Caution</Badge>;
  if (result === "UNSAFE") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Unsafe</Badge>;
  return <Badge variant="outline">{result}</Badge>;
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value ?? "—"}</span>
    </div>
  );
}

export default function CallDetailsPage() {
  const params = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const sessionId = params.sessionId;

  const { data, isLoading, error } = trpc.calls.getCallDetails.useQuery(
    { sessionId: sessionId ?? "" },
    { enabled: Boolean(sessionId) }
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/history")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to History
          </Button>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-8 text-center">
              <XCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
              <p className="font-medium text-red-900">Call not found</p>
              <p className="text-sm text-red-700 mt-1">{error?.message ?? "This call session could not be loaded."}</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const { session, transcriptChunks } = data;

  // Build transcript from DB chunks or fall back to raw text
  const transcriptLines: Array<{ speaker: string; text: string }> = transcriptChunks.length > 0
    ? transcriptChunks.map((t) => ({ speaker: t.speaker, text: t.text }))
    : session.transcriptRaw
    ? session.transcriptRaw.split("\n").filter(Boolean).map((line) => {
        const match = line.match(/^\[(AGENT|USER)\]:\s*(.*)/i);
        return match
          ? { speaker: match[1].toLowerCase(), text: match[2] }
          : { speaker: "unknown", text: line };
      })
    : [];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back + Header */}
        <div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/history")} className="gap-2 mb-3 -ml-2">
            <ArrowLeft className="h-4 w-4" /> Back to History
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight capitalize">
                {session.topicClassified ? session.topicClassified.replace(/_/g, " ") : "Voice Call"}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {new Date(session.createdAt).toLocaleDateString(undefined, {
                  weekday: "long", year: "numeric", month: "long", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SafetyBadge result={session.safetyResult} />
              {session.status === "active" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                  onClick={() => setLocation(`/call/${session.sessionId}/live`)}
                >
                  <Radio className="h-3.5 w-3.5" />
                  Live Monitor
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transcript */}
          <div className="lg:col-span-2 space-y-4">
            {session.callSummary && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Call Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground leading-relaxed">{session.callSummary}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Transcript
                  {transcriptChunks.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-auto">
                      {transcriptChunks.length} messages
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transcriptLines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">No transcript available yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Transcript will appear here after the call completes and syncs.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {transcriptLines.map((line, i) => (
                      <div
                        key={i}
                        className={`flex gap-3 ${line.speaker === "agent" ? "" : "flex-row-reverse"}`}
                      >
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                          line.speaker === "agent" ? "bg-primary/10" : "bg-secondary"
                        }`}>
                          {line.speaker === "agent" ? (
                            <Bot className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                          line.speaker === "agent"
                            ? "bg-muted text-foreground rounded-tl-sm"
                            : "bg-primary text-primary-foreground rounded-tr-sm"
                        }`}>
                          {line.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Metadata */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Safety Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 divide-y divide-border">
                <MetaRow label="Result" value={<SafetyBadge result={session.safetyResult} />} />
                {session.safetyFlagType && session.safetyFlagType !== "none" && (
                  <MetaRow label="Flag Type" value={session.safetyFlagType} />
                )}
                <MetaRow
                  label="Escalation"
                  value={
                    session.escalationTriggered ? (
                      <span className="text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Triggered
                      </span>
                    ) : (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> None
                      </span>
                    )
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  Call Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 divide-y divide-border">
                <MetaRow label="Status" value={session.status} />
                <MetaRow
                  label="Duration"
                  value={session.callDurationSeconds
                    ? `${Math.floor(session.callDurationSeconds / 60)}m ${session.callDurationSeconds % 60}s`
                    : null}
                />
                <MetaRow label="Resolution" value={session.resolutionType} />
                <MetaRow
                  label="Callback Requested"
                  value={
                    session.callbackRequested ? (
                      <span className="text-amber-600">Yes</span>
                    ) : "No"
                  }
                />
                <MetaRow
                  label="Consent Verified"
                  value={
                    session.consentVerballyConfirmed ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                      </span>
                    ) : "No"
                  }
                />
                <MetaRow label="ASR Confidence" value={session.asrConfidence} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-primary" />
                  GHL Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 divide-y divide-border">
                <MetaRow
                  label="GHL Synced"
                  value={
                    session.ghlSynced ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                      </span>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Pending
                      </span>
                    )
                  }
                />
                {session.ghlContactId && (
                  <MetaRow
                    label="Contact ID"
                    value={
                      <span className="font-mono text-xs">{session.ghlContactId}</span>
                    }
                  />
                )}
                {session.ghlOpportunityId && (
                  <MetaRow
                    label="Opportunity ID"
                    value={
                      <span className="font-mono text-xs">{session.ghlOpportunityId}</span>
                    }
                  />
                )}
                {session.ghlSyncedAt && (
                  <MetaRow
                    label="Synced At"
                    value={new Date(session.ghlSyncedAt).toLocaleString()}
                  />
                )}
                {session.ghlSyncError && (
                  <div className="pt-2">
                    <p className="text-xs text-red-600 bg-red-50 rounded p-2">
                      {session.ghlSyncError}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium mb-1">Session ID</p>
                <code className="text-xs font-mono break-all">{session.sessionId}</code>
                {session.elevenlabsConversationId && (
                  <>
                    <Separator className="my-2" />
                    <p className="text-xs text-muted-foreground font-medium mb-1">ElevenLabs ID</p>
                    <code className="text-xs font-mono break-all">{session.elevenlabsConversationId}</code>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
