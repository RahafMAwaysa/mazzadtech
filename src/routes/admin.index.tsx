import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CircleDollarSign, ClipboardList, Package, ShieldAlert, Store, Users } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Card, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin dashboard — MazzadTech" }, { name: "description", content: "Current platform status and actions requiring admin attention." }] }),
  component: () => <Guard roles={["admin"]}>{() => <Body />}</Guard>,
});

function sevenDaysAgo() {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 6); return d;
}

function Body() {
  const { t } = useI18n();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const [ordersResult, suppliersResult, verifiedResult, pendingSuppliersResult, disputesResult] = await Promise.all([
        supabase.from("orders").select("id, amount, commission, customer_commission, status, payment_status, created_at"),
        supabase.from("supplier_profiles").select("id", { count: "exact", head: true }),
        supabase.from("supplier_profiles").select("id", { count: "exact", head: true }).eq("verification_status", "verified"),
        supabase.from("supplier_profiles").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
        supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (suppliersResult.error) throw suppliersResult.error;
      if (verifiedResult.error) throw verifiedResult.error;
      if (pendingSuppliersResult.error) throw pendingSuppliersResult.error;
      if (disputesResult.error) throw disputesResult.error;
      const orders = ordersResult.data ?? [];
      const paid = orders.filter((o) => o.payment_status === "paid");
      const platformRevenue = paid.reduce((sum, o) => sum + Number(o.commission ?? 0) + Number(o.customer_commission ?? 0), 0);
      const pendingOrders = orders.filter((o) => !["delivered", "cancelled"].includes(String(o.status))).length;
      const activity = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(sevenDaysAgo()); date.setDate(date.getDate() + index);
        const key = date.toISOString().slice(0, 10);
        return { key, label: date.toLocaleDateString(undefined, { weekday: "short" }), count: orders.filter((o) => String(o.created_at).slice(0, 10) === key).length };
      });
      return { totalOrders: orders.length, pendingOrders, totalSuppliers: suppliersResult.count ?? 0, verifiedSuppliers: verifiedResult.count ?? 0, platformRevenue, openDisputes: disputesResult.count ?? 0, pendingVerifications: pendingSuppliersResult.count ?? 0, activity };
    },
  });

  if (isLoading || !data) return <Page title={t("dashboard")}><div className="grid place-items-center py-16 text-muted-foreground"><Spinner /></div></Page>;
  if (error) return <Page title={t("dashboard")}><Card className="text-sm text-destructive">Could not load the dashboard.</Card></Page>;
  const maxActivity = Math.max(...data.activity.map((item) => item.count), 1);

  return (
    <Page title={t("dashboard")}>
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Package className="size-4" />} label="Total Orders" value={data.totalOrders.toLocaleString()} />
        <Stat icon={<ClipboardList className="size-4" />} label="Pending Orders" value={data.pendingOrders.toLocaleString()} />
        <Stat icon={<Store className="size-4" />} label="Total Suppliers" value={data.totalSuppliers.toLocaleString()} />
        <Stat icon={<Users className="size-4" />} label="Verified Suppliers" value={data.verifiedSuppliers.toLocaleString()} />
        <Stat icon={<CircleDollarSign className="size-4" />} label="Platform Revenue" value={`${data.platformRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${t("currency")}`} />
        <Stat icon={<AlertTriangle className="size-4" />} label="Open Disputes" value={data.openDisputes.toLocaleString()} />
      </div>

      <Card className="space-y-4">
        <div><h2 className="font-display font-semibold">Needs Your Attention</h2><p className="text-xs text-muted-foreground">Items that may require an admin action.</p></div>
        <AttentionLink label="Suppliers awaiting verification" count={data.pendingVerifications} to="/admin/suppliers" icon={<ShieldAlert className="size-4" />} />
        <AttentionLink label="Open disputes" count={data.openDisputes} to="/admin/disputes" icon={<AlertTriangle className="size-4" />} />
        <AttentionLink label="Orders still in progress" count={data.pendingOrders} to="/admin/orders" icon={<ClipboardList className="size-4" />} />
      </Card>

      <Card className="space-y-4">
        <div><h2 className="font-display font-semibold">Orders Activity</h2><p className="text-xs text-muted-foreground">Orders created during the last 7 days.</p></div>
        <div className="flex h-36 items-end gap-2">
          {data.activity.map((item) => (
            <div key={item.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <span className="text-[10px] font-medium text-muted-foreground">{item.count}</span>
              <div className="flex h-24 w-full items-end rounded-lg bg-muted/50 px-1"><div className="w-full rounded-md bg-primary transition-all" style={{ height: `${Math.max((item.count / maxActivity) * 100, item.count ? 8 : 2)}%` }} /></div>
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Card className="space-y-1"><span className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</span><p className="font-display text-xl font-semibold">{value}</p></Card>;
}

function AttentionLink({ label, count, to, icon }: { label: string; count: number; to: string; icon: React.ReactNode }) {
  return <Link to={to as any} className="block"><div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/50"><span className="flex items-center gap-2 text-sm">{icon}{label}</span><span className="flex items-center gap-2"><span className="font-semibold">{count}</span><ArrowRight className="size-4 text-muted-foreground" /></span></div></Link>;
}
