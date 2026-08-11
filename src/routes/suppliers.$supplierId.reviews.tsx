import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Card, EmptyState, Spinner } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/suppliers/$supplierId/reviews")({
  head: () => ({
    meta: [
      { title: "Supplier reviews — MazzadTech" },
      { name: "description", content: "Customer reviews for this supplier." },
    ],
  }),
  component: () => <Guard roles={["customer"]}>{() => <SupplierReviews />}</Guard>,
});

type SupplierReview = {
  id: string;
  stars: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string | null;
};

function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <div className="flex gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={`${size} ${star <= value ? "fill-current text-yellow-500" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

function SupplierReviews() {
  const { supplierId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["supplier-reviews", supplierId],
    queryFn: async () => {
      const [{ data: supplier, error: supplierError }, { data: reviews, error: reviewsError }] = await Promise.all([
        supabase
          .from("supplier_profiles")
          .select("user_id, alias, company_name, rating, verified")
          .eq("user_id", supplierId)
          .maybeSingle(),
        (supabase as any).rpc("get_supplier_reviews", { _supplier_id: supplierId }),
      ]);
      if (supplierError) throw supplierError;
      if (reviewsError) throw reviewsError;
      return { supplier, reviews: (reviews ?? []) as SupplierReview[] };
    },
  });

  if (isLoading) {
    return (
      <Page>
        <div className="grid place-items-center py-16 text-muted-foreground"><Spinner /></div>
      </Page>
    );
  }

  if (!data?.supplier) return <Page title="Supplier reviews"><EmptyState title="Supplier not found" /></Page>;

  const average = Number(data.supplier.rating ?? 0);
  const count = data.reviews.length;

  return (
    <Page title="Supplier reviews">
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold">{data.supplier.company_name}</p>
            <p className="text-xs text-muted-foreground">{data.supplier.alias}</p>
          </div>
          {data.supplier.verified && <Badge tone="success">Verified</Badge>}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl font-bold">{average > 0 ? average.toFixed(1) : "—"}</span>
          <div>
            <Stars value={Math.round(average)} size="size-5" />
            <p className="mt-1 text-xs text-muted-foreground">{count} {count === 1 ? "review" : "reviews"}</p>
          </div>
        </div>
      </Card>

      {data.reviews.length === 0 ? (
        <EmptyState title="No reviews yet" />
      ) : (
        <div className="space-y-3">
          {data.reviews.map((review) => (
            <Card key={review.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Stars value={review.stars} />
                  <p className="text-sm font-medium">{review.reviewer_name || "Customer"}</p>
                </div>
                <time className="text-[11px] text-muted-foreground" dateTime={review.created_at}>
                  {new Date(review.created_at).toLocaleDateString()}
                </time>
              </div>
              {review.comment && <p className="text-sm leading-relaxed text-muted-foreground">{review.comment}</p>}
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
