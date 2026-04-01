import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Phone,
  RefreshCw,
  Save,
  Shield,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "../components/DashboardLayout";

export default function ProfilePage() {
  const { user } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: identity, refetch: refetchIdentity } = trpc.identity.getMyIdentity.useQuery();
  const { data: setupStatus, refetch: refetchSetup } = trpc.identity.checkSetupStatus.useQuery();

  const updateProfile = trpc.identity.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully");
      refetchIdentity();
      refetchSetup();
      setSaving(false);
    },
    onError: (err: { message: string }) => {
      toast.error("Failed to update profile", { description: err.message });
      setSaving(false);
    },
  });

  const syncGHL = trpc.identity.setupIdentity.useMutation({
    onSuccess: (result) => {
      if (result.ghlContactId) {
        toast.success("GHL contact synced successfully");
      } else {
        toast.success("Profile synced");
      }
      refetchIdentity();
      refetchSetup();
    },
    onError: (err: { message: string }) => {
      toast.error("GHL sync failed", { description: err.message });
    },
  });

  useEffect(() => {
    if (identity?.phoneNumber) {
      setPhoneNumber(identity.phoneNumber);
    }
  }, [identity]);

  const handleSave = () => {
    setSaving(true);
    updateProfile.mutate({ phoneNumber: phoneNumber.trim() });
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your account details and GHL contact linkage
          </p>
        </div>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Account Information
            </CardTitle>
            <CardDescription>Your Manus OAuth identity details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Full Name</Label>
                <p className="text-sm font-medium">{user?.name ?? "—"}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="text-sm font-medium">{user?.email ?? "—"}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Role</Label>
                <Badge variant={user?.role === "admin" ? "default" : "secondary"} className="text-xs">
                  {user?.role ?? "user"}
                </Badge>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Member Since</Label>
                <p className="text-sm font-medium">
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString(undefined, {
                        month: "long", day: "numeric", year: "numeric",
                      })
                    : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phone Number */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              Phone Number
            </CardTitle>
            <CardDescription>
              Your phone number is used to initiate voice calls and link your GHL contact record.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex gap-2">
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="font-mono flex-1"
                />
                <Button
                  onClick={handleSave}
                  disabled={saving || !phoneNumber.trim()}
                  className="gap-2 shrink-0"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Include country code (e.g., +1 for US/Canada)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* GHL Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-primary" />
              GoHighLevel Contact
            </CardTitle>
            <CardDescription>
              Your portal account is linked to a GHL contact for CRM tracking and call record management.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {identity?.ghlContactId ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-700">GHL contact linked</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Contact ID</span>
                    <code className="text-xs font-mono">{identity.ghlContactId}</code>
                  </div>

                  {identity.consentGiven && (
                    <div className="flex items-center gap-2 pt-1">
                      <Shield className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-xs text-emerald-700">
                        Consent verified
                        {identity.consentTimestamp
                          ? ` on ${new Date(identity.consentTimestamp).toLocaleDateString()}`
                          : ""}
                      </span>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncGHL.mutate({ phoneNumber: phoneNumber || undefined })}
                  disabled={syncGHL.isPending}
                  className="gap-2"
                >
                  {syncGHL.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Re-sync with GHL
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">No GHL contact linked yet</span>
                </div>
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  A GHL contact will be created automatically when you save your phone number. You can also manually trigger the sync below.
                </p>
                <Button
                  onClick={() => syncGHL.mutate({ phoneNumber: phoneNumber.trim() })}
                  disabled={syncGHL.isPending || !phoneNumber.trim()}
                  className="gap-2"
                >
                  {syncGHL.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  Create GHL Contact
                </Button>
                {!phoneNumber.trim() && (
                  <p className="text-xs text-amber-600">Save your phone number first to create a GHL contact.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Setup Checklist */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Setup Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {[
                { label: "Account created", done: true },
                { label: "Phone number saved", done: setupStatus?.hasPhone ?? false },
                { label: "GHL contact linked", done: setupStatus?.hasGHLContact ?? false },
                { label: "ElevenLabs configured", done: setupStatus?.elevenLabsConfigured ?? false },
                { label: "Consent verified", done: setupStatus?.consentGiven ?? false },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  {item.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                  )}
                  <span className={`text-sm ${item.done ? "text-foreground" : "text-muted-foreground"}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
