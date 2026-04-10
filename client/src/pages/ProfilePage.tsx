import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ExternalLink, Loader2, Phone, RefreshCw, Save, Shield, User, XCircle } from "lucide-react";
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
      toast.success(result.ghlContactId ? "Wibiz contact synced successfully" : "Profile synced");
      refetchIdentity();
      refetchSetup();
    },
    onError: (err: { message: string }) => {
      toast.error("Wibiz sync failed", { description: err.message });
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

  const sidebar = (
    <div className="cg-sidebar-card sticky top-[104px] rounded-[1.6rem] p-6">
      <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-white/32">Setup Checklist</p>
      <div className="space-y-3">
        {[
          { label: "Account created", done: true },
          { label: "Phone number saved", done: setupStatus?.hasPhone ?? false },
          { label: "Wibiz contact linked", done: setupStatus?.hasGHLContact ?? false },
          { label: "ElevenLabs configured", done: setupStatus?.elevenLabsConfigured ?? false },
          { label: "Consent verified", done: setupStatus?.consentGiven ?? false },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/6 px-4 py-3">
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <div className="h-4 w-4 shrink-0 rounded-full border border-white/28" />
            )}
            <span className="text-sm text-white/78">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <DashboardLayout sidebar={sidebar}>
      <div className="space-y-6">
        <section className="cg-panel rounded-[2rem] px-6 py-7 sm:px-8">
          <p className="cg-label">Caregiver Profile</p>
          <h1 className="cg-display mt-2 text-4xl font-bold text-[#0f2e2c] sm:text-5xl">Identity and support linkage</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            Manage the account details the assistant uses to recognize this caregiver and keep CRM records tied to the correct portal history.
          </p>
        </section>

        <Card className="cg-panel rounded-[2rem] border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-[#0f2e2c]">
              <User className="h-5 w-5 text-[#1d4e4b]" />
              Account Information
            </CardTitle>
            <CardDescription>Your authenticated caregiver identity.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.3rem] bg-white/65 p-4">
              <p className="cg-label">Full Name</p>
              <p className="mt-2 text-lg font-medium text-[#0f2e2c]">{user?.name ?? "-"}</p>
            </div>
            <div className="rounded-[1.3rem] bg-white/65 p-4">
              <p className="cg-label">Email</p>
              <p className="mt-2 text-lg font-medium text-[#0f2e2c]">{user?.email ?? "-"}</p>
            </div>
            <div className="rounded-[1.3rem] bg-white/65 p-4">
              <p className="cg-label">Role</p>
              <div className="mt-2">
                <Badge variant={user?.role === "admin" ? "default" : "secondary"} className="rounded-full px-3 py-1 text-xs">
                  {user?.role ?? "user"}
                </Badge>
              </div>
            </div>
            <div className="rounded-[1.3rem] bg-white/65 p-4">
              <p className="cg-label">Member Since</p>
              <p className="mt-2 text-lg font-medium text-[#0f2e2c]">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
                  : "-"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="cg-panel rounded-[2rem] border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-[#0f2e2c]">
              <Phone className="h-5 w-5 text-[#1d4e4b]" />
              Phone Number
            </CardTitle>
            <CardDescription>
              This phone number helps link voice calls and caregiver CRM records to the same person.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="cg-label">Phone Number</Label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+65 9123 4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="h-12 rounded-2xl border-[#ddd3c4] bg-white font-mono"
                />
                <Button onClick={handleSave} disabled={saving || !phoneNumber.trim()} className="h-12 rounded-2xl bg-[#1d4e4b] px-5 hover:bg-[#0f2e2c]">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Include the country code so Wibiz and voice workflows can match correctly.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cg-panel rounded-[2rem] border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-[#0f2e2c]">
              <ExternalLink className="h-5 w-5 text-[#1d4e4b]" />
              Wibiz Contact
            </CardTitle>
            <CardDescription>
              Your caregiver portal account links to a Wibiz contact so conversations and care workflows stay mapped correctly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {identity?.ghlContactId ? (
              <>
                <div className="rounded-[1.3rem] bg-white/65 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="font-medium text-emerald-700">Wibiz contact linked</span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Contact ID</span>
                    <code className="rounded-full bg-[#ede7dc] px-3 py-1 text-[#0f2e2c]">{identity.ghlContactId}</code>
                  </div>
                  {identity.consentGiven && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
                      <Shield className="h-4 w-4" />
                      Consent verified
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => syncGHL.mutate({ phoneNumber: phoneNumber || undefined })}
                  disabled={syncGHL.isPending}
                  className="rounded-2xl border-[#ddd3c4] bg-white/65 hover:bg-white"
                >
                  {syncGHL.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Re-sync with Wibiz
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-[1.3rem] border border-[#d4935a]/22 bg-[#d4935a]/10 p-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-[#b77642]" />
                    <span className="font-medium text-[#84532d]">No Wibiz contact linked yet</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#84532d]">
                    Save a phone number first, then create or re-sync the caregiver contact so future AI and call activity maps back to this same account.
                  </p>
                </div>
                <Button
                  onClick={() => syncGHL.mutate({ phoneNumber: phoneNumber.trim() })}
                  disabled={syncGHL.isPending || !phoneNumber.trim()}
                  className="rounded-2xl bg-[#1d4e4b] hover:bg-[#0f2e2c]"
                >
                  {syncGHL.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                  Create Wibiz Contact
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
