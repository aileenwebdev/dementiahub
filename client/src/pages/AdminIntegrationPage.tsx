import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  MessageCircle,
  Phone,
  RefreshCcw,
  ShieldAlert,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import DashboardLayout from "../components/DashboardLayout";

function formatDate(value?: string | number | Date | null) {
  if (!value) return "-";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function copyToClipboard(value?: string | null) {
  if (!value) return;
  void navigator.clipboard.writeText(value);
  toast.success("Copied");
}

function WebhookUrlRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-[1.2rem] border border-[#ddd3c4] bg-white/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">{label}</p>
          <p className="mt-2 break-all text-sm font-medium text-[#0f2e2c]">{value || "Unavailable"}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 rounded-full border-[#ddd3c4] bg-white"
          disabled={!value}
          onClick={() => copyToClipboard(value)}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function AdminIntegrationPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const integration = trpc.admin.integration.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const refreshPipeline = trpc.ghl.refreshPipelineCache.useMutation({
    onSuccess: async () => {
      await utils.admin.integration.invalidate();
      await utils.admin.overview.invalidate();
    },
  });

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="cg-panel rounded-[2rem] p-8 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-[#b77642]" />
          <h1 className="cg-display mt-4 text-3xl font-bold text-[#0f2e2c]">Admin access required</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Only admin accounts can inspect the Wibiz and ElevenLabs integration wiring.
          </p>
          <Button onClick={() => setLocation("/")} className="mt-6 rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]">
            Return to dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="cg-panel rounded-[2rem] px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="cg-label">Integration Diagnostics</p>
              <h1 className="cg-display mt-2 text-4xl font-bold text-[#0f2e2c] sm:text-5xl">
                Wibiz and ElevenLabs wiring
              </h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
                Review the location-level CRM configuration, ElevenLabs call wiring, webhook endpoints, and queued sync failures before we switch to your final production keys.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="rounded-full border-[#ddd3c4] bg-white/70 hover:bg-white"
                onClick={() => void integration.refetch()}
              >
                Refresh diagnostics
              </Button>
              <Button
                onClick={() => refreshPipeline.mutate()}
                disabled={refreshPipeline.isPending}
                className="rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                {refreshPipeline.isPending ? "Refreshing..." : "Refresh Wibiz pipeline cache"}
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-[#0f2e2c]">
                <Link2 className="h-5 w-5 text-[#1d4e4b]" />
                Wibiz
              </CardTitle>
              <CardDescription>Portal-to-CRM caregiver identity bridge and case pipeline visibility.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.2rem] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">Configured</p>
                  <p className="mt-2 text-lg font-semibold text-[#0f2e2c]">
                    {integration.data?.ghl.configured ? "Yes" : "No"}
                  </p>
                </div>
                <div className="rounded-[1.2rem] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">Connected</p>
                  <p className="mt-2 text-lg font-semibold text-[#0f2e2c]">
                    {integration.data?.ghl.connected ? "Yes" : "No"}
                  </p>
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[#ddd3c4] bg-white/65 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">Location ID</p>
                <p className="mt-2 break-all font-medium text-[#0f2e2c]">{integration.data?.ghl.locationId || "Waiting for production credential"}</p>
              </div>

              <div className="rounded-[1.2rem] border border-[#ddd3c4] bg-white/65 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">Caregiver Cases Pipeline</p>
                <p className="mt-2 font-medium text-[#0f2e2c]">
                  {integration.data?.ghl.caregiversPipeline?.name || "Pipeline not found yet"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {integration.data?.ghl.caregiversPipeline?.stages.map((stage) => (
                    <Badge key={stage.id} variant="secondary" className="rounded-full px-3 py-1">
                      {stage.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-[#0f2e2c]">
                <MessageCircle className="h-5 w-5 text-[#1d4e4b]" />
                Twilio and WhatsApp
              </CardTitle>
              <CardDescription>
                Plug-and-play inbound WhatsApp/SMS routing into the staff case queue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.2rem] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">Account SID</p>
                  <p className="mt-2 text-lg font-semibold text-[#0f2e2c]">
                    {integration.data?.twilio.accountSidConfigured ? "Configured" : "Missing"}
                  </p>
                </div>
                <div className="rounded-[1.2rem] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">Signature Validation</p>
                  <p className="mt-2 text-lg font-semibold text-[#0f2e2c]">
                    {integration.data?.twilio.authTokenConfigured ? "Enabled" : "Missing token"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.2rem] border border-[#ddd3c4] bg-white/65 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">WhatsApp Sender</p>
                  <p className="mt-2 break-all font-medium text-[#0f2e2c]">
                    {integration.data?.twilio.whatsappNumber || "Set TWILIO_WHATSAPP_NUMBER"}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border border-[#ddd3c4] bg-white/65 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">Messaging Service</p>
                  <p className="mt-2 break-all font-medium text-[#0f2e2c]">
                    {integration.data?.twilio.messagingServiceSid || "Optional"}
                  </p>
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[#ddd3c4] bg-white/65 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">Current behavior</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Incoming WhatsApp/SMS messages are matched by caregiver phone number, appended to the caregiver's portal chat, and surfaced in the staff/admin support queue. If no portal identity matches, Twilio receives a safe acknowledgement asking the caregiver to sign in and link their number.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-[#0f2e2c]">
                <Bot className="h-5 w-5 text-[#1d4e4b]" />
                ElevenLabs
              </CardTitle>
              <CardDescription>Outbound voice agent setup, recent conversations, and call ingestion status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.2rem] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">Configured</p>
                  <p className="mt-2 text-lg font-semibold text-[#0f2e2c]">
                    {integration.data?.elevenlabs.configured ? "Yes" : "No"}
                  </p>
                </div>
                <div className="rounded-[1.2rem] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">Agent ID</p>
                  <p className="mt-2 break-all text-sm font-semibold text-[#0f2e2c]">
                    {integration.data?.elevenlabs.agentId || "Waiting for production agent"}
                  </p>
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[#ddd3c4] bg-white/65 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">Recent Conversations</p>
                <div className="mt-3 space-y-3">
                  {integration.data?.elevenlabs.recentConversations.slice(0, 5).map((conversation) => (
                    <div key={conversation.conversation_id} className="rounded-2xl bg-[#ede7dc] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-[#0f2e2c]">{conversation.conversation_id}</p>
                        <Badge variant="secondary">{conversation.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {conversation.caller_phone || "No caller phone"} - {formatDate(conversation.start_time_unix_secs)}
                      </p>
                    </div>
                  ))}
                  {!integration.data?.elevenlabs.recentConversations.length ? (
                    <p className="text-sm text-muted-foreground">No recent ElevenLabs conversations were returned.</p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-[#0f2e2c]">
                <Webhook className="h-5 w-5 text-[#1d4e4b]" />
                Webhooks
              </CardTitle>
              <CardDescription>Endpoints that should be configured in ElevenLabs to push post-call and consent events back into the portal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <WebhookUrlRow label="ElevenLabs post-call webhook" value={integration.data?.webhooks.postCall} />
              <WebhookUrlRow label="ElevenLabs consent webhook" value={integration.data?.webhooks.consent} />
              <WebhookUrlRow label="Twilio WhatsApp/SMS incoming message webhook" value={integration.data?.webhooks.twilioMessaging} />
              <WebhookUrlRow label="Twilio message status callback" value={integration.data?.webhooks.twilioStatus} />
              <WebhookUrlRow label="Twilio voice webhook" value={integration.data?.webhooks.twilioVoice} />
              <WebhookUrlRow label="Health endpoint" value={integration.data?.webhooks.health} />

              <div className="rounded-[1.2rem] border border-[#ddd3c4] bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">Shared Secret</p>
                <div className="mt-2 flex items-center gap-2">
                  {integration.data?.webhooks.secretConfigured.postCall &&
                  integration.data?.webhooks.secretConfigured.consent ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium text-[#0f2e2c]">ElevenLabs secrets configured</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">ElevenLabs secret missing</span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {integration.data?.webhooks.secretConfigured.twilioSignature ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium text-[#0f2e2c]">Twilio signature validation enabled</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Twilio auth token missing</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-[#0f2e2c]">
                <Activity className="h-5 w-5 text-[#1d4e4b]" />
                Failed Sync Queue
              </CardTitle>
              <CardDescription>Webhook payloads that failed to sync into Wibiz and may need admin follow-up.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conversation</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Retries</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integration.data?.failedSyncs.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-[#0f2e2c]">{item.conversationId}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.webhookType}</Badge>
                      </TableCell>
                      <TableCell>{item.retryCount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
                      <TableCell className="max-w-[260px] whitespace-normal text-xs text-muted-foreground">
                        {item.errorMessage || "No error message saved"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!integration.data?.failedSyncs.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No pending failed syncs right now.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <Card className="cg-panel rounded-[2rem] border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl text-[#0f2e2c]">
              <Phone className="h-5 w-5 text-[#1d4e4b]" />
              Setup Checklist
            </CardTitle>
            <CardDescription>
              Admin handoff steps for Twilio, WhatsApp, and ElevenLabs routing.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            {[
              {
                title: "Twilio WhatsApp",
                body: "In Twilio Console, set the inbound message webhook for your WhatsApp sender or Messaging Service to the Twilio WhatsApp/SMS URL above. Use HTTP POST.",
              },
              {
                title: "Twilio Status",
                body: "Set the message status callback to the status URL above so delivery failures can be logged and surfaced later.",
              },
              {
                title: "ElevenLabs",
                body: "Keep ElevenLabs post-call and consent webhooks pointed to the portal URLs above. The next phase can send approved WhatsApp replies through Twilio after staff/AI policy is confirmed.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-[1.2rem] border border-[#ddd3c4] bg-white/65 p-4">
                <p className="font-semibold text-[#0f2e2c]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            variant="outline"
            className="rounded-full border-[#ddd3c4] bg-white/70 hover:bg-white"
            onClick={() => window.open("https://dementiahub-dashboard-production-1714.up.railway.app/api/webhooks/health", "_blank")}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open live webhook health
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
