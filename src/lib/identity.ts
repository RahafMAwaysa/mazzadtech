import type { Role } from "@/lib/session";

/**
 * Identity anonymity rules for MazzadTech.
 *
 * Customers and Suppliers must NEVER see each other's real identity
 * (personal name, phone, email, or company contact details).
 * Only the Platform Administration sees real identities.
 *
 * Everything a counterparty is allowed to see goes through these helpers.
 */

/** Short, stable, non-identifying reference derived from a UUID. */
export function shortRef(id: string | null | undefined): string {
  if (!id) return "0000";
  return id.replace(/-/g, "").slice(0, 4).toUpperCase();
}

/** How a supplier is shown to a customer. */
export function supplierPublicName(
  viewerRole: Role | null,
  supplier: { alias?: string | null; company_name?: string | null; user_id?: string | null } | null,
): string {
  if (!supplier) return "Verified Supplier";
  if (viewerRole === "admin" || viewerRole === "delivery")
    return supplier.company_name ?? supplier.alias ?? "Supplier";
  // Trade alias only — never the legal/company contact identity.
  return supplier.alias ?? `Verified Supplier #${shortRef(supplier.user_id)}`;
}

/** How a customer is shown to a supplier or delivery company. */
export function customerPublicName(viewerRole: Role | null, customer: { id?: string | null; full_name?: string | null } | null): string {
  if (!customer) return "Customer";
  if (viewerRole === "admin" || viewerRole === "delivery")
    return customer.full_name ?? `Customer #${shortRef(customer.id)}`;
  return `Customer #${shortRef(customer.id)}`;
}

/** How a delivery company is shown to customers and suppliers. */
export function deliveryPublicName(
  viewerRole: Role | null,
  company: { alias?: string | null; company_name?: string | null } | null,
): string {
  if (!company) return "Delivery partner";
  if (viewerRole === "admin") return company.company_name ?? company.alias ?? "Delivery partner";
  return company.alias ?? "Delivery partner";
}

/** True when the viewer is allowed to see real personal identities. */
export function canSeeRealIdentities(viewerRole: Role | null): boolean {
  // Delivery partners need real names/phones to complete a handover.
  return viewerRole === "admin" || viewerRole === "delivery";
}
