import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MessageSquare,
  Phone,
  Search,
  Shield,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "../components/DashboardLayout";

function SupportStatusBadge({ item }: { item: HistoryItem }) {
  if (item.escalationTriggered || item.resolutionType === "needs_staff") {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">Follow-up</Badge>;
  }
  if (item.callbackRequested) {
    return <Badge className="bg-[#d4935a]/14 text-[#b77642] hover:bg-[#d4935a]/14 text-xs">Callback</Badge>;
  }
  if (item.status === "completed" || item.status === "synced" || item.resolutionType === "self_serve") {
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs">Completed</Badge>;
  }
  return <Badge variant="secondary" className="text-xs">In progress</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
    archived: { label: "Archived", className: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
    completed: { label: "Completed", className: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
    synced: { label: "Synced", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
    failed: { label: "Failed", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  };
  const s = map[status] ?? { label: status, className: "" };
  return <Badge className={`text-xs ${s.className}`}>{s.label}</Badge>;
}

const stickyColumnClass = {
  safety: "sticky right-[280px] z-20 bg-white",
  status: "sticky right-[170px] z-20 bg-white",
  sync: "sticky right-[80px] z-20 bg-white",
  action: "sticky right-0 z-30 bg-white",
} as const;

type HistoryItem = {
  id: string;
  kind: "call" | "chat";
  title: string;
  summary: string | null;
  safetyResult?: string | null;
  status: string;
  ghlSynced: boolean;
  createdAt: string | Date;
  updatedAt?: string | Date;
  durationSeconds?: number | null;
  href: string;
  searchTokens: string[];
  callbackRequested?: boolean | null;
  escalationTriggered?: boolean | null;
  resolutionType?: string | null;
};

export default function CallHistoryPage() {
  const [location, setLocation] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), [location]);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "all");
  const [channelFilter, setChannelFilter] = useState(() => searchParams.get("channel") ?? "all");

  const { data: callHistory, isLoading: callsLoading } = trpc.calls.getCallHistory.useQuery({
    limit: 100,
    source: "history_page",
  });
  const { data: chatHistory, isLoading: chatsLoading } = trpc.ai.getConversationHistory.useQuery({ limit: 100 });

  const history = useMemo<HistoryItem[]>(() => {
    const callItems =
      callHistory?.map((call) => ({
        id: `call-${call.id}`,
        kind: "call" as const,
        title: call.topicClassified ? call.topicClassified.replace(/_/g, " ") : "Voice call",
        summary: call.callSummary ?? null,
        safetyResult: call.safetyResult,
        status: call.status,
        ghlSynced: Boolean(call.ghlSynced),
        createdAt: call.createdAt,
        updatedAt: call.updatedAt,
        durationSeconds: call.callDurationSeconds,
        href: `/call/${call.sessionId}`,
        searchTokens: [call.sessionId, call.topicClassified ?? "", call.callSummary ?? ""],
        callbackRequested: call.callbackRequested,
        escalationTriggered: call.escalationTriggered,
        resolutionType: call.resolutionType,
      })) ?? [];

    const chatItems =
      chatHistory?.map((chat) => ({
        id: `chat-${chat.id}`,
        kind: "chat" as const,
        title: chat.title ?? "Portal chat",
        summary: chat.conversationSummary ?? chat.lastMessagePreview ?? null,
        safetyResult: chat.safetyResult,
        status: chat.status,
        ghlSynced: Boolean(chat.ghlSynced),
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        durationSeconds: null,
        href: `/history/chat/${chat.id}`,
        searchTokens: [
          String(chat.id),
          chat.title ?? "",
          chat.topicClassified ?? "",
          chat.conversationSummary ?? "",
          chat.lastMessagePreview ?? "",
        ],
        callbackRequested: chat.callbackRequested,
        escalationTriggered: chat.escalationTriggered,
        resolutionType: chat.resolutionType,
      })) ?? [];

    return [...callItems, ...chatItems].sort(
      (a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
    );
  }, [callHistory, chatHistory]);

  const filtered = useMemo(() => {
    return history.filter((item) => {
      const matchesSearch =
        !search ||
        item.searchTokens.some((token) => token.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "completed"
          ? item.status === "completed" || item.status === "synced"
          : item.status === statusFilter);
      const matchesChannel = channelFilter === "all" || item.kind === channelFilter;
      return matchesSearch && matchesStatus && matchesChannel;
    });
  }, [history, search, statusFilter, channelFilter]);

  const stats = useMemo(() => ({
    total: history.length,
    completed: history.filter((item) => item.status === "completed" || item.status === "synced" || item.resolutionType === "self_serve").length,
    followUp: history.filter((item) => item.escalationTriggered || item.resolutionType === "needs_staff").length,
    callbacks: history.filter((item) => item.callbackRequested).length,
    synced: history.filter((item) => item.ghlSynced).length,
  }), [history]);

  const isLoading = callsLoading || chatsLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Conversation History</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Calls and chat sessions for your caregiver support record
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLocation("/assistant")} className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Open Chat
            </Button>
            <Button onClick={() => setLocation("/call")} className="gap-2">
              <Phone className="h-4 w-4" />
              New Call
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Total", value: stats.total, icon: MessageSquare, color: "text-primary" },
            { label: "Completed", value: stats.completed, icon: Shield, color: "text-emerald-600" },
            { label: "Follow-up", value: stats.followUp, icon: Clock, color: "text-amber-600" },
            { label: "Callbacks", value: stats.callbacks, icon: XCircle, color: "text-[#b77642]" },
            { label: "Wibiz Synced", value: stats.synced, icon: CheckCircle2, color: "text-emerald-600" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pb-3 pt-4">
                <div className="flex items-center gap-2">
                  <stat.icon className={`h-4 w-4 shrink-0 ${stat.color}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-bold leading-tight">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="pb-4 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, topic, summary, or transcript preview..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="call">Calls</SelectItem>
                  <SelectItem value="chat">Chats</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {filtered.length} {filtered.length === 1 ? "conversation" : "conversations"}
              {(search || statusFilter !== "all" || channelFilter !== "all") && " (filtered)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No conversations found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {history.length === 0 ? "Start a chat or call to build your conversation history" : "Try adjusting your filters"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Date</TableHead>
                      <TableHead className="w-[110px]">Channel</TableHead>
                      <TableHead className="w-[320px] min-w-[320px]">Topic</TableHead>
                      <TableHead className={`w-[110px] ${stickyColumnClass.safety}`}>Support</TableHead>
                      <TableHead className={`w-[110px] ${stickyColumnClass.status}`}>Status</TableHead>
                      <TableHead className="w-[95px]">Duration</TableHead>
                      <TableHead className={`w-[90px] ${stickyColumnClass.sync}`}>Wibiz Sync</TableHead>
                      <TableHead className={`w-[80px] ${stickyColumnClass.action}`}></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setLocation(item.href)}
                      >
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          <br />
                          {new Date(item.createdAt).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1 text-xs capitalize">
                            {item.kind === "call" ? <Phone className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                            {item.kind}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p
                            className="truncate text-sm font-medium capitalize"
                            title={item.title}
                          >
                            {item.title}
                          </p>
                          {item.summary ? (
                            <p
                              className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground"
                              title={item.summary}
                            >
                              {item.summary}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className={stickyColumnClass.safety}>
                          <SupportStatusBadge item={item} />
                        </TableCell>
                        <TableCell className={stickyColumnClass.status}>
                          <StatusBadge status={item.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.durationSeconds
                            ? `${Math.floor(item.durationSeconds / 60)}m ${item.durationSeconds % 60}s`
                            : "—"}
                        </TableCell>
                        <TableCell className={stickyColumnClass.sync}>
                          {item.ghlSynced ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className={stickyColumnClass.action}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(event) => {
                              event.stopPropagation();
                              setLocation(item.href);
                            }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
