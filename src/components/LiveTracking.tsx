import { useEffect, useState } from "react";
import { MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export type Tracking = {
  order_id: string;
  lat: number | null;
  lng: number | null;
  eta_at: string | null;
  sharing: boolean;
  updated_at: string;
};

// The tracking table is newer than the generated types, so access it loosely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trackingTable = () => (supabase as any).from("delivery_tracking");

/** Subscribes to live courier position for one order. */
export function useLiveTracking(orderId: string | undefined) {
  const [tracking, setTracking] = useState<Tracking | null>(null);
  useEffect(() => {
    if (!orderId) return;
    let alive = true;
    void trackingTable()
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle()
      .then(({ data }: { data: Tracking | null }) => alive && setTracking(data));
    const channel = supabase
      .channel(`tracking-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_tracking", filter: `order_id=eq.${orderId}` },
        (payload) => setTracking(payload.new as Tracking),
      )
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [orderId]);
  return tracking;
}

/** Re-runs `onChange` whenever the order row changes (status updates). */
export function useOrderRealtime(orderId: string | undefined, onChange: () => void) {
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => onChange(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);
}

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(i);
  }, [ms]);
  return now;
}

export function LiveTrackingPanel({ orderId, compact = false }: { orderId: string; compact?: boolean }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const tracking = useLiveTracking(orderId);
  const now = useNow();

  if (!tracking || tracking.lat == null || tracking.lng == null) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="size-4" />
        {ar ? "لا يوجد موقع مباشر للمندوب بعد" : "No live courier location yet"}
      </p>
    );
  }

  const ageMin = Math.max(0, Math.round((now - new Date(tracking.updated_at).getTime()) / 60000));
  const etaMin = tracking.eta_at
    ? Math.max(0, Math.round((new Date(tracking.eta_at).getTime() - now) / 60000))
    : null;
  const live = tracking.sharing && ageMin < 3;
  const d = 0.006;
  const bbox = `${tracking.lng - d},${tracking.lat - d},${tracking.lng + d},${tracking.lat + d}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${tracking.lat},${tracking.lng}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className={`flex items-center gap-1.5 font-medium ${live ? "text-success" : "text-muted-foreground"}`}>
          <span className={`size-2 rounded-full ${live ? "animate-pulse bg-success" : "bg-muted-foreground"}`} />
          {live ? (ar ? "مباشر" : "Live") : ar ? "آخر موقع معروف" : "Last known location"}
        </span>
        {etaMin != null && (
          <span className="flex items-center gap-1 text-foreground">
            <Clock className="size-3.5" />
            {ar ? "الوصول المتوقع" : "ETA"}: {etaMin === 0 ? (ar ? "الآن" : "arriving") : `${etaMin} ${ar ? "دقيقة" : "min"}`}
            {" · "}
            {new Date(tracking.eta_at!).toLocaleTimeString(ar ? "ar" : "en", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <span className="text-muted-foreground">
          {ar ? "تحديث منذ" : "Updated"} {ageMin} {ar ? "د" : "min ago"}
        </span>
      </div>
      <iframe
        title="Courier location"
        src={src}
        loading="lazy"
        className={`w-full rounded-xl border border-border ${compact ? "h-40" : "h-56"}`}
      />
    </div>
  );
}
