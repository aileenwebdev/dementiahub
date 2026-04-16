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
      <span className="max-w-[60%] text-right text-sm font-medium">{value ?? "—"}</span>
    </div>
  );
}

export default function ChatConversationDetailsPage() {
  const params = useParams<{ conversationId: string }>();
  const [, setLocation] = useLocation();
  const conversationId = Number(params.conversationId);

  const { data, isLoading, error } = trpc.ai.getConversationDetails.useQuery(
    { conversationId },
    { enabled: Number.isFinite(conversationId) }
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
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

  const { conversation, messages } = data;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/history")} className="mb-3 -ml-2 gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to History
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{conversation.title ?? "Portal Chat"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(conversation.createdAt).toLocaleDateString(undefined, {
                  weekday: "long", year: "numeric", month: "long", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SafetyBadge result={conversation.safetyResult} />
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLocation("/assistant")}>
                <MessageSquare className="h-3.5 w-3.5" />
                Continue Chat
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
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
                  <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === "assistant" ? "" : "flex-row-reverse"}`}
                      >
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          message.role === "assistant" ? "bg-primary/10" : "bg-secondary"
                        }`}>
                          {message.role === "assistant" ? (
                            <Bot className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                          message.role === "assistant"
                            ? "rounded-tl-sm bg-muted text-foreground"
                            : "rounded-tr-sm bg-primary text-primary-foreground"
                        }`}>
                          <p className="whitespace-pre-wrap">{message.content}</p>
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
