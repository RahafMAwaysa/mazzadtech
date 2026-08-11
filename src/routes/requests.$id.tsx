import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, PackageSearch, ShieldCheck, Star, Truck, X } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, Spinner } from "@/components/ui-kit";
import { categoryLabel, useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { computeMatch, reasonText } from "@/lib/match";

export const Route = createFileRoute("/requests/$id")({
  head: () => ({
    meta: [
      { title: "Offers for your request — Ateeq" },
      { name: "description", content: "Compare supplier offers ranked by an AI match score for your request." },
      { property: "og:title", content: "Offers for your request — Ateeq" },
      { property: "og:description", content: "Compare offers ranked by AI match score, price, warranty and delivery." },
    ],
  }),
  component: () => <Guard roles={["customer", "admin"]}>{() => <RequestOffers />}</Guard>,
});

type Sort = "match" | "price" | "warranty" | "delivery" | "rating";

type OfferRow = {
  id: string;
  supplier_id: string;
  price: number;
  specs: unknown;
  warranty_months: number;
  delivery_days: number;
  product_name: string;
  model: string | null;
  image_url: string | null;
  benefits: string | null;
};

type SupplierRow = {
  user_id: string;
  alias: string | null;
  rating: number | null;
  verified: boolean;
  completed_orders: number;
};

function RequestOffers() {
  const { id } = Route.useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [sort, setSort] = useState<Sort>("match");

  const { data, isLoading, error } = useQuery({
    queryKey: ["request", id],
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const [{ data: request, error: e1 }, { data: offers, error: e2 }] = await Promise.all([
        supabase
          .from("purchase_requests")
          .select("id,title,category,budget_min,budget_max,specs,warranty_preference,delivery_preference,brands,status")
          .eq("id", id)
          .single(),
        supabase
          .from("offers")
          .select("id,supplier_id,price,specs,warranty_months,delivery_days,product_name,model,image_url,benefits")
          .eq("request_id", id),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const typedOffers = (offers ?? []) as OfferRow[];
      const supplierIds = [...new Set(typedOffers.map((o) => o.supplier_id))];
      if (supplierIds.length === 0) {
        return { request, offers: typedOffers, suppliers: [] as SupplierRow[], reviewCountsBySupplier: new Map<string, number>() };
      }

      // Everything after the initial request/offer fetch is batched and runs in parallel.
      // In particular, never call one reviews endpoint per supplier.
      const [{ data: suppliers, error: supplierError }, { data: ratings, error: ratingsError }] = await Promise.all([
        supabase
          .from("supplier_profiles")
          .select("user_id, alias, rating, verified, completed_orders")
          .in("user_id", supplierIds),
        supabase
          .from("ratings")
          .select("ratee_id")
          .in("ratee_id", supplierIds)
          .eq("rater_role", "customer"),
      ]);
      if (supplierError) throw supplierError;
      if (ratingsError) throw ratingsError;

      const reviewCountsBySupplier = new Map<string, number>();
      for (const row of ratings ?? []) {
        const supplierId = row.ratee_id as string;
        reviewCountsBySupplier.set(supplierId, (reviewCountsBySupplier.get(supplierId) ?? 0) + 1);
      }

      return {
        request,
        offers: typedOffers,
        suppliers: (suppliers ?? []) as SupplierRow[],
        reviewCountsBySupplier,
      };
    },
  });

  const ranked = useMemo(() => {
    if (!data?.request) return [];
    const req = data.request;
    const list = data.offers.map((offer) => {
      const supplier = data.suppliers.find((s) => s.user_id === offer.supplier_id);
      const reviewCount = data.reviewCountsBySupplier.get(offer.supplier_id) ?? 0;
      const match = computeMatch({
        request: {
          budget_min: req.budget_min ? Number(req.budget_min) : null,
          budget_max: req.budget_max ? Number(req.budget_max) : null,
          specs: (req.specs as string[]) ?? [],
          warranty_preference: req.warranty_preference,
          delivery_preference: req.delivery_preference,
          brands: req.brands ?? [],
        },
        offer: {
          price: Number(offer.price),
          specs: (offer.specs as string[]) ?? [],
          warranty_months: offer.warranty_months,
          delivery_days: offer.delivery_days,
          product_name: offer.product_name,
        },
        supplier: { rating: Number(supplier?.rating ?? 0), verified: supplier?.verified ?? false },
      });
      return { offer, supplier, match, reviewCount };
    });

    return list.sort((a, b) => {
      switch (sort) {
        case "price": return Number(a.offer.price) - Number(b.offer.price);
        case "warranty": return b.offer.warranty_months - a.offer.warranty_months;
        case "delivery": return a.offer.delivery_days - b.offer.delivery_days;
        case "rating": return Number(b.supplier?.rating ?? 0) - Number(a.supplier?.rating ?? 0);
        default: return b.match.score - a.match.score;
      }
    });
  }, [data, sort]);

  if (isLoading) {
    return <Page><div className="grid place-items-center py-16 text-muted-foreground"><Spinner /></div></Page>;
  }

  if (error) {
    return (
      <Page title={t("offersFor")}>
        <Card className="space-y-2">
          <p className="text-sm font-semibold">Could not load offers</p>
          <p className="text-xs text-muted-foreground">{error instanceof Error ? error.message : "Please try again."}</p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </Card>
      </Page>
    );
  }

  if (!data?.request) return <Page title={t("offersFor")}>{null}</Page>;

  const req = data.request;
  const sorts: { key: Sort; label: string }[] = [
    { key: "match", label: t("bestMatch") },
    { key: "price", label: t("lowestPrice") },
    { key: "warranty", label: t("longestWarranty") },
    { key: "delivery", label: t("fastestDelivery") },
    { key: "rating", label: t("topRated") },
  ];

  return (
    <Page title={req.title}>
      <Card className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Badge tone="primary">{categoryLabel[req.category]?.[lang] ?? req.category}</Badge>
          {req.budget_max && <Badge>{t("budget")}: {Number(req.budget_max).toLocaleString()} {t("currency")}</Badge>}
        </div>
        <ul className="list-inside list-disc text-xs leading-relaxed text-muted-foreground">
          {((req.specs as string[]) ?? []).map((s) => <li key={s}>{s}</li>)}
        </ul>
        <p className="text-[11px] text-muted-foreground">{t("identityHidden")}</p>
      </Card>

      {ranked.length === 0 ? (
        <EmptyState title={t("noOffers")} icon={<PackageSearch className="size-6 text-muted-foreground" />} />
      ) : (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {sorts.map((s) => (
              <button key={s.key} onClick={() => setSort(s.key)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${sort === s.key ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-muted-foreground"}`}>
                {s.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {ranked.map(({ offer, supplier, match, reviewCount }, index) => (
              <Card key={offer.id} className="space-y-3">
                {index === 0 && sort === "match" && <Badge tone="success">{t("recommended")}</Badge>}
                <div className="flex items-start gap-3">
                  {offer.image_url && <img src={offer.image_url} alt={offer.product_name} loading="lazy" className="size-16 rounded-xl object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{offer.product_name}</p>
                    {offer.model && <p className="text-xs text-muted-foreground">{offer.model}</p>}
                    <p className="mt-1 font-display text-lg font-semibold">{Number(offer.price).toLocaleString()} {t("currency")}</p>
                  </div>
                  <div className="text-end"><p className="font-display text-xl font-semibold text-primary">{match.score}%</p><p className="text-[10px] text-muted-foreground">{t("match")}</p></div>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" /> {offer.warranty_months} {t("monthsWarranty")}</span>
                  <span className="inline-flex items-center gap-1"><Truck className="size-3.5" /> {offer.delivery_days} {t("daysDelivery")}</span>
                  <span className="inline-flex items-center gap-1"><Star className="size-3.5" /> {Number(supplier?.rating ?? 0) > 0 ? Number(supplier?.rating).toFixed(1) : "No ratings yet"}</span>
                  {supplier && <button type="button" onClick={() => navigate({ to: "/suppliers/$supplierId/reviews", params: { supplierId: supplier.user_id } })} className="font-medium text-primary underline-offset-2 hover:underline">{reviewCount} {reviewCount === 1 ? "review" : "reviews"}</button>}
                  <span>{supplier?.alias ?? "SUP"}</span>
                  {supplier?.verified && <Badge tone="success">{t("verified")}</Badge>}
                </div>

                <div className="space-y-1 rounded-xl bg-muted/60 p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground">{t("matchWhy")}</p>
                  {match.reasons.map((r) => <p key={r.key} className="flex items-center gap-1.5 text-[11px]">{r.ok ? <Check className="size-3.5 text-success" /> : <X className="size-3.5 text-muted-foreground" />}{reasonText(r.key, r.ok, lang)}</p>)}
                </div>

                {offer.benefits && <p className="text-xs text-muted-foreground">{offer.benefits}</p>}
                {req.status === "open" && <Button className="w-full" onClick={() => navigate({ to: "/checkout/$offerId", params: { offerId: offer.id } })}>{t("accept")}</Button>}
              </Card>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}
