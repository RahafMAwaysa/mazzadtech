import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, WalletCards, ShoppingCart, Coins, Truck, Banknote } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Card, Spinner } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Financial Report — MazzadTech" },
      { name: "description", content: "Financial overview of paid orders, commissions, delivery fees and supplier wallets." },
    ],
  }),
  component: () => <Guard roles={["admin"]}>{() => <Body />}</Guard>,
});

type ReportOrder = {
  order_number: string;
  amount: number | string;
  commission: number | string;
  customer_commission: number | string;
  delivery_fee: number | string;
  payment_status: string;
  created_at: string;
};

function Body() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-financial-report"],
    queryFn: async () => {
      const [ordersResult, walletResult] = await Promise.all([
        supabase
          .from("orders")
          .select("order_number, amount, commission, customer_commission, delivery_fee, payment_status, created_at")
          .eq("payment_status", "paid")
          .order("created_at", { ascending: false }),
        supabase.from("wallets").select("balance"),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (walletResult.error) throw walletResult.error;

      const orders = (ordersResult.data ?? []) as ReportOrder[];
      const grossSales = orders.reduce((sum, order) => sum + Number(order.amount ?? 0), 0);
      const supplierCommission = orders.reduce((sum, order) => sum + Number(order.commission ?? 0), 0);
      const customerCommission = orders.reduce((sum, order) => sum + Number(order.customer_commission ?? 0), 0);
      const deliveryFees = orders.reduce((sum, order) => sum + Number(order.delivery_fee ?? 0), 0);
      const supplierPayouts = orders.reduce(
        (sum, order) => sum + Number(order.amount ?? 0) - Number(order.commission ?? 0),
        0,
      );
      const supplierWalletBalance = (walletResult.data ?? []).reduce(
        (sum, wallet) => sum + Number(wallet.balance ?? 0),
        0,
      );

      return {
        orders,
        grossSales,
        supplierCommission,
        customerCommission,
        platformRevenue: supplierCommission + customerCommission,
        deliveryFees,
        supplierPayouts,
        supplierWalletBalance,
      };
    },
  });

  if (isLoading) {
    return (
      <Page title="Financial Report">
        <div className="grid place-items-center py-16 text-muted-foreground"><Spinner /></div>
      </Page>
    );
  }

  if (error || !data) {
    return (
      <Page title="Financial Report">
        <Card className="text-sm text-destructive">Could not load the financial report.</Card>
      </Page>
    );
  }

  const money = (value: number) => `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Page title="Financial Report">
      <Card className="space-y-1">
        <div className="flex items-center gap-2 font-display font-semibold"><FileText className="size-5 text-primary" />Financial overview</div>
        <p className="text-xs text-muted-foreground">Based on all orders currently marked as paid.</p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <ReportStat icon={<ShoppingCart className="size-4" />} label="Paid Orders" value={data.orders.length.toLocaleString()} />
        <ReportStat icon={<Banknote className="size-4" />} label="Gross Sales" value={money(data.grossSales)} />
        <ReportStat icon={<Coins className="size-4" />} label="Platform Revenue" value={money(data.platformRevenue)} />
        <ReportStat icon={<WalletCards className="size-4" />} label="Supplier Payouts" value={money(data.supplierPayouts)} />
        <ReportStat icon={<WalletCards className="size-4" />} label="Supplier Wallet Balance" value={money(data.supplierWalletBalance)} />
        <ReportStat icon={<Truck className="size-4" />} label="Delivery Fees" value={money(data.deliveryFees)} />
      </div>

      <Card className="space-y-3">
        <div>
          <h2 className="font-display font-semibold">Commission breakdown</h2>
          <p className="text-xs text-muted-foreground">Actual commissions recorded on paid orders.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-muted p-3"><p className="text-xs text-muted-foreground">Supplier commission</p><p className="mt-1 font-semibold">{money(data.supplierCommission)}</p></div>
          <div className="rounded-xl bg-muted p-3"><p className="text-xs text-muted-foreground">Customer commission</p><p className="mt-1 font-semibold">{money(data.customerCommission)}</p></div>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display font-semibold">Paid orders</h2>
        {data.orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No paid orders yet.</p>
        ) : (
          <div className="space-y-2">
            {data.orders.map((order) => (
              <div key={order.order_number} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{order.order_number}</span>
                  <span className="font-semibold">{money(Number(order.amount))}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Supplier commission: {money(Number(order.commission))}</span>
                  <span>Customer commission: {money(Number(order.customer_commission))}</span>
                  <span>Delivery: {money(Number(order.delivery_fee))}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}

function ReportStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="space-y-1">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</span>
      <p className="font-display text-lg font-semibold">{value}</p>
    </Card>
  );
}
