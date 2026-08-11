import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Eye, FileText, Filter, Printer, Save, SlidersHorizontal } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Button, Card, Input } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — MazzadTech" }, { name: "description", content: "Create, preview and save custom platform reports." }] }),
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
  const [preview, setPreview] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["admin-report-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("name").eq("active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: suppliers } = useQuery({
    queryKey: ["admin-report-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("supplier_profiles").select("user_id, company_name, verified, verification_status, completed_orders, response_rate").order("company_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const availableFields = useMemo(() => Array.from(new Set(reportTypes.flatMap((type) => FIELDS[type]))), [reportTypes]);
  const allFieldsSelected = availableFields.length > 0 && availableFields.every((field) => selectedFields.includes(field));

  const toggleReportType = (type: (typeof REPORT_TYPES)[number]) => {
    setReportTypes((current) => current.includes(type) ? (current.length === 1 ? current : current.filter((item) => item !== type)) : [...current, type]);
    setSelectedFields([]); setPreview(null); setSaved(false);
  };
  const toggleField = (field: string) => { setSelectedFields((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field]); setPreview(null); setSaved(false); };
  const selectAllFields = () => { setSelectedFields(allFieldsSelected ? [] : availableFields); setPreview(null); setSaved(false); };

  const getDateRange = () => {
    if (datePreset === "Custom") return { start: from ? new Date(`${from}T00:00:00`) : null, end: to ? new Date(`${to}T23:59:59.999`) : null };
    const now = new Date(); const start = new Date(now);
    if (datePreset === "Today") start.setHours(0, 0, 0, 0);
    if (datePreset === "This Week") { const day = start.getDay(); start.setDate(start.getDate() - (day === 0 ? 6 : day - 1)); start.setHours(0, 0, 0, 0); }
    if (datePreset === "This Month") { start.setDate(1); start.setHours(0, 0, 0, 0); }
    if (datePreset === "This Year") { start.setMonth(0, 1); start.setHours(0, 0, 0, 0); }
    return { start, end: now };
  };

  const generate = async () => {
    if (!selectedFields.length) return;
    setLoading(true); setError(""); setPreview(null); setSaved(false);
    try {
      const { start, end } = getDateRange();
      let query = supabase.from("orders").select("id, order_number, amount, commission, customer_commission, delivery_fee, payment_status, status, created_at, supplier_id, customer_id, request_id").eq("payment_status", "paid").order("created_at", { ascending: false });
      if (start) query = query.gte("created_at", start.toISOString());
      if (end) query = query.lte("created_at", end.toISOString());
      if (supplier) query = query.eq("supplier_id", supplier);
      if (orderStatus) query = query.eq("status", orderStatus);
      const [{ data: orders, error: ordersError }, { data: wallets, error: walletsError }, { data: walletTransactions, error: txError }, { data: disputes, error: disputesError }] = await Promise.all([
        query,
        supabase.from("wallets").select("id, supplier_id, balance"),
        supabase.from("wallet_transactions").select("wallet_id, order_id, amount, type, created_at"),
        supabase.from("disputes").select("id, order_id, category, status, resolution_action, created_at, resolved_at, filed_by_role"),
      ]);
      if (ordersError) throw ordersError;
      if (walletsError) throw walletsError;
      if (txError) throw txError;
      if (disputesError) throw disputesError;

      let rows = orders ?? [];
      if (category && rows.length) {
        const ids = Array.from(new Set(rows.map((o) => o.request_id).filter(Boolean)));
        if (ids.length) {
          const { data: requests, error } = await supabase.from("requests").select("id, category").in("id", ids);
          if (error) throw error;
          const matching = new Set((requests ?? []).filter((r) => String(r.category ?? "").toLowerCase() === category.toLowerCase()).map((r) => r.id));
          rows = rows.filter((o) => matching.has(o.request_id));
        } else rows = [];
      }

      const walletRows = wallets ?? [];
      const walletById = new Map(walletRows.map((w) => [w.id, w]));
      const rowIds = new Set(rows.map((o) => o.id));
      const credits = (walletTransactions ?? []).filter((t) => t.type === "credit" && t.order_id && rowIds.has(t.order_id));
      const gross = rows.reduce((s, o) => s + Number(o.amount || 0), 0);
      const supplierCommission = rows.reduce((s, o) => s + Number(o.commission || 0), 0);
      const customerCommission = rows.reduce((s, o) => s + Number(o.customer_commission || 0), 0);
      const delivery = rows.reduce((s, o) => s + Number(o.delivery_fee || 0), 0);
      const supplierPayouts = credits.reduce((s, t) => s + Number(t.amount || 0), 0);
      const walletBalance = supplier ? walletRows.filter((w) => w.supplier_id === supplier).reduce((s, w) => s + Number(w.balance || 0), 0) : walletRows.reduce((s, w) => s + Number(w.balance || 0), 0);
      const customerIds = new Set(rows.map((o) => o.customer_id));
      const disputeRows = (disputes ?? []).filter((d) => rowIds.has(d.order_id));
      const supplierRows = (suppliers ?? []).filter((s) => !supplier || s.user_id === supplier);
      setPreview({ rows, gross, supplierCommission, customerCommission, delivery, supplierPayouts, walletBalance, platformRevenue: supplierCommission + customerCommission, disputeRows, supplierRows, customerCount: customerIds.size, credits, walletById });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build the report preview.");
    } finally { setLoading(false); }
  };

  const saveReport = () => {
    if (!preview) return;
    const existing = JSON.parse(localStorage.getItem("mazzadtech_saved_reports") || "[]");
    existing.unshift({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), reportTypes, datePreset, from, to, category, supplier, orderStatus, selectedFields, preview });
    localStorage.setItem("mazzadtech_saved_reports", JSON.stringify(existing.slice(0, 20)));
    setSaved(true);
  };

  return (
    <Page title="Reports">
      <div className="print:hidden space-y-4">
        <Card className="space-y-1"><div className="flex items-center gap-2 font-display font-semibold"><FileText className="size-5 text-primary" />Generate a Report</div><p className="text-xs text-muted-foreground">Choose the data you need. The report is generated only after you request it.</p></Card>
        <Card className="space-y-4"><div className="flex items-center gap-2 font-display font-semibold"><SlidersHorizontal className="size-4 text-primary" />Report type <span className="text-xs font-normal text-muted-foreground">(select multiple)</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{REPORT_TYPES.map((type) => { const selected = reportTypes.includes(type); return <button key={type} type="button" onClick={() => toggleReportType(type)} aria-pressed={selected} className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>{type}</button>; })}</div></Card>
        <Card className="space-y-4"><div className="flex items-center gap-2 font-display font-semibold"><CalendarDays className="size-4 text-primary" />Date range</div><div className="flex flex-wrap gap-2">{DATE_PRESETS.map((preset) => <button key={preset} type="button" onClick={() => { setDatePreset(preset); setPreview(null); }} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${datePreset === preset ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{preset}</button>)}</div>{datePreset === "Custom" && <div className="grid grid-cols-2 gap-3"><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); }} /><Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreview(null); }} /></div>}</Card>
        <Card className="space-y-4"><div className="flex items-center gap-2 font-display font-semibold"><Filter className="size-4 text-primary" />Filters</div><div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1.5 text-xs font-medium text-muted-foreground">Category<select value={category} onChange={(e) => { setCategory(e.target.value); setPreview(null); }} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"><option value="">All categories</option>{categories?.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><label className="space-y-1.5 text-xs font-medium text-muted-foreground">Supplier<select value={supplier} onChange={(e) => { setSupplier(e.target.value); setPreview(null); }} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"><option value="">All suppliers</option>{suppliers?.map((item) => <option key={item.user_id} value={item.user_id}>{item.company_name}</option>)}</select></label><label className="space-y-1.5 text-xs font-medium text-muted-foreground">Order status<select value={orderStatus} onChange={(e) => { setOrderStatus(e.target.value); setPreview(null); }} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"><option value="">All statuses</option>{ORDER_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label></div></Card>
        <Card className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display font-semibold">Information to include</h2><p className="text-xs text-muted-foreground">Nothing is selected by default.</p></div><Button type="button" variant="outline" size="sm" onClick={selectAllFields}>{allFieldsSelected ? "Clear all" : "Select all"}</Button></div><div className="grid gap-2 sm:grid-cols-2">{availableFields.map((field) => <label key={field} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={selectedFields.includes(field)} onChange={() => toggleField(field)} className="size-4 accent-primary" /><span>{field}</span></label>)}</div></Card>
        <Button className="w-full" onClick={generate} disabled={!selectedFields.length || loading}>{loading ? "Building preview…" : "Generate Report"}</Button>
        {error && <Card className="border-destructive/30 text-sm text-destructive">{error}</Card>}
      </div>

      {preview && <Card className="mt-5 border-primary/30 print:border-0 print:shadow-none" id="report-preview">
        <div className="flex items-start justify-between gap-4 border-b pb-4"><div><div className="text-lg font-display font-bold">MazzadTech</div><div className="flex items-center gap-2 font-display font-semibold"><Eye className="size-5 text-primary print:hidden" />Report Preview</div><p className="text-xs text-muted-foreground">{reportTypes.join(" + ")} · {datePreset === "Custom" ? `${from || "—"} → ${to || "—"}` : datePreset} · Generated {new Date().toLocaleString()}</p></div><div className="print:hidden flex gap-2"><Button variant="outline" size="sm" onClick={saveReport}><Save className="mr-1 size-4" />{saved ? "Saved" : "Save"}</Button><Button size="sm" onClick={() => window.print()}><Printer className="mr-1 size-4" />Download PDF</Button></div></div>

        {reportTypes.includes("Financial") && <ReportSection title="Financial">{selectedFields.includes("Gross Sales") && <Metric label="Gross Sales" value={money(preview.gross)} />}{selectedFields.includes("Platform Revenue") && <Metric label="Platform Revenue" value={money(preview.platformRevenue)} />}{selectedFields.includes("Supplier Payouts") && <Metric label="Supplier Payouts" value={money(preview.supplierPayouts)} />}{selectedFields.includes("Supplier Wallet Balance") && <Metric label="Supplier Wallet Balance" value={money(preview.walletBalance)} />}{selectedFields.includes("Delivery Fees") && <Metric label="Delivery Fees" value={money(preview.delivery)} />}{selectedFields.includes("Commissions") && <Metric label="Total Commissions" value={money(preview.supplierCommission + preview.customerCommission)} />}{selectedFields.includes("Commissions") && <div className="col-span-full grid gap-2 sm:grid-cols-2"><Detail label="Supplier commission" value={money(preview.supplierCommission)} /><Detail label="Customer commission" value={money(preview.customerCommission)} /></div>}</ReportSection>}

        {reportTypes.includes("Orders") && <ReportSection title="Orders">{selectedFields.includes("Order Count") && <Metric label="Paid Orders" value={String(preview.rows.length)} />}{selectedFields.includes("Order Value") && <Metric label="Order Value" value={money(preview.gross)} />}{selectedFields.includes("Order Status") && <Detail label="Status filter" value={orderStatus ? titleCase(orderStatus) : "All"} />}{selectedFields.includes("Order Details") || selectedFields.includes("Order Count") ? <OrderTable rows={preview.rows} /> : null}</ReportSection>}

        {reportTypes.includes("Suppliers") && <ReportSection title="Suppliers">{selectedFields.includes("Supplier Count") && <Metric label="Suppliers" value={String(preview.supplierRows.length)} />}{selectedFields.includes("Verified Suppliers") && <Metric label="Verified" value={String(preview.supplierRows.filter((s) => s.verified).length)} />}{selectedFields.includes("Pending Verification") && <Metric label="Pending" value={String(preview.supplierRows.filter((s) => s.verification_status !== "verified").length)} />}{selectedFields.includes("Wallet Balance") && <Metric label="Wallet Balance" value={money(preview.walletBalance)} />}{selectedFields.includes("Completed Orders") && <Metric label="Completed Orders" value={String(preview.supplierRows.reduce((s, x) => s + Number(x.completed_orders || 0), 0))} />}{selectedFields.includes("Response Rate") && <Metric label="Avg Response Rate" value={preview.supplierRows.length ? `${Math.round(preview.supplierRows.reduce((s, x) => s + Number(x.response_rate || 0), 0) / preview.supplierRows.length)}%` : "0%"} />}</ReportSection>}

        {reportTypes.includes("Customers") && <ReportSection title="Customers">{selectedFields.includes("Customer Count") && <Metric label="Customers" value={String(preview.customerCount)} />}{selectedFields.includes("Order Count") && <Metric label="Orders" value={String(preview.rows.length)} />}{selectedFields.includes("Total Spending") && <Metric label="Total Spending" value={money(preview.gross + preview.customerCommission)} />}{selectedFields.includes("Average Order Value") && <Metric label="Average Order Value" value={money(preview.rows.length ? preview.gross / preview.rows.length : 0)} />}{selectedFields.includes("Delivery Preferences") && <Detail label="Delivery fees in selected orders" value={money(preview.delivery)} />}</ReportSection>}

        {reportTypes.includes("Disputes") && <ReportSection title="Disputes">{selectedFields.includes("Dispute Count") && <Metric label="Disputes" value={String(preview.disputeRows.length)} />}{selectedFields.includes("Open Disputes") && <Metric label="Open" value={String(preview.disputeRows.filter((d) => d.status === "open").length)} />}{selectedFields.includes("Resolved Disputes") && <Metric label="Resolved" value={String(preview.disputeRows.filter((d) => d.status === "resolved").length)} />}{selectedFields.includes("Categories") && <Detail label="Categories" value={Array.from(new Set(preview.disputeRows.map((d) => d.category))).join(", ") || "None"} />}{selectedFields.includes("Resolution Actions") && <Detail label="Resolution actions" value={Array.from(new Set(preview.disputeRows.map((d) => d.resolution_action).filter(Boolean))).map(titleCase).join(", ") || "None"} />}{selectedFields.includes("Resolution Time") && <Detail label="Resolved disputes" value={`${preview.disputeRows.filter((d) => d.resolved_at).length} with resolution date`} />}</ReportSection>}
      </Card>}
    </Page>
  );
}

type ReportData = {
  rows: any[]; gross: number; supplierCommission: number; customerCommission: number; delivery: number; supplierPayouts: number; walletBalance: number; platformRevenue: number; disputeRows: any[]; supplierRows: any[]; customerCount: number; credits: any[]; walletById: Map<string, any>;
};

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-6 space-y-3"><h2 className="border-b pb-2 font-display text-base font-semibold">{title}</h2><div className="grid gap-3 sm:grid-cols-3">{children}</div></section>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-muted/20 p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-display text-xl font-bold">{value}</div></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border p-3 text-sm"><span className="text-muted-foreground">{label}</span><strong className="float-right">{value}</strong></div>; }
function OrderTable({ rows }: { rows: any[] }) { return <div className="col-span-full overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-muted/30"><th className="p-3">Order</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Payment</th><th className="p-3">Date</th></tr></thead><tbody>{rows.map((o) => <tr key={o.id} className="border-b last:border-0"><td className="p-3 font-medium">{o.order_number}</td><td className="p-3">{money(Number(o.amount || 0))}</td><td className="p-3">{titleCase(o.status)}</td><td className="p-3">{titleCase(o.payment_status)}</td><td className="p-3">{new Date(o.created_at).toLocaleDateString()}</td></tr>)}{!rows.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No paid orders match the selected filters.</td></tr>}</tbody></table></div>; }
