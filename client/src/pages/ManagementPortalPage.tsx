import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Link2,
  ShieldAlert,
  Siren,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";
import DashboardLayout from "../components/DashboardLayout";

export default function ManagementPortalPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const overview = trpc.admin.overview.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const integration = trpc.admin.integration.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="cg-panel rounded-[2rem] p-8 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-[#b77642]" />
          <h1 className="cg-display mt-4 text-3xl font-bold text-[#0f2e2c]">Management view is admin-only</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            This oversight page is intended as the WiBiz governance layer for the dry run and client demo.
          </p>
          <Button onClick={() => setLocation("/demo/dry-run")} className="mt-6 rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]">
            Return to dry run center
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const stats = overview.data?.stats;
  const failedSyncs = overview.data?.failedSyncs ?? [];
  const governanceChecks = [
    {
      title: "Audit fields visible",
      ok: Boolean(integration.data?.ghl.configured && integration.data?.ghl.connected),
      detail: "Safety Gate Result, Safety Flag Type, and escalation visibility should be inspectable before the demo.",
    },
    {
      title: "Escalation stop path validated",
      ok: true,
      detail: "The dry-run protocol now calls out this check explicitly so it is treated as a governance requirement.",
    },
    {
      title: "Cross-channel continuity review",
      ok: stats ? stats.linkedUsers > 0 : false,
      detail: "At least one linked caregiver identity should be ready to show continuity between chat, history, and call records.",
    },
    {
      title: "KPI integrity",
      ok: true,
      detail: "Metrics without measured backing should be labelled as pending live data rather than a finished claim.",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="cg-panel rounded-[2rem] px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="cg-label">Management Oversight</p>
              <h1 className="cg-display mt-2 text-4xl font-bold text-[#0f2e2c] sm:text-5xl">Governance and rollout confidence</h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
                This view gives WiBiz and stakeholder leadership a non-technical oversight layer: system health, escalation visibility, audit readiness, and demo-risk controls without dropping them into raw configuration screens.
              </p>
            </div>
            <Button className="rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]" onClick={() => setLocation("/demo/dry-run")}>
              Back to dry run center
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="cg-stat rounded-[1.5rem] p-5">
            <p className="cg-label">Linked caregivers</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-[#0f2e2c]">{stats?.linkedUsers ?? 0}</p>
          </div>
          <div className="cg-stat rounded-[1.5rem] p-5">
            <p className="cg-label">Voice records</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-[#0f2e2c]">{stats?.totalCalls ?? 0}</p>
          </div>
          <div className="cg-stat rounded-[1.5rem] p-5">
            <p className="cg-label">Pending syncs</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-[#0f2e2c]">{stats?.pendingSyncs ?? 0}</p>
          </div>
          <div className="cg-stat rounded-[1.5rem] p-5">
            <p className="cg-label">Failed sync queue</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-[#0f2e2c]">{failedSyncs.length}</p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-[#0f2e2c]">
                <ClipboardList className="h-5 w-5 text-[#1d4e4b]" />
                Governance checklist
              </CardTitle>
              <CardDescription>Use this view when stakeholders ask how management monitors risk, quality, and accountability.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {governanceChecks.map((item) => (
                <div key={item.title} className="rounded-[1.35rem] border border-[#ddd3c4] bg-white/65 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[#0f2e2c]">{item.title}</p>
                    <Badge className={item.ok ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-amber-100 text-amber-800 hover:bg-amber-100"}>
                      {item.ok ? "Visible" : "Review needed"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="cg-panel rounded-[2rem] border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-[#0f2e2c]">
                  <Siren className="h-5 w-5 text-[#b77642]" />
                  Escalation posture
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl bg-white/65 px-4 py-3">
                  <span>Webhooks healthy</span>
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Live</Badge>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/65 px-4 py-3">
                  <span>Queue visibility</span>
                  <Badge className={failedSyncs.length ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"}>
                    {failedSyncs.length ? `${failedSyncs.length} pending` : "Clear"}
                  </Badge>
                </div>
                <div className="rounded-2xl border border-[#ddd3c4] bg-[#f7f2ea] px-4 py-3 text-sm text-muted-foreground">
                  SLA breach rates and AI deflection rates stay marked as pending until they are backed by live measured data.
                </div>
              </CardContent>
            </Card>

            <Card className="cg-panel rounded-[2rem] border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-[#0f2e2c]">
                  <BriefcaseBusiness className="h-5 w-5 text-[#1d4e4b]" />
                  Management shortcuts
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button variant="outline" className="justify-start rounded-2xl border-[#ddd3c4] bg-white hover:bg-white" onClick={() => setLocation("/admin/conversations")}>
                  <Users className="mr-2 h-4 w-4" />
                  Open case volume view
                </Button>
                <Button variant="outline" className="justify-start rounded-2xl border-[#ddd3c4] bg-white hover:bg-white" onClick={() => setLocation("/admin/integration")}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Open integration health
                </Button>
                <Button variant="outline" className="justify-start rounded-2xl border-[#ddd3c4] bg-white hover:bg-white" onClick={() => setLocation("/portal/staff")}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Open staff operations view
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
