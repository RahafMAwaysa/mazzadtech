import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CreditCard, ShieldCheck, CheckCircle2, Plus, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Button, Card, Field, Input, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { estimatedDelivery } from "@/lib/auction";
import { errorMessage } from "@/lib/utils";

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
type NewLocation = { label: string; address: string; city: string; phone: string };
const EMPTY_LOCATION: NewLocation = { label: "", address: "", city: "", phone: "" };

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

  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocation, setNewLocation] = useState<NewLocation>(EMPTY_LOCATION);

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

  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ["my-delivery-locations", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_locations")
        .select("*")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
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

  // Same default-selection pattern for delivery locations. If the customer
  // has none saved yet, open the "add new" form right away instead of
  // leaving them with nothing to pick.
  useEffect(() => {
    if (!locations || selectedLocationId || addingLocation) return;
    if (locations.length === 0) {
      setAddingLocation(true);
      return;
    }
    const def = locations.find((l) => l.is_default) ?? locations[0];
    if (def) setSelectedLocationId(def.id);
  }, [locations, selectedLocationId, addingLocation]);

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
    if (!addingLocation && !selectedLocationId) {
      toast.error(t("selectLocationFirst"));
      return;
    }
    if (addingLocation && (!newLocation.label.trim() || !newLocation.address.trim())) {
      toast.error(t("locationFieldsRequired"));
      return;
    }
    setBusy(true);
    try {
      // Resolve the delivery location for this order: either the one the
      // customer picked from their saved list, or a brand-new one they just
      // typed in — which also gets saved to their profile for next time.
      let locationId = selectedLocationId;
      if (addingLocation) {
        const { data: savedLocation, error: locationError } = await supabase
          .from("delivery_locations")
          .insert({
            user_id: userId,
            label: newLocation.label.trim(),
            address: newLocation.address.trim(),
            city: newLocation.city.trim() || null,
            phone: newLocation.phone.trim() || null,
            is_default: !locations || locations.length === 0,
          })
          .select("id")
          .single();
        if (locationError) throw locationError;
        locationId = savedLocation.id;
        await qc.invalidateQueries({ queryKey: ["my-delivery-locations", userId] });
      }

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
          delivery_location_id: locationId,
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
      toast.error(errorMessage(error));
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
        <p className="text-xs font-medium text-muted-foreground">{t("deliveryDestination")}</p>

        {locationsLoading && <Spinner />}

        {locations?.map((loc) => (
          <button
            key={loc.id}
            onClick={() => {
              setSelectedLocationId(loc.id);
              setAddingLocation(false);
            }}
            className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-start text-sm transition-colors ${
              !addingLocation && selectedLocationId === loc.id
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-card"
            }`}
          >
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-medium">{loc.label}</span>
              <span className="block text-xs text-muted-foreground">
                {loc.address}
                {loc.city ? `, ${loc.city}` : ""}
              </span>
            </span>
          </button>
        ))}

        {!addingLocation ? (
          <button
            onClick={() => {
              setAddingLocation(true);
              setSelectedLocationId(null);
            }}
            className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-border p-3.5 text-start text-sm text-muted-foreground"
          >
            <Plus className="size-4" />
            {t("addNewLocation")}
          </button>
        ) : (
          <Card className="space-y-2">
            <Field label={t("locationLabel")}>
              <Input
                value={newLocation.label}
                onChange={(e) => setNewLocation((f) => ({ ...f, label: e.target.value }))}
                placeholder={t("locationLabelPlaceholder")}
              />
            </Field>
            <Field label={t("addressDetails")}>
              <Input
                value={newLocation.address}
                onChange={(e) => setNewLocation((f) => ({ ...f, address: e.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("city")}>
                <Input value={newLocation.city} onChange={(e) => setNewLocation((f) => ({ ...f, city: e.target.value }))} />
              </Field>
              <Field label={t("phone")}>
                <Input
                  type="tel"
                  value={newLocation.phone}
                  onChange={(e) => setNewLocation((f) => ({ ...f, phone: e.target.value }))}
                />
              </Field>
            </div>
            {locations && locations.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setAddingLocation(false)}>
                {t("back")}
              </Button>
            )}
          </Card>
        )}
      </div>

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

      <Button
        size="lg"
        className="w-full"
        onClick={pay}
        disabled={
          busy ||
          !selectedCardId ||
          (!addingLocation && !selectedLocationId) ||
          (addingLocation && (!newLocation.label.trim() || !newLocation.address.trim()))
        }
      >
        {busy ? <Spinner /> : t("payNow")}
      </Button>
    </Page>
  );
}
