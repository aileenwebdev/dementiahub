import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  Bot,
  CheckCircle2,
  Clock3,
  Link2,
  MessageSquare,
  Search,
  ShieldAlert,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "../components/DashboardLayout";

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SafetyBadge({ result }: { result?: string | null }) {
  if (!result) return <Badge variant="secondary">Pending</Badge>;
  if (result === "SAFE") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Safe</Badge>;
  if (result === "CAUTION") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Caution</Badge>;
  if (result === "UNSAFE") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Unsafe</Badge>;
  return <Badge variant="outline">{result}</Badge>;
}

export default function AdminConversationsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const overview = trpc.admin.overview.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const usersQuery = trpc.admin.users.useQuery(
    { search, limit: 50 },
    { enabled: user?.role === "admin" }
  );
  const userDetail = trpc.admin.userDetail.useQuery(
    { userId: selectedUserId ?? 0 },
    { enabled: user?.role === "admin" && selectedUserId !== null }
  );
  const selectedDetail = userDetail.data ?? null;

  useEffect(() => {
    if (!selectedUserId && usersQuery.data?.[0]?.user.id) {
      setSelectedUserId(usersQuery.data[0].user.id);
    }
  }, [selectedUserId, usersQuery.data]);

  const stats = useMemo(() => overview.data?.stats, [overview.data]);

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="cg-panel rounded-[2rem] p-8 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-[#b77642]" />
          <h1 className="cg-display mt-4 text-3xl font-bold text-[#0f2e2c]">Admin access required</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            This panel is only available to DementiaHub administrators. We can promote an account to admin and wire the final GHL and ElevenLabs credentials when you share them.
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
              <p className="cg-label">Admin Panel</p>
              <h1 className="cg-display mt-2 text-4xl font-bold text-[#0f2e2c] sm:text-5xl">
                Caregiver records and conversations
              </h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
                Review caregiver accounts, inspect identity linkage to GHL, and follow how portal chats and calls are being recorded before the full production rollout.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="rounded-full border-[#ddd3c4] bg-white/70 hover:bg-white"
                onClick={() => {
                  void overview.refetch();
                  void usersQuery.refetch();
                  if (selectedUserId) {
                    void userDetail.refetch();
                  }
                }}
              >
                Refresh panel
              </Button>
              <Button onClick={() => setLocation("/admin/integration")} className="rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]">
                Open integration diagnostics
              </Button>
            </div>
          </div>
        </section>

        {stats ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Caregivers", value: stats.totalUsers, icon: Users, tone: "bg-[#1d4e4b]/10 text-[#1d4e4b]" },
              { label: "Linked to GHL", value: stats.linkedUsers, icon: Link2, tone: "bg-[#7a9e8a]/14 text-[#527a68]" },
              { label: "Consent Verified", value: stats.consentedUsers, icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700" },
              { label: "Voice Calls", value: stats.totalCalls, icon: Clock3, tone: "bg-[#d4935a]/14 text-[#b77642]" },
              { label: "AI Threads", value: stats.aiConversations, icon: Bot, tone: "bg-[#ede7dc] text-[#0f2e2c]" },
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
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl text-[#0f2e2c]">Caregiver Directory</CardTitle>
              <CardDescription>Search portal users and inspect how each account is mapped into the support workflow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, phone, GHL contact ID, or openId"
                  className="h-12 rounded-2xl border-[#ddd3c4] bg-white pl-10"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Caregiver</TableHead>
                    <TableHead>Portal Status</TableHead>
                    <TableHead>GHL Link</TableHead>
                    <TableHead>Consent</TableHead>
                    <TableHead>Last Sign In</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersQuery.data?.map(({ user: caregiver, identity }) => (
                    <TableRow
                      key={caregiver.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedUserId(caregiver.id)}
                    >
                      <TableCell className="min-w-[220px]">
                        <div>
                          <p className="font-medium text-[#0f2e2c]">{caregiver.name || "Unnamed caregiver"}</p>
                          <p className="text-xs text-muted-foreground">{caregiver.email || caregiver.openId}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={caregiver.role === "admin" ? "default" : "secondary"}>
                          {caregiver.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {identity?.ghlContactId ? (
                          <div className="text-xs">
                            <p className="font-medium text-[#0f2e2c]">{identity.ghlContactId}</p>
                            <p className="text-muted-foreground">{identity.phoneNumber || identity.ghlLocationId || "Mapped"}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not linked</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {identity?.consentGiven ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Verified</Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(caregiver.lastSignedIn)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedUserId(caregiver.id);
                          }}
                        >
                          Inspect
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl text-[#0f2e2c]">Selected Caregiver</CardTitle>
              <CardDescription>Portal identity, saved AI threads, and recent call records for the currently selected user.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {selectedDetail ? (
                <>
                  <div className="rounded-[1.4rem] border border-[#ddd3c4] bg-white/70 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="cg-display text-2xl font-bold text-[#0f2e2c]">{selectedDetail.user.name || "Unnamed caregiver"}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{selectedDetail.user.email || selectedDetail.user.openId}</p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1d4e4b]/10">
                        <UserRound className="h-5 w-5 text-[#1d4e4b]" />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-[#ede7dc] px-4 py-3 text-sm">
                        <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">GHL Contact</p>
                        <p className="mt-1 font-medium text-[#0f2e2c]">{selectedDetail.identity?.ghlContactId || "Not linked"}</p>
                      </div>
                      <div className="rounded-2xl bg-[#ede7dc] px-4 py-3 text-sm">
                        <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">Phone / Language</p>
                        <p className="mt-1 font-medium text-[#0f2e2c]">
                          {selectedDetail.identity?.phoneNumber || "No phone"} - {selectedDetail.identity?.preferredLanguage || "en"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#527a68]">Recent Voice Calls</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        onClick={() => selectedDetail.calls[0] && setLocation(`/call/${selectedDetail.calls[0].sessionId}`)}
                      >
                        Open latest
                      </Button>
                    </div>

                    {selectedDetail.calls.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#ddd3c4] bg-white/55 px-4 py-6 text-sm text-muted-foreground">
                        No voice calls recorded for this caregiver yet.
                      </div>
                    ) : (
                      selectedDetail.calls.slice(0, 4).map((call) => (
                        <button
                          key={call.id}
                          onClick={() => setLocation(`/call/${call.sessionId}`)}
                          className="cg-soft-raise flex w-full items-center justify-between rounded-[1.2rem] border border-[#ddd3c4] bg-white/65 px-4 py-4 text-left"
                        >
                          <div>
                            <p className="font-medium capitalize text-[#0f2e2c]">{call.topicClassified?.replace(/_/g, " ") || "Voice call"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{formatDate(call.createdAt)}</p>
                          </div>
                          <SafetyBadge result={call.safetyResult} />
                        </button>
                      ))
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#527a68]">Saved AI Threads</h3>
                    {selectedDetail.conversations.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#ddd3c4] bg-white/55 px-4 py-6 text-sm text-muted-foreground">
                        No AI chat history saved for this caregiver yet.
                      </div>
                    ) : (
                      selectedDetail.conversations.slice(0, 3).map(({ conversation, messages }) => (
                        <div key={conversation.id} className="rounded-[1.2rem] border border-[#ddd3c4] bg-white/65 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-[#0f2e2c]">{conversation.title || "Caregiver Support Chat"}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{formatDate(conversation.lastMessageAt)}</p>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1d4e4b]/10">
                              <MessageSquare className="h-4 w-4 text-[#1d4e4b]" />
                            </div>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            {messages[0]?.content || "No messages saved yet."}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-[#ddd3c4] bg-white/60 px-4 py-10 text-center text-sm text-muted-foreground">
                  Select a caregiver to inspect the linked portal, GHL, and conversation data.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="text-2xl text-[#0f2e2c]">Recent AI activity</CardTitle>
              <CardDescription>Latest caregiver conversations currently being persisted inside the portal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.data?.recentChats.map(({ conversation, user: caregiver, messages }) => (
                <div key={conversation.id} className="rounded-[1.2rem] border border-[#ddd3c4] bg-white/65 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[#0f2e2c]">{caregiver?.name || "Unknown caregiver"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(conversation.updatedAt)}</p>
                    </div>
                    <Badge variant="secondary">{conversation.status}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {messages[0]?.content || "No preview available."}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="text-2xl text-[#0f2e2c]">Recent voice outcomes</CardTitle>
              <CardDescription>Latest synced or pending call records captured from ElevenLabs conversations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.data?.recentCalls.map(({ call, user: caregiver }) => (
                <div key={call.id} className="rounded-[1.2rem] border border-[#ddd3c4] bg-white/65 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[#0f2e2c]">{caregiver?.name || "Unknown caregiver"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {call.topicClassified?.replace(/_/g, " ") || "Voice call"} - {formatDate(call.createdAt)}
                      </p>
                    </div>
                    <SafetyBadge result={call.safetyResult} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{call.callSummary || "No call summary saved yet."}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
