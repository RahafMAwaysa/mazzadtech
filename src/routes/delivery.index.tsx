import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Button, Card, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { statusKey } from "@/lib/order-status";
import { shortRef } from "@/lib/identity";

const TITLE = "Deliveries — MazzadTech";
const DESC = "Delivery partners track and update assigned orders without seeing customer identities.";

export const Route = createFileRoute("/delivery/")({
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

type DeliveryOrder = {
  id: string;
  order_number: string;
  status: string;
  amount: number;
  customer_id: string;
  created_at: string;
};

const NEXT: Record<string, "received_from_supplier" | "in_transit" | "delivered" | null> = {
  confirmed: "received_from_supplier",
  preparing: "received_from_supplier",
  verified: "received_from_supplier",
  received_from_supplier: "in_transit",
  in_transit: "delivered",
  shipping: "delivered",
  delivered: null,
  cancelled: null,
};

function Body({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data: company } = await supabase
      .from("delivery_companies")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!company) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, status, amount, customer_id, created_at")
      .eq("delivery_company_id", company.id)
      .order("created_at", { ascending: false });

    if (error) toast.error(error.message);
    setOrders((data as DeliveryOrder[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const advance = async (order: DeliveryOrder) => {
    const next = NEXT[order.status];
    if (!next) return;
    setBusy(order.id);
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", order.id);
    if (error) {
      toast.error(error.message);
    } else {
      await supabase.from("order_events").insert({ order_id: order.id, status: next });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
      toast.success(t("statusUpdated"));
    }
    setBusy(null);
  };

  return (
    <Page title={t("deliveries")}>
      <p className="text-sm text-muted-foreground">{t("assignedOrders")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("identityProtected")}</p>

      {loading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      ) : orders.length === 0 ? (
        <Card className="mt-4">
          <p className="text-sm text-muted-foreground">{t("noDeliveries")}</p>
        </Card>
      ) : (
        <div className="mt-4 space-y-3">
          {orders.map((order) => {
            const next = NEXT[order.status];
            return (
              <Card key={order.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{order.order_number}</p>
                    <p className="text-xs text-muted-foreground">
                      Customer #{shortRef(order.customer_id)}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                    {t(statusKey(order.status))}
                  </span>
                </div>
                {next && (
                  <Button
                    className="w-full"
                    disabled={busy === order.id}
                    onClick={() => void advance(order)}
                  >
                    {busy === order.id ? (
                      <Spinner />
                    ) : next === "received_from_supplier" ? (
                      t("markReceived")
                    ) : next === "in_transit" ? (
                      t("markInTransit")
                    ) : (
                      t("markDelivered")
                    )}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}
