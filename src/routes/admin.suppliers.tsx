import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, XCircle, MessageSquarePlus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, Spinner, Textarea } from "@/components/ui-kit";
import { categoryLabel, useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers — MazzadTech" },
      { name: "description", content: "Verify suppliers and manage their platform status." },
      { property: "og:title", content: "Suppliers — MazzadTech" },
      { property: "og:description", content: "Verify suppliers and manage their platform status." },
    ],
  }),
  component: () => <Guard roles={["admin"]}>{() => <Body />}</Guard>,
});

type SupplierRow = {
  id: string;
  user_id: string;
  company_name: string;
  city: string | null;
  categories: string[];
  rating: number;
  completed_orders: number;
  verification_status: "pending" | "verified" | "rejected";
  verification_note: string | null;
  email?: string | null;
  phone?: string | null;
};

function Body() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-suppliers"],
    queryFn: async () => {
      const { data: suppliers, error } = await supabase
        .from("supplier_profiles")
        .select("*")
        .order("verification_status", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (suppliers ?? []).map((s) => s.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, phone").in("id", ids)
        : { data: [] };
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

      return (suppliers ?? []).map((s) => ({
        ...s,
        phone: byId.get(s.user_id)?.phone ?? null,
      })) as SupplierRow[];
    },
  });

  const setStatus = async (row: SupplierRow, status: SupplierRow["verification_status"]) => {
    setBusy(row.id);
    const note = notes[row.id]?.trim() || null;
    const { error } = await supabase
      .from("supplier_profiles")
      .update({ verification_status: status, verification_note: note })
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
    } else {
      await qc.invalidateQueries({ queryKey: ["admin-suppliers"] });
      toast.success(t("verificationUpdated"));
    }
    setBusy(null);
  };

  if (isLoading || !data) {
    return (
      <Page title={t("suppliers")}>
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      </Page>
    );
  }

  if (data.length === 0) {
    return (
      <Page title={t("suppliers")}>
        <EmptyState title={t("noSuppliers")} />
      </Page>
    );
  }

  const statusTone = (s: SupplierRow["verification_status"]) =>
    s === "verified" ? "success" : s === "rejected" ? "danger" : "warning";

  return (
    <Page title={t("suppliers")}>
      <div className="space-y-3">
        {data.map((row) => (
          <Card key={row.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{row.company_name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.city ?? "—"}
                  {row.phone ? ` · ${row.phone}` : ""}
                </p>
              </div>
              <Badge tone={statusTone(row.verification_status)}>
                {row.verification_status === "verified" && <ShieldCheck className="size-3" />}
                {t(
                  row.verification_status === "verified"
                    ? "verified"
                    : row.verification_status === "rejected"
                      ? "verificationRejected"
                      : "pendingVerification",
                )}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(row.categories ?? []).map((c) => (
                <Badge key={c}>{categoryLabel[c]?.[lang] ?? c}</Badge>
              ))}
            </div>

            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>★ {Number(row.rating).toFixed(1)}</span>
              <span>{row.completed_orders} {t("completedOrders")}</span>
            </div>

            {row.verification_note && (
              <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <MessageSquarePlus className="me-1 inline size-3.5" />
                {row.verification_note}
              </p>
            )}

            <Textarea
              rows={2}
              placeholder={t("verificationNotePlaceholder")}
              value={notes[row.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [row.id]: e.target.value }))}
            />

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                disabled={busy === row.id}
                onClick={() => void setStatus(row, "verified")}
              >
                <CheckCircle2 className="size-4" />
                {t("approve")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={busy === row.id}
                onClick={() => void setStatus(row, "rejected")}
              >
                <XCircle className="size-4" />
                {t("reject")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={busy === row.id}
                onClick={() => void setStatus(row, "pending")}
              >
                <MessageSquarePlus className="size-4" />
                {t("requestInfo")}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}
