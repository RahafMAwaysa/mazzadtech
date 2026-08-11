import { createFileRoute, Navigate } from "@tanstack/react-router";

// Supplier order management now lives entirely inside My Offers.
// Keep this route as a compatibility redirect for old bookmarks/links.
export const Route = createFileRoute("/supplier/orders")({
  component: () => <Navigate to="/supplier/offers" replace />,
});
