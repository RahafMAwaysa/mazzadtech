import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, ShieldOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, Input, Spinner, Textarea } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Users — MazzadTech" },
      { name: "description", content: "Search accounts and manage suspensions." },
      { property: "og:title", content: "Users — MazzadTech" },
      { property: "og:description", content: "Search accounts and manage suspensions." },
    ],
  }),
  component: () => <Guard roles={["admin"]}>{() => <Body />}</Guard>,
});

type Row = {
  id: string;
  full_name: string | null;
  phone: string | null;
  suspended: boolean;
  suspension_reason: string | null;
  role: string;
};

function Body() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, suspended, suspension_reason")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleById = new Map((roles ?? []).map((r) => [r.user_id, r.role]));

      return (profiles ?? []).map((p) => ({ ...p, role: roleById.get(p.id) ?? "customer" })) as Row[];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (r) => r.full_name?.toLowerCase().includes(q) || r.phone?.toLowerCase().includes(q) || r.id.includes(q),
    );
  }, [data, query]);

  const toggleSuspend = async (row: Row) => {
    setBusy(row.id);
    const nextSuspended = !row.suspended;
    const { error } = await supabase
      .from("profiles")
      .update({
        suspended: nextSuspended,
        suspension_reason: nextSuspended ? reasons[row.id]?.trim() || null : null,
      })
      .eq("id", row.id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t(nextSuspended ? "userSuspended" : "userUnsuspended"));
    await qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  return (
    <Page title={t("users")}>
      <div className="relative">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="ps-9"
          placeholder={t("searchUsersPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title={t("noUsersFound")} />
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <Card key={row.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{row.full_name ?? t("unnamed")}</p>
                  <p className="text-xs text-muted-foreground">{row.phone ?? "—"}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone="accent">
                    {t(row.role === "delivery" ? "deliveryCompany" : row.role === "admin" ? "admin" : row.role === "supplier" ? "supplier" : "customer")}
                  </Badge>
                  <Badge tone={row.suspended ? "danger" : "success"}>
                    {t(row.suspended ? "suspended" : "active")}
                  </Badge>
                </div>
              </div>

              {row.suspended && row.suspension_reason && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {row.suspension_reason}
                </p>
              )}

              {!row.suspended && (
                <Textarea
                  rows={2}
                  placeholder={t("suspensionReasonPlaceholder")}
                  value={reasons[row.id] ?? ""}
                  onChange={(e) => setReasons((r) => ({ ...r, [row.id]: e.target.value }))}
                />
              )}

              <Button
                size="sm"
                variant={row.suspended ? "outline" : "outline"}
                disabled={busy === row.id}
                onClick={() => void toggleSuspend(row)}
              >
                {row.suspended ? <ShieldCheck className="size-4" /> : <ShieldOff className="size-4" />}
                {t(row.suspended ? "unsuspend" : "suspend")}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}