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
  PhoneCall,
  Shield,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

export default function ChatConversationDetailsPage() {
  const { user } = useAuth();
  const params = useParams<{ conversationId: string }>();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const conversationId = Number(params.conversationId);
  const isStaff = user?.role === "admin" || user?.role === "staff";

  const detailsQuery = trpc.ai.getConversationDetails.useQuery(
    { conversationId },
    { enabled: Number.isFinite(conversationId) }
  );
  const supportCaseQuery = trpc.admin.staffConversationCase.useQuery(
    { conversationId },
    { enabled: isStaff && Number.isFinite(conversationId) }
  );

  const [caseStatus, setCaseStatus] = useState<(typeof CASE_STATUSES)[number]>("open");
  const [casePriority, setCasePriority] = useState<(typeof CASE_PRIORITIES)[number]>("normal");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [staffReply, setStaffReply] = useState("");
  const [callbackPhone, setCallbackPhone] = useState("");
  const [callbackStatus, setCallbackStatus] = useState<(typeof CALLBACK_STATUSES)[number]>("attempted");
  const [callbackNotes, setCallbackNotes] = useState("");

  const conversation = supportCaseQuery.data?.conversation ?? detailsQuery.data?.conversation;
  const messages = supportCaseQuery.data?.messages ?? detailsQuery.data?.messages ?? [];
  const caregiver = supportCaseQuery.data?.caregiver;
  const identity = supportCaseQuery.data?.identity;
  const callbacks = supportCaseQuery.data?.callbacks ?? [];
  const assignedStaff = supportCaseQuery.data?.assignedStaff;

  useEffect(() => {
    if (!conversation) return;
    setCaseStatus((conversation.caseStatus as (typeof CASE_STATUSES)[number]) ?? "open");
    setCasePriority((conversation.casePriority as (typeof CASE_PRIORITIES)[number]) ?? "normal");
    setResolutionNotes(conversation.resolutionNotes ?? "");
  }, [conversation]);

  useEffect(() => {
    if (identity?.phoneNumber) {
      setCallbackPhone(identity.phoneNumber);
    }
  }, [identity?.phoneNumber]);

  const updateCase = trpc.admin.updateConversationCase.useMutation({
    onSuccess: async () => {
      toast.success("Case updated");
      await Promise.all([
        utils.ai.getConversationDetails.invalidate({ conversationId }),
        utils.admin.staffConversationCase.invalidate({ conversationId }),
        utils.admin.staffDashboard.invalidate(),
      ]);
    },
    onError: (error) => toast.error("Could not update case", { description: error.message }),
  });

  const sendStaffReply = trpc.admin.sendStaffChatReply.useMutation({
    onSuccess: async () => {
      setStaffReply("");
      toast.success("Staff reply sent");
      await Promise.all([
        utils.ai.getConversationDetails.invalidate({ conversationId }),
        utils.admin.staffConversationCase.invalidate({ conversationId }),
        utils.admin.staffDashboard.invalidate(),
      ]);
    },
    onError: (error) => toast.error("Could not send staff reply", { description: error.message }),
  });

  const logCallbackAttempt = trpc.admin.logCallbackAttempt.useMutation({
    onSuccess: async () => {
      setCallbackNotes("");
      toast.success("Callback history saved");
      await Promise.all([
        utils.admin.staffConversationCase.invalidate({ conversationId }),
        utils.admin.staffDashboard.invalidate(),
      ]);
    },
    onError: (error) => toast.error("Could not save callback", { description: error.message }),
  });

  const isLoading = detailsQuery.isLoading || (isStaff && supportCaseQuery.isLoading);
  const error = detailsQuery.error ?? supportCaseQuery.error;

  const callbackHistory = useMemo(() => callbacks, [callbacks]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !conversation) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-2xl space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/history")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to History
          </Button>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-8 text-center">
              <XCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
              <p className="font-medium text-red-900">Chat conversation not found</p>
              <p className="mt-1 text-sm text-red-700">{error?.message ?? "This chat conversation could not be loaded."}</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/history")} className="mb-3 -ml-2 gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to History
          </Button>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{conversation.title ?? "Portal Chat"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(conversation.createdAt).toLocaleDateString(undefined, {
                  weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SafetyBadge result={conversation.safetyResult} />
              {isStaff ? <Badge variant="outline">{formatLabel(conversation.caseStatus)}</Badge> : null}
              {conversation.humanTakeover ? (
                <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Human takeover active</Badge>
              ) : null}
              {!isStaff ? (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLocation("/assistant")}>
                  <MessageSquare className="h-3.5 w-3.5" />
                  Continue Chat
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
          <div className="space-y-4">
            {conversation.conversationSummary ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Chat Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-foreground">{conversation.conversationSummary}</p>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Transcript
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {messages.length} messages
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No messages saved yet</p>
                  </div>
                ) : (
                  <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
                    {messages.map((message: any) => {
                      const isCaregiver = message.role === "user";
                      const isStaffMessage = message.role === "staff";
                      return (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${isCaregiver ? "flex-row-reverse" : ""}`}
                        >
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            isCaregiver
                              ? "bg-secondary"
                              : isStaffMessage
                                ? "bg-sky-100"
                                : "bg-primary/10"
                          }`}>
                            {isCaregiver ? (
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : isStaffMessage ? (
                              <Headphones className="h-3.5 w-3.5 text-sky-700" />
                            ) : (
                              <Bot className="h-3.5 w-3.5 text-primary" />
                            )}
                          </div>
                          <div
                            className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm ${
                              isCaregiver
                                ? "rounded-tr-sm bg-primary text-primary-foreground"
                                : isStaffMessage
                                  ? "rounded-tl-sm border border-sky-200 bg-sky-50 text-sky-950"
                                  : "rounded-tl-sm bg-muted text-foreground"
                            }`}
                          >
                            {isStaffMessage ? (
                              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                                Human staff
                              </p>
                            ) : null}
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {isStaff ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Headphones className="h-4 w-4 text-sky-700" />
                    Human reply
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={staffReply}
                    onChange={(event) => setStaffReply(event.target.value)}
                    rows={4}
                    placeholder="Reply to the caregiver as a human staff member..."
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]"
                      disabled={!staffReply.trim() || sendStaffReply.isPending}
                      onClick={() => sendStaffReply.mutate({ conversationId, content: staffReply })}
                    >
                      {sendStaffReply.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                      Send human reply
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() =>
                        updateCase.mutate({
                          conversationId,
                          humanTakeover: !conversation.humanTakeover,
                        })
                      }
                    >
                      {conversation.humanTakeover ? "Release back to AI" : "Enable human takeover"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Shield className="h-4 w-4 text-primary" />
                  Safety Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 divide-y divide-border">
                <MetaRow label="Result" value={<SafetyBadge result={conversation.safetyResult} />} />
                {conversation.safetyFlagType && conversation.safetyFlagType !== "none" ? (
                  <MetaRow label="Flag Type" value={conversation.safetyFlagType} />
                ) : null}
                <MetaRow
                  label="Escalation"
                  value={
                    conversation.escalationTriggered ? (
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertTriangle className="h-3.5 w-3.5" /> Triggered
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> None
                      </span>
                    )
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Chat Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 divide-y divide-border">
                <MetaRow label="Status" value={conversation.status} />
                <MetaRow label="Channel" value="Portal chat" />
                <MetaRow label="Topic" value={conversation.topicClassified ?? "general"} />
                <MetaRow label="Resolution" value={conversation.resolutionType ?? "pending"} />
                <MetaRow label="Callback Requested" value={conversation.callbackRequested ? "Yes" : "No"} />
                <MetaRow label="Consent Verified" value={conversation.consentVerballyConfirmed ? "Yes" : "No"} />
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
                    placeholder="Resolution notes, next steps, or staff handoff context..."
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() =>
                        updateCase.mutate({
                          conversationId,
                          ownershipAction: assignedStaff?.id === user?.id ? "release" : "claim",
                        })
                      }
                    >
                      {assignedStaff?.id === user?.id ? "Release case" : "Claim case"}
                    </Button>
                    <Button
                      className="rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]"
                      disabled={updateCase.isPending}
                      onClick={() =>
                        updateCase.mutate({
                          conversationId,
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
                    placeholder="Outcome notes, voicemail details, or next callback step..."
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
                          portalUserId: conversation.portalUserId,
                          conversationId,
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
                    {callbackHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No callbacks logged for this chat case yet.</p>
                    ) : (
                      callbackHistory.map(({ attempt, staffUser }: any) => (
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
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <ExternalLink className="h-4 w-4 text-primary" />
                  Wibiz Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 divide-y divide-border">
                <MetaRow
                  label="Wibiz Synced"
                  value={
                    conversation.ghlSynced ? (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" /> Pending
                      </span>
                    )
                  }
                />
                {conversation.ghlSyncedAt ? (
                  <MetaRow label="Synced At" value={new Date(conversation.ghlSyncedAt).toLocaleString()} />
                ) : null}
                {conversation.ghlSyncError ? (
                  <div className="pt-2">
                    <p className="rounded bg-red-50 p-2 text-xs text-red-600">{conversation.ghlSyncError}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pb-3 pt-4">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Conversation ID</p>
                <code className="break-all text-xs font-mono">{conversation.id}</code>
                {conversation.elevenlabsConversationId ? (
                  <>
                    <Separator className="my-2" />
                    <p className="mb-1 text-xs font-medium text-muted-foreground">ElevenLabs ID</p>
                    <code className="break-all text-xs font-mono">{conversation.elevenlabsConversationId}</code>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
