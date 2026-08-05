import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Button, Card, Field, Input, Spinner } from "@/components/ui-kit";
import { CATEGORIES, categoryLabel, useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/supplier/profile")({
  head: () => ({
    meta: [
      { title: "Supplier profile — MazzadTech" },
      { name: "description", content: "Manage your company profile, city and the product categories you supply." },
      { property: "og:title", content: "Supplier profile — MazzadTech" },
      { property: "og:description", content: "Keep your supplier details and categories up to date." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Guard roles={["supplier", "admin"]}>{(ctx) => <Profile userId={ctx.userId} />}</Guard>,
});

function Profile({ userId }: { userId: string }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["supplier-profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("supplier_profiles").select("*").eq("user_id", userId).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!data) return;
    setCompany(data.company_name ?? "");
    setCity(data.city ?? "");
    setCats(data.categories ?? []);
  }, [data]);

  const save = async () => {
    setBusy(true);
    try {
      const payload = { company_name: company.trim() || "Supplier", city: city.trim() || null, categories: cats };
      const { error } = data
        ? await supabase.from("supplier_profiles").update(payload).eq("user_id", userId)
        : await supabase.from("supplier_profiles").insert({ user_id: userId, ...payload });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["supplier-profile", userId] });
      await qc.invalidateQueries({ queryKey: ["auctions", userId] });
      toast.success(t("saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <Page title={t("supplierProfile")}>
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      </Page>
    );
  }

  return (
    <Page title={t("supplierProfile")}>
      <Card className="space-y-3">
        <Field label={t("companyName")}>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} />
        </Field>
        <Field label={t("city")}>
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t("myCategories")}</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = cats.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCats((prev) => (on ? prev.filter((x) => x !== c) : [...prev, c]))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    on ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {categoryLabel[c]?.[lang] ?? c}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">{t("categoriesHint")}</p>
        </div>
        {data && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge tone={data.verified ? "success" : "warning"}>
              {data.verified ? t("verified") : t("pendingVerification")}
            </Badge>
            <Badge>
              {t("rating")}: {Number(data.rating).toFixed(1)}
            </Badge>
            <Badge>
              {t("completedOrders")}: {data.completed_orders}
            </Badge>
          </div>
        )}
      </Card>

      <Button className="w-full" onClick={save} disabled={busy}>
        {busy ? <Spinner /> : t("save")}
      </Button>
    </Page>
  );
}
