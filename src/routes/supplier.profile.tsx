import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Button, Card, Field, Input, Spinner } from "@/components/ui-kit";
import { CATEGORIES, categoryLabel, useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

const CITIES = [
  ["Jerusalem", "القدس"],
  ["Jenin", "جنين"],
  ["Tulkarm", "طولكرم"],
  ["Tubas", "طوباس"],
  ["Nablus", "نابلس"],
  ["Qalqilya", "قلقيلية"],
  ["Salfit", "سلفيت"],
  ["Ramallah and Al-Bireh", "رام الله والبيرة"],
  ["Jericho", "أريحا والأغوار"],
  ["Bethlehem", "بيت لحم"],
  ["Hebron", "الخليل"],
  ["Palestinian Interior", "الداخل الفلسطيني"],
] as const;

type SupplierReview = {
  id: string;
  stars: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string | null;
};

export const Route = createFileRoute("/supplier/profile")({
  head: () => ({
    meta: [
      { title: "Supplier profile — MazzadTech" },
      { name: "description", content: "Manage your company profile, city and the product categories you supply." },
      { property: "og:title", content: "Supplier profile — MazzadTech" },
      { property: "og:description", content: "Keep your supplier details and categories up to date." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Guard roles={["supplier", "admin"]}>{(ctx) => <Profile userId={ctx.userId} />}</Guard>,
});

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={`size-4 ${star <= value ? "fill-current text-yellow-500" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

function Profile({ userId }: { userId: string }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["supplier-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("supplier_profiles").select("*").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: wallet } = useQuery({
    queryKey: ["supplier-wallet", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wallets").select("balance").eq("supplier_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["supplier-own-reviews", userId],
    enabled: !!data,
    queryFn: async () => {
      const { data: rows, error } = await (supabase as any).rpc("get_supplier_reviews", {
        _supplier_id: userId,
      });
      if (error) throw error;
      return (rows ?? []) as SupplierReview[];
    },
  });

  useEffect(() => {
    if (!data) return;
    const profile = data as typeof data & { contact_phone?: string | null };
    setCompany(profile.company_name ?? "");
    setCity(profile.city ?? "");
    setPhone(profile.contact_phone ?? "");
    setCats(profile.categories ?? []);
  }, [data]);

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        company_name: company.trim() || "Supplier",
        city: city || null,
        categories: cats,
        contact_phone: phone.trim() || null,
      };
      const db = supabase as any;
      const { error } = data
        ? await db.from("supplier_profiles").update(payload).eq("user_id", userId)
        : await db.from("supplier_profiles").insert({ user_id: userId, ...payload });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["supplier-profile", userId] });
      await qc.invalidateQueries({ queryKey: ["auctions", userId] });
      toast.success(t("saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    const amount = Number(withdrawAmount);
    const balance = Number(wallet?.balance ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid withdrawal amount");
      return;
    }
    if (amount > balance) {
      toast.error("Withdrawal amount exceeds your wallet balance");
      return;
    }
    setWithdrawing(true);
    try {
      const { error } = await supabase.rpc("withdraw_from_wallet", { _amount: amount });
      if (error) throw error;
      setWithdrawAmount("");
      await qc.invalidateQueries({ queryKey: ["supplier-wallet", userId] });
      toast.success("Withdrawal processed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not process withdrawal");
    } finally {
      setWithdrawing(false);
    }
  };

  if (isLoading) {
    return (
      <Page title={t("supplierProfile")}>
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      </Page>
    );
  }

  const starCounts = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((review) => review.stars === stars).length,
  }));
  const reviewCount = reviews.length;

  return (
    <Page title={t("supplierProfile")}>
      <Card className="space-y-3">
        <Field label={t("companyName")}>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} />
        </Field>
        <Field label={t("city")}>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"
          >
            <option value="">{t("city")}</option>
            {CITIES.map(([en, ar]) => (
              <option key={en} value={en}>
                {lang === "ar" ? ar : en}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Contact phone">
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+970..." />
        </Field>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t("myCategories")}</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = cats.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCats((prev) => (on ? prev.filter((x) => x !== c) : [...prev, c]))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    on ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {categoryLabel[c]?.[lang] ?? c}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">{t("categoriesHint")}</p>
        </div>
        {data && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge tone={data.verified ? "success" : "warning"}>
              {data.verified ? t("verified") : t("pendingVerification")}
            </Badge>
            <Badge>
              {t("rating")}: {Number(data.rating) > 0 ? Number(data.rating).toFixed(1) : "No ratings yet"}
            </Badge>
            <Badge>
              {t("completedOrders")}: {data.completed_orders}
            </Badge>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <div>
          <p className="font-display font-semibold">Customer reviews</p>
          <p className="text-xs text-muted-foreground">Customer identities are hidden from suppliers.</p>
        </div>

        <div className="flex items-center gap-4 rounded-xl bg-muted/50 p-3">
          <div className="text-center">
            <p className="font-display text-3xl font-bold">{Number(data?.rating ?? 0) > 0 ? Number(data?.rating).toFixed(1) : "—"}</p>
            <Stars value={Math.round(Number(data?.rating ?? 0))} />
            <p className="mt-1 text-[11px] text-muted-foreground">{reviewCount} {reviewCount === 1 ? "review" : "reviews"}</p>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            {starCounts.map(({ stars, count }) => (
              <div key={stars} className="flex items-center gap-2 text-xs">
                <span className="w-8 shrink-0">{stars} ★</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-yellow-500"
                    style={{ width: `${reviewCount ? (count / reviewCount) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-5 text-right text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {reviews.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-xl border p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Stars value={review.stars} />
                    <p className="text-xs font-medium">Verified Customer</p>
                  </div>
                  <time className="text-[11px] text-muted-foreground" dateTime={review.created_at}>
                    {new Date(review.created_at).toLocaleDateString()}
                  </time>
                </div>
                {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Wallet balance</p>
            <p className="font-display text-2xl font-semibold">{Number(wallet?.balance ?? 0).toFixed(2)} {t("currency")}</p>
          </div>
          <Badge tone="success">Available</Badge>
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Amount"
          />
          <Button onClick={withdraw} disabled={withdrawing || Number(wallet?.balance ?? 0) <= 0}>
            {withdrawing ? <Spinner /> : "Withdraw"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Withdrawal updates the supplier wallet ledger. Actual bank transfer requires a connected payout provider.
        </p>
      </Card>

      <Button className="w-full" onClick={save} disabled={busy}>
        {busy ? <Spinner /> : t("save")}
      </Button>
    </Page>
  );
}
