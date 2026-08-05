import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Check } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Card, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { ORDER_FLOW, statusKey } from "@/lib/order-status";
import { estimatedDelivery } from "@/lib/auction";
import { supplierPublicName } from "@/lib/identity";
import type { Role } from "@/lib/session";

export const Route = createFileRoute("/orders/$id")({
  head: () => ({
    meta: [
      { title: "Order tracking — MazzadTech" },
      { name: "description", content: "Track your order from confirmation to delivery, step by step." },
      { property: "og:title", content: "Order tracking — MazzadTech" },
      { property: "og:description", content: "Track your order from confirmation to delivery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Guard>{(ctx) => <OrderDetail viewerRole={ctx.role} />}</Guard>,
});

function OrderDetail({ viewerRole }: { viewerRole: Role }) {
  const { id } = Route.useParams();
  const { t, lang } = useI18n();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, offers(product_name, model, image_url, warranty_months, delivery_days)")
        .eq("id", id)
        .single();
      if (error) throw error;
      const { data: supplier } = await supabase
        .from("supplier_profiles")
        .select("alias, company_name, city, rating, user_id")
      return { order: data, supplier };
    },
  });

  const status = data?.order.status;

  // Prototype: simulate delivery progress moving forward on its own.
  useEffect(() => {
    if (!status) return;
    const index = ORDER_FLOW.indexOf(status as (typeof ORDER_FLOW)[number]);
    if (index < 0 || index >= ORDER_FLOW.length - 1) return;
    const next = ORDER_FLOW[index + 1];
    if (!next) return;
    const timer = setTimeout(async () => {
      await supabase.from("orders").update({ status: next }).eq("id", id);
      await supabase.from("order_events").insert({ order_id: id, status: next });
      await qc.invalidateQueries({ queryKey: ["order", id] });
    }, 8000);
    return () => clearTimeout(timer);
  }, [status, id, qc]);

  if (isLoading || !data) {
    return (
      <Page>
        <div className="grid place-items-center py-16 text-muted-foreground"><Spinner /></div>
      </Page>
    );
  }

  const { order, supplier } = data;
  const currentIndex = ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]);
  const eta = estimatedDelivery(order.created_at, order.offers?.delivery_days ?? 3, lang);

  return (
    <Page title={t("orderStatus")}>
      <Card className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold">{order.offers?.product_name}</p>
          <Badge tone={order.status === "delivered" ? "success" : "primary"}>{t(statusKey(order.status))}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("orderNumber")}: {order.order_number}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("currentStatus")}: {t(statusKey(order.status))}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("estimatedDelivery")}: {eta}
        </p>
        <p className="text-sm font-semibold">
          {Number(order.amount).toLocaleString()} {t("currency")}
        </p>
        {supplier && (
          <p className="text-xs text-muted-foreground">
            {supplier.company_name}
            {supplier.city ? ` · ${supplier.city}` : ""}
          </p>
        )}
      </Card>

      <Card className="space-y-4">
        <p className="text-xs font-semibold text-muted-foreground">{t("tracking")}</p>
        <ol className="space-y-4">
          {ORDER_FLOW.map((step, i) => {
            const done = currentIndex >= i;
            return (
              <li key={step} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[10px] ${
                    done ? "bg-success text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={`text-sm ${done ? "font-medium" : "text-muted-foreground"}`}>
                  {t(statusKey(step))}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-[11px] text-muted-foreground">{t("trackingSim")}</p>
      </Card>
    </Page>
  );
}
