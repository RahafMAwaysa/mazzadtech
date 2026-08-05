import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Card, EmptyState, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { statusKey } from "@/lib/order-status";

export const Route = createFileRoute("/orders/")({
  head: () => ({
    meta: [
      { title: "My orders — Ateeq" },
      { name: "description", content: "Follow every order you placed and its delivery progress." },
      { property: "og:title", content: "My orders — Ateeq" },
      { property: "og:description", content: "Follow your orders and delivery progress." },
    ],
  }),
  component: () => <Guard roles={["customer", "admin"]}>{(ctx) => <Orders userId={ctx.userId} />}</Guard>,
});

function Orders({ userId }: { userId: string }) {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["orders", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, amount, status, created_at, offers(product_name)")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <Page title={t("myOrders")}>
      {isLoading && (
        <div className="grid place-items-center py-10 text-muted-foreground">
          <Spinner />
        </div>
      )}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <EmptyState title={t("noOrders")} icon={<Package className="size-6 text-muted-foreground" />} />
      )}
      <div className="space-y-3">
        {data?.map((o) => (
          <Link key={o.id} to="/orders/$id" params={{ id: o.id }} className="block">
            <Card className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">{o.offers?.product_name}</p>
                <Badge tone={o.status === "delivered" ? "success" : "primary"}>{t(statusKey(o.status))}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{o.order_number}</span>
                <span>
                  {Number(o.amount).toLocaleString()} {t("currency")}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </Page>
  );
}
