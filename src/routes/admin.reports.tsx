import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileText, Filter, SlidersHorizontal, Eye } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Button, Card, Input } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — MazzadTech" }, { name: "description", content: "Create a custom platform report when you need it." }] }),
  component: () => <Guard roles={["admin"]}>{() => <Body />}</Guard>,
});

const REPORT_TYPES = ["Financial", "Orders", "Suppliers", "Customers", "Disputes"] as const;
const DATE_PRESETS = ["Today", "This Week", "This Month", "This Year", "Custom"] as const;
const ORDER_STATUSES = ["confirmed", "preparing", "verified", "received_from_supplier", "in_transit", "shipping", "delivered", "cancelled"] as const;
const FIELDS: Record<(typeof REPORT_TYPES)[number], string[]> = {
  Financial: ["Gross Sales", "Platform Revenue", "Supplier Payouts", "Supplier Wallet Balance", "Delivery Fees", "Commissions", "Order Details"],
  Orders: ["Order Count", "Order Value", "Order Status", "Supplier", "Category", "Payment Status", "Created Date"],
  Suppliers: ["Supplier Count", "Verified Suppliers", "Pending Verification", "Wallet Balance", "Completed Orders", "Response Rate"],
  Customers: ["Customer Count", "Order Count", "Total Spending", "Average Order Value", "Delivery Preferences"],
  Disputes: ["Dispute Count", "Open Disputes", "Resolved Disputes", "Categories", "Resolution Actions", "Resolution Time"],
};

const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

function Body() {
  const [reportTypes, setReportTypes] = useState<(typeof REPORT_TYPES)[number][]>(["Financial"]);
  const [datePreset, setDatePreset] = useState<(typeof DATE_PRESETS)[number]>("This Month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [generated, setGenerated] = useState(false);

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["admin-report-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("name").eq("active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: ["admin-report-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("supplier_profiles").select("user_id, company_name, verified, verification_status, completed_orders, response_rate").order("company_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const availableFields = Array.from(new Set(reportTypes.flatMap((type) => FIELDS[type])));
  const allFieldsSelected = availableFields.length > 0 && availableFields.every((field) => selectedFields.includes(field));

  const toggleReportType = (type: (typeof REPORT_TYPES)[number]) => {
    setReportTypes((current) => {
      if (current.includes(type)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== type);
      }
      return [...current, type];
    });
    setSelectedFields([]);
    setGenerated(false);
  };
  const toggleField = (field: string) => {
    setSelectedFields((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field]);
    setGenerated(false);
  };
  const selectAllFields = () => {
    setSelectedFields(allFieldsSelected ? [] : availableFields);
    setGenerated(false);
  };

  const getDateRange = () => {
    if (datePreset === "Custom") return { start: from ? new Date(`${from}T00:00:00`) : null, end: to ? new Date(`${to}T23:59:59.999`) : null };
    const now = new Date();
    const start = new Date(now);
    if (datePreset === "Today") start.setHours(0, 0, 0, 0);
    if (datePreset === "This Week") { const day = start.getDay(); start.setDate(start.getDate() - (day === 0 ? 6 : day - 1)); start.setHours(0, 0, 0, 0); }
    if (datePreset === "This Month") { start.setDate(1); start.setHours(0, 0, 0, 0); }
    if (datePreset === "This Year") { start.setMonth(0, 1); start.setHours(0, 0, 0, 0); }
    return { start, end: now };
  };

  const { data: preview, isFetching: previewLoading, refetch: buildPreview } = useQuery({
    queryKey: ["admin-report-preview", reportTypes, selectedFields, datePreset, from, to, category, supplier, orderStatus],
    enabled: false,
    queryFn: async () => {
      const { start, end } = getDateRange();
      let ordersQuery = supabase.from("orders").select("id, order_number, amount, commission, customer_commission, delivery_fee, payment_status, status, created_at, supplier_id, customer_id, request_id").eq("payment_status", "paid").order("created_at", { ascending: false });
      if (start) ordersQuery = ordersQuery.gte("created_at", start.toISOString());
      if (end) ordersQuery = ordersQuery.lte("created_at", end.toISOString());
      if (supplier) ordersQuery = ordersQuery.eq("supplier_id", supplier);
      if (orderStatus) ordersQuery = ordersQuery.eq("status", orderStatus);
      const [{ data: orders, error: ordersError }, { data: wallets, error: walletsError }, { data: disputes, error: disputesError }] = await Promise.all([
        ordersQuery,
        supabase.from("wallets").select("supplier_id, balance"),
        supabase.from("disputes").select("id, order_id, category, status, resolution_action, created_at, resolved_at, filed_by_role"),
      ]);
      if (ordersError) throw ordersError;
      if (walletsError) throw walletsError;
      if (disputesError) throw disputesError;

      const orderRows = orders ?? [];
      const walletRows = wallets ?? [];
      const supplierIds = Array.from(new Set(orderRows.map((o) => o.supplier_id)));
      let filteredOrders = orderRows;
      if (category && orderRows.length) {
        const requestIds = Array.from(new Set(orderRows.map((o) => o.request_id)));
        const { data: requests, error } = await supabase.from("requests").select("id, category").in("id", requestIds);
        if (error) throw error;
        const matching = new Set((requests ?? []).filter((r) => r.category?.toLowerCase() === category.toLowerCase()).map((r) => r.id));
        filteredOrders = orderRows.filter((o) => matching.has(o.request_id));
      }
      const gross = filteredOrders.reduce((s, o) => s + Number(o.amount || 0), 0);
      const supplierCommission = filteredOrders.reduce((s, o) => s + Number(o.commission || 0), 0);
      const customerCommission = filteredOrders.reduce((s, o) => s + Number(o.customer_commission || 0), 0);
      const delivery = filteredOrders.reduce((s, o) => s + Number(o.delivery_fee || 0), 0);
      const creditsQuery = supplierIds.length ? supabase.from("wallet_transactions").select("supplier_id, amount, type, order_id, created_at, wallets!inner(supplier_id)").eq("type", "credit") : null;
      const creditsResult = creditsQuery ? await creditsQuery : { data: [], error: null };
      if (creditsResult.error) throw creditsResult.error;
      const supplierPayouts = (creditsResult.data ?? []).filter((t: any) => filteredOrders.some((o) => o.id === t.order_id)).reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
      const walletBalance = supplier ? walletRows.filter((w) => w.supplier_id === supplier).reduce((s, w) => s + Number(w.balance || 0), 0) : walletRows.reduce((s, w) => s + Number(w.balance || 0), 0);
      const platformRevenue = supplierCommission + customerCommission;
      const disputeRows = (disputes ?? []).filter((d) => filteredOrders.some((o) => o.id === d.order_id));
      const filteredSuppliers = (suppliers ?? []).filter((s) => !supplier || s.user_id === supplier);
      return { orders: filteredOrders, gross, supplierCommission, customerCommission, delivery, supplierPayouts, walletBalance, platformRevenue, disputes: disputeRows, filteredSuppliers };
    },
  });

  const generate = async () => { setGenerated(true); await buildPreview(); };

  return (
    <Page title="Reports">
      <Card className="space-y-1"><div className="flex items-center gap-2 font-display font-semibold"><FileText className="size-5 text-primary" />Generate a Report</div><p className="text-xs text-muted-foreground">Choose one or more report types. Detailed data stays hidden until you request a report.</p></Card>
      <Card className="space-y-4"><div className="flex items-center gap-2 font-display font-semibold"><SlidersHorizontal className="size-4 text-primary" />Report type <span className="text-xs font-normal text-muted-foreground">(select multiple)</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{REPORT_TYPES.map((type) => { const selected = reportTypes.includes(type); return <button key={type} type="button" onClick={() => toggleReportType(type)} aria-pressed={selected} className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted/50"}`}>{type}</button>; })}</div></Card>
      <Card className="space-y-4"><div className="flex items-center gap-2 font-display font-semibold"><CalendarDays className="size-4 text-primary" />Date range</div><div className="flex flex-wrap gap-2">{DATE_PRESETS.map((preset) => <button key={preset} type="button" onClick={() => { setDatePreset(preset); setGenerated(false); }} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${datePreset === preset ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{preset}</button>)}</div>{datePreset === "Custom" && <div className="grid grid-cols-2 gap-3"><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setGenerated(false); }} /><Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setGenerated(false); }} /></div>}</Card>
      <Card className="space-y-4"><div className="flex items-center gap-2 font-display font-semibold"><Filter className="size-4 text-primary" />Filters</div><div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1.5 text-xs font-medium text-muted-foreground">Category<select value={category} onChange={(e) => { setCategory(e.target.value); setGenerated(false); }} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"><option value="">All categories</option>{categories?.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><label className="space-y-1.5 text-xs font-medium text-muted-foreground">Supplier<select value={supplier} onChange={(e) => { setSupplier(e.target.value); setGenerated(false); }} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"><option value="">All suppliers</option>{suppliers?.map((item) => <option key={item.user_id} value={item.user_id}>{item.company_name}</option>)}</select></label><label className="space-y-1.5 text-xs font-medium text-muted-foreground">Order status<select value={orderStatus} onChange={(e) => { setOrderStatus(e.target.value); setGenerated(false); }} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"><option value="">All statuses</option>{ORDER_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label></div></Card>
      <Card className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display font-semibold">Information to include</h2><p className="text-xs text-muted-foreground">Choose exactly what you want in the generated report. Nothing is selected by default.</p></div><Button type="button" variant="outline" size="sm" onClick={selectAllFields} disabled={!availableFields.length}>{allFieldsSelected ? "Clear all" : "Select all"}</Button></div><div className="grid gap-2 sm:grid-cols-2">{availableFields.map((field) => <label key={field} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm hover:bg-muted/40"><input type="checkbox" checked={selectedFields.includes(field)} onChange={() => toggleField(field)} className="size-4 accent-primary" /><span>{field}</span></label>)}</div></Card>
      <Button className="w-full" onClick={generate} disabled={!selectedFields.length || categoriesLoading || suppliersLoading || previewLoading}>{previewLoading ? "Building preview…" : "Generate Report"}</Button>

      {generated && preview && <Card className="space-y-5 border-primary/30"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 font-display font-semibold"><Eye className="size-5 text-primary" />Report Preview</div><p className="text-xs text-muted-foreground">{reportTypes.join(" + ")} · {datePreset === "Custom" ? `${from || "—"} → ${to || "—"}` : datePreset}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs">Live data</span></div>
        {reportTypes.includes("Financial") && <section className="space-y-3"><h3 className="font-display font-semibold">Financial</h3><div className="grid gap-2 sm:grid-cols-3">{selectedFields.includes("Gross Sales") && <Metric label="Gross Sales" value={money(preview.gross)} />}{selectedFields.includes("Platform Revenue") && <Metric label="Platform Revenue" value={money(preview.platformRevenue)} />}{selectedFields.includes("Supplier Payouts") && <Metric label="Supplier Payouts" value={money(preview.supplierPayouts)} />}{selectedFields.includes("Supplier Wallet Balance") && <Metric label="Supplier Wallet Balance" value={money(preview.walletBalance)} />}{selectedFields.includes("Delivery Fees") && <Metric label="Delivery Fees" value={money(preview.delivery)} />}{selectedFields.includes("Commissions") && <Metric label="Supplier + Customer Commission" value={money(preview.supplierCommission + preview.customerCommission)} />}</div>{selectedFields.includes("Commissions") && <div className="grid gap-2 sm:grid-cols-2"><div className="rounded-xl border p-3 text-sm">Supplier commission <strong className="float-right">{money(preview.supplierCommission)}</strong></div><div className="rounded-xl border p-3 text-sm">Customer commission <strong className="float-right">{money(preview.customerCommission)}</strong></div></div>}</section>}
        {selectedFields.some((f) => ["Order Count", "Order Value", "Order Status", "Supplier", "Category", "Payment Status", "Created Date", "Order Details"].includes(f)) && <section className="space-y-3"><h3 className="font-display font-semibold">Orders</h3><div className="grid gap-2 sm:grid-cols-3"><Metric label="Paid Orders" value={String(preview.orders.length)} />{selectedFields.includes("Order Value") && <Metric label="Order Value" value={money(preview.gross)} />}</div>{(selectedFields.includes("Order Details") || selectedFields.includes("Created Date") || selectedFields.includes("Order Status") || selectedFields.includes("Payment Status")) && <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-xs"><thead className="bg-muted/50"><tr><th className="p-3">Order</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Payment</th><th className="p-3">Date</th></tr></thead><tbody>{preview.orders.map((o) => <tr key={o.id} className="border-t"><td className="p-3 font-medium">{o.order_number}</td><td className="p-3">{money(Number(o.amount))}</td><td className="p-3">{titleCase(String(o.status))}</td><td className="p-3">{o.payment_status}</td><td className="p-3">{new Date(o.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>}</section>}
        {reportTypes.includes("Suppliers") && selectedFields.some((f) => ["Supplier Count", "Verified Suppliers", "Pending Verification", "Wallet Balance", "Completed Orders", "Response Rate"].includes(f)) && <section className="space-y-3"><h3 className="font-display font-semibold">Suppliers</h3><div className="grid gap-2 sm:grid-cols-3">{selectedFields.includes("Supplier Count") && <Metric label="Supplier Count" value={String(preview.filteredSuppliers.length)} />}{selectedFields.includes("Verified Suppliers") && <Metric label="Verified Suppliers" value={String(preview.filteredSuppliers.filter((s) => s.verified || s.verification_status === "verified").length)} />}{selectedFields.includes("Pending Verification") && <Metric label="Pending Verification" value={String(preview.filteredSuppliers.filter((s) => !s.verified && s.verification_status !== "verified").length)} />}</div></section>}
        {reportTypes.includes("Disputes") && selectedFields.some((f) => ["Dispute Count", "Open Disputes", "Resolved Disputes", "Categories", "Resolution Actions", "Resolution Time"].includes(f)) && <section className="space-y-3"><h3 className="font-display font-semibold">Disputes</h3><div className="grid gap-2 sm:grid-cols-3">{selectedFields.includes("Dispute Count") && <Metric label="Disputes" value={String(preview.disputes.length)} />}{selectedFields.includes("Open Disputes") && <Metric label="Open" value={String(preview.disputes.filter((d) => d.status === "open").length)} />}{selectedFields.includes("Resolved Disputes") && <Metric label="Resolved" value={String(preview.disputes.filter((d) => d.status === "resolved").length)} />}</div></section>}
        {reportTypes.includes("Customers") && selectedFields.some((f) => ["Customer Count", "Order Count", "Total Spending", "Average Order Value"].includes(f)) && <section className="space-y-3"><h3 className="font-display font-semibold">Customers</h3><div className="grid gap-2 sm:grid-cols-3">{selectedFields.includes("Customer Count") && <Metric label="Customers" value={String(new Set(preview.orders.map((o) => o.customer_id)).size)} />}{selectedFields.includes("Order Count") && <Metric label="Orders" value={String(preview.orders.length)} />}{selectedFields.includes("Total Spending") && <Metric label="Total Spending" value={money(preview.gross)} />}{selectedFields.includes("Average Order Value") && <Metric label="Average Order Value" value={money(preview.orders.length ? preview.gross / preview.orders.length : 0)} />}</div></section>}
        <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">This is a real-time preview from the selected filters. Save and Download PDF will be added after this preview is verified.</div>
      </Card>}
    </Page>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}
