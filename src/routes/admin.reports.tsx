import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileText, Filter, SlidersHorizontal } from "lucide-react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Button, Card, Input } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Reports — MazzadTech" },
      { name: "description", content: "Create a custom platform report when you need it." },
    ],
  }),
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

function Body() {
  const [reportTypes, setReportTypes] = useState<(typeof REPORT_TYPES)[number][]>(["Financial"]);
  const [datePreset, setDatePreset] = useState<(typeof DATE_PRESETS)[number]>("This Month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>(FIELDS.Financial);
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
      const { data, error } = await supabase.from("supplier_profiles").select("user_id, company_name").order("company_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleReportType = (type: (typeof REPORT_TYPES)[number]) => {
    setReportTypes((current) => {
      if (current.includes(type)) {
        if (current.length === 1) return current;
        const next = current.filter((item) => item !== type);
        setSelectedFields((fields) => fields.filter((field) => next.some((selectedType) => FIELDS[selectedType].includes(field))));
        return next;
      }
      const next = [...current, type];
      setSelectedFields((fields) => Array.from(new Set([...fields, ...FIELDS[type]])));
      return next;
    });
    setGenerated(false);
  };

  const availableFields = Array.from(new Set(reportTypes.flatMap((type) => FIELDS[type])));

  const toggleField = (field: string) => {
    setSelectedFields((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field]);
    setGenerated(false);
  };

  const generate = () => setGenerated(true);

  return (
    <Page title="Reports">
      <Card className="space-y-1">
        <div className="flex items-center gap-2 font-display font-semibold"><FileText className="size-5 text-primary" />Generate a Report</div>
        <p className="text-xs text-muted-foreground">Choose one or more report types. Detailed data stays hidden until you request a report.</p>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2 font-display font-semibold"><SlidersHorizontal className="size-4 text-primary" />Report type <span className="text-xs font-normal text-muted-foreground">(select multiple)</span></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {REPORT_TYPES.map((type) => {
            const selected = reportTypes.includes(type);
            return <button key={type} type="button" onClick={() => toggleReportType(type)} aria-pressed={selected} className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted/50"}`}>{type}</button>;
          })}
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2 font-display font-semibold"><CalendarDays className="size-4 text-primary" />Date range</div>
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map((preset) => <button key={preset} type="button" onClick={() => setDatePreset(preset)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${datePreset === preset ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{preset}</button>)}
        </div>
        {datePreset === "Custom" && <div className="grid grid-cols-2 gap-3"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2 font-display font-semibold"><Filter className="size-4 text-primary" />Filters</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">Category<select value={category} onChange={(e) => { setCategory(e.target.value); setGenerated(false); }} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"><option value="">All categories</option>{categories?.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">Supplier<select value={supplier} onChange={(e) => { setSupplier(e.target.value); setGenerated(false); }} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"><option value="">All suppliers</option>{suppliers?.map((item) => <option key={item.user_id} value={item.user_id}>{item.company_name}</option>)}</select></label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">Order status<select value={orderStatus} onChange={(e) => { setOrderStatus(e.target.value); setGenerated(false); }} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"><option value="">All statuses</option>{ORDER_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
        </div>
      </Card>

      <Card className="space-y-4">
        <div><h2 className="font-display font-semibold">Information to include</h2><p className="text-xs text-muted-foreground">Select the sections you want in the generated report.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {availableFields.map((field) => (
            <label key={field} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm hover:bg-muted/40">
              <input type="checkbox" checked={selectedFields.includes(field)} onChange={() => toggleField(field)} className="size-4 accent-primary" />
              <span>{field}</span>
            </label>
          ))}
        </div>
      </Card>

      <Button className="w-full" onClick={generate} disabled={!selectedFields.length || categoriesLoading || suppliersLoading}>Generate Report</Button>

      {generated && (
        <Card className="space-y-2 border-primary/30 bg-primary/5">
          <p className="font-display font-semibold">Report configuration ready</p>
          <p className="text-xs text-muted-foreground">{reportTypes.join(" + ")} · {datePreset}{datePreset === "Custom" ? ` · ${from || "—"} → ${to || "—"}` : ""}</p>
          <p className="text-xs text-muted-foreground">{selectedFields.length} sections selected{category ? ` · Category: ${category}` : ""}{supplier ? " · Supplier selected" : ""}{orderStatus ? ` · Status: ${orderStatus.replaceAll("_", " ")}` : ""}.</p>
          <p className="text-xs text-muted-foreground">The next step is to render this configuration as a report preview and then add Save / Download PDF.</p>
        </Card>
      )}
    </Page>
  );
}
