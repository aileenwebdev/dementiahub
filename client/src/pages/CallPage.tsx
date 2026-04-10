import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Loader2,
  Mic,
  Phone,
  PhoneCall,
  PhoneOff,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import DashboardLayout from "../components/DashboardLayout";

export default function CallPage() {
  const [, setLocation] = useLocation();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [activeCall, setActiveCall] = useState<{
    sessionId: string;
    conversationId: string;
    mode: "phone" | "web_demo";
  } | null>(null);

  const { data: setupStatus } = trpc.identity.checkSetupStatus.useQuery();
  const { data: identity } = trpc.identity.getMyIdentity.useQuery();

  const initiateCall = trpc.calls.initiateCall.useMutation({
    onSuccess: (data) => {
      setActiveCall({ sessionId: data.sessionId, conversationId: data.conversationId, mode: "phone" });
      toast.success("Phone call initiated", {
        description: `Session ID: ${data.sessionId}`,
      });
    },
    onError: (err) => {
      toast.error("Failed to initiate phone call", { description: err.message });
    },
  });

  const initiateWebCall = trpc.calls.initiateWebCall.useMutation({
    onSuccess: (data) => {
      toast.success("Browser demo call ready", {
        description: "Opening the live demo room now.",
      });
      setLocation(`/call/${data.sessionId}/live`);
    },
    onError: (err) => {
      toast.error("Failed to start browser demo call", { description: err.message });
    },
  });

  const markCompleted = trpc.calls.markCallCompleted.useMutation({
    onSuccess: () => {
      toast.success("Call marked as completed");
      setActiveCall(null);
      setLocation("/history");
    },
  });

  const handleStartPhoneCall = () => {
    const phone = phoneNumber.trim() || identity?.phoneNumber;
    if (!phone) {
      toast.error("Please enter a phone number");
      return;
    }
    initiateCall.mutate({ phoneNumber: phone });
  };

  const isPhoneReady = setupStatus?.hasGHLContact && setupStatus?.elevenLabsConfigured;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="cg-panel rounded-[2rem] px-6 py-7 sm:px-8">
          <p className="cg-label">Call Assistant</p>
          <h1 className="cg-display mt-2 text-4xl font-bold text-[#0f2e2c] sm:text-5xl">Start a support call</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            Use browser-based demo calling right away for presentations, or switch to live phone calling once the Wibiz and ElevenLabs telephony setup is fully enabled.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-[#0f2e2c]">
                <Globe className="h-5 w-5 text-[#1d4e4b]" />
                Browser demo call
              </CardTitle>
              <CardDescription>
                Best for demos today. Launch a guided web call room, walk through a scripted caregiver conversation, and save the outcome into portal history.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[1.2rem] border border-[#ddd3c4] bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[#527a68]">What this does</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Creates a real saved session in the portal, opens a browser call experience, and stores the demo transcript, summary, and outcome in call history when you finish.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1">No telephony required</Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">Saved to portal history</Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">Ready for demos</Badge>
              </div>

              <Button
                className="w-full rounded-2xl bg-[#1d4e4b] hover:bg-[#0f2e2c]"
                onClick={() => initiateWebCall.mutate()}
                disabled={initiateWebCall.isPending}
              >
                {initiateWebCall.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing browser call...
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-4 w-4" />
                    Start Browser Demo Call
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="cg-panel rounded-[2rem] border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-[#0f2e2c]">
                <Phone className="h-5 w-5 text-[#1d4e4b]" />
                Phone call
              </CardTitle>
              <CardDescription>
                Uses ElevenLabs to dial a real phone number. Keep this for production once outbound calling is configured end to end.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {setupStatus && !isPhoneReady && (
                <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-900">Phone calling still needs setup</p>
                      {!setupStatus.hasGHLContact && (
                        <p className="text-xs text-amber-700">
                          Your account is not yet linked to a Wibiz contact. Visit Profile to finish the contact setup.
                        </p>
                      )}
                      {!setupStatus.elevenLabsConfigured && (
                        <p className="text-xs text-amber-700">
                          ElevenLabs calling is not configured yet. Use the browser demo call for now.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeCall?.mode === "phone" ? (
                <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                      <PhoneCall className="h-5 w-5 animate-pulse text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Phone call in progress</p>
                      <p className="text-xs text-emerald-700">Session {activeCall.sessionId}</p>
                    </div>
                    <Badge className="ml-auto border-emerald-200 bg-emerald-100 text-emerald-800">Active</Badge>
                  </div>

                  <div className="mt-4 flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-2xl border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                      onClick={() => setLocation(`/call/${activeCall.sessionId}`)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 rounded-2xl border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => markCompleted.mutate({ sessionId: activeCall.sessionId })}
                      disabled={markCompleted.isPending}
                    >
                      <PhoneOff className="mr-2 h-4 w-4" />
                      Mark Complete
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+65 9123 4567"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="font-mono"
                    />
                    {identity?.phoneNumber && !phoneNumber && (
                      <p className="text-xs text-muted-foreground">
                        Will use your saved number: <span className="font-mono font-medium">{identity.phoneNumber}</span>
                      </p>
                    )}
                  </div>

                  {identity?.ghlContactId && (
                    <div className="rounded-[1.2rem] bg-[#ede7dc] p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#527a68]">Linked Wibiz contact</p>
                      <p className="mt-2 font-mono text-sm text-[#0f2e2c]">{identity.ghlContactId}</p>
                    </div>
                  )}

                  <Button
                    className="w-full rounded-2xl bg-[#1d4e4b] hover:bg-[#0f2e2c]"
                    onClick={handleStartPhoneCall}
                    disabled={initiateCall.isPending || (!isPhoneReady && setupStatus !== undefined)}
                  >
                    {initiateCall.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Initiating phone call...
                      </>
                    ) : (
                      <>
                        <Phone className="mr-2 h-4 w-4" />
                        Start Phone Call
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-dashed bg-muted/30">
          <CardContent className="py-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Demo mode recommendation:</strong> for presentations, use the browser demo call. It keeps the portal experience complete while outbound telephony is still being finalized. When phone calling is ready, live call outcomes will continue syncing against the same Wibiz-linked caregiver record.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
