import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, PackageSearch, ShieldCheck, Star, Truck, X, Play } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, Spinner } from "@/components/ui-kit";
import { categoryLabel, useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { computeMatch, reasonText } from "@/lib/match";

export const Route = createFileRoute("/requests/$id")({
  head: () => ({ meta: [
    { title: "Offers for your request — Ateeq" },
    { name: "description", content: "Compare supplier offers ranked by an AI match score for your request." },
    { property: "og:title", content: "Offers for your request — Ateeq" },
    { property: "og:description", content: "Compare offers ranked by AI match score, price, warranty and delivery." },
  ] }),
  component: () => <Guard roles={["customer", "admin"]}>{() => <RequestOffers />}</Guard>,
});

type Sort = "match" | "price" | "warranty" | "delivery" | "rating";
type OfferRow = { id:string; supplier_id:string; price:number; specs:unknown; technical_specs:unknown; warranty_months:number; delivery_days:number; product_name:string; model:string|null; image_url:string|null; benefits:string|null; video_url:string|null };
type SupplierRow = { user_id:string; alias:string|null; rating:number|null; verified:boolean; completed_orders:number };

type Tech = Record<string, unknown>;

function videoEmbedUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (u.hostname.includes("drive.google.com")) {
      const match = u.pathname.match(/\/file\/d\/([^/]+)/);
      return match ? `https://drive.google.com/file/d/${match[1]}/preview` : null;
    }
  } catch { /* fall through to normal link */ }
  return null;
}

function TechnicalGrid({ specs, lang }: { specs: unknown; lang: "en" | "ar" }) {
  const s = (specs && typeof specs === "object" ? specs : {}) as Tech;
  const labels = lang === "ar"
    ? { ram:"RAM", processor:"المعالج", screen_size:"حجم الشاشة", hinge_style:"المفصلة", camera_resolution:"الكاميرا", battery_life:"البطارية", dedicated_gpu:"كرت شاشة منفصل", gpu_model_vram:"موديل كرت الشاشة وVRAM" }
    : { ram:"RAM", processor:"Processor", screen_size:"Screen size", hinge_style:"Hinge style", camera_resolution:"Camera", battery_life:"Battery", dedicated_gpu:"Dedicated GPU", gpu_model_vram:"GPU model & VRAM" };
  const entries = Object.entries(labels).map(([key,label]) => ({ key, label, value: s[key] })).filter(({ value }) => value !== undefined && value !== null && String(value) !== "");
  if (!entries.length) return null;
  return <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border text-xs"><div className="col-span-2 bg-muted/60 px-3 py-2 text-[11px] font-semibold">{lang === "ar" ? "المواصفات التقنية" : "Technical specifications"}</div>{entries.map(({key,label,value}) => <div key={key} className="border-t border-border p-2.5 first:border-t-0"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-0.5 font-medium">{key === "dedicated_gpu" ? (value ? (lang === "ar" ? "نعم" : "Yes") : (lang === "ar" ? "لا" : "No")) : String(value)}</p></div>)}</div>;
}

function VideoPreview({ url, lang }: { url: string; lang: "en" | "ar" }) {
  const embed = videoEmbedUrl(url);
  if (!embed) return <a href={url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-primary hover:bg-muted"><Play className="size-4" />{lang === "ar" ? "مشاهدة فيديو المنتج" : "Watch product video"}</a>;
  return <div className="overflow-hidden rounded-xl border border-border bg-black"><iframe src={embed} title={lang === "ar" ? "فيديو المنتج" : "Product video"} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>;
}

function RequestOffers() {
  const { id } = Route.useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [sort, setSort] = useState<Sort>("match");

  const { data, isLoading, error } = useQuery({
    queryKey: ["request", id], staleTime: 30_000, gcTime: 5 * 60_000,
    queryFn: async () => {
      const [{ data: request, error: e1 }, { data: offers, error: e2 }] = await Promise.all([
        supabase.from("purchase_requests").select("id,title,category,budget_min,budget_max,specs,technical_specs,warranty_preference,delivery_preference,brands,status").eq("id", id).single(),
        (supabase as any).from("offers").select("id,supplier_id,price,specs,technical_specs,warranty_months,delivery_days,product_name,model,image_url,benefits,video_url").eq("request_id", id),
      ]);
      if (e1) throw e1; if (e2) throw e2;
      const typedOffers = (offers ?? []) as OfferRow[];
      const supplierIds = [...new Set(typedOffers.map(o => o.supplier_id))];
      if (!supplierIds.length) return { request, offers: typedOffers, suppliers: [] as SupplierRow[], reviewCountsBySupplier: new Map<string,number>() };
      const [{ data: suppliers, error: se }, { data: ratings, error: re }] = await Promise.all([
        supabase.from("supplier_profiles").select("user_id,alias,rating,verified,completed_orders").in("user_id", supplierIds),
        (supabase as any).from("ratings").select("ratee_id").in("ratee_id", supplierIds).eq("rater_role", "customer"),
      ]);
      if (se) throw se; if (re) throw re;
      const counts = new Map<string,number>();
      for (const row of ratings ?? []) counts.set(row.ratee_id, (counts.get(row.ratee_id) ?? 0) + 1);
      return { request, offers: typedOffers, suppliers: (suppliers ?? []) as SupplierRow[], reviewCountsBySupplier: counts };
    },
  });

  const ranked = useMemo(() => {
    if (!data?.request) return [];
    const req = data.request;
    const list = data.offers.map(offer => {
      const supplier = data.suppliers.find(s => s.user_id === offer.supplier_id);
      const reviewCount = data.reviewCountsBySupplier.get(offer.supplier_id) ?? 0;
      const match = computeMatch({ request: { budget_min:req.budget_min?Number(req.budget_min):null, budget_max:req.budget_max?Number(req.budget_max):null, specs:(req.specs as string[])??[], warranty_preference:req.warranty_preference, delivery_preference:req.delivery_preference, brands:req.brands??[] }, offer:{ price:Number(offer.price), specs:(offer.specs as string[])??[], warranty_months:offer.warranty_months, delivery_days:offer.delivery_days, product_name:offer.product_name }, supplier:{ rating:Number(supplier?.rating??0), verified:supplier?.verified??false } });
      return { offer, supplier, match, reviewCount };
    });
    return list.sort((a,b) => sort === "price" ? Number(a.offer.price)-Number(b.offer.price) : sort === "warranty" ? b.offer.warranty_months-a.offer.warranty_months : sort === "delivery" ? a.offer.delivery_days-b.offer.delivery_days : sort === "rating" ? Number(b.supplier?.rating??0)-Number(a.supplier?.rating??0) : b.match.score-a.match.score);
  }, [data, sort]);

  if (isLoading) return <Page><div className="grid place-items-center py-16 text-muted-foreground"><Spinner /></div></Page>;
  if (error) return <Page title={t("offersFor")}><Card className="space-y-2"><p className="text-sm font-semibold">Could not load offers</p><p className="text-xs text-muted-foreground">{error instanceof Error ? error.message : "Please try again."}</p><Button onClick={() => window.location.reload()}>Try again</Button></Card></Page>;
  if (!data?.request) return <Page title={t("offersFor")}>{null}</Page>;

  const req = data.request;
  const sorts:{key:Sort;label:string}[] = [{key:"match",label:t("bestMatch")},{key:"price",label:t("lowestPrice")},{key:"warranty",label:t("longestWarranty")},{key:"delivery",label:t("fastestDelivery")},{key:"rating",label:t("topRated")}];
  return <Page title={req.title}>
    <Card className="space-y-2"><div className="flex flex-wrap gap-2"><Badge tone="primary">{categoryLabel[req.category]?.[lang]??req.category}</Badge>{req.budget_max&&<Badge>{t("budget")}: {Number(req.budget_max).toLocaleString()} {t("currency")}</Badge>}</div><ul className="list-inside list-disc text-xs leading-relaxed text-muted-foreground">{((req.specs as string[])??[]).map(s=><li key={s}>{s}</li>)}</ul></Card>
    {ranked.length===0?<EmptyState title={t("noOffers")} icon={<PackageSearch className="size-6 text-muted-foreground"/>}/>:<><div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">{sorts.map(s=><button key={s.key} onClick={()=>setSort(s.key)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${sort===s.key?"border-primary bg-primary-soft text-primary":"border-border bg-card text-muted-foreground"}`}>{s.label}</button>)}</div><div className="space-y-3">{ranked.map(({offer,supplier,match,reviewCount},index)=><Card key={offer.id} className="space-y-3">{index===0&&sort==="match"&&<Badge tone="success">{t("recommended")}</Badge>}<div className="flex items-start gap-3">{offer.image_url&&<img src={offer.image_url} alt={offer.product_name} loading="lazy" className="size-16 rounded-xl object-cover"/>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{offer.product_name}</p>{offer.model&&<p className="text-xs text-muted-foreground">{offer.model}</p>}<p className="mt-1 font-display text-lg font-semibold">{Number(offer.price).toLocaleString()} {t("currency")}</p></div><div className="text-end"><p className="font-display text-xl font-semibold text-primary">{match.score}%</p><p className="text-[10px] text-muted-foreground">{t("match")}</p></div></div><div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5"/> {offer.warranty_months} {t("monthsWarranty")}</span><span className="inline-flex items-center gap-1"><Truck className="size-3.5"/> {offer.delivery_days} {t("daysDelivery")}</span><span className="inline-flex items-center gap-1"><Star className="size-3.5"/> {Number(supplier?.rating??0)>0?Number(supplier?.rating).toFixed(1):"No ratings yet"}</span>{supplier&&<button type="button" onClick={()=>navigate({to:"/suppliers/$supplierId/reviews",params:{supplierId:supplier.user_id}})} className="font-medium text-primary underline-offset-2 hover:underline">{reviewCount} {reviewCount===1?"review":"reviews"}</button>}<span>{supplier?.alias??"SUP"}</span>{supplier?.verified&&<Badge tone="success">{t("verified")}</Badge>}</div><TechnicalGrid specs={offer.technical_specs} lang={lang}/>{offer.video_url&&<VideoPreview url={offer.video_url} lang={lang}/>}<div className="space-y-1 rounded-xl bg-muted/60 p-3"><p className="text-[11px] font-semibold text-muted-foreground">{t("matchWhy")}</p>{match.reasons.map(r=><p key={r.key} className="flex items-center gap-1.5 text-[11px]">{r.ok?<Check className="size-3.5 text-success"/>:<X className="size-3.5 text-muted-foreground"/>}{reasonText(r.key,r.ok,lang)}</p>)}</div>{offer.benefits&&<p className="text-xs text-muted-foreground">{offer.benefits}</p>}{req.status==="open"&&<Button className="w-full" onClick={()=>navigate({to:"/checkout/$offerId",params:{offerId:offer.id}})}>{t("accept")}</Button>}</Card>)}</div></>}
  </Page>;
}
