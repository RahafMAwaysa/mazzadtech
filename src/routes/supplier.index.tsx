import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gavel, ShieldCheck, Star, Package, Store } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Button, Card, Spinner } from "@/components/ui-kit";
import { categoryLabel, useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/supplier/")({
  head: () => ({
    meta: [
      { title: "Supplier home — MazzadTech" },
      { name: "description", content: "Your supplier home: profile summary and live electronics auctions to bid on." },
      { property: "og:title", content: "Supplier home — MazzadTech" },
      { property: "og:description", content: "Review your supplier profile and open live auctions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Guard roles={["supplier", "admin"]}>{(ctx) => <Welcome userId={ctx.userId} />}</Guard>,
});

function Welcome({ userId }: { userId: string }) {
  const { t, lang } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["supplier-profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("supplier_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) {
    return (
      <Page>
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      </Page>
    );
  }

  const rating = Number(data?.rating ?? 0);

  return (
    <Page>
      <div className="hero-gradient rounded-3xl p-5 text-primary-foreground">
        <p className="text-xs opacity-80">{t("welcome")}</p>
        <h1 className="font-display text-2xl font-semibold">{data?.company_name ?? t("supplier")}</h1>
        <p className="mt-2 text-sm opacity-90">{t("supplierWelcomeSub")}</p>
      </div>

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Store className="size-4 text-primary" />
          <p className="text-sm font-semibold">{t("supplierProfile")}</p>
          {data?.verified ? (
            <Badge tone="success">
              <ShieldCheck className="size-3" /> {t("verified")}
            </Badge>
          ) : (
            <Badge tone="warning">{t("pendingVerification")}</Badge>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label={t("rating")} value={rating > 0 ? rating.toFixed(1) : "—"} icon={<Star className="size-3.5" />} />
          <Stat label={t("completedOrders")} value={String(data?.completed_orders ?? 0)} icon={<Package className="size-3.5" />} />
          <Stat label={t("responseRate")} value={`${data?.response_rate ?? 95}%`} />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t("categories")}</p>
          <div className="flex flex-wrap gap-1.5">
            {(data?.categories ?? []).length === 0 ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : (
              (data?.categories ?? []).map((c) => (
                <Badge key={c} tone="primary">
                  {categoryLabel[c]?.[lang] ?? c}
                </Badge>
              ))
            )}
          </div>
        </div>
        {data?.city && <p className="text-xs text-muted-foreground">{data.city}</p>}
      </Card>

      <Link to="/supplier/auctions" className="block">
        <Button size="lg" className="w-full">
          <Gavel className="size-5" />
          {t("viewAuctions")}
        </Button>
      </Link>
    </Page>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <p className="flex items-center justify-center gap-1 font-display text-base font-semibold">
        {icon}
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
