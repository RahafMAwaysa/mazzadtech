import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PackageSearch, ShieldCheck, Truck } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Card, EmptyState, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { shortId } from "@/lib/auction";

export const Route = createFileRoute("/supplier/offers")({
  head: () => ({
    meta: [
      { title: "My offers — MazzadTech" },
      { name: "description", content: "Review the offers you submitted to customer auctions and their status." },
      { property: "og:title", content: "My offers — MazzadTech" },
      { property: "og:description", content: "Track the status of every offer you have submitted." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Guard roles={["supplier", "admin"]}>{(ctx) => <MyOffers userId={ctx.userId} />}</Guard>,
});

function MyOffers({ userId }: { userId: string }) {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["my-offers", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .eq("supplier_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <Page title={t("myOffers")}>
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      </Page>
    );
  }

  const offers = data ?? [];

  return (
    <Page title={t("myOffers")}>
      {offers.length === 0 ? (
        <EmptyState title={t("noOffersYet")} icon={<PackageSearch className="size-6 text-muted-foreground" />} />
      ) : (
        <div className="space-y-3">
          {offers.map((o) => (
            <Card key={o.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{o.product_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("requestId")}: {shortId(o.request_id)}
                  </p>
                </div>
                <Badge tone={o.status === "accepted" ? "success" : o.status === "rejected" ? "muted" : "primary"}>
                  {o.status === "accepted" ? t("accepted") : o.status === "rejected" ? t("rejected") : t("submitted")}
                </Badge>
              </div>
              <p className="font-display text-lg font-semibold">
                {Number(o.price).toLocaleString()} {t("currency")}
              </p>
              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="size-3.5" /> {o.warranty_months} {t("monthsWarranty")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Truck className="size-3.5" /> {o.delivery_days} {t("daysDelivery")}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
