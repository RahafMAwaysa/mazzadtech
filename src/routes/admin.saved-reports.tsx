import { createFileRoute } from "@tanstack/react-router";
import { FileText, Printer, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Button, Card } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/saved-reports")({
  head: () => ({ meta: [{ title: "Saved Reports — MazzadTech" }] }),
  component: () => <Guard roles={["admin"]}>{() => <SavedReports />}</Guard>,
});

type SavedReport = {
  id: string;
  title: string;
  params: Record<string, any>;
  content: Record<string, any>;
  created_at: string;
};

const money = (value: number) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function SavedReports() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [selected, setSelected] = useState<SavedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase
      .from("reports")
      .select("id, title, params, content, created_at")
      .not("admin_id", "is", null)
      .order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setReports((data ?? []) as SavedReport[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const remove = async (id: string) => {
    if (!window.confirm("Delete this saved report?")) return;
    const { error: deleteError } = await supabase.from("reports").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else {
      if (selected?.id === id) setSelected(null);
      setReports((current) => current.filter((report) => report.id !== id));
    }
  };

  return (
    <Page title="Saved Reports">
      <div className="space-y-4 print:hidden">
        <Card>
          <div className="flex items-center gap-2 font-display font-semibold"><FileText className="size-5 text-primary" />Saved Reports</div>
          <p className="mt-1 text-xs text-muted-foreground">Reports saved by your admin account remain available after logout and on other devices.</p>
        </Card>
        {error && <Card className="border-destructive/30 text-sm text-destructive">{error}</Card>}
        {loading ? <Card className="text-sm text-muted-foreground">Loading saved reports…</Card> : reports.length === 0 ? <Card className="text-sm text-muted-foreground">No saved reports yet. Generate a report and press Save.</Card> : reports.map((report) => (
          <Card key={report.id} className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelected(report)}>
              <div className="font-display font-semibold">{report.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">Saved {new Date(report.created_at).toLocaleString()}</div>
            </button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelected(report)}>Open</Button>
              <Button variant="outline" size="sm" onClick={() => void remove(report.id)} aria-label="Delete report"><Trash2 className="size-4" /></Button>
            </div>
          </Card>
        ))}
      </div>

      {selected && <Card className="mt-5 print:border-0 print:shadow-none" id="saved-report-preview">
        <div className="flex items-start justify-between gap-4 border-b pb-4">
          <div><div className="text-lg font-display font-bold">MazzadTech</div><h2 className="font-display font-semibold">{selected.title}</h2><p className="text-xs text-muted-foreground">Saved {new Date(selected.created_at).toLocaleString()}</p></div>
          <div className="flex gap-2 print:hidden"><Button size="sm" onClick={() => window.print()}><Printer className="mr-1 size-4" />Download PDF</Button><Button variant="outline" size="sm" onClick={() => setSelected(null)}>Close</Button></div>
        </div>
        <SavedContent content={selected.content} />
      </Card>}
    </Page>
  );
}

function SavedContent({ content }: { content: Record<string, any> }) {
  const rows = Array.isArray(content.rows) ? content.rows : [];
  const disputeRows = Array.isArray(content.disputeRows) ? content.disputeRows : [];
  const params = content.params ?? {};
  return <div className="space-y-6 pt-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Gross Sales" value={money(content.gross)} />
      <Metric label="Platform Revenue" value={money(content.platformRevenue)} />
      <Metric label="Supplier Payouts" value={money(content.supplierPayouts)} />
      <Metric label="Wallet Balance" value={money(content.walletBalance)} />
      <Metric label="Delivery Fees" value={money(content.delivery)} />
      <Metric label="Customer Count" value={String(content.customerCount ?? 0)} />
    </div>
    <div className="rounded-xl border p-4 text-sm">
      <div className="font-display font-semibold">Configuration</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 text-muted-foreground">
        <div>Types: <strong className="text-foreground">{Array.isArray(params.reportTypes) ? params.reportTypes.join(" + ") : "—"}</strong></div>
        <div>Date: <strong className="text-foreground">{params.datePreset || "—"}</strong></div>
        <div>Category: <strong className="text-foreground">{params.category || "All"}</strong></div>
        <div>Status: <strong className="text-foreground">{params.orderStatus || "All"}</strong></div>
      </div>
    </div>
    <section><h3 className="border-b pb-2 font-display font-semibold">Orders</h3><div className="mt-3 overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-muted/30"><th className="p-3">Order</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Payment</th><th className="p-3">Date</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="p-3">{row.order_number}</td><td className="p-3">{money(row.amount)}</td><td className="p-3">{row.status}</td><td className="p-3">{row.payment_status}</td><td className="p-3">{row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}</td></tr>)}{!rows.length && <tr><td colSpan={5} className="p-5 text-center text-muted-foreground">No orders in this saved report.</td></tr>}</tbody></table></div></section>
    <section><h3 className="border-b pb-2 font-display font-semibold">Disputes</h3><div className="mt-3 grid gap-3 sm:grid-cols-3"><Metric label="Total" value={String(disputeRows.length)} /><Metric label="Open" value={String(disputeRows.filter((d) => d.status === "open").length)} /><Metric label="Resolved" value={String(disputeRows.filter((d) => d.status === "resolved").length)} /></div></section>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-muted/20 p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-display text-xl font-bold">{value}</div></div>; }
