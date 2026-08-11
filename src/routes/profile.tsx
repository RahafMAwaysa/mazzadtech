import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, MapPin, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Button, Card, Field, Input, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My profile — MazzadTech" },
      {
        name: "description",
        content: "View and edit your account information, saved delivery locations and payment methods.",
      },
      { property: "og:title", content: "My profile — MazzadTech" },
      {
        property: "og:description",
        content: "View and edit your account information, saved delivery locations and payment methods.",
      },
    ],
  }),
  component: () => <Guard roles={["customer"]}>{(ctx) => <ProfileBody userId={ctx.userId} />}</Guard>,
});

type LocationForm = { label: string; address: string; city: string; phone: string };
const EMPTY_LOCATION: LocationForm = { label: "", address: "", city: "", phone: "" };

const CARD_BRANDS = ["Visa", "Mastercard", "Other"] as const;
type CardForm = { brand: string; last4: string; expiryMonth: string; expiryYear: string };
const EMPTY_CARD: CardForm = { brand: "Visa", last4: "", expiryMonth: "", expiryYear: "" };

function ProfileBody({ userId }: { userId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<LocationForm>(EMPTY_LOCATION);
  const [locBusy, setLocBusy] = useState<string | null>(null);

  const [addingCard, setAddingCard] = useState(false);
  const [cardForm, setCardForm] = useState<CardForm>(EMPTY_CARD);
  const [cardBusy, setCardBusy] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-profile", userId],
    queryFn: async () => {
      const [{ data: profile, error: profileError }, { data: authUser }] = await Promise.all([
        supabase.from("profiles").select("full_name, phone").eq("id", userId).single(),
        supabase.auth.getUser(),
      ]);
      if (profileError) throw profileError;
      return { profile, email: authUser.user?.email ?? null };
    },
  });

  const { data: locations, isLoading: locLoading } = useQuery({
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

  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ["payment_cards", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_cards")
        .select("*")
        .eq("customer_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Prefill the editable fields once the profile loads (only the first time,
  // so we don't stomp on text the person is actively typing).
  useEffect(() => {
    if (!data) return;
    setFullName((prev) => prev || data.profile.full_name || "");
    setPhone((prev) => prev || data.profile.phone || "");
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null, phone: phone.trim() || null })
        .eq("id", userId);
      if (updateError) throw updateError;
      await qc.invalidateQueries({ queryKey: ["my-profile", userId] });
      toast.success(t("profileSaved"));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const startAdd = () => {
    setForm(EMPTY_LOCATION);
    setEditingId(null);
    setAdding(true);
  };

  const startEdit = (loc: NonNullable<typeof locations>[number]) => {
    setForm({ label: loc.label, address: loc.address, city: loc.city ?? "", phone: loc.phone ?? "" });
    setEditingId(loc.id);
    setAdding(true);
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    setForm(EMPTY_LOCATION);
  };

  const saveLocation = async () => {
    if (!form.label.trim() || !form.address.trim()) {
      toast.error(t("locationFieldsRequired"));
      return;
    }
    setLocBusy(editingId ?? "new");
    try {
      const payload = {
        user_id: userId,
        label: form.label.trim(),
        address: form.address.trim(),
        city: form.city.trim() || null,
        phone: form.phone.trim() || null,
      };
      const { error } = editingId
        ? await supabase.from("delivery_locations").update(payload).eq("id", editingId)
        : await supabase.from("delivery_locations").insert({
            ...payload,
            is_default: (locations?.length ?? 0) === 0,
          });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["my-delivery-locations", userId] });
      toast.success(t("locationSaved"));
      cancelForm();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLocBusy(null);
    }
  };

  const deleteLocation = async (id: string) => {
    setLocBusy(id);
    try {
      const { error } = await supabase.from("delivery_locations").delete().eq("id", id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["my-delivery-locations", userId] });
      toast.success(t("locationDeleted"));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLocBusy(null);
    }
  };

  const setDefault = async (id: string) => {
    setLocBusy(id);
    try {
      // Clear the previous default first, then set the new one — two small
      // writes rather than one, since RLS scopes every write to this user's
      // own rows only anyway.
      await supabase.from("delivery_locations").update({ is_default: false }).eq("user_id", userId).eq("is_default", true);
      const { error } = await supabase.from("delivery_locations").update({ is_default: true }).eq("id", id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["my-delivery-locations", userId] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLocBusy(null);
    }
  };

  const saveCard = async () => {
    if (!/^\d{4}$/.test(cardForm.last4.trim())) {
      toast.error(t("cardLast4Invalid"));
      return;
    }
    const month = cardForm.expiryMonth ? Number(cardForm.expiryMonth) : null;
    const year = cardForm.expiryYear ? Number(cardForm.expiryYear) : null;
    setCardBusy("new");
    try {
      const { error } = await supabase.from("payment_cards").insert({
        customer_id: userId,
        brand: cardForm.brand,
        last4: cardForm.last4.trim(),
        expiry_month: month,
        expiry_year: year,
        is_default: !cards || cards.length === 0,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["payment_cards", userId] });
      toast.success(t("cardSaved"));
      setAddingCard(false);
      setCardForm(EMPTY_CARD);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCardBusy(null);
    }
  };

  const deleteCard = async (id: string) => {
    setCardBusy(id);
    try {
      const { error } = await supabase.from("payment_cards").delete().eq("id", id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["payment_cards", userId] });
      toast.success(t("cardDeleted"));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCardBusy(null);
    }
  };

  const setDefaultCard = async (id: string) => {
    setCardBusy(id);
    try {
      await supabase.from("payment_cards").update({ is_default: false }).eq("customer_id", userId).eq("is_default", true);
      const { error } = await supabase.from("payment_cards").update({ is_default: true }).eq("id", id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["payment_cards", userId] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCardBusy(null);
    }
  };

  if (error) {
    return (
      <Page title={t("profile")}>
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{errorMessage(error)}</p>
      </Page>
    );
  }

  if (isLoading || !data) {
    return (
      <Page title={t("profile")}>
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      </Page>
    );
  }

  return (
    <Page title={t("profile")}>
      <Card className="space-y-3">
        <Field label={t("email")}>
          <Input value={data.email ?? ""} disabled />
        </Field>
        <Field label={t("fullName")}>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label={t("phone")}>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+970 5X XXX XXXX" />
        </Field>
        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? <Spinner /> : t("saveChanges")}
        </Button>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{t("savedLocations")}</p>
          {!adding && (
            <Button size="sm" variant="outline" onClick={startAdd}>
              <Plus className="size-4" />
              {t("addLocation")}
            </Button>
          )}
        </div>

        {adding && (
          <Card className="space-y-3">
            <Field label={t("locationLabel")}>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder={t("locationLabelPlaceholder")}
              />
            </Field>
            <Field label={t("addressDetails")}>
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("city")}>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </Field>
              <Field label={t("phone")}>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveLocation} disabled={locBusy !== null}>
                {locBusy !== null ? <Spinner /> : t("save")}
              </Button>
              <Button size="sm" variant="outline" onClick={cancelForm}>
                <X className="size-4" />
                {t("back")}
              </Button>
            </div>
          </Card>
        )}

        {locLoading ? (
          <div className="grid place-items-center py-8 text-muted-foreground">
            <Spinner />
          </div>
        ) : locations && locations.length > 0 ? (
          locations.map((loc) => (
            <Card key={loc.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{loc.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {loc.address}
                      {loc.city ? `, ${loc.city}` : ""}
                    </p>
                    {loc.phone && <p className="text-xs text-muted-foreground">{loc.phone}</p>}
                  </div>
                </div>
                {loc.is_default && (
                  <Badge tone="primary">
                    <Star className="size-3" />
                    {t("defaultLocation")}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                {!loc.is_default && (
                  <Button size="sm" variant="outline" disabled={locBusy === loc.id} onClick={() => void setDefault(loc.id)}>
                    <Star className="size-3.5" />
                    {t("makeDefault")}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => startEdit(loc)}>
                  <Pencil className="size-3.5" />
                  {t("editLocation")}
                </Button>
                <Button size="sm" variant="outline" disabled={locBusy === loc.id} onClick={() => void deleteLocation(loc.id)}>
                  <Trash2 className="size-3.5" />
                  {t("delete")}
                </Button>
              </div>
            </Card>
          ))
        ) : (
          !adding && <p className="text-xs text-muted-foreground">{t("noSavedLocations")}</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{t("paymentMethods")}</p>
          {!addingCard && (
            <Button size="sm" variant="outline" onClick={() => setAddingCard(true)}>
              <Plus className="size-4" />
              {t("addNewCard")}
            </Button>
          )}
        </div>

        {addingCard && (
          <Card className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("cardBrand")}>
                <select
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-sm"
                  value={cardForm.brand}
                  onChange={(e) => setCardForm((f) => ({ ...f, brand: e.target.value }))}
                >
                  {CARD_BRANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("cardLast4Placeholder")}>
                <Input
                  maxLength={4}
                  value={cardForm.last4}
                  onChange={(e) => setCardForm((f) => ({ ...f, last4: e.target.value.replace(/\D/g, "") }))}
                  placeholder="1234"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("expiryMonth")}>
                <Input
                  maxLength={2}
                  value={cardForm.expiryMonth}
                  onChange={(e) => setCardForm((f) => ({ ...f, expiryMonth: e.target.value.replace(/\D/g, "") }))}
                  placeholder="MM"
                />
              </Field>
              <Field label={t("expiryYear")}>
                <Input
                  maxLength={4}
                  value={cardForm.expiryYear}
                  onChange={(e) => setCardForm((f) => ({ ...f, expiryYear: e.target.value.replace(/\D/g, "") }))}
                  placeholder="YYYY"
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveCard} disabled={cardBusy !== null}>
                {cardBusy !== null ? <Spinner /> : t("save")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAddingCard(false);
                  setCardForm(EMPTY_CARD);
                }}
              >
                <X className="size-4" />
                {t("back")}
              </Button>
            </div>
          </Card>
        )}

        {cardsLoading ? (
          <div className="grid place-items-center py-8 text-muted-foreground">
            <Spinner />
          </div>
        ) : cards && cards.length > 0 ? (
          cards.map((c) => (
            <Card key={c.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <CreditCard className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {c.brand} •••• {c.last4}
                    </p>
                    {c.expiry_month && c.expiry_year && (
                      <p className="text-xs text-muted-foreground">
                        {t("expires")} {String(c.expiry_month).padStart(2, "0")}/{c.expiry_year}
                      </p>
                    )}
                  </div>
                </div>
                {c.is_default && (
                  <Badge tone="primary">
                    <Star className="size-3" />
                    {t("defaultCard")}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                {!c.is_default && (
                  <Button size="sm" variant="outline" disabled={cardBusy === c.id} onClick={() => void setDefaultCard(c.id)}>
                    <Star className="size-3.5" />
                    {t("makeDefault")}
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={cardBusy === c.id} onClick={() => void deleteCard(c.id)}>
                  <Trash2 className="size-3.5" />
                  {t("delete")}
                </Button>
              </div>
            </Card>
          ))
        ) : (
          !addingCard && <p className="text-xs text-muted-foreground">{t("noSavedCards")}</p>
        )}
      </div>
    </Page>
  );
}

