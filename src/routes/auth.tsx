import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, Page } from "@/components/AppShell";
import { Button, Card, Field, Input, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Ateeq" },
      { name: "description", content: "Sign in or create your Ateeq customer or supplier account." },
      { property: "og:title", content: "Sign in — Ateeq" },
      { property: "og:description", content: "Access your Ateeq account as a customer or supplier." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [role, setRole] = useState<"customer" | "supplier">("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: role === "supplier" ? "/supplier" : "/" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, role, company_name: company },
          },
        });
        if (error) throw error;
        toast.success("Account created — you can sign in now.");
        setMode("in");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
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
          <div className="grid grid-cols-2 rounded-xl bg-muted p-1 text-sm">
            {(["in", "up"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
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
                  <div className="grid grid-cols-2 gap-2">
                    {(["customer", "supplier"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`h-11 rounded-xl border text-sm font-medium transition-colors ${
                          role === r
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        {r === "customer" ? t("customer") : t("supplier")}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={t("fullName")}>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </Field>
                {role === "supplier" && (
                  <Field label={t("companyName")}>
                    <Input value={company} onChange={(e) => setCompany(e.target.value)} required />
                  </Field>
                )}
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
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? <Spinner /> : mode === "in" ? t("signIn") : t("signUp")}
            </Button>
          </form>
        </Card>
      </Page>
    </AppShell>
  );
}
