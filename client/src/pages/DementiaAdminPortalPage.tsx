import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Activity, Bot, ShieldAlert, Users } from "lucide-react";
import { useLocation } from "wouter";
import DashboardLayout from "../components/DashboardLayout";

export default function DementiaAdminPortalPage() {
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
          <h1 className="cg-display mt-4 text-3xl font-bold text-[#0f2e2c]">Dementia admin preview is admin-only</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            This is the organisation-level readout for the stakeholder dry run and uses the current admin account until final role scoping is added.
          </p>
          <Button onClick={() => setLocation("/demo/dry-run")} className="mt-6 rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]">
            Return to dry run center
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const stats = overview.data?.stats;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="cg-panel rounded-[2rem] px-6 py-7 sm:px-8">
          <p className="cg-label">DementiaSG Admin View</p>
          <h1 className="cg-display mt-2 text-4xl font-bold text-[#0f2e2c] sm:text-5xl">Organisation-level system view</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            Use this to show DementiaSG how the system is performing without exposing workflow editing controls. It is focused on visibility, QA confidence, and operational readiness.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="cg-stat rounded-[1.5rem] p-5">
            <p className="cg-label">Caregiver accounts</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-[#0f2e2c]">{stats?.totalUsers ?? 0}</p>
          </div>
          <div className="cg-stat rounded-[1.5rem] p-5">
            <p className="cg-label">Conversation threads</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-[#0f2e2c]">{stats?.aiConversations ?? 0}</p>
          </div>
          <div className="cg-stat rounded-[1.5rem] p-5">
            <p className="cg-label">Voice calls</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-[#0f2e2c]">{stats?.totalCalls ?? 0}</p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-[#0f2e2c]">
                <Users className="h-5 w-5 text-[#1d4e4b]" />
                Case volume
              </CardTitle>
              <CardDescription>Stakeholder-safe overview of active footprint.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Linked caregiver identities: {stats?.linkedUsers ?? 0}</p>
              <p>Consent-verified accounts: {stats?.consentedUsers ?? 0}</p>
              <Button className="w-full rounded-full bg-[#1d4e4b] hover:bg-[#0f2e2c]" onClick={() => setLocation("/admin/conversations")}>
                Open case records
              </Button>
            </CardContent>
          </Card>

          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-[#0f2e2c]">
                <Activity className="h-5 w-5 text-[#1d4e4b]" />
                QA and audit
              </CardTitle>
              <CardDescription>Keep the message focused on visibility and traceability.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Webhook health, failed sync queue, and integration diagnostics are available.</p>
              <p>SLA breach rate and deflection rate should remain labelled as pending until measured from live data.</p>
              <Button variant="outline" className="w-full rounded-full border-[#ddd3c4] bg-white hover:bg-white" onClick={() => setLocation("/admin/integration")}>
                Open QA diagnostics
              </Button>
            </CardContent>
          </Card>

          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-[#0f2e2c]">
                <Bot className="h-5 w-5 text-[#1d4e4b]" />
                AI system readiness
              </CardTitle>
              <CardDescription>Use this to explain what is live now versus still in controlled QA.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Chat and case triage are demoable now with scripted scenarios.</p>
              <p>Voice should only be shown if the internal five-test protocol passes.</p>
              <Button variant="outline" className="w-full rounded-full border-[#ddd3c4] bg-white hover:bg-white" onClick={() => setLocation("/demo/dry-run")}>
                Open dry run script
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
