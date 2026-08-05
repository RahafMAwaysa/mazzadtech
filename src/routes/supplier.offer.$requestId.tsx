import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Button, Card, Field, Input, Spinner, Textarea } from "@/components/ui-kit";
import { categoryLabel, useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { fileToCompactDataUrl, shortId } from "@/lib/auction";

export const Route = createFileRoute("/supplier/offer/$requestId")({
  head: () => ({
    meta: [
      { title: "Submit an offer — MazzadTech" },
      { name: "description", content: "Send your best product, price, warranty and delivery offer for this request." },
      { property: "og:title", content: "Submit an offer — MazzadTech" },
      { property: "og:description", content: "Compete for the customer's request with your best offer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Guard roles={["supplier", "admin"]}>{(ctx) => <OfferForm userId={ctx.userId} />}</Guard>,
});

function OfferForm({ userId }: { userId: string }) {
  const { requestId } = Route.useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [form, setForm] = useState({
    product_name: "",
    brand: "",
    model: "",
    specs: "",
    price: "",
    warranty_months: "12",
    delivery_days: "3",
    benefits: "",
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const { data: request, isLoading } = useQuery({
    queryKey: ["auction-request", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_requests")
        .select("*")
        .eq("id", requestId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const pickImages = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const next = await Promise.all(Array.from(files).slice(0, 4).map((f) => fileToCompactDataUrl(f)));
      setImages((prev) => [...prev, ...next].slice(0, 4));
    } catch {
      toast.error("Could not read that image");
    }
  };

  const submit = async () => {
    if (!form.product_name.trim() || !form.price) {
      toast.error(`${t("productName")} · ${t("price")}`);
      return;
    }
    setBusy(true);
    try {
      const specs = form.specs
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const { error } = await supabase.from("offers").insert({
        request_id: requestId,
        supplier_id: userId,
        product_name: form.product_name.trim(),
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        specs,
        images,
        image_url: images[0] ?? null,
        price: Number(form.price),
        warranty_months: Number(form.warranty_months) || 12,
        delivery_days: Number(form.delivery_days) || 3,
        benefits: form.benefits.trim() || null,
      });
      if (error) throw error;
      setDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit offer");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <Page>
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      </Page>
    );
  }

  if (done) {
    return (
      <Page>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <CheckCircle2 className="size-14 text-success" />
          <p className="font-display text-xl font-semibold">{t("offerSuccessMsg")}</p>
          <p className="text-sm text-muted-foreground">
            {t("requestId")}: {shortId(requestId)}
          </p>
          <div className="flex w-full max-w-xs flex-col gap-2 pt-2">
            <Button onClick={() => navigate({ to: "/supplier/auctions" })}>{t("backToAuctions")}</Button>
            <Link to="/supplier/offers">
              <Button variant="outline" className="w-full">
                {t("myOffers")}
              </Button>
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page title={t("submitOffer")}>
      {request && (
        <Card className="space-y-1">
          <p className="text-[11px] text-muted-foreground">
            {t("requestId")}: {shortId(request.id)}
          </p>
          <p className="text-sm font-semibold">{request.title}</p>
          <Badge tone="primary">{categoryLabel[request.category]?.[lang] ?? request.category}</Badge>
        </Card>
      )}

      <Card className="space-y-3">
        <Field label={t("productName")}>
          <Input value={form.product_name} onChange={set("product_name")} placeholder="MacBook Air M3" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("brand")}>
            <Input value={form.brand} onChange={set("brand")} placeholder="Apple" />
          </Field>
          <Field label={t("model")}>
            <Input value={form.model} onChange={set("model")} placeholder="A3113" />
          </Field>
        </div>
        <Field label={`${t("specs")} — ${t("specsHint")}`}>
          <Textarea rows={4} value={form.specs} onChange={set("specs")} placeholder={"16GB RAM\n512GB SSD"} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={`${t("price")} (${t("currency")})`}>
            <Input inputMode="decimal" value={form.price} onChange={set("price")} placeholder="3500" />
          </Field>
          <Field label={t("warrantyMonths")}>
            <Input inputMode="numeric" value={form.warranty_months} onChange={set("warranty_months")} />
          </Field>
          <Field label={t("deliveryDays")}>
            <Input inputMode="numeric" value={form.delivery_days} onChange={set("delivery_days")} />
          </Field>
        </div>
        <Field label={t("benefits")}>
          <Textarea rows={2} value={form.benefits} onChange={set("benefits")} placeholder="Free case, free delivery" />
        </Field>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t("uploadImages")}</p>
          <div className="flex flex-wrap gap-2">
            {images.map((src, i) => (
              <div key={src.slice(0, 40) + i} className="relative">
                <img src={src} alt={`${t("productName")} ${i + 1}`} className="size-16 rounded-xl object-cover" />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -end-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-destructive text-destructive-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {images.length < 4 && (
              <label className="grid size-16 cursor-pointer place-items-center rounded-xl border border-dashed border-border text-muted-foreground">
                <ImagePlus className="size-5" />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void pickImages(e.target.files)}
                />
              </label>
            )}
          </div>
        </div>
      </Card>

      <Button size="lg" className="w-full" onClick={submit} disabled={busy}>
        {busy ? <Spinner /> : t("submitOffer")}
      </Button>
    </Page>
  );
}
