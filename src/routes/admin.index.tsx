import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, Wallet, Users, Store, ShieldAlert, ArrowRight } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Card, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — MazzadTech" },
      { name: "description", content: "Platform overview of customers, suppliers, orders and revenue." },
      { property: "og:title", content: "Admin dashboard — MazzadTech" },
      { property: "og:description", content: "Platform overview of customers, suppliers, orders and revenue." },
    ],
  }),
  component: () => <Guard roles={["admin"]}>{() => <Body />}</Guard>,
});

function monthStart() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function Body() {
  const { t } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const since = monthStart();
      const [orders, pending, newSuppliers, newCustomers] = await Promise.all([
        supabase.from("orders").select("amount, commission, customer_commission"),
        supabase
          .from("supplier_profiles")
          .select("id", { count: "exact", head: true })
          .eq("verification_status", "pending"),
        supabase
          .from("supplier_profiles")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
      ]);

      const rows = orders.data ?? [];
      const totalOrders = rows.length;
      const totalCommission = rows.reduce(
        (sum, o) => sum + Number(o.commission ?? 0) + Number(o.customer_commission ?? 0),
        0,
      );

      return {
        totalOrders,
        totalCommission,
        pendingVerifications: pending.count ?? 0,
        newCustomersThisMonth: newCustomers.count ?? 0,
        newSuppliersThisMonth: newSuppliers.count ?? 0,
      };
    },
  });

  if (isLoading || !data) {
    return (
      <Page title={t("dashboard")}>
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      </Page>
    );
  }

  return (
    <Page title={t("dashboard")}>
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Package className="size-4" />} label={t("totalOrders")} value={data.totalOrders.toLocaleString()} />
        <Stat
          icon={<Wallet className="size-4" />}
          label={t("totalCommissionRevenue")}
          value={`${data.totalCommission.toLocaleString()} ${t("currency")}`}
        />
        <Stat icon={<Users className="size-4" />} label={t("newCustomersThisMonth")} value={`+${data.newCustomersThisMonth}`} />
        <Stat icon={<Store className="size-4" />} label={t("newSuppliersThisMonth")} value={`+${data.newSuppliersThisMonth}`} />
      </div>

      <Card className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{t("pendingVerifications")}</span>
        <span className="font-display text-lg font-semibold">{data.pendingVerifications}</span>
      </Card>

      {data.pendingVerifications > 0 && (
        <Link to="/admin/suppliers">
          <Card className="flex items-center justify-between gap-3 border-warning/40 bg-warning/5">
            <span className="flex items-center gap-2 text-sm font-medium text-warning-foreground">
              <ShieldAlert className="size-4" />
              {t("pendingVerifications")}: {data.pendingVerifications}
            </span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Card>
        </Link>
      )}
    </Page>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="space-y-1">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <p className="font-display text-xl font-semibold">{value}</p>
    </Card>
  );
}
