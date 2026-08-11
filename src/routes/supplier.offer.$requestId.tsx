import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Button, Card, Field, Input, Spinner, Textarea } from "@/components/ui-kit";
import { categoryLabel, useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { fileToCompactDataUrl, shortId } from "@/lib/auction";

const RAM_OPTIONS = ["4 GB", "8 GB", "16 GB", "24 GB", "32 GB", "64 GB+"] as const;
const PROCESSOR_OPTIONS = ["Intel Core i3/i5/i7/i9/Ultra", "AMD Ryzen 3/5/7/9", "Apple M-Series", "Other"] as const;
const SCREEN_OPTIONS = ["11.6\"", "13.3\"", "14.0\"", "15.6\"", "16.0\"", "17.3\"", "Other"] as const;
const HINGE_OPTIONS = ["Standard (up to 130°)", "Lay-Flat (180° Hinge)", "2-in-1 Convertible (360° Touchscreen)"] as const;
const CAMERA_OPTIONS = ["720p HD", "1080p Full HD", "1440p/2K", "4K", "No Camera"] as const;
const BATTERY_OPTIONS = ["Up to 3 hours", "3 - 5 hours", "5 - 8 hours", "8 - 12 hours", "12+ hours"] as const;

type TechnicalSpecs = {
  ram: string;
  processor: string;
  processor_other: string;
  screen_size: string;
  screen_other: string;
  hinge_style: string;
  camera_resolution: string;
  battery_life: string;
  dedicated_gpu: boolean;
  gpu_model_vram: string;
};

const emptyTechnicalSpecs: TechnicalSpecs = {
  ram: "", processor: "", processor_other: "", screen_size: "", screen_other: "",
  hinge_style: "", camera_resolution: "", battery_life: "", dedicated_gpu: false, gpu_model_vram: "",
};

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

function SelectField({ value, onChange, options, placeholder = "Select" }: { value: string; onChange: (value: string) => void; options: readonly string[]; placeholder?: string }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"><option value="">{placeholder}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
}

function OfferForm({ userId }: { userId: string }) {
  const { requestId } = Route.useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [video, setVideo] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [brandOpen, setBrandOpen] = useState(false);
  const [technicalSpecs, setTechnicalSpecs] = useState<TechnicalSpecs>(emptyTechnicalSpecs);
  const [form, setForm] = useState({ product_name: "", brand: "", model: "", specs: "", price: "", warranty_months: "12", delivery_days: "3", benefits: "" });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const { data: request, isLoading } = useQuery({
    queryKey: ["auction-request", requestId],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_requests").select("*").eq("id", requestId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: competing } = useQuery({
    queryKey: ["competing-offers", requestId],
    queryFn: async () => {
      const { data, error } = await supabase.from("offers").select("price").eq("request_id", requestId);
      if (error) throw error;
      const prices = (data ?? []).map((o) => Number(o.price));
      return { count: prices.length, min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null };
    },
  });

  useEffect(() => {
    const loadBrands = async () => {
      const db = supabase as any;
      const { data, error } = await db.from("brands").select("name").eq("active", true).order("name");
      if (!error) setBrandOptions((data ?? []).map((b: { name: string }) => b.name));
    };
    void loadBrands();
  }, []);

  useEffect(() => {
    if (!request) return;
    const customerSpecs = ((request.specs as string[]) ?? []).join("\n");
    setForm((f) => (f.specs ? f : { ...f, specs: customerSpecs }));
    const customerTechnical = (request as any).technical_specs as Partial<TechnicalSpecs> | null;
    if (customerTechnical) setTechnicalSpecs((current) => ({ ...current, ...customerTechnical }));
  }, [request]);

  const pickImages = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const next = await Promise.all(Array.from(files).slice(0, 4).map((f) => fileToCompactDataUrl(f)));
      setImages((prev) => [...prev, ...next].slice(0, 4));
    } catch { toast.error("Could not read that image"); }
  };

  const budgetMax = request?.budget_max != null ? Number(request.budget_max) : null;
  const price = Number(form.price || 0);
  const updateTech = <K extends keyof TechnicalSpecs>(key: K, value: TechnicalSpecs[K]) => setTechnicalSpecs((s) => ({ ...s, [key]: value }));

  const validatePrice = (value: string) => {
    const nextPrice = Number(value);
    if (budgetMax !== null && nextPrice > budgetMax) { setPriceError(`${t("priceExceedsBudget")} (${budgetMax.toLocaleString()} ${t("currency")})`); return false; }
    if (nextPrice < 0) { setPriceError("Price cannot be negative"); return false; }
    setPriceError(null); return true;
  };

  const validateTechnical = () => {
    const required = [technicalSpecs.ram, technicalSpecs.processor, technicalSpecs.screen_size, technicalSpecs.hinge_style, technicalSpecs.camera_resolution, technicalSpecs.battery_life, video.trim()];
    if (required.some((v) => !v.trim())) { toast.error(lang === "ar" ? "يرجى تعبئة جميع المواصفات التقنية ورابط الفيديو" : "Please complete all technical specifications and the video link"); return false; }
    if (technicalSpecs.processor === "Other" && !technicalSpecs.processor_other.trim()) { toast.error(lang === "ar" ? "اكتب نوع المعالج" : "Enter the processor type"); return false; }
    if (technicalSpecs.screen_size === "Other" && !technicalSpecs.screen_other.trim()) { toast.error(lang === "ar" ? "اكتب حجم الشاشة" : "Enter the screen size"); return false; }
    if (technicalSpecs.dedicated_gpu && !technicalSpecs.gpu_model_vram.trim()) { toast.error(lang === "ar" ? "اكتب موديل كرت الشاشة والـVRAM" : "Enter the GPU model and VRAM"); return false; }
    return true;
  };

  const submit = async () => {
    if (!form.product_name.trim() || !form.price) { toast.error(`${t("productName")} · ${t("price")}`); return; }
    if (!validatePrice(form.price) || !validateTechnical()) return;
    setBusy(true);
    try {
      const specs = form.specs.split("\n").map((s) => s.trim()).filter(Boolean);
      const finalTechnicalSpecs = {
        ...technicalSpecs,
        processor: technicalSpecs.processor === "Other" ? technicalSpecs.processor_other.trim() : technicalSpecs.processor,
        screen_size: technicalSpecs.screen_size === "Other" ? technicalSpecs.screen_other.trim() : technicalSpecs.screen_size,
        processor_other: undefined,
        screen_other: undefined,
      };
      const { error } = await (supabase as any).from("offers").insert({
        request_id: requestId, supplier_id: userId, product_name: form.product_name.trim(), brand: form.brand.trim() || null,
        model: form.model.trim() || null, specs, technical_specs: finalTechnicalSpecs, images, image_url: images[0] ?? null,
        video_url: video.trim(), price, warranty_months: Number(form.warranty_months) || 12, delivery_days: Number(form.delivery_days) || 3,
        benefits: form.benefits.trim() || null,
      });
      if (error) throw error;
      setDone(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not submit offer"); }
    finally { setBusy(false); }
  };

  if (isLoading) return <Page><div className="grid place-items-center py-16 text-muted-foreground"><Spinner /></div></Page>;
  if (done) return <Page><div className="flex flex-col items-center gap-4 py-16 text-center"><CheckCircle2 className="size-14 text-success" /><p className="font-display text-xl font-semibold">{t("offerSuccessMsg")}</p><p className="text-sm text-muted-foreground">{t("requestId")}: {shortId(requestId)}</p><div className="flex w-full max-w-xs flex-col gap-2 pt-2"><Button onClick={() => navigate({ to: "/supplier/auctions" })}>{t("backToAuctions")}</Button><Link to="/supplier/offers"><Button variant="outline" className="w-full">{t("myOffers")}</Button></Link></div></div></Page>;

  return <Page title={t("submitOffer")}>
    {request && <Card className="space-y-1"><p className="text-[11px] text-muted-foreground">{t("requestId")}: {shortId(request.id)}</p><p className="text-sm font-semibold">{request.title}</p><Badge tone="primary">{categoryLabel[request.category]?.[lang] ?? request.category}</Badge></Card>}
    {competing && competing.count > 0 && <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{t("competingOffers")}: {competing.count}{competing.min !== null && competing.max !== null && <> {" · "}{competing.min === competing.max ? `${competing.min.toLocaleString()} ${t("currency")}` : `${competing.min.toLocaleString()}–${competing.max.toLocaleString()} ${t("currency")}`}</>}</p>}

    <Card className="space-y-4">
      <Field label={t("productName")}><Input value={form.product_name} onChange={set("product_name")} placeholder="MacBook Air M3" /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label={t("brand")}><div className="relative"><button type="button" onClick={() => setBrandOpen((v) => !v)} className="flex h-11 w-full items-center justify-between rounded-xl border border-input bg-card px-3 text-sm text-start"><span className={form.brand ? "text-foreground" : "text-muted-foreground"}>{form.brand || "Select brand"}</span><span>⌄</span></button>{brandOpen && <div className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-border bg-card p-2 shadow-lg">{brandOptions.map((brand) => <button key={brand} type="button" onClick={() => { setForm((f) => ({ ...f, brand })); setBrandOpen(false); }} className="block w-full rounded-lg px-2 py-2 text-start text-xs hover:bg-muted">{brand}</button>)}<button type="button" onClick={() => { setForm((f) => ({ ...f, brand: "" })); setBrandOpen(false); }} className="block w-full rounded-lg px-2 py-2 text-start text-xs font-medium hover:bg-muted">Other / custom brand</button></div>}</div>{!form.brand && <Input className="mt-2" value={form.brand} onChange={set("brand")} placeholder="Write custom brand" />}</Field><Field label={t("model")}><Input value={form.model} onChange={set("model")} placeholder="A3113" /></Field></div>

      <div className="border-t border-border pt-4"><p className="mb-3 text-sm font-semibold">{lang === "ar" ? "المواصفات التقنية" : "Technical specifications"}</p><div className="grid grid-cols-2 gap-3">
        <Field label="RAM *"><SelectField value={technicalSpecs.ram} onChange={(v) => updateTech("ram", v)} options={RAM_OPTIONS} /></Field>
        <Field label="Processor *"><SelectField value={technicalSpecs.processor} onChange={(v) => updateTech("processor", v)} options={PROCESSOR_OPTIONS} />{technicalSpecs.processor === "Other" && <Input className="mt-2" value={technicalSpecs.processor_other} onChange={(e) => updateTech("processor_other", e.target.value)} placeholder="Custom processor" />}</Field>
        <Field label="Screen size *"><SelectField value={technicalSpecs.screen_size} onChange={(v) => updateTech("screen_size", v)} options={SCREEN_OPTIONS} />{technicalSpecs.screen_size === "Other" && <Input className="mt-2" value={technicalSpecs.screen_other} onChange={(e) => updateTech("screen_other", e.target.value)} placeholder="e.g. 12.4\"" />}</Field>
        <Field label="Hinge style *"><SelectField value={technicalSpecs.hinge_style} onChange={(v) => updateTech("hinge_style", v)} options={HINGE_OPTIONS} /></Field>
        <Field label="Camera resolution *"><SelectField value={technicalSpecs.camera_resolution} onChange={(v) => updateTech("camera_resolution", v)} options={CAMERA_OPTIONS} /></Field>
        <Field label="Battery life/status *"><SelectField value={technicalSpecs.battery_life} onChange={(v) => updateTech("battery_life", v)} options={BATTERY_OPTIONS} /></Field>
      </div><div className="flex items-center justify-between rounded-xl border border-border p-3"><div><p className="text-xs font-medium">Dedicated GPU *</p><p className="text-[10px] text-muted-foreground">{lang === "ar" ? "هل يوجد كرت شاشة منفصل؟" : "Does the device have a dedicated GPU?"}</p></div><button type="button" role="switch" aria-checked={technicalSpecs.dedicated_gpu} onClick={() => updateTech("dedicated_gpu", !technicalSpecs.dedicated_gpu)} className={`relative h-6 w-11 rounded-full transition ${technicalSpecs.dedicated_gpu ? "bg-primary" : "bg-muted"}`}><span className={`absolute top-1 size-4 rounded-full bg-white transition ${technicalSpecs.dedicated_gpu ? "start-6" : "start-1"}`} /></button></div>{technicalSpecs.dedicated_gpu && <Field label="GPU Model & VRAM *"><Input value={technicalSpecs.gpu_model_vram} onChange={(e) => updateTech("gpu_model_vram", e.target.value)} placeholder="NVIDIA RTX 4060 8GB" /></Field>}</div>

      <Field label={`${t("specs")} — ${t("specsHint")}`}><Textarea rows={4} value={form.specs} onChange={set("specs")} placeholder={"16GB RAM\n512GB SSD"} /></Field>
      <div className="grid grid-cols-3 gap-3"><Field label={`${t("price")} (${t("currency")})`}><div className="space-y-2">{budgetMax !== null && budgetMax > 0 ? <><input type="range" min={0} max={budgetMax} step={1} value={Math.min(Math.max(price || 0, 0), budgetMax)} onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, price: v })); validatePrice(v); }} className="w-full accent-primary" /><div className="flex justify-between text-[10px] text-muted-foreground"><span>0</span><span className="font-semibold text-foreground">{price.toLocaleString()} {t("currency")}</span><span>{budgetMax.toLocaleString()}</span></div></> : <Input inputMode="decimal" value={form.price} onChange={(e) => { set("price")(e); validatePrice(e.target.value); }} placeholder="3500" />}</div></Field><Field label={t("warrantyMonths")}><Input inputMode="numeric" value={form.warranty_months} onChange={set("warranty_months")} /></Field><Field label={t("deliveryDays")}><Input inputMode="numeric" value={form.delivery_days} onChange={set("delivery_days")} /></Field></div>
      {priceError && <p className="text-xs text-destructive">{priceError}</p>}
      {(request?.warranty_preference || request?.delivery_preference) && <p className="text-[11px] text-muted-foreground">{request.warranty_preference && `${t("customerWants")}: ${request.warranty_preference}`}{request.warranty_preference && request.delivery_preference && " · "}{request.delivery_preference}</p>}
      <Field label={t("benefits")}><Textarea rows={2} value={form.benefits} onChange={set("benefits")} placeholder="Free case, free delivery" /></Field>
      <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">{t("uploadImages")}</p><div className="flex flex-wrap gap-2">{images.map((src, i) => <div key={src.slice(0, 40) + i} className="relative"><img src={src} alt={`${t("productName")} ${i + 1}`} className="size-16 rounded-xl object-cover" /><button type="button" aria-label="Remove image" onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))} className="absolute -end-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-destructive text-destructive-foreground"><X className="size-3" /></button></div>)}{images.length < 4 && <label className="grid size-16 cursor-pointer place-items-center rounded-xl border border-dashed border-border text-muted-foreground"><ImagePlus className="size-5" /><input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void pickImages(e.target.files)} /></label>}</div></div>
      <Field label="Product Demo Video *"><Input type="url" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="YouTube / Drive / Vimeo link" /><p className="mt-1 text-[10px] text-muted-foreground">{lang === "ar" ? "رابط فيديو المنتج مطلوب لإرسال العرض." : "A product video link is required to submit the offer."}</p></Field>
    </Card>
    <Button size="lg" className="w-full" onClick={submit} disabled={busy || !!priceError}>{busy ? <Spinner /> : t("submitOffer")}</Button>
  </Page>;
}
