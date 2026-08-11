import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Smartphone } from "lucide-react";
import { AppShell, Page } from "@/components/AppShell";
import { Button, Card, Field, Input, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { ensureAccount } from "@/lib/account.functions";
import { errorMessage } from "@/lib/utils";

const TITLE = "Sign in — MazzadTech";
const DESC = "Sign in or create your MazzadTech customer, supplier or delivery account.";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const ROLES = ["customer", "supplier", "delivery"] as const;
type SignupRole = (typeof ROLES)[number];

const PENDING_SIGNUP_KEY = "mazzadtech_pending_signup";

function routeForRoles(roles: string[]) {
  return roles.includes("admin")
    ? "/admin"
    : roles.includes("supplier")
      ? "/supplier/auctions"
      : roles.includes("delivery")
        ? "/delivery"
        : "/";
}

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [role, setRole] = useState<SignupRole>("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [authMethod, setAuthMethod] = useState<"password" | "phone">("password");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const needsCompany = role === "supplier" || role === "delivery";

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;

      const pendingRaw = localStorage.getItem(PENDING_SIGNUP_KEY);
      if (pendingRaw) {
        localStorage.removeItem(PENDING_SIGNUP_KEY);
        try {
          const pending = JSON.parse(pendingRaw) as { role: string; company_name: string | null; phone: string | null };
          await supabase.auth.updateUser({ data: pending });
        } catch {
          // ignore malformed pending data
        }
      }

      let roles: string[] = [];
      try {
        roles = (await ensureAccount()).roles;
      } catch {
        return;
      }
      navigate({ to: routeForRoles(roles) });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const oauthSignIn = async (provider: "google" | "apple") => {
    if (mode === "up") {
      localStorage.setItem(
        PENDING_SIGNUP_KEY,
        JSON.stringify({ role, company_name: needsCompany ? company || null : null, phone: phone || null }),
      );
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) toast.error(errorMessage(error));
  };

  const sendOtp = async () => {
    if (!phone.trim()) {
      toast.error(t("phoneRequired"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp(
        mode === "up"
          ? {
              phone: phone.trim(),
              options: { data: { full_name: fullName, role, company_name: needsCompany ? company : null, phone: phone.trim() } },
            }
          : { phone: phone.trim() },
      );
      if (error) throw error;
      setOtpSent(true);
      toast.success(t("otpSent"));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: phone.trim(), token: otpCode.trim(), type: "sms" });
      if (error) throw error;
      let roles: string[] = [];
      try {
        roles = (await ensureAccount()).roles;
      } catch {
        roles = [];
      }
      navigate({ to: routeForRoles(roles) });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        let stored: string[] = [];
        try {
          const res = await ensureAccount();
          stored = res.roles;
        } catch {
          stored = [];
        }
        if (adminMode && !stored.includes("admin")) {
          toast.error(t("notAnAdmin"));
        }
        navigate({ to: routeForRoles(stored) });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName,
              role,
              company_name: needsCompany ? company : null,
              phone: phone || null,
            },
          },
        });
        if (error) throw error;
        toast.success("Account created — you can sign in now.");
        setMode("in");
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell role={null} signedIn={false}>
      <Page>
        <div className="pt-6 text-center">
          <h1 className="font-display text-2xl font-semibold">{t("appName")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("tagline")}</p>
        </div>

        <Card className="mt-4 space-y-4">
          {adminMode && (
            <div className="flex items-start gap-2 rounded-xl bg-primary-soft p-3 text-xs text-primary">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">{t("adminPortal")}</p>
                <p className="mt-1 opacity-90">{t("adminPortalHint")}</p>
              </div>
            </div>
          )}
          <div className={`grid-cols-2 rounded-xl bg-muted p-1 text-sm ${adminMode ? "hidden" : "grid"}`}>
            {(["in", "up"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-lg py-2 font-medium transition-colors ${mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                {m === "in" ? t("signIn") : t("signUp")}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "up" && (
              <>
                <Field label={t("iAmA")}>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLES.map((r) => (
                      <button key={r} type="button" onClick={() => setRole(r)} className={`h-11 rounded-xl border px-1 text-xs font-medium transition-colors ${role === r ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-muted-foreground"}`}>
                        {r === "customer" ? t("customer") : r === "supplier" ? t("supplier") : t("deliveryCompany")}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={t("fullName")}>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </Field>
                {needsCompany && (
                  <Field label={role === "delivery" ? t("deliveryCompanyName") : t("companyName")}>
                    <Input value={company} onChange={(e) => setCompany(e.target.value)} required />
                  </Field>
                )}
                {authMethod === "password" && (
                  <Field label={t("phone")}>
                    <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                  </Field>
                )}
              </>
            )}

            {!adminMode && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => void oauthSignIn("google")} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium">
                    <GoogleIcon />
                    Google
                  </button>
                  <button type="button" onClick={() => void oauthSignIn("apple")} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium">
                    <AppleIcon />
                    Apple
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  {t("orContinueWith")}
                  <span className="h-px flex-1 bg-border" />
                </div>

                <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-xs">
                  <button type="button" onClick={() => { setAuthMethod("password"); setOtpSent(false); }} className={`rounded-lg py-1.5 font-medium transition-colors ${authMethod === "password" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                    {t("email")}
                  </button>
                  <button type="button" onClick={() => setAuthMethod("phone")} className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition-colors ${authMethod === "phone" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                    <Smartphone className="size-3.5" />
                    {t("phone")}
                  </button>
                </div>
              </>
            )}

            {authMethod === "phone" && !adminMode ? (
              <div className="space-y-3">
                <Field label={t("phone")}>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+970 5X XXX XXXX" disabled={otpSent} autoComplete="tel" />
                </Field>
                {otpSent && (
                  <Field label={t("otpCode")}>
                    <Input inputMode="numeric" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="123456" autoFocus />
                  </Field>
                )}
                <Button type="button" size="lg" className="w-full" disabled={busy} onClick={() => void (otpSent ? verifyOtp() : sendOtp())}>
                  {busy ? <Spinner /> : otpSent ? t("verifyCode") : t("sendCode")}
                </Button>
                {otpSent && (
                  <button type="button" onClick={() => { setOtpSent(false); setOtpCode(""); }} className="mx-auto block text-xs text-muted-foreground underline">
                    {t("changePhoneNumber")}
                  </button>
                )}
              </div>
            ) : (
              <>
                <Field label={t("email")}>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                </Field>
                <Field label={t("password")}>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} />
                </Field>
                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {busy ? <Spinner /> : mode === "in" ? t("signIn") : t("signUp")}
                </Button>
              </>
            )}
          </form>
        </Card>

        <button type="button" onClick={() => { setAdminMode((v) => !v); setMode("in"); setAuthMethod("password"); }} className="mx-auto mt-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ShieldCheck className="size-4" />
          {adminMode ? t("backToNormalSignIn") : t("adminPortal")}
        </button>
      </Page>
    </AppShell>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4c-.3 1.5-1.2 2.7-2.5 3.6v3h4.3c2.5-2.3 3.3-5.6 3.3-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-4.3-3c-1.1.8-2.6 1.3-4.3 1.3-3.3 0-6.1-2.2-7.1-5.2H.4v3.1C2.4 21.5 6.9 24 12 24z" />
      <path fill="#FBBC05" d="M4.9 14.2c-.3-.8-.4-1.6-.4-2.4s.1-1.6.4-2.4V6.3H.4C-.1 8 -.4 9.9-.4 11.8s.3 3.8.8 5.5l4.5-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.7 1.8l3.6-3.6C18.1 1.1 15.3 0 12 0 6.9 0 2.4 2.5.4 6.3l4.5 3.1c1-3 3.8-4.6 7.1-4.6z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current">
      <path d="M16.7 1c.1 1.2-.4 2.4-1.1 3.3-.8.9-2 1.6-3.2 1.5-.1-1.1.4-2.3 1.1-3.1C14.3 1.7 15.5 1 16.7 1zM20.9 17.2c-.5 1.2-1.1 2.3-1.9 3.4-1.1 1.5-2.3 3.4-4 3.4-1.4 0-1.9-.9-3.5-.9-1.6 0-2.2.9-3.5.9-1.7.1-3-1.9-4.1-3.4-2.3-3.2-4-9-1.7-13 1.1-2 3.1-3.2 5.2-3.3 1.4 0 2.6.9 3.5.9.8 0 2.3-1.1 4-.9.7 0 3.1.3 4.6 2.5-.1.1-2.8 1.6-2.8 4.9.1 3.9 3.4 5.2 3.2 5.5z" />
    </svg>
  );
}
