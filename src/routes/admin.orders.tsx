import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Card, EmptyState, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { statusKey } from "@/lib/order-status";

const TITLE = "All orders — MazzadTech";
const DESC = "Monitor every order, platform commission, and assign delivery partners.";

export const Route = createFileRoute("/admin/orders")({
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
  component: () => <Guard roles={["admin"]}>{() => <Body />}</Guard>,
});

function Body() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const [{ data: orders, error }, { data: couriers }] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id, order_number, status, amount, commission, created_at, delivery_company_id, offers(product_name)",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("delivery_companies")
          .select("id, company_name, alias, city")
          .eq("active", true)
          .order("company_name"),
      ]);
      if (error) throw error;
      return { orders: orders ?? [], couriers: couriers ?? [] };
    },
  });

  const assign = async (orderId: string, companyId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ delivery_company_id: companyId || null })
      .eq("id", orderId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["admin-orders"] });
    toast.success(t("assignedToast"));
  };

  if (isLoading || !data) {
    return (
      <Page title={t("orders")}>
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      </Page>
    );
  }

  if (data.orders.length === 0) {
    return (
      <Page title={t("orders")}>
        <EmptyState title={t("noOrders")} />
      </Page>
    );
  }

  return (
    <Page title={t("orders")}>
      <div className="space-y-3">
        {data.orders.map((order) => (
          <Card key={order.id} className="space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{order.offers?.product_name ?? order.order_number}</p>
                <p className="text-xs text-muted-foreground">{order.order_number}</p>
              </div>
              <Badge tone={order.status === "delivered" ? "success" : "primary"}>
                {t(statusKey(order.status))}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                {Number(order.amount).toLocaleString()} {t("currency")}
              </span>
              <span>
                {t("commission")}: {Number(order.commission).toLocaleString()} {t("currency")}
              </span>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">{t("assignDelivery")}</span>
              <select
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                value={order.delivery_company_id ?? ""}
                onChange={(e) => void assign(order.id, e.target.value)}
              >
                <option value="">{t("unassigned")}</option>
                {data.couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                    {c.city ? ` · ${c.city}` : ""} ({c.alias})
                  </option>
                ))}
              </select>
            </label>
          </Card>
        ))}
      </div>
    </Page>
  );
}
