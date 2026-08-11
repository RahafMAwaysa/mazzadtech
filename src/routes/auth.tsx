import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
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
      ? "/supplier"
      : roles.includes("delivery")
        ? "/delivery"
        : "/";
}

function passwordStrength(password: string) {
  if (!password) return { score: 0, label: "", color: "bg-muted" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: "Weak", color: "bg-destructive" };
  if (score === 2) return { score: 2, label: "Fair", color: "bg-orange-500" };
  if (score === 3) return { score: 3, label: "Good", color: "bg-yellow-500" };
  return { score: 4, label: "Strong", color: "bg-green-500" };
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

  const needsCompany = role === "supplier" || role === "delivery";
  const strength = passwordStrength(password);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;

      const pendingRaw = localStorage.getItem(PENDING_SIGNUP_KEY);
      if (pendingRaw) {
        localStorage.removeItem(PENDING_SIGNUP_KEY);
        try {
          const pending = JSON.parse(pendingRaw) as {
            role: string;
            company_name: string | null;
            phone: string | null;
          };
          await supabase.auth.updateUser({ data: pending });
        } catch {
          // Ignore malformed pending signup data.
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

  const googleSignIn = async () => {
    if (mode === "up") {
      localStorage.setItem(
        PENDING_SIGNUP_KEY,
        JSON.stringify({
          role,
          company_name: needsCompany ? company || null : null,
          phone: phone || null,
        }),
      );
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) toast.error(errorMessage(error));
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
          stored = (await ensureAccount()).roles;
        } catch {
          stored = [];
        }

        if (adminMode && !stored.includes("admin")) {
          toast.error(t("notAnAdmin"));
        }
        navigate({ to: routeForRoles(stored) });
      } else {
        const signupName = needsCompany ? company : fullName;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: signupName,
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
            {["in", "up"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m as "in" | "up")}
                className={`rounded-lg py-2 font-medium transition-colors ${
                  mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
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
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`h-11 rounded-xl border px-1 text-xs font-medium transition-colors ${
                          role === r
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        {r === "customer"
                          ? t("customer")
                          : r === "supplier"
                            ? t("supplier")
                            : t("deliveryCompany")}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label={needsCompany ? (role === "delivery" ? t("deliveryCompanyName") : t("companyName")) : t("fullName")}>
                  <Input
                    value={needsCompany ? company : fullName}
                    onChange={(e) => (needsCompany ? setCompany(e.target.value) : setFullName(e.target.value))}
                    required
                  />
                </Field>

                <Field label={t("phone")}>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                </Field>
              </>
            )}

            {!adminMode && (
              <>
                <button
                  type="button"
                  onClick={() => void googleSignIn()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  {t("orContinueWith")}
                  <span className="h-px flex-1 bg-border" />
                </div>
              </>
            )}

            <Field label={t("email")}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Field>

            <Field label={t("password")}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "in" ? "current-password" : "new-password"}
              />
              {mode === "up" && password && (
                <div className="mt-2 space-y-1.5" aria-live="polite">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((segment) => (
                      <div
                        key={segment}
                        className={`h-1.5 flex-1 rounded-full ${segment <= strength.score ? strength.color : "bg-muted"}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{strength.label}</p>
                </div>
              )}
            </Field>

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? <Spinner /> : mode === "in" ? t("signIn") : t("signUp")}
            </Button>
          </form>
        </Card>

        <button
          type="button"
          onClick={() => {
            setAdminMode((v) => !v);
            setMode("in");
          }}
          className="mx-auto mt-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
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
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-4.3-3c-1.1.8-2.6 1.3-4.3 1.3-3.3 0-6.1-2.2-7.1-5.2H.4v3.1C-.1 8 -.4 9.9-.4 11.8s.3 3.8.8 5.5l4.5-3.1z" />
      <path fill="#FBBC05" d="M4.9 14.2c-.3-.8-.4-1.6-.4-2.4s.1-1.6.4-2.4V6.3H.4C-.1 8 -.4 9.9-.4 11.8s.3 3.8.8 5.5l4.5-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.7 1.8l3.6-3.6C18.1 1.1 15.3 0 12 0 6.9 0 2.4 2.5.4 6.3l4.5 3.1c1-3 3.8-4.6 7.1-4.6z" />
    </svg>
  );
}
