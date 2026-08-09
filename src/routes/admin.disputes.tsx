import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, Spinner, Textarea } from "@/components/ui-kit";
import { useI18n, type TKey } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/disputes")({
  head: () => ({
    meta: [
      { title: "Disputes — MazzadTech" },
      { name: "description", content: "Review and resolve customer and supplier disputes." },
      { property: "og:title", content: "Disputes — MazzadTech" },
      { property: "og:description", content: "Review and resolve customer and supplier disputes." },
    ],
  }),
  component: () => <Guard roles={["admin"]}>{() => <Body />}</Guard>,
});

const ACTIONS = ["refund_customer", "deduct_supplier", "warn_supplier", "suspend_supplier", "no_action"] as const;

function Body() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const { data: disputes, error } = await supabase
        .from("disputes")
        .select("*, orders(order_number, amount, customer_id, supplier_id)")
        .order("status", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return disputes;
    },
  });

  const resolve = async (disputeId: string, action: (typeof ACTIONS)[number]) => {
    setBusy(disputeId);
    const { error } = await supabase.rpc("resolve_dispute", {
      _dispute_id: disputeId,
      _action: action,
      _note: notes[disputeId]?.trim() || "",
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("disputeResolvedToast"));
    await qc.invalidateQueries({ queryKey: ["admin-disputes"] });
  };

  if (isLoading || !data) {
    return (
      <Page title={t("disputes")}>
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      </Page>
    );
  }

  if (data.length === 0) {
    return (
      <Page title={t("disputes")}>
        <EmptyState title={t("noDisputes")} icon={<AlertTriangle className="size-8" />} />
      </Page>
    );
  }

  return (
    <Page title={t("disputes")}>
      <div className="space-y-3">
        {data.map((d) => (
          <Card key={d.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {t("orderNumber")}: {d.orders?.order_number}
                </p>
                <p className="text-sm font-semibold">{t(`disputeCategory_${d.category}` as TKey)}</p>
              </div>
              <Badge tone={d.status === "resolved" ? "success" : "warning"}>
                {t(d.status === "resolved" ? "disputeResolved" : "disputeOpen")}
              </Badge>
            </div>

            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <MessageSquare className="mt-0.5 size-3.5 shrink-0" />
              {d.description}
            </p>

            <p className="text-[11px] text-muted-foreground">
              {t("filedBy")}: {t(d.filed_by_role === "customer" ? "customer" : "supplier")} · {t("orderAmount")}:{" "}
              {Number(d.orders?.amount ?? 0).toLocaleString()} {t("currency")}
            </p>

            {d.status === "resolved" ? (
              <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                {t("resolutionAction")}: {t(`resolutionAction_${d.resolution_action}` as TKey)}
                {d.resolution_note ? ` — ${d.resolution_note}` : ""}
              </p>
            ) : (
              <div className="space-y-2">
                <Textarea
                  rows={2}
                  placeholder={t("resolutionNotePlaceholder")}
                  value={notes[d.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  {ACTIONS.map((a) => (
                    <Button
                      key={a}
                      size="sm"
                      variant="outline"
                      disabled={busy === d.id}
                      onClick={() => void resolve(d.id, a)}
                    >
                      {t(`resolutionAction_${a}`)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </Page>
  );
}