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
  Phone,
  PhoneCall,
  Search,
  Shield,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "../components/DashboardLayout";

function SafetyBadge({ result }: { result?: string | null }) {
  if (!result) return <Badge variant="secondary" className="text-xs">Pending</Badge>;
  if (result === "SAFE") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs">Safe</Badge>;
  if (result === "CAUTION") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">Caution</Badge>;
  if (result === "UNSAFE") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">Unsafe</Badge>;
  return <Badge variant="outline" className="text-xs">{result}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
    completed: { label: "Completed", className: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
    synced: { label: "Synced", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
    failed: { label: "Failed", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  };
  const s = map[status] ?? { label: status, className: "" };
  return <Badge className={`text-xs ${s.className}`}>{s.label}</Badge>;
}

export default function CallHistoryPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [safetyFilter, setSafetyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: callHistory, isLoading } = trpc.calls.getCallHistory.useQuery({ limit: 100 });

  const filtered = useMemo(() => {
    if (!callHistory) return [];
    return callHistory.filter((call) => {
      const matchesSearch =
        !search ||
        call.sessionId.toLowerCase().includes(search.toLowerCase()) ||
        (call.topicClassified ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (call.callSummary ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesSafety = safetyFilter === "all" || call.safetyResult === safetyFilter;
      const matchesStatus = statusFilter === "all" || call.status === statusFilter;
      return matchesSearch && matchesSafety && matchesStatus;
    });
  }, [callHistory, search, safetyFilter, statusFilter]);

  const stats = useMemo(() => {
    if (!callHistory) return null;
    return {
      total: callHistory.length,
      safe: callHistory.filter((c) => c.safetyResult === "SAFE").length,
      caution: callHistory.filter((c) => c.safetyResult === "CAUTION").length,
      unsafe: callHistory.filter((c) => c.safetyResult === "UNSAFE").length,
      synced: callHistory.filter((c) => c.ghlSynced).length,
    };
  }, [callHistory]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Call History</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              All your voice AI sessions and their outcomes
            </p>
          </div>
          <Button onClick={() => setLocation("/call")} className="gap-2">
            <Phone className="h-4 w-4" />
            New Call
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Total", value: stats.total, icon: PhoneCall, color: "text-primary" },
              { label: "Safe", value: stats.safe, icon: Shield, color: "text-emerald-600" },
              { label: "Caution", value: stats.caution, icon: Clock, color: "text-amber-600" },
              { label: "Unsafe", value: stats.unsafe, icon: XCircle, color: "text-red-600" },
              { label: "GHL Synced", value: stats.synced, icon: CheckCircle2, color: "text-emerald-600" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2">
                    <s.icon className={`h-4 w-4 ${s.color} shrink-0`} />
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-lg font-bold leading-tight">{s.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by session ID, topic, or summary..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={safetyFilter} onValueChange={setSafetyFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Safety" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Safety</SelectItem>
                  <SelectItem value="SAFE">Safe</SelectItem>
                  <SelectItem value="CAUTION">Caution</SelectItem>
                  <SelectItem value="UNSAFE">Unsafe</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="synced">Synced</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {filtered.length} {filtered.length === 1 ? "call" : "calls"}
              {(search || safetyFilter !== "all" || statusFilter !== "all") && " (filtered)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <PhoneCall className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No calls found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {callHistory?.length === 0 ? "Start your first call to see it here" : "Try adjusting your filters"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Date</TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead>Safety</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>GHL Sync</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((call) => (
                      <TableRow
                        key={call.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setLocation(`/call/${call.sessionId}`)}
                      >
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(call.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          <br />
                          {new Date(call.createdAt).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium capitalize">
                            {call.topicClassified ? call.topicClassified.replace(/_/g, " ") : "—"}
                          </p>
                          {call.callSummary && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {call.callSummary}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <SafetyBadge result={call.safetyResult} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={call.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {call.callDurationSeconds
                            ? `${Math.floor(call.callDurationSeconds / 60)}m ${call.callDurationSeconds % 60}s`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {call.ghlSynced ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/call/${call.sessionId}`);
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
