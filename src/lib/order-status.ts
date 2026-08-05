export const ORDER_FLOW = ["confirmed", "preparing", "verified", "shipping", "delivered"] as const;

export type OrderStatus = (typeof ORDER_FLOW)[number] | "cancelled";

export function statusKey(status: string) {
  return (status === "verified" ? "verifiedStep" : status) as
    | "confirmed"
    | "preparing"
    | "verifiedStep"
    | "shipping"
    | "delivered"
    | "cancelled";
}
