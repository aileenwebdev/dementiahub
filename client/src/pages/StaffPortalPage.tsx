import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Headphones, MessageSquare, PhoneCall, ShieldAlert, TimerReset } from "lucide-react";
import { useLocation } from "wouter";
import DashboardLayout from "../components/DashboardLayout";

function SafetyBadge({ result }: { result?: string | null }) {
  if (!result) return <Badge variant="secondary">Pending</Badge>;
  if (result === "SAFE") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Safe</Badge>;
  if (result === "CAUTION") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Caution</Badge>;
  if (result === "UNSAFE") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Unsafe</Badge>;
  return <Badge variant="outline">{result}</Badge>;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StaffPortalPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const overview = trpc.admin.overview.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="cg-panel rounded-[2rem] p-8 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-[#b77642]" />
          <h1 className="cg-display mt-4 text-3xl font-bold text-[#0f2e2c]">Staff portal preview is admin-only</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            This view is provided as a dry-run surface until final staff-role permissions are introduced.
          </p>
          <Button onClick={() => setLocation("/demo/dry-run")} className="mt-6 rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]">
            Return to dry run center
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const recentCalls = overview.data?.recentCalls ?? [];
  const recentChats = overview.data?.recentChats ?? [];
  const callbackQueue = recentCalls.filter((item) => item.call.callbackRequested || item.call.status === "active");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="cg-panel rounded-[2rem] px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="cg-label">Staff Portal</p>
              <h1 className="cg-display mt-2 text-4xl font-bold text-[#0f2e2c] sm:text-5xl">Case manager workspace</h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
                Use this during the demo to prove staff can see live case context, callback priorities, and linked conversation history without jumping across tools.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="rounded-full border-[#ddd3c4] bg-white/70 hover:bg-white" onClick={() => setLocation("/admin/conversations")}>
                Full admin records
              </Button>
              <Button className="rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]" onClick={() => setLocation("/history")}>
                Conversation history
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="cg-stat rounded-[1.5rem] p-5">
            <p className="cg-label">Callback queue</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-[#0f2e2c]">{callbackQueue.length}</p>
          </div>
          <div className="cg-stat rounded-[1.5rem] p-5">
            <p className="cg-label">Recent calls</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-[#0f2e2c]">{recentCalls.length}</p>
          </div>
          <div className="cg-stat rounded-[1.5rem] p-5">
            <p className="cg-label">Recent chats</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-[#0f2e2c]">{recentChats.length}</p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-[#0f2e2c]">
                <TimerReset className="h-5 w-5 text-[#1d4e4b]" />
                Callback manager
              </CardTitle>
              <CardDescription>Show this when stakeholders ask how staff see today's worklist.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {callbackQueue.length ? (
                callbackQueue.map((item) => (
                  <div key={item.call.id} className="rounded-[1.35rem] border border-[#ddd3c4] bg-white/65 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#0f2e2c]">{item.user?.name || "Caregiver case"}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.call.callSummary || "Awaiting conversation summary"}</p>
                      </div>
                      <SafetyBadge result={item.call.safetyResult} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{item.call.status}</Badge>
                      <Badge variant="outline">{formatDate(item.call.createdAt)}</Badge>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button className="rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]" onClick={() => setLocation(`/call/${item.call.sessionId}`)}>
                        Open case
                      </Button>
                      <Button variant="outline" className="rounded-full border-[#ddd3c4] bg-white hover:bg-white" onClick={() => setLocation("/call")}>
                        <PhoneCall className="mr-2 h-4 w-4" />
                        Click-to-call
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.35rem] border border-dashed border-[#ddd3c4] bg-white/50 px-5 py-10 text-center text-sm text-muted-foreground">
                  No callback-needed cases are in the recent dataset right now. Seed at least one CAUTION or callback request case before the demo.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-[#0f2e2c]">
                <Headphones className="h-5 w-5 text-[#1d4e4b]" />
                Live case context
              </CardTitle>
              <CardDescription>Use these shortcuts to prove staff can move from queue to record without losing context.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentChats.slice(0, 4).map((item) => (
                <button
                  key={item.conversation.id}
                  onClick={() => setLocation(`/history/chat/${item.conversation.id}`)}
                  className="cg-soft-raise flex w-full items-center justify-between rounded-[1.35rem] border border-[#ddd3c4] bg-white/65 p-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1d4e4b]/10">
                      <MessageSquare className="h-4 w-4 text-[#1d4e4b]" />
                    </div>
                    <div>
                      <p className="font-medium text-[#0f2e2c]">{item.user?.name || "Caregiver chat"}</p>
                      <p className="text-sm text-muted-foreground">{item.conversation.conversationSummary || item.messages[0]?.content || "Open chat thread"}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
