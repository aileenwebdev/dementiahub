import { ElevenLabsVoiceWidget } from "@/components/ElevenLabsVoiceWidget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, Loader2, Mic, Shield } from "lucide-react";
import { useLocation, useParams } from "wouter";
import DashboardLayout from "../components/DashboardLayout";

export default function LiveCallPage() {
  const params = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const sessionId = params.sessionId;

  const sessionQuery = trpc.calls.getBrowserCallSession.useQuery(
    { sessionId: sessionId ?? "" },
    {
      enabled: Boolean(sessionId),
      staleTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/call/${sessionId}`)}
            className="mb-3 -ml-2 gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Details
          </Button>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Live Browser Voice Call</h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{sessionId}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1.5 bg-[#1d4e4b]/10 text-[#1d4e4b] hover:bg-[#1d4e4b]/10">
                <Mic className="h-3 w-3" />
                ElevenLabs widget
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <Shield className="h-3 w-3" />
                Logged-in caregiver attached
              </Badge>
            </div>
          </div>
        </div>

        <Card className="border-[#ddd3c4] bg-[#ede7dc]/60">
          <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0f2e2c]">Official ElevenLabs browser voice experience</p>
              <p className="text-xs leading-6 text-muted-foreground">
                This page now uses the hosted ElevenLabs widget for faster microphone setup. The portal session ID and caregiver profile are still attached so the completed conversation saves back to this logged-in user.
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => setLocation("/history")}
            >
              Back to History
            </Button>
          </CardContent>
        </Card>

        {sessionQuery.isLoading ? (
          <Card>
            <CardContent className="flex min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparing browser voice session...
              </div>
            </CardContent>
          </Card>
        ) : sessionQuery.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {sessionQuery.error.message}
          </div>
        ) : sessionQuery.data ? (
          <Card className="overflow-hidden border-[#ddd3c4] bg-[#fffdf9]">
            <CardContent className="p-4 sm:p-6">
              <ElevenLabsVoiceWidget
                signedUrl={sessionQuery.data.signedUrl}
                dynamicVariables={sessionQuery.data.dynamicVariables}
                overridePrompt={sessionQuery.data.overridePrompt}
                overrideFirstMessage={sessionQuery.data.overrideFirstMessage}
              />
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-3 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-900">The finished call will still save into the portal</p>
              <p className="text-xs text-emerald-700">
                Once ElevenLabs ends the session and sends the post-call webhook, we match it back to this portal session using the logged-in user and session ID.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
