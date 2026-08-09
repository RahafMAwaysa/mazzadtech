import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CreditCard, ShieldCheck, CheckCircle2, Plus } from "lucide-react";
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

// Phase 1: electronic payment only — no cash on delivery, no separate
// customer wallet. This keeps the money flow simple, safe and fully
// digital/traceable. COD can be revisited in a later phase.
type Success = { id: string; orderNumber: string; eta: string };

function Checkout({ userId }: { userId: string }) {
  const { offerId } = Route.useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<Success | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [newLast4, setNewLast4] = useState("");
  const [newBrand, setNewBrand] = useState("Visa");

  const { data, isLoading } = useQuery({
    queryKey: ["offer", offerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("*, purchase_requests(id, title, customer_id, category)")
        .eq("id", offerId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ["payment_cards", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_cards")
        .select("*")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Default to the customer's saved default card (or the first one) once loaded.
  useEffect(() => {
    if (!cards || cards.length === 0 || selectedCardId) return;
    const def = cards.find((c) => c.is_default) ?? cards[0];
    if (def) setSelectedCardId(def.id);
  }, [cards, selectedCardId]);

  const { data: rates } = useQuery({
    queryKey: ["commission_rates"],
    queryFn: async () => {
      const { data: rows, error } = await supabase.rpc("get_commission_rates");
      if (error) throw error;
      return rows?.[0] ?? { supplier_pct: 5, customer_pct: 2, delivery_pct: 5 };
    },
  });

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => navigate({ to: "/orders/$id", params: { id: success.id } }), 3000);
    return () => clearTimeout(timer);
  }, [success, navigate]);

  const amount = data ? Number(data.price) : 0;
  const DELIVERY_FEE = 20; // Flat delivery fee (NIS)
  const supplierPct = rates?.supplier_pct ?? 5;
  const customerPct = rates?.customer_pct ?? 2;
  const supplierCommission = useMemo(() => Math.round(amount * (supplierPct / 100) * 100) / 100, [amount, supplierPct]);
  const customerCommission = useMemo(() => Math.round(amount * (customerPct / 100) * 100) / 100, [amount, customerPct]);
  const totalDue = amount + customerCommission + DELIVERY_FEE;

  const saveNewCard = async () => {
    if (newLast4.trim().length !== 4 || !/^\d{4}$/.test(newLast4.trim())) {
      toast.error(t("cardLast4Invalid"));
      return;
    }
    const { data: card, error } = await supabase
      .from("payment_cards")
      .insert({
        customer_id: userId,
        brand: newBrand,
        last4: newLast4.trim(),
        is_default: !cards || cards.length === 0,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["payment_cards", userId] });
    setSelectedCardId(card.id);
    setAddingCard(false);
    setNewLast4("");
  };

  const pay = async () => {
    if (!data || !selectedCardId) {
      toast.error(t("selectCardFirst"));
      return;
    }
    setBusy(true);
    try {
      // Phase 1 keeps delivery simple: auto-assign the single active delivery
      // company (if one has signed up yet) so the order shows up on their
      // list immediately — no manual admin dispatch step required.
      const { data: courier } = await supabase
        .from("delivery_companies")
        .select("id")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          offer_id: data.id,
          request_id: data.request_id,
          customer_id: userId,
          supplier_id: data.supplier_id,
          delivery_company_id: courier?.id ?? null,
          amount,
          commission: supplierCommission,
          customer_commission: customerCommission,
          delivery_fee: DELIVERY_FEE,
          payment_card_id: selectedCardId,
          payment_method: "card",
          payment_status: "paid",
        })
        .select("id, order_number, created_at")
        .single();
      if (error) throw error;

      await Promise.all([
        supabase.from("offers").update({ status: "accepted" }).eq("id", data.id),
        supabase.from("offers").update({ status: "rejected" }).eq("request_id", data.request_id).neq("id", data.id),
        supabase.from("purchase_requests").update({ status: "awarded" }).eq("id", data.request_id),
        supabase.from("order_events").insert({ order_id: order.id, status: "confirmed" }),
        // Instantly deposit the supplier's share (price minus their commission)
        // into their wallet — no manual admin step required.
        supabase.rpc("credit_supplier_wallet", {
          _supplier_id: data.supplier_id,
          _amount: amount - supplierCommission,
          _order_id: order.id,
        }),
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

  return (
    <Page title={t("checkout")}>
      <Card className="space-y-2">
        <p className="text-sm font-semibold">{data.product_name}</p>
        {data.model && <p className="text-xs text-muted-foreground">{data.model}</p>}
        <div className="flex items-center justify-between pt-2 text-sm">
          <span className="text-muted-foreground">{t("price")}</span>
          <span>{amount.toLocaleString()} {t("currency")}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("customerCommission")}</span>
          <span>{customerCommission.toLocaleString()} {t("currency")}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("deliveryFee")}</span>
          <span>{DELIVERY_FEE.toLocaleString()} {t("currency")}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
          <span className="font-medium">{t("totalDue")}</span>
          <span className="font-display text-lg font-semibold">
            {totalDue.toLocaleString()} {t("currency")}
          </span>
        </div>
      </Card>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t("paymentMethod")}</p>
        <p className="text-xs text-muted-foreground">{t("electronicOnlyNote")}</p>

        {cardsLoading && <Spinner />}

        {cards?.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCardId(c.id)}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-start text-sm transition-colors ${
              selectedCardId === c.id ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"
            }`}
          >
            <CreditCard className="size-4" />
            {c.brand} •••• {c.last4}
          </button>
        ))}

        {!addingCard ? (
          <button
            onClick={() => setAddingCard(true)}
            className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-border p-3.5 text-start text-sm text-muted-foreground"
          >
            <Plus className="size-4" />
            {t("addNewCard")}
          </button>
        ) : (
          <Card className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select
                className="rounded-xl border border-border bg-background p-2 text-sm"
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
              >
                <option>Visa</option>
                <option>Mastercard</option>
              </select>
              <input
                className="rounded-xl border border-border bg-background p-2 text-sm"
                placeholder={t("cardLast4Placeholder")}
                maxLength={4}
                value={newLast4}
                onChange={(e) => setNewLast4(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveNewCard}>{t("save")}</Button>
              <Button size="sm" variant="outline" onClick={() => setAddingCard(false)}>{t("back")}</Button>
            </div>
          </Card>
        )}
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-success" />
        {t("securePayment")}
      </p>

      <Button size="lg" className="w-full" onClick={pay} disabled={busy || !selectedCardId}>
        {busy ? <Spinner /> : t("payNow")}
      </Button>
    </Page>
  );
}
