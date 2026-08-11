import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, MessageSquareWarning, Star } from "lucide-react";
import { toast } from "sonner";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Button, Card, Field, Spinner, Textarea } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { ORDER_FLOW, statusKey } from "@/lib/order-status";
import { estimatedDelivery } from "@/lib/auction";
import { supplierPublicName } from "@/lib/identity";
import type { Role } from "@/lib/session";

export const Route = createFileRoute("/orders/$id")({
  head: () => ({
    meta: [
      { title: "Order tracking — MazzadTech" },
      { name: "description", content: "Track your order from confirmation to delivery, step by step." },
      { property: "og:title", content: "Order tracking — MazzadTech" },
      { property: "og:description", content: "Track your order from confirmation to delivery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Guard>{(ctx) => <OrderDetail viewerRole={ctx.role} userId={ctx.userId} />}</Guard>,
});

const DISPUTE_CATEGORIES = ["delivery_delay", "product_mismatch", "payment_issue", "other"] as const;

function OrderDetail({ viewerRole, userId }: { viewerRole: Role; userId: string }) {
  const { id } = Route.useParams();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [filing, setFiling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<(typeof DISPUTE_CATEGORIES)[number]>("delivery_delay");
  const [description, setDescription] = useState("");
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingBusy, setRatingBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, offers(product_name, model, image_url, warranty_months, delivery_days)")
        .eq("id", id)
        .single();
      if (error) throw error;
      const { data: supplier } = await supabase
        .from("supplier_profiles")
        .select("alias, company_name, city, rating, user_id")
        .eq("user_id", data.supplier_id)
        .maybeSingle();
      const { data: myDispute } = await supabase
        .from("disputes")
        .select("*")
        .eq("order_id", id)
        .eq("filed_by", userId)
        .maybeSingle();
      const { data: myRating } = await supabase
        .from("ratings")
        .select("id, stars, comment")
        .eq("order_id", id)
        .eq("rater_id", userId)
        .eq("rater_role", "customer")
        .maybeSingle();
      return { order: data, supplier, myDispute, myRating };
    },
  });

  const status = data?.order.status;

  const AUTO_UNTIL = ORDER_FLOW.indexOf("verified");
  useEffect(() => {
    if (!status) return;
    const index = ORDER_FLOW.indexOf(status as (typeof ORDER_FLOW)[number]);
    if (index < 0 || index >= AUTO_UNTIL) return;
    const next = ORDER_FLOW[index + 1];
    if (!next) return;
    const timer = setTimeout(async () => {
      await supabase.from("orders").update({ status: next }).eq("id", id);
      await supabase.from("order_events").insert({ order_id: id, status: next });
      await qc.invalidateQueries({ queryKey: ["order", id] });
    }, 8000);
    return () => clearTimeout(timer);
  }, [status, id, qc, AUTO_UNTIL]);

  useEffect(() => {
    if (!data?.myRating) return;
    setRatingStars(data.myRating.stars);
    setRatingComment(data.myRating.comment ?? "");
  }, [data?.myRating]);

  const fileDispute = async () => {
    if (!description.trim()) {
      toast.error(t("describeIssue"));
      return;
    }
    if (viewerRole !== "customer" && viewerRole !== "supplier") return;
    setBusy(true);
    const { error } = await supabase.from("disputes").insert({
      order_id: id,
      filed_by: userId,
      filed_by_role: viewerRole,
      category,
      description: description.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("disputeFiled"));
    setFiling(false);
    await qc.invalidateQueries({ queryKey: ["order", id] });
  };

  const publishRating = async () => {
    if (viewerRole !== "customer" || status !== "delivered" || !data?.order.supplier_id) return;
    if (!ratingStars) {
      toast.error("Choose a star rating first.");
      return;
    }
    setRatingBusy(true);
    const { error } = await supabase.from("ratings").insert({
      order_id: id,
      rater_id: userId,
      ratee_id: data.order.supplier_id,
      rater_role: "customer",
      stars: ratingStars,
      comment: ratingComment.trim() || null,
    });
    setRatingBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Your review has been published.");
    await qc.invalidateQueries({ queryKey: ["order", id] });
  };

  if (isLoading || !data) {
    return (
      <Page>
        <div className="grid place-items-center py-16 text-muted-foreground"><Spinner /></div>
      </Page>
    );
  }

  const { order, supplier, myDispute, myRating } = data;
  const currentIndex = ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]);
  const eta = estimatedDelivery(order.created_at, order.offers?.delivery_days ?? 3, lang);
  const canFile = viewerRole === "customer" || viewerRole === "supplier";
  const canRate = viewerRole === "customer" && order.status === "delivered";

  return (
    <Page title={t("orderStatus")}>
      <Card className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold">{order.offers?.product_name}</p>
          <Badge tone={order.status === "delivered" ? "success" : "primary"}>{t(statusKey(order.status))}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("orderNumber")}: {order.order_number}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("currentStatus")}: {t(statusKey(order.status))}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("estimatedDelivery")}: {eta}
        </p>
        <p className="text-sm font-semibold">
          {Number(order.amount).toLocaleString()} {t("currency")}
        </p>
        {supplier && (
          <p className="text-xs text-muted-foreground">
            {supplierPublicName(viewerRole, supplier)}
            {supplier.city ? ` · ${supplier.city}` : ""}
          </p>
        )}
      </Card>

      <Card className="space-y-4">
        <p className="text-xs font-semibold text-muted-foreground">{t("tracking")}</p>
        <ol className="space-y-4">
          {ORDER_FLOW.map((step, i) => {
            const done = currentIndex >= i;
            return (
              <li key={step} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[10px] ${
                    done ? "bg-success text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={`text-sm ${done ? "font-medium" : "text-muted-foreground"}`}>
                  {t(statusKey(step))}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-[11px] text-muted-foreground">{t("trackingSim")}</p>
      </Card>

      {canRate && (
        <Card className="space-y-4">
          <div>
            <p className="font-display font-semibold">Rate your supplier</p>
            <p className="mt-1 text-xs text-muted-foreground">Share your experience after the order is delivered.</p>
          </div>
          {myRating ? (
            <div className="space-y-2">
              <div className="flex gap-1" aria-label={`Your rating: ${myRating.stars} out of 5`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className={`size-5 ${star <= myRating.stars ? "fill-current text-yellow-500" : "text-muted-foreground/40"}`} />
                ))}
              </div>
              {myRating.comment && <p className="text-sm text-muted-foreground">{myRating.comment}</p>}
              <p className="text-[11px] text-muted-foreground">Your review is published.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-1" role="radiogroup" aria-label="Supplier rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingStars(star)}
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                    aria-pressed={ratingStars === star}
                    className="rounded-md p-1 transition-transform hover:scale-110"
                  >
                    <Star className={`size-7 ${star <= ratingStars ? "fill-current text-yellow-500" : "text-muted-foreground/40"}`} />
                  </button>
                ))}
              </div>
              <Field label="Comment">
                <Textarea rows={3} value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} placeholder="Tell other customers about your experience" />
              </Field>
              <Button onClick={publishRating} disabled={ratingBusy || !ratingStars}>
                {ratingBusy ? <Spinner /> : "Publish review"}
              </Button>
            </div>
          )}
        </Card>
      )}

      {canFile && (
        <Card className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <MessageSquareWarning className="size-3.5" />
            {t("haveAnIssue")}
          </p>

          {myDispute ? (
            <div className="space-y-1.5">
              <Badge tone={myDispute.status === "resolved" ? "success" : "warning"}>
                {t(myDispute.status === "resolved" ? "disputeResolved" : "disputeOpen")}
              </Badge>
              <p className="text-xs text-muted-foreground">{myDispute.description}</p>
              {myDispute.resolution_note && (
                <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  {myDispute.resolution_note}
                </p>
              )}
            </div>
          ) : filing ? (
            <div className="space-y-2">
              <select
                className="w-full rounded-xl border border-border bg-background p-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value as (typeof DISPUTE_CATEGORIES)[number])}
              >
                {DISPUTE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`disputeCategory_${c}`)}
                  </option>
                ))}
              </select>
              <Field label={t("describeIssue")}>
                <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
              <div className="flex gap-2">
                <Button size="sm" onClick={fileDispute} disabled={busy}>
                  {busy ? <Spinner /> : t("submitDispute")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setFiling(false)}>
                  {t("back")}
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setFiling(true)}>
              {t("reportIssue")}
            </Button>
          )}
        </Card>
      )}
    </Page>
  );
}
