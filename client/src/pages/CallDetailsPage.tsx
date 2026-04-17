import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  Headphones,
  Loader2,
  MessageSquare,
  Phone,
  PhoneCall,
  Radio,
  Shield,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../components/DashboardLayout";

const CASE_STATUSES = [
  "new",
  "open",
  "in_progress",
  "pending_callback",
  "pending_caregiver",
  "pending_internal",
  "resolved",
  "closed",
  "escalated",
] as const;

const CASE_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const CALLBACK_STATUSES = [
  "scheduled",
  "attempted",
  "connected",
  "no_answer",
  "left_voicemail",
  "invalid_number",
  "cancelled",
] as const;

function formatLabel(value?: string | null) {
  if (!value) return "Pending";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function SafetyBadge({ result }: { result?: string | null }) {
  if (!result) return <Badge variant="secondary">Pending</Badge>;
  if (result === "SAFE") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Safe</Badge>;
  if (result === "CAUTION") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Caution</Badge>;
  if (result === "UNSAFE") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Unsafe</Badge>;
  return <Badge variant="outline">{result}</Badge>;
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value ?? "-"}</span>
    </div>
  );
}

export default function CallDetailsPage() {
  const { user } = useAuth();
  const params = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const sessionId = params.sessionId;
  const isStaff = user?.role === "admin" || user?.role === "staff";

  const callQuery = trpc.calls.getCallDetails.useQuery(
    { sessionId: sessionId ?? "" },
    { enabled: Boolean(sessionId) }
  );
  const supportCaseQuery = trpc.admin.staffCallCase.useQuery(
    { sessionId: sessionId ?? "" },
    { enabled: isStaff && Boolean(sessionId) }
  );

  const [caseStatus, setCaseStatus] = useState<(typeof CASE_STATUSES)[number]>("open");
  const [casePriority, setCasePriority] = useState<(typeof CASE_PRIORITIES)[number]>("normal");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [callbackPhone, setCallbackPhone] = useState("");
  const [callbackStatus, setCallbackStatus] = useState<(typeof CALLBACK_STATUSES)[number]>("attempted");
  const [callbackNotes, setCallbackNotes] = useState("");

  const session = supportCaseQuery.data?.session ?? callQuery.data?.session;
  const transcriptChunks = supportCaseQuery.data?.transcriptChunks ?? callQuery.data?.transcriptChunks ?? [];
  const caregiver = supportCaseQuery.data?.caregiver;
  const identity = supportCaseQuery.data?.identity;
  const callbacks = supportCaseQuery.data?.callbacks ?? [];
  const assignedStaff = supportCaseQuery.data?.assignedStaff;

  useEffect(() => {
    if (!session) return;
    setCaseStatus((session.caseStatus as (typeof CASE_STATUSES)[number]) ?? "open");
    setCasePriority((session.casePriority as (typeof CASE_PRIORITIES)[number]) ?? "normal");
    setResolutionNotes(session.resolutionNotes ?? "");
  }, [session]);

  useEffect(() => {
    if (identity?.phoneNumber) {
      setCallbackPhone(identity.phoneNumber);
    }
  }, [identity?.phoneNumber]);

  const updateCase = trpc.admin.updateCallCase.useMutation({
    onSuccess: async () => {
      toast.success("Call case updated");
      if (!sessionId) return;
      await Promise.all([
        utils.calls.getCallDetails.invalidate({ sessionId }),
        utils.admin.staffCallCase.invalidate({ sessionId }),
        utils.admin.staffDashboard.invalidate(),
      ]);
    },
    onError: (error) => toast.error("Could not update case", { description: error.message }),
  });

  const logCallbackAttempt = trpc.admin.logCallbackAttempt.useMutation({
    onSuccess: async () => {
      toast.success("Callback saved");
      setCallbackNotes("");
      if (!sessionId) return;
      await Promise.all([
        utils.admin.staffCallCase.invalidate({ sessionId }),
        utils.admin.staffDashboard.invalidate(),
      ]);
    },
    onError: (error) => toast.error("Could not save callback", { description: error.message }),
  });

  const isLoading = callQuery.isLoading || (isStaff && supportCaseQuery.isLoading);
  const error = callQuery.error ?? supportCaseQuery.error;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !session) {
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

  const isWebDemo = session.sessionId.startsWith("web_");
  const transcriptLines: Array<{ speaker: string; text: string }> = transcriptChunks.length > 0
    ? transcriptChunks.map((t: { speaker: string; text: string }) => ({ speaker: t.speaker, text: t.text }))
    : session.transcriptRaw
      ? session.transcriptRaw.split("\n").filter(Boolean).map((line: string) => {
          const match = line.match(/^\[(AGENT|USER)\]:\s*(.*)/i);
          return match
            ? { speaker: match[1].toLowerCase(), text: match[2] }
            : { speaker: "unknown", text: line };
        })
      : [];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/history")} className="gap-2 mb-3 -ml-2">
            <ArrowLeft className="h-4 w-4" /> Back to History
          </Button>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight capitalize">
                {session.topicClassified
                  ? session.topicClassified.replace(/_/g, " ")
                  : isWebDemo
                    ? "Browser Demo Call"
                    : "Phone Call"}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {new Date(session.createdAt).toLocaleDateString(undefined, {
                  weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SafetyBadge result={session.safetyResult} />
              {isStaff ? <Badge variant="outline">{formatLabel(session.caseStatus)}</Badge> : null}
              {session.humanTakeover ? <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Human owned</Badge> : null}
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

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
          <div className="space-y-4">
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
                  <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                    {transcriptLines.map((line, i) => (
                      <div key={i} className={`flex gap-3 ${line.speaker === "agent" ? "" : "flex-row-reverse"}`}>
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                          line.speaker === "agent" ? "bg-primary/10" : "bg-secondary"
                        }`}>
                          {line.speaker === "agent" ? (
                            <Bot className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm ${
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
                <MetaRow label="Channel" value={isWebDemo ? "Browser demo" : "Phone call"} />
                <MetaRow
                  label="Duration"
                  value={session.callDurationSeconds
                    ? `${Math.floor(session.callDurationSeconds / 60)}m ${session.callDurationSeconds % 60}s`
                    : null}
                />
                <MetaRow label="Resolution" value={session.resolutionType} />
                <MetaRow label="Callback Requested" value={session.callbackRequested ? <span className="text-amber-600">Yes</span> : "No"} />
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

            {isStaff ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Headphones className="h-4 w-4 text-sky-700" />
                    Staff Case Controls
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Case status</p>
                      <Select value={caseStatus} onValueChange={(value) => setCaseStatus(value as (typeof CASE_STATUSES)[number])}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CASE_STATUSES.map((value) => (
                            <SelectItem key={value} value={value}>{formatLabel(value)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Priority</p>
                      <Select value={casePriority} onValueChange={(value) => setCasePriority(value as (typeof CASE_PRIORITIES)[number])}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CASE_PRIORITIES.map((value) => (
                            <SelectItem key={value} value={value}>{formatLabel(value)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#ddd3c4] bg-white/60 p-4 text-sm">
                    <p className="font-medium text-[#0f2e2c]">{caregiver?.name || "Caregiver case"}</p>
                    <p className="mt-1 text-muted-foreground">{caregiver?.email || caregiver?.openId || "No email on file"}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">Assigned staff</p>
                    <p className="mt-1 text-sm text-[#0f2e2c]">{assignedStaff?.name || "Unassigned"}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">Phone</p>
                    <p className="mt-1 font-mono text-sm text-[#0f2e2c]">{identity?.phoneNumber || "No phone number on file"}</p>
                  </div>

                  <Textarea
                    value={resolutionNotes}
                    onChange={(event) => setResolutionNotes(event.target.value)}
                    rows={3}
                    placeholder="Internal notes, disposition, or follow-up instructions..."
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() =>
                        updateCase.mutate({
                          sessionId,
                          ownershipAction: assignedStaff?.id === user?.id ? "release" : "claim",
                        })
                      }
                    >
                      {assignedStaff?.id === user?.id ? "Release case" : "Claim case"}
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() =>
                        updateCase.mutate({
                          sessionId,
                          humanTakeover: !session.humanTakeover,
                        })
                      }
                    >
                      {session.humanTakeover ? "Mark AI-owned" : "Mark human-owned"}
                    </Button>
                    <Button
                      className="rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]"
                      disabled={updateCase.isPending}
                      onClick={() =>
                        updateCase.mutate({
                          sessionId,
                          caseStatus,
                          casePriority,
                          resolutionNotes,
                        })
                      }
                    >
                      Save case updates
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {isStaff ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <PhoneCall className="h-4 w-4 text-primary" />
                    Callback Tracking
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    value={callbackPhone}
                    onChange={(event) => setCallbackPhone(event.target.value)}
                    placeholder="+65 9123 4567"
                  />
                  <Select value={callbackStatus} onValueChange={(value) => setCallbackStatus(value as (typeof CALLBACK_STATUSES)[number])}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CALLBACK_STATUSES.map((value) => (
                        <SelectItem key={value} value={value}>{formatLabel(value)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={callbackNotes}
                    onChange={(event) => setCallbackNotes(event.target.value)}
                    rows={3}
                    placeholder="Log the callback result, voicemail, or next attempt plan..."
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      disabled={!callbackPhone}
                      onClick={() => {
                        window.location.href = `tel:${callbackPhone}`;
                      }}
                    >
                      <PhoneCall className="mr-2 h-4 w-4" />
                      Call externally
                    </Button>
                    <Button
                      className="rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]"
                      disabled={!callbackPhone || logCallbackAttempt.isPending}
                      onClick={() =>
                        logCallbackAttempt.mutate({
                          portalUserId: session.portalUserId,
                          sessionId,
                          phoneNumber: callbackPhone,
                          status: callbackStatus,
                          notes: callbackNotes,
                        })
                      }
                    >
                      Save callback history
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    {callbacks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No callback attempts logged for this call yet.</p>
                    ) : (
                      callbacks.map(({ attempt, staffUser }: any) => (
                        <div key={attempt.id} className="rounded-2xl border border-[#ddd3c4] bg-white/60 p-3 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-[#0f2e2c]">{formatLabel(attempt.status)}</p>
                              <p className="mt-1 font-mono text-xs text-muted-foreground">{attempt.phoneNumber}</p>
                            </div>
                            <Badge variant="outline">{new Date(attempt.createdAt).toLocaleString()}</Badge>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">Staff: {staffUser?.name || staffUser?.email || "Unknown staff"}</p>
                          {attempt.notes ? <p className="mt-2 text-sm text-muted-foreground">{attempt.notes}</p> : null}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-primary" />
                  Wibiz Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 divide-y divide-border">
                <MetaRow
                  label="Wibiz Synced"
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
                  <MetaRow label="Wibiz Contact ID" value={<span className="font-mono text-xs">{session.ghlContactId}</span>} />
                )}
                {session.ghlOpportunityId && (
                  <MetaRow label="Wibiz Opportunity ID" value={<span className="font-mono text-xs">{session.ghlOpportunityId}</span>} />
                )}
                {session.ghlSyncedAt && <MetaRow label="Synced At" value={new Date(session.ghlSyncedAt).toLocaleString()} />}
                {session.ghlSyncError && (
                  <div className="pt-2">
                    <p className="text-xs text-red-600 bg-red-50 rounded p-2">{session.ghlSyncError}</p>
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
