import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CreditCard, Wallet, Banknote, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Button, Card, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { estimatedDelivery } from "@/lib/auction";

export const Route = createFileRoute("/checkout/$offerId")({
  head: () => ({
    meta: [
      { title: "Secure checkout — MazzadTech" },
      { name: "description", content: "Pay securely for the offer you selected. Funds are protected by the platform." },
      { property: "og:title", content: "Secure checkout — MazzadTech" },
      { property: "og:description", content: "Complete your purchase with platform-protected payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Guard roles={["customer", "admin"]}>{(ctx) => <Checkout userId={ctx.userId} />}</Guard>,
});

const METHODS = [
  { key: "card", icon: CreditCard },
  { key: "wallet", icon: Wallet },
  { key: "cod", icon: Banknote },
] as const;

type Success = { id: string; orderNumber: string; eta: string };

function Checkout({ userId }: { userId: string }) {
  const { offerId } = Route.useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [method, setMethod] = useState<(typeof METHODS)[number]["key"]>("card");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<Success | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["offer", offerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("*, purchase_requests(id, title, customer_id)")
        .eq("id", offerId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => navigate({ to: "/orders/$id", params: { id: success.id } }), 3000);
    return () => clearTimeout(timer);
  }, [success, navigate]);

  const pay = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const amount = Number(data.price);
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          offer_id: data.id,
          request_id: data.request_id,
          customer_id: userId,
          supplier_id: data.supplier_id,
          amount,
          commission: Math.round(amount * 0.05 * 100) / 100,
          payment_method: method,
          payment_status: method === "cod" ? "pending" : "paid",
        })
        .select("id, order_number, created_at")
        .single();
      if (error) throw error;

      await Promise.all([
        supabase.from("offers").update({ status: "accepted" }).eq("id", data.id),
        supabase.from("offers").update({ status: "rejected" }).eq("request_id", data.request_id).neq("id", data.id),
        supabase.from("purchase_requests").update({ status: "awarded" }).eq("id", data.request_id),
        supabase.from("order_events").insert({ order_id: order.id, status: "confirmed" }),
      ]);

      setSuccess({
        id: order.id,
        orderNumber: order.order_number,
        eta: estimatedDelivery(order.created_at, data.delivery_days, lang),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <Page>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <CheckCircle2 className="size-16 text-success" />
          <h1 className="font-display text-2xl font-semibold">{t("paymentSuccess")}</h1>
          <Card className="w-full space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("orderNumber")}</span>
              <span className="font-semibold">{success.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("estimatedDelivery")}</span>
              <span className="font-semibold">{success.eta}</span>
            </div>
          </Card>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-3" />
            {t("redirecting")}
          </p>
        </div>
      </Page>
    );
  }

  if (isLoading || !data) {
    return (
      <Page>
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      </Page>
    );
  }

  const amount = Number(data.price);

  return (
    <Page title={t("checkout")}>
      <Card className="space-y-2">
        <p className="text-sm font-semibold">{data.product_name}</p>
        {data.model && <p className="text-xs text-muted-foreground">{data.model}</p>}
        <div className="flex items-center justify-between pt-2 text-sm">
          <span className="text-muted-foreground">{t("total")}</span>
          <span className="font-display text-lg font-semibold">
            {amount.toLocaleString()} {t("currency")}
          </span>
        </div>
      </Card>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t("paymentMethod")}</p>
        {METHODS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMethod(m.key)}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-start text-sm transition-colors ${
              method === m.key ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"
            }`}
          >
            <m.icon className="size-4" />
            {t(m.key)}
          </button>
        ))}
      </div>

      {method === "card" && (
        <Card className="space-y-2 text-xs text-muted-foreground">
          <p>Card ending 4242 · Demo card for this prototype</p>
        </Card>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-success" />
        {t("securePayment")}
      </p>

      <Button size="lg" className="w-full" onClick={pay} disabled={busy}>
        {busy ? <Spinner /> : t("payNow")}
      </Button>
    </Page>
  );
}
