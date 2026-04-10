import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Brain, HeartHandshake, Languages, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="rounded-2xl border border-[#c0392b]/20 bg-[#c0392b]/8 px-4 py-3 text-sm text-[#c0392b]">
      {message}
    </div>
  );
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ name: "", email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setLocation("/");
    },
    onError: (err) => setLoginError(err.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setLocation("/");
    },
    onError: (err) => setRegisterError(err.message),
  });

  return (
    <div className="cg-auth-shell grid min-h-screen lg:grid-cols-[430px_minmax(0,1fr)]">
      <aside className="cg-auth-left hidden min-h-screen flex-col justify-between px-11 py-12 text-[#f9f5ee] lg:flex">
        <div className="relative z-10">
          <div className="mb-14 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8">
              <Brain className="h-5 w-5 text-[#edb27e]" />
            </div>
            <div>
              <p className="cg-display text-xl font-bold text-white">Dementia<span className="text-[#edb27e]">SG</span></p>
              <p className="text-xs font-light tracking-[0.18em] text-white/45 uppercase">Caregiver Portal</p>
            </div>
          </div>

          <div className="max-w-[17rem]">
            <h1 className="cg-display text-5xl font-black leading-[0.94] text-white">
              You carry
              <br />
              <em className="font-normal italic text-[#edb27e]">so much.</em>
              <br />
              Let us help.
            </h1>
            <p className="mt-6 text-sm font-light leading-7 text-white/58">
              Sign in to continue your caregiver journey with saved conversations, contact history, and support that remembers who you are.
            </p>
          </div>

          <div className="mt-10 space-y-3 text-sm text-white/68">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7a9e8a]/18">
                <LockKeyhole className="h-4 w-4 text-[#edb27e]" />
              </div>
              Your information is kept private and secure
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7a9e8a]/18">
                <HeartHandshake className="h-4 w-4 text-[#edb27e]" />
              </div>
              Dementia support records stay attached to your account
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7a9e8a]/18">
                <Languages className="h-4 w-4 text-[#edb27e]" />
              </div>
              Supportive guidance built for multilingual caregiver care
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs font-light leading-6 text-white/30">
          Dementia Singapore
          <br />
          Caregiver support, case history, and AI guidance in one calm space.
        </p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-xl">
          <div className="mb-8 text-center lg:hidden">
            <p className="cg-display text-3xl font-bold text-[#0f2e2c]">Dementia<span className="text-[#d4935a]">SG</span></p>
            <p className="mt-2 text-sm text-muted-foreground">Caregiver Portal</p>
          </div>

          <div className="cg-form-card rounded-[2rem] p-4 sm:p-6">
            <Tabs defaultValue="login">
              <TabsList className="mb-8 grid h-auto w-full grid-cols-2 rounded-2xl bg-[#ede7dc] p-1">
                <TabsTrigger value="login" className="rounded-xl py-3 data-[state=active]:bg-[#1d4e4b] data-[state=active]:text-white">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="register" className="rounded-xl py-3 data-[state=active]:bg-[#1d4e4b] data-[state=active]:text-white">
                  Create Account
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-0">
                <div className="mb-8">
                  <h2 className="cg-display text-4xl font-bold text-[#0f2e2c]">Welcome back</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    Your assistant, support history, and caregiver tools are ready when you are.
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setLoginError("");
                    loginMutation.mutate(loginForm);
                  }}
                  className="space-y-5"
                >
                  <FormError message={loginError} />

                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="cg-label">Email Address</Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      placeholder="caregiver@example.com"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
                      required
                      className="h-12 rounded-2xl border-[#ddd3c4] bg-white px-4"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="cg-label">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                      required
                      className="h-12 rounded-2xl border-[#ddd3c4] bg-white px-4"
                    />
                  </div>

                  <Button type="submit" className="h-12 w-full rounded-2xl bg-[#1d4e4b] text-base hover:bg-[#0f2e2c]" disabled={loginMutation.isPending}>
                    {loginMutation.isPending ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-0">
                <div className="mb-8">
                  <h2 className="cg-display text-4xl font-bold text-[#0f2e2c]">Create your account</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    Register once and keep your caregiver identity, chat context, and portal history in one secure place.
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setRegisterError("");
                    registerMutation.mutate(registerForm);
                  }}
                  className="space-y-5"
                >
                  <FormError message={registerError} />

                  <div className="space-y-2">
                    <Label htmlFor="reg-name" className="cg-label">Full Name</Label>
                    <Input
                      id="reg-name"
                      type="text"
                      autoComplete="name"
                      placeholder="Sarah Tan"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, name: e.target.value }))}
                      required
                      className="h-12 rounded-2xl border-[#ddd3c4] bg-white px-4"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-email" className="cg-label">Email Address</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      autoComplete="email"
                      placeholder="caregiver@example.com"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, email: e.target.value }))}
                      required
                      className="h-12 rounded-2xl border-[#ddd3c4] bg-white px-4"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-password" className="cg-label">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, password: e.target.value }))}
                      minLength={8}
                      required
                      className="h-12 rounded-2xl border-[#ddd3c4] bg-white px-4"
                    />
                  </div>

                  <div className="rounded-2xl border border-[#7a9e8a]/16 bg-[#7a9e8a]/8 px-4 py-3 text-sm leading-6 text-[#527a68]">
                    By creating an account, the portal can recognize your caregiver profile and keep future AI conversations attached to the same history.
                  </div>

                  <Button type="submit" className="h-12 w-full rounded-2xl bg-[#1d4e4b] text-base hover:bg-[#0f2e2c]" disabled={registerMutation.isPending}>
                    {registerMutation.isPending ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
