import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, Gavel, PackageSearch } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, Spinner } from "@/components/ui-kit";
import { categoryLabel, useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { shortId, timeLeft } from "@/lib/auction";

export const Route = createFileRoute("/supplier/auctions")({
  head: () => ({
    meta: [
      { title: "Available auctions — MazzadTech" },
      { name: "description", content: "Live customer purchase requests matching your categories, open for offers." },
      { property: "og:title", content: "Available auctions — MazzadTech" },
      { property: "og:description", content: "Bid on live electronics purchase requests from real customers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Guard roles={["supplier", "admin"]}>{(ctx) => <Auctions userId={ctx.userId} />}</Guard>,
});

function Auctions({ userId }: { userId: string }) {
  const { t, lang } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["auctions", userId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("supplier_profiles")
        .select("categories")
        .eq("user_id", userId)
        .maybeSingle();
      const categories = profile?.categories ?? [];

      let query = supabase
        .from("purchase_requests")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (categories.length > 0) query = query.in("category", categories);

      const [{ data: requests, error }, { data: mine }] = await Promise.all([
        query,
        supabase.from("offers").select("request_id").eq("supplier_id", userId),
      ]);
      if (error) throw error;
      return {
        requests: requests ?? [],
        offered: new Set((mine ?? []).map((o) => o.request_id)),
      };
    },
  });

  if (isLoading) {
    return (
      <Page title={t("availableAuctions")}>
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      </Page>
    );
  }

  const requests = data?.requests ?? [];

  return (
    <Page title={t("availableAuctions")}>
      {requests.length === 0 ? (
        <EmptyState title={t("noAuctions")} icon={<PackageSearch className="size-6 text-muted-foreground" />} />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const remaining = timeLeft(r.bidding_ends_at, lang);
            const already = data?.offered.has(r.id);
            return (
              <Card key={r.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">
                      {t("requestId")}: {shortId(r.id)}
                    </p>
                    <p className="truncate text-sm font-semibold">{r.title}</p>
                  </div>
                  <Badge tone="primary">{categoryLabel[r.category]?.[lang] ?? r.category}</Badge>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground">{t("requirements")}</p>
                  <ul className="list-inside list-disc text-xs leading-relaxed text-muted-foreground">
                    {((r.specs as string[]) ?? []).slice(0, 5).map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                    {r.purpose && <li>{r.purpose}</li>}
                  </ul>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge>
                    {t("budget")}:{" "}
                    {r.budget_min ? `${Number(r.budget_min).toLocaleString()} – ` : ""}
                    {Number(r.budget_max ?? r.budget_min ?? 0).toLocaleString()} {t("currency")}
                  </Badge>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {remaining ? `${t("timeLeft")}: ${remaining}` : t("biddingClosed")}
                  </span>
                </div>

                {already ? (
                  <p className="text-xs text-success">{t("alreadyOffered")}</p>
                ) : (
                  <Link to="/supplier/offer/$requestId" params={{ requestId: r.id }} className="block">
                    <Button className="w-full" disabled={!remaining}>
                      <Gavel className="size-4" />
                      {t("submitOffer")}
                    </Button>
                  </Link>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}
