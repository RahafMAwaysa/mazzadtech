import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Building2, MapPin, Phone } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Button, Card, Field, Input, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "Delivery company profile — MazzadTech";
const DESC = "Manage your delivery company details, coverage city and contact number.";

const CITIES = [
  ["Nablus", "نابلس"],
  ["Ramallah and Al-Bireh", "رام الله والبيرة"],
  ["Hebron", "الخليل"],
  ["Jenin", "جنين"],
  ["Tulkarm", "طولكرم"],
  ["Qalqilya", "قلقيلية"],
  ["Bethlehem", "بيت لحم"],
  ["Jericho", "أريحا والأغوار"],
  ["Salfit", "سلفيت"],
  ["Tubas", "طوباس"],
  ["Gaza", "غزة"],
  ["Jerusalem", "القدس"],
] as const;

export const Route = createFileRoute("/delivery/profile")({
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
  component: () => <Guard roles={["delivery", "admin"]}>{(ctx) => <Body userId={ctx.userId} />}</Guard>,
});

function Body({ userId }: { userId: string }) {
  const { t, lang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [alias, setAlias] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("delivery_companies")
        .select("alias, company_name, phone, city")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setAlias(data.alias ?? "");
        setCompanyName(data.company_name ?? "");
        setPhone(data.phone ?? "");
        setCity(data.city ?? "");
      }
      setLoading(false);
    })();
  }, [userId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase
      .from("delivery_companies")
      .update({ company_name: companyName, phone: phone || null, city: city || null })
      .eq("user_id", userId);
    if (error) toast.error(error.message);
    else toast.success(t("saved"));
    setBusy(false);
  };

  if (loading) {
    return (
      <Page title={t("profile")}>
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      </Page>
    );
  }

  return (
    <Page title={t("profile")}>
      <div className="mx-auto w-full max-w-2xl">
        <Card className="overflow-hidden p-0 shadow-sm">
          <div className="border-b border-border bg-muted/20 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold">{t("deliveryCompanyName")}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("identityProtected")}</p>
              </div>
            </div>
          </div>

          <form onSubmit={save} className="space-y-5 p-5 sm:p-6">
            <Field label={t("deliveryCompanyName")}>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  className="pl-10"
                />
              </div>
            </Field>

            <Field label={t("phone")}>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10"
                />
              </div>
            </Field>

            <Field label={t("city")}>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-input bg-card pl-10 pr-10 text-sm text-foreground outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <option value="">{t("city")}</option>
                  {CITIES.map(([en, ar]) => (
                    <option key={en} value={en}>
                      {lang === "ar" ? ar : en}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </Field>

            <div className="rounded-xl border border-border bg-muted/20 px-3.5 py-3 text-xs text-muted-foreground">
              {t("deliveryPartner")}: <span className="font-medium text-foreground">{alias}</span>
            </div>

            <Button type="submit" className="h-11 w-full" disabled={busy}>
              {busy ? <Spinner /> : t("save")}
            </Button>
          </form>
        </Card>
      </div>
    </Page>
  );
}
