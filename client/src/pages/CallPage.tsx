import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Loader2, Phone, PhoneCall, PhoneOff } from "lucide-react";
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
  } | null>(null);

  const { data: setupStatus } = trpc.identity.checkSetupStatus.useQuery();
  const { data: identity } = trpc.identity.getMyIdentity.useQuery();

  const initiateCall = trpc.calls.initiateCall.useMutation({
    onSuccess: (data) => {
      setActiveCall({ sessionId: data.sessionId, conversationId: data.conversationId });
      toast.success("Call initiated successfully", {
        description: `Session ID: ${data.sessionId}`,
      });
    },
    onError: (err) => {
      toast.error("Failed to initiate call", { description: err.message });
    },
  });

  const markCompleted = trpc.calls.markCallCompleted.useMutation({
    onSuccess: () => {
      toast.success("Call marked as completed");
      setActiveCall(null);
      setLocation("/history");
    },
  });

  const handleStartCall = () => {
    const phone = phoneNumber.trim() || identity?.phoneNumber;
    if (!phone) {
      toast.error("Please enter a phone number");
      return;
    }
    initiateCall.mutate({ phoneNumber: phone });
  };

  const isReady = setupStatus?.hasGHLContact && setupStatus?.elevenLabsConfigured;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Start a Voice Call</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Initiate an ElevenLabs AI voice call linked to your GHL contact record.
          </p>
        </div>

        {/* Readiness Check */}
        {setupStatus && !isReady && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-900">Setup required before calling</p>
                  {!setupStatus.hasGHLContact && (
                    <p className="text-xs text-amber-700">
                      • Your account is not yet linked to a GHL contact. Visit Profile to set up your phone number.
                    </p>
                  )}
                  {!setupStatus.elevenLabsConfigured && (
                    <p className="text-xs text-amber-700">
                      • ElevenLabs is not configured. Contact your administrator.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Call Card */}
        {activeCall ? (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <PhoneCall className="h-5 w-5 text-emerald-600 animate-pulse" />
                </div>
                <div>
                  <CardTitle className="text-base text-emerald-900">Call in Progress</CardTitle>
                  <CardDescription className="text-emerald-700 text-xs">
                    ElevenLabs AI agent is active
                  </CardDescription>
                </div>
                <Badge className="ml-auto bg-emerald-100 text-emerald-800 border-emerald-200">
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/70 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">Session ID</p>
                  <p className="font-mono text-xs mt-1 break-all">{activeCall.sessionId}</p>
                </div>
                <div className="bg-white/70 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">Conversation ID</p>
                  <p className="font-mono text-xs mt-1 break-all">{activeCall.conversationId}</p>
                </div>
              </div>
              <p className="text-xs text-emerald-700 bg-emerald-100 rounded-lg px-3 py-2">
                The AI agent will call the phone number you provided. Post-call data will automatically sync to GHL when the call ends.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  onClick={() => setLocation(`/call/${activeCall.sessionId}`)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  View Details
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => markCompleted.mutate({ sessionId: activeCall.sessionId })}
                  disabled={markCompleted.isPending}
                >
                  <PhoneOff className="h-4 w-4 mr-2" />
                  Mark Complete
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Initiate Call</CardTitle>
              <CardDescription>
                Enter the phone number to call. The ElevenLabs AI agent will dial this number and your GHL contact will be updated automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="font-mono"
                />
                {identity?.phoneNumber && !phoneNumber && (
                  <p className="text-xs text-muted-foreground">
                    Will use your saved number:{" "}
                    <span className="font-mono font-medium">{identity.phoneNumber}</span>
                  </p>
                )}
              </div>

              {/* Identity Info */}
              {identity?.ghlContactId && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Call will be linked to</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <p className="text-xs">
                      GHL Contact:{" "}
                      <span className="font-mono font-medium">{identity.ghlContactId}</span>
                    </p>
                  </div>
                  {identity.consentGiven && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <p className="text-xs text-emerald-700">Consent previously verified</p>
                    </div>
                  )}
                </div>
              )}

              <Button
                className="w-full gap-2"
                onClick={handleStartCall}
                disabled={initiateCall.isPending || (!isReady && setupStatus !== undefined)}
              >
                {initiateCall.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Initiating Call...
                  </>
                ) : (
                  <>
                    <Phone className="h-4 w-4" />
                    Start Voice Call
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">How it works:</strong> When you start a call, the ElevenLabs AI agent will call the provided phone number. During the call, the agent collects information and verifies consent. After the call ends, a webhook automatically syncs the transcript, safety assessment, and outcome to your GoHighLevel contact record.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
