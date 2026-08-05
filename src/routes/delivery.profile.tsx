import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Button, Card, Field, Input, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "Delivery company profile — MazzadTech";
const DESC = "Manage your delivery company details, coverage city and contact number.";

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
  const { t } = useI18n();
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
      <Card>
        <form onSubmit={save} className="space-y-3">
          <Field label={t("deliveryCompanyName")}>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
          </Field>
          <Field label={t("phone")}>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label={t("city")}>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <p className="text-xs text-muted-foreground">
            {t("deliveryPartner")}: <span className="font-medium text-foreground">{alias}</span> —{" "}
            {t("identityProtected")}
          </p>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Spinner /> : t("save")}
          </Button>
        </form>
      </Card>
    </Page>
  );
}
