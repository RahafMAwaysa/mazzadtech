import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PackageSearch, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { shortId } from "@/lib/auction";
import { statusKey } from "@/lib/order-status";

const REJECTED_RETENTION_MS = 24 * 60 * 60 * 1000;

type OfferRow = {
  id: string;
  request_id: string;
  product_name: string;
  price: number;
  warranty_months: number;
  delivery_days: number;
  status: string;
  created_at: string;
};

type OrderRow = { id: string; offer_id: string; request_id: string; status: string };

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
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-offers", userId],
    queryFn: async () => {
      const { data: offers, error } = await supabase
        .from("offers")
        .select("id, request_id, product_name, price, warranty_months, delivery_days, status, created_at")
        .eq("supplier_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (offers ?? []) as OfferRow[];
      const ids = rows.map((o) => o.id);
      const requestIds = rows.map((o) => o.request_id);

      if (ids.length === 0) return { offers: [], orders: [] as OrderRow[] };

      const { data: orders, error: orderError } = await supabase
        .from("orders")
        .select("id, offer_id, request_id, status")
        .in("offer_id", ids);
      if (orderError) throw orderError;

      // Keep the request ids referenced above so this query remains easy to
      // extend for request-level lifecycle checks without adding per-offer calls.
      void requestIds;
      return { offers: rows, orders: (orders ?? []) as OrderRow[] };
    },
    staleTime: 15_000,
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

  const now = Date.now();
  const ordersByOffer = new Map((data?.orders ?? []).map((o) => [o.offer_id, o]));
  const deliveredRequests = new Set(
    (data?.orders ?? []).filter((o) => o.status === "delivered").map((o) => o.request_id),
  );

  const offers = (data?.offers ?? []).filter((offer) => {
    if (offer.status !== "rejected") return true;
    const expired = now - new Date(offer.created_at).getTime() >= REJECTED_RETENTION_MS;
    return !expired && !deliveredRequests.has(offer.request_id);
  });

  const markReady = async (offer: OfferRow) => {
    const order = ordersByOffer.get(offer.id);
    if (!order) {
      toast.error("The order is not ready yet.");
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({ status: "preparing" })
      .eq("id", order.id)
      .eq("supplier_id", userId)
      .eq("status", "confirmed");

    if (error) {
      toast.error(error.message);
      return;
    }

    await supabase.from("order_events").insert({ order_id: order.id, status: "preparing" });
    toast.success("Order marked as ready for delivery.");
    await refetch();
  };

  return (
    <Page title={t("myOffers")}>
      {offers.length === 0 ? (
        <EmptyState title={t("noOffersYet")} icon={<PackageSearch className="size-6 text-muted-foreground" />} />
      ) : (
        <div className="space-y-3">
          {offers.map((o) => {
            const order = ordersByOffer.get(o.id);
            const accepted = o.status === "accepted";
            const ready = order?.status === "preparing" || order?.status === "verified" || order?.status === "received_from_supplier" || order?.status === "in_transit";
            const delivered = order?.status === "delivered";

            return (
              <Card key={o.id} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{o.product_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("requestId")}: {shortId(o.request_id)}
                    </p>
                  </div>
                  <Badge tone={accepted ? "success" : o.status === "rejected" ? "muted" : "primary"}>
                    {accepted ? t("accepted") : o.status === "rejected" ? t("rejected") : t("submitted")}
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

                {o.status === "rejected" && (
                  <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                    This offer was not selected. It will disappear after 24 hours or once the order is delivered.
                  </p>
                )}

                {accepted && !ready && !delivered && (
                  <Button className="w-full" onClick={() => void markReady(o)}>
                    Mark as ready for delivery
                  </Button>
                )}

                {accepted && ready && !delivered && (
                  <p className="rounded-xl bg-primary-soft px-3 py-2 text-xs font-medium text-primary">
                    {t(statusKey(order?.status ?? "preparing"))} — delivery partner can continue the order.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}
