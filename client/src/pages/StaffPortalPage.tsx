import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Headphones,
  MessageSquare,
  PhoneCall,
  ShieldAlert,
  Siren,
  TimerReset,
} from "lucide-react";
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

function formatTopic(topic?: string | null) {
  if (!topic) return "General support";
  return topic.replace(/_/g, " ");
}

export default function StaffPortalPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const staffDashboard = trpc.admin.staffDashboard.useQuery(undefined, {
    enabled: user?.role === "admin" || user?.role === "staff",
  });

  if (user?.role !== "admin" && user?.role !== "staff") {
    return (
      <DashboardLayout>
        <div className="cg-panel rounded-[2rem] p-8 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-[#b77642]" />
          <h1 className="cg-display mt-4 text-3xl font-bold text-[#0f2e2c]">Staff portal access required</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            This portal is available to staff and admin accounts only.
          </p>
          <Button onClick={() => setLocation("/demo/dry-run")} className="mt-6 rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]">
            Return to dry run center
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const urgentCalls = staffDashboard.data?.urgentCalls ?? [];
  const callbackCalls = staffDashboard.data?.callbackCalls ?? [];
  const activeCalls = staffDashboard.data?.activeCalls ?? [];
  const unsafeChats = staffDashboard.data?.unsafeChats ?? [];
  const chatSupportQueue = staffDashboard.data?.chatSupportQueue ?? [];
  const needsStaffTotal = staffDashboard.data?.needsStaffTotal ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="cg-panel rounded-[2rem] px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="cg-label">Staff Portal</p>
              <h1 className="cg-display mt-2 text-4xl font-bold text-[#0f2e2c] sm:text-5xl">Support operations dashboard</h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
                This workspace shows which calls and chats need staff action, which cases need callback handling, and which unsafe or escalated conversations should trigger immediate attention.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="rounded-full border-[#ddd3c4] bg-white/70 hover:bg-white" onClick={() => void staffDashboard.refetch()}>
                Refresh queues
              </Button>
              <Button variant="outline" className="rounded-full border-[#ddd3c4] bg-white/70 hover:bg-white" onClick={() => setLocation("/admin/conversations")}>
                Full admin records
              </Button>
              <Button className="rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]" onClick={() => setLocation("/history")}>
                Conversation history
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Needs Staff", value: needsStaffTotal, icon: BellRing, tone: "bg-[#1d4e4b]/10 text-[#1d4e4b]" },
            { label: "Urgent Alerts", value: urgentCalls.length + unsafeChats.length, icon: Siren, tone: "bg-red-100 text-red-700" },
            { label: "Callbacks Due", value: callbackCalls.length, icon: TimerReset, tone: "bg-[#d4935a]/14 text-[#b77642]" },
            { label: "Active Calls", value: activeCalls.length, icon: PhoneCall, tone: "bg-amber-100 text-amber-700" },
            { label: "Chat Support Queue", value: chatSupportQueue.length, icon: MessageSquare, tone: "bg-[#ede7dc] text-[#0f2e2c]" },
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

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-[#0f2e2c]">
                <Siren className="h-5 w-5 text-red-600" />
                Urgent alerts
              </CardTitle>
              <CardDescription>
                Unsafe conversations and escalations that should alert staff immediately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...urgentCalls.map((item) => ({ type: "call" as const, item })), ...unsafeChats.map((item) => ({ type: "chat" as const, item }))].length ? (
                [...urgentCalls.map((item) => ({ type: "call" as const, item })), ...unsafeChats.map((item) => ({ type: "chat" as const, item }))].map((entry, index) => (
                  <div key={`${entry.type}-${index}`} className="rounded-[1.35rem] border border-red-200 bg-red-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{entry.type === "call" ? "Voice call" : "Chat thread"}</Badge>
                          <SafetyBadge result={entry.type === "call" ? entry.item.call.safetyResult : entry.item.conversation.safetyResult} />
                          {(entry.type === "call" ? entry.item.call.escalationTriggered : entry.item.conversation.escalationTriggered) ? (
                            <Badge variant="outline" className="border-red-300 text-red-700">Escalated</Badge>
                          ) : null}
                        </div>
                        <p className="mt-3 font-semibold text-[#0f2e2c]">
                          {entry.item.user?.name || "Caregiver case"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {entry.type === "call"
                            ? entry.item.call.callSummary || "Unsafe or escalated call requires staff review."
                            : entry.item.conversation.conversationSummary || entry.item.messages[0]?.content || "Unsafe or escalated chat requires staff review."}
                        </p>
                      </div>
                      <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{entry.type === "call" ? formatTopic(entry.item.call.topicClassified) : formatTopic(entry.item.conversation.topicClassified)}</Badge>
                      <Badge variant="outline">{formatDate(entry.type === "call" ? entry.item.call.updatedAt : entry.item.conversation.updatedAt)}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        className="rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]"
                        onClick={() =>
                          setLocation(
                            entry.type === "call"
                              ? `/call/${entry.item.call.sessionId}`
                              : `/history/chat/${entry.item.conversation.id}`
                          )
                        }
                      >
                        Open case
                      </Button>
                      {entry.type === "call" ? (
                        <Button
                          variant="outline"
                          className="rounded-full border-[#ddd3c4] bg-white hover:bg-white"
                          onClick={() => setLocation(`/call/${entry.item.call.sessionId}`)}
                        >
                          <PhoneCall className="mr-2 h-4 w-4" />
                          Callback tools
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.35rem] border border-dashed border-[#ddd3c4] bg-white/50 px-5 py-10 text-center text-sm text-muted-foreground">
                  No unsafe or escalated conversations are in the queue right now.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-[#0f2e2c]">
                <TimerReset className="h-5 w-5 text-[#1d4e4b]" />
                Callback worklist
              </CardTitle>
              <CardDescription>Cases where caregivers asked for follow-up or where staff should call back.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {callbackCalls.length ? (
                callbackCalls.map((item) => (
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
                      <Badge variant="outline">{formatTopic(item.call.topicClassified)}</Badge>
                      <Badge variant="outline">{formatDate(item.call.updatedAt)}</Badge>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button className="rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]" onClick={() => setLocation(`/call/${item.call.sessionId}`)}>
                        Open case
                      </Button>
                      <Button variant="outline" className="rounded-full border-[#ddd3c4] bg-white hover:bg-white" onClick={() => setLocation(`/call/${item.call.sessionId}`)}>
                        <PhoneCall className="mr-2 h-4 w-4" />
                        Callback tools
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.35rem] border border-dashed border-[#ddd3c4] bg-white/50 px-5 py-10 text-center text-sm text-muted-foreground">
                  No callback requests are waiting right now.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-[#0f2e2c]">
                <Headphones className="h-5 w-5 text-[#1d4e4b]" />
                Chat support queue
              </CardTitle>
              <CardDescription>
                Chats that fall into needs-staff categories, including caution, unsafe, callback, and escalated threads.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {chatSupportQueue.length ? (
                chatSupportQueue.map((item) => (
                  <button
                    key={item.conversation.id}
                    onClick={() => setLocation(`/history/chat/${item.conversation.id}`)}
                    className="cg-soft-raise flex w-full items-start justify-between rounded-[1.35rem] border border-[#ddd3c4] bg-white/65 p-4 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1d4e4b]/10">
                        <MessageSquare className="h-4 w-4 text-[#1d4e4b]" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-[#0f2e2c]">{item.user?.name || "Caregiver chat"}</p>
                          <SafetyBadge result={item.conversation.safetyResult} />
                          {item.conversation.callbackRequested ? <Badge variant="outline">Callback requested</Badge> : null}
                          {item.conversation.escalationTriggered ? <Badge variant="outline">Escalated</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {item.conversation.conversationSummary || item.messages[0]?.content || "Open chat thread"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{formatTopic(item.conversation.topicClassified)}</Badge>
                          <Badge variant="outline">{formatDate(item.conversation.updatedAt)}</Badge>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))
              ) : (
                <div className="rounded-[1.35rem] border border-dashed border-[#ddd3c4] bg-white/50 px-5 py-10 text-center text-sm text-muted-foreground">
                  No chat threads are waiting for staff handling right now.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-[#0f2e2c]">
                <PhoneCall className="h-5 w-5 text-[#1d4e4b]" />
                Live and active calls
              </CardTitle>
              <CardDescription>Calls still active or not fully closed out yet, so staff can keep watch on them.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeCalls.length ? (
                activeCalls.map((item) => (
                  <div key={item.call.id} className="rounded-[1.35rem] border border-[#ddd3c4] bg-white/65 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#0f2e2c]">{item.user?.name || "Active caregiver call"}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.call.callSummary || "Call is still active or waiting for post-call completion."}
                        </p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Active</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{formatTopic(item.call.topicClassified)}</Badge>
                      <Badge variant="outline">{formatDate(item.call.createdAt)}</Badge>
                    </div>
                    <div className="mt-4">
                      <Button className="rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]" onClick={() => setLocation(`/call/${item.call.sessionId}`)}>
                        Open live case
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.35rem] border border-dashed border-[#ddd3c4] bg-white/50 px-5 py-10 text-center text-sm text-muted-foreground">
                  No active calls are waiting in the staff watchlist.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
