import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock,
  Phone,
  PhoneCall,
  Shield,
  XCircle,
} from "lucide-react";
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
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-400 shrink-0" />
      )}
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: callHistory } = trpc.calls.getCallHistory.useQuery({ limit: 5 });
  const { data: integrationStatus } = trpc.ghl.getIntegrationStatus.useQuery();
  const { data: setupStatus } = trpc.identity.checkSetupStatus.useQuery();
  const postLoginSync = trpc.auth.postLoginSync.useMutation();

  useEffect(() => {
    postLoginSync.mutate();
  }, []);

  const totalCalls = callHistory?.length ?? 0;
  const completedCalls = callHistory?.filter((c) => c.status === "completed" || c.status === "synced").length ?? 0;
  const safeCalls = callHistory?.filter((c) => c.safetyResult === "SAFE").length ?? 0;
  const callbackPending = callHistory?.filter((c) => c.callbackRequested && c.status !== "synced").length ?? 0;
  const recentCalls = callHistory?.slice(0, 5) ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back, {user?.name?.split(" ")[0] ?? "there"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              DementiaHub Voice AI Portal — your caregiver support dashboard
            </p>
          </div>
          <Button onClick={() => setLocation("/call")} className="gap-2 shadow-sm">
            <Phone className="h-4 w-4" />
            Start a Call
          </Button>
        </div>

        {/* Setup Banner */}
        {setupStatus && !setupStatus.hasPhone && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-900">Profile setup incomplete</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Add your phone number to enable voice calls and GHL contact linking.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/profile")}
                className="border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0"
              >
                Complete Setup
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Calls</p>
                  <p className="text-2xl font-bold mt-1">{totalCalls}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <PhoneCall className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed</p>
                  <p className="text-2xl font-bold mt-1">{completedCalls}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Safe Calls</p>
                  <p className="text-2xl font-bold mt-1">{safeCalls}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Callbacks Due</p>
                  <p className="text-2xl font-bold mt-1">{callbackPending}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Calls */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Recent Calls</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/history")} className="text-xs text-muted-foreground">
                    View all
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recentCalls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <PhoneCall className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No calls yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Start your first call to see it here</p>
                    <Button size="sm" className="mt-4 gap-2" onClick={() => setLocation("/call")}>
                      <Phone className="h-3.5 w-3.5" />
                      Start a Call
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentCalls.map((call) => (
                      <div
                        key={call.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => setLocation(`/call/${call.sessionId}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Phone className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium capitalize">
                              {call.topicClassified ? call.topicClassified.replace(/_/g, " ") : "Voice Call"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(call.createdAt).toLocaleDateString(undefined, {
                                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                              })}
                              {call.callDurationSeconds
                                ? ` · ${Math.floor(call.callDurationSeconds / 60)}m ${call.callDurationSeconds % 60}s`
                                : ""}
                            </p>
                          </div>
                        </div>
                        <SafetyBadge result={call.safetyResult} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Integration Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatusIndicator ok={integrationStatus?.ghl.configured ?? false} label="GHL Configured" />
                <StatusIndicator ok={integrationStatus?.ghl.connected ?? false} label="GHL Connected" />
                <StatusIndicator ok={integrationStatus?.elevenlabs.configured ?? false} label="ElevenLabs Configured" />
                <StatusIndicator ok={setupStatus?.hasGHLContact ?? false} label="GHL Contact Linked" />
                <StatusIndicator ok={setupStatus?.consentGiven ?? false} label="Consent Verified" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  Webhook URLs
                </CardTitle>
                <CardDescription className="text-xs">Configure in ElevenLabs agent settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Post-Call Webhook</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                    {integrationStatus?.webhookUrl ?? "Loading..."}
                  </code>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Consent Webhook</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                    {integrationStatus?.consentWebhookUrl ?? "Loading..."}
                  </code>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
