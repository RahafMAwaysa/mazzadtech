import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Plus } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, Spinner } from "@/components/ui-kit";
import { categoryLabel, useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/requests/")({
  head: () => ({
    meta: [
      { title: "My requests — Ateeq" },
      { name: "description", content: "Track your electronics purchase requests and the offers suppliers sent." },
      { property: "og:title", content: "My requests — Ateeq" },
      { property: "og:description", content: "Track your purchase requests and incoming supplier offers." },
    ],
  }),
  component: () => <Guard roles={["customer", "admin"]}>{(ctx) => <Requests userId={ctx.userId} />}</Guard>,
});

function Requests({ userId }: { userId: string }) {
  const { t, lang } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["requests", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_requests")
        .select("id, title, category, status, budget_max, created_at, offers(id)")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <Page title={t("myRequests")}>
      <Link to="/assistant">
        <Button className="w-full">
          <Plus className="size-4" />
          {t("newRequest")}
        </Button>
      </Link>

      {isLoading && (
        <div className="grid place-items-center py-10 text-muted-foreground">
          <Spinner />
        </div>
      )}

      {!isLoading && (data?.length ?? 0) === 0 && (
        <EmptyState title={t("noRequests")} icon={<ClipboardList className="size-6 text-muted-foreground" />} />
      )}

      <div className="space-y-3">
        {data?.map((r) => (
          <Link key={r.id} to="/requests/$id" params={{ id: r.id }} className="block">
            <Card className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">{r.title}</p>
                <Badge tone={r.status === "open" ? "primary" : r.status === "awarded" ? "success" : "muted"}>
                  {t(r.status === "open" ? "open" : r.status === "awarded" ? "awarded" : "closed")}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{categoryLabel[r.category]?.[lang] ?? r.category}</span>
                {r.budget_max && (
                  <span>
                    · {t("budget")} {Number(r.budget_max).toLocaleString()} {t("currency")}
                  </span>
                )}
                <span>· {r.offers.length} {t("offers")}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </Page>
  );
}
