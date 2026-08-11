export const ORDER_FLOW = [
  "confirmed",
  "preparing",
  "verified",
  "received_from_supplier",
  "in_transit",
  "shipping",
  "delivered",
  "completed",
] as const;

export type OrderStatus = (typeof ORDER_FLOW)[number] | "cancelled";

/** Statuses a delivery company may set, in order. */
export const COURIER_FLOW = ["received_from_supplier", "in_transit", "delivered"] as const;

export type StatusKey =
  | "confirmed"
  | "preparing"
  | "verifiedStep"
  | "receivedFromSupplier"
  | "inTransit"
  | "shipping"
  | "delivered"
  | "completed"
  | "cancelled";

const MAP: Record<string, StatusKey> = {
  confirmed: "confirmed",
  preparing: "preparing",
  verified: "verifiedStep",
  received_from_supplier: "receivedFromSupplier",
  in_transit: "inTransit",
  shipping: "shipping",
  delivered: "delivered",
  completed: "completed",
  cancelled: "cancelled",
};

export function statusKey(status: string): StatusKey {
  return MAP[status] ?? "confirmed";
}
