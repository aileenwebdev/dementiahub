import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Activity, AlertTriangle, Brain, CheckCircle2, Clock, Phone, PhoneCall, Shield, XCircle } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "../components/DashboardLayout";

function SafetyBadge({ result }: { result?: string | null }) {
  if (!result) return <Badge variant="secondary">Pending</Badge>;
  if (result === "SAFE") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Safe</Badge>;
  if (result === "CAUTION") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Caution</Badge>;
  if (result === "UNSAFE") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Unsafe</Badge>;
  return <Badge variant="outline">{result}</Badge>;
}

function StatusIndicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="h-4 w-4 shrink-0 text-red-400" />}
      <span className="text-white/76">{label}</span>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: callHistory } = trpc.calls.getCallHistory.useQuery({ limit: 5 });
  const { data: integrationStatus } = trpc.ghl.getIntegrationStatus.useQuery();
  const { data: setupStatus } = trpc.identity.checkSetupStatus.useQuery();
  const { data: identity } = trpc.identity.getMyIdentity.useQuery();
  const postLoginSync = trpc.auth.postLoginSync.useMutation();

  useEffect(() => {
    postLoginSync.mutate();
  }, []);

  const totalCalls = callHistory?.length ?? 0;
  const completedCalls = callHistory?.filter((c) => c.status === "completed" || c.status === "synced").length ?? 0;
  const safeCalls = callHistory?.filter((c) => c.safetyResult === "SAFE").length ?? 0;
  const callbackPending = callHistory?.filter((c) => c.callbackRequested && c.status !== "synced").length ?? 0;
  const recentCalls = callHistory?.slice(0, 5) ?? [];

  const sidebar = (
    <div className="cg-sidebar-card sticky top-[104px] rounded-[1.6rem] p-6">
      <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-white/32">Your Profile</p>
      <div className="rounded-[1.25rem] border border-white/10 bg-white/6 p-5">
        <p className="cg-display text-2xl font-bold text-white">{user?.name ?? "Caregiver"}</p>
        <p className="mt-2 text-sm text-white/46">{identity?.phoneNumber ?? "Add your phone number in profile"}</p>
        <p className="mt-1 text-sm text-white/46">{user?.email ?? "Portal account"}</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#d4935a]/18 px-3 py-1 text-xs text-[#edb27e]">
          <Brain className="h-3.5 w-3.5" />
          {identity?.preferredLanguage ?? "English"}
        </div>
      </div>

      <p className="mb-4 mt-6 text-[11px] uppercase tracking-[0.18em] text-white/32">Portal Status</p>
      <div className="space-y-3">
        <StatusIndicator ok={integrationStatus?.ghl.configured ?? false} label="Wibiz configured" />
        <StatusIndicator ok={integrationStatus?.ghl.connected ?? false} label="Wibiz connected" />
        <StatusIndicator ok={setupStatus?.hasGHLContact ?? false} label="Wibiz contact linked" />
        <StatusIndicator ok={setupStatus?.consentGiven ?? false} label="Consent verified" />
      </div>

      <div className="mt-8 rounded-[1.4rem] bg-gradient-to-br from-[#d4935a] to-[#b77642] p-5 text-white">
        <p className="cg-display text-xl font-bold">Need urgent help?</p>
        <p className="mt-2 text-3xl font-black tracking-tight">6377 0700</p>
        <p className="mt-1 text-sm text-white/72">Mon-Fri 9am-6pm, Sat 9am-1pm</p>
      </div>
    </div>
  );

  return (
    <DashboardLayout sidebar={sidebar}>
      <div className="space-y-6">
        <section className="cg-panel rounded-[2rem] px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="cg-label">Caregiver Workspace</p>
              <h1 className="cg-display mt-2 text-4xl font-bold text-[#0f2e2c] sm:text-5xl">
                Hello, {user?.name?.split(" ")[0] ?? "there"}.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                Your assistant, call records, and support pathways live here. The portal now keeps your caregiver identity and AI context together.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#7a9e8a]/22 bg-[#7a9e8a]/10 px-4 py-2 text-sm font-medium text-[#527a68]">
                <span className="h-2 w-2 rounded-full bg-[#7a9e8a]" />
                AI assistant online
              </div>
              <Button onClick={() => setLocation("/assistant")} className="h-11 rounded-full bg-[#1d4e4b] px-5 hover:bg-[#0f2e2c]">
                Open Assistant
              </Button>
              {user?.role === "admin" && (
                <Button
                  variant="outline"
                  onClick={() => setLocation("/demo/dry-run")}
                  className="h-11 rounded-full border-[#1d4e4b]/15 bg-white/70 px-5 text-[#1d4e4b] hover:bg-white"
                >
                  Open Dry Run Center
                </Button>
              )}
            </div>
          </div>
        </section>

        {setupStatus && !setupStatus.hasPhone && (
          <section className="rounded-[1.6rem] border border-[#d4935a]/24 bg-[#d4935a]/10 px-5 py-4 text-[#84532d]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#b77642]" />
                <div>
                  <p className="font-medium">Profile setup incomplete</p>
                  <p className="mt-1 text-sm">Add your phone number to enable voice calls and keep your caregiver record fully linked.</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setLocation("/profile")} className="rounded-full border-[#d4935a]/35 bg-white/70 text-[#84532d] hover:bg-white">
                Complete Setup
              </Button>
            </div>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Calls", value: totalCalls, icon: PhoneCall, tone: "bg-[#1d4e4b]/10 text-[#1d4e4b]" },
            { label: "Completed", value: completedCalls, icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700" },
            { label: "Safe Calls", value: safeCalls, icon: Shield, tone: "bg-[#7a9e8a]/14 text-[#527a68]" },
            { label: "Callbacks Due", value: callbackPending, icon: Clock, tone: "bg-[#d4935a]/14 text-[#b77642]" },
          ].map((stat) => (
            <div key={stat.label} className="cg-stat rounded-[1.5rem] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="cg-label">{stat.label}</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-[#0f2e2c]">{stat.value}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${stat.tone}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <div className="cg-panel rounded-[2rem] p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="cg-label">Recent Call History</p>
                <h2 className="cg-display mt-2 text-3xl font-bold text-[#0f2e2c]">Your latest conversations</h2>
              </div>
              <Button variant="ghost" onClick={() => setLocation("/history")} className="rounded-full text-[#527a68] hover:bg-[#ede7dc] hover:text-[#0f2e2c]">
                View all
              </Button>
            </div>

            {recentCalls.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[#ddd3c4] bg-white/50 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ede7dc]">
                  <PhoneCall className="h-6 w-6 text-[#527a68]" />
                </div>
                <p className="mt-4 text-lg font-medium text-[#0f2e2c]">No calls yet</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Start your first call to build a support history for this caregiver account.
                </p>
                <Button onClick={() => setLocation("/call")} className="mt-5 rounded-full bg-[#1d4e4b] px-5 hover:bg-[#0f2e2c]">
                  Start a Call
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCalls.map((call) => (
                  <button
                    key={call.id}
                    onClick={() => setLocation(`/call/${call.sessionId}`)}
                    className="cg-soft-raise flex w-full items-center justify-between rounded-[1.3rem] border border-[#ddd3c4] bg-white/65 p-4 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1d4e4b]/10">
                        <Phone className="h-5 w-5 text-[#1d4e4b]" />
                      </div>
                      <div>
                        <p className="font-medium capitalize text-[#0f2e2c]">
                          {call.topicClassified ? call.topicClassified.replace(/_/g, " ") : "Voice call"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {new Date(call.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <SafetyBadge result={call.safetyResult} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <Card className="cg-panel rounded-[2rem] border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-[#0f2e2c]">
                  <Activity className="h-5 w-5 text-[#1d4e4b]" />
                  Integration Status
                </CardTitle>
                <CardDescription>Current health of your connected caregiver systems.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl bg-white/65 px-4 py-3">
                  <span>Wibiz Configured</span>
                  <span className={integrationStatus?.ghl.configured ? "text-emerald-600" : "text-muted-foreground"}>
                    {integrationStatus?.ghl.configured ? "Ready" : "Pending"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/65 px-4 py-3">
                  <span>Wibiz Contact Linked</span>
                  <span className={setupStatus?.hasGHLContact ? "text-emerald-600" : "text-muted-foreground"}>
                    {setupStatus?.hasGHLContact ? "Linked" : "Not linked"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/65 px-4 py-3">
                  <span>Consent Verified</span>
                  <span className={setupStatus?.consentGiven ? "text-emerald-600" : "text-muted-foreground"}>
                    {setupStatus?.consentGiven ? "Verified" : "Awaiting"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="cg-panel rounded-[2rem] border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-[#0f2e2c]">
                  <Brain className="h-5 w-5 text-[#1d4e4b]" />
                  Quick Actions
                </CardTitle>
                <CardDescription>Fast entry points for the most common caregiver workflows.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {[
                  { label: "Continue assistant chat", action: () => setLocation("/assistant") },
                  { label: "Review profile linkage", action: () => setLocation("/profile") },
                  { label: "Start a new call", action: () => setLocation("/call") },
                  ...(user?.role === "admin"
                    ? [{ label: "Preview staff portal", action: () => setLocation("/portal/staff") }]
                    : []),
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className="cg-soft-raise rounded-[1.2rem] border border-[#ddd3c4] bg-white/65 px-4 py-4 text-left text-sm font-medium text-[#0f2e2c]"
                  >
                    {item.label}
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
