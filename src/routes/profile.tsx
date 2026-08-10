import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Pencil, Plus, Star, Trash2, X } from "lucide-react";
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
      { name: "description", content: "View and edit your account information and saved delivery locations." },
      { property: "og:title", content: "My profile — MazzadTech" },
      { property: "og:description", content: "View and edit your account information and saved delivery locations." },
    ],
  }),
  component: () => <Guard roles={["customer"]}>{(ctx) => <ProfileBody userId={ctx.userId} />}</Guard>,
});

type LocationForm = { label: string; address: string; city: string; phone: string };
const EMPTY_LOCATION: LocationForm = { label: "", address: "", city: "", phone: "" };

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
    </Page>
  );
}

