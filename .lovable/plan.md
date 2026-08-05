# MazzadTech Build Plan

## Goal
Transform the remixed project into a production-grade reverse-auction electronics marketplace for the Palestinian market, serving four parties: Customers, Suppliers, Delivery Companies, and Platform Administration.

## Guiding principles
- Keep current functionality working while adding features.
- Customers and Suppliers never see each other's real identity; only Admin sees real names, contacts, and company identity.
- Build mobile-first, bilingual Arabic/English with full RTL/LTR support.
- Wire flows end-to-end, not as isolated UI screens.

## Build Sequence

### Phase 1: Features & flow (core product logic)
1. Extend the role system to four parties: customer, supplier, delivery, admin.
2. Refactor the AI Assistant into a multi-turn, situation-based conversation that produces a structured technical specification.
3. Build the request lifecycle: draft → open → bidding → awarded → closed.
4. Implement supplier bidding with match-ratio scoring and human-readable match reasons.
5. Add customer offer comparison and acceptance flow.
6. Wire order creation, payment hold, commission deduction, and supplier payout logic.
7. Enforce identity anonymity across all customer/supplier touch points.
8. Add delivery-company assignment, status/location updates, and proof-of-delivery.
9. Add dispute filing and resolution flow.
10. Add post-order ratings and supplier performance metrics.
11. Build admin operations: verification, disputes, commissions, categories, users, reports.

### Phase 2: Data & backend
1. Extend `app_role` enum with `delivery`.
2. Add `delivery_companies` table and role wiring in the signup trigger.
3. Add `wallets` and `transactions` tables for customer balances, supplier payouts, and platform commission.
4. Add `disputes` and `ratings` tables.
5. Update RLS policies and GRANTs for every new table.
6. Update `handle_new_user()` trigger to support delivery-company signups.
7. Add server functions for requests, offers, orders, wallets, disputes, ratings, and admin reports.

### Phase 3: Design direction
1. Apply blue & white palette with deep teal/blue gradient hero/banner sections.
2. Use fully rounded UI elements and clean card-based layouts.
3. Implement site-wide RTL (Arabic) / LTR (English) switching with direction-aware spacing.
4. Add a hamburger navigation drawer in the header.
5. Add a fixed bottom navigation bar with icons and labels for each role.
6. Update AppShell, header, footer, cards, forms, and buttons.

### Phase 4: Branding & copy
1. Finalize the landing page with "Why MazzadTech" benefits, FAQ, and trust signals.
2. Update footer with support email (backwalaa@gmail.com), phone (999), and copyright.
3. Add full Arabic translations and copy.
4. Polish SEO meta tags and OG tags for every route.

## First milestone (start here)
Phase 1, Step 1: Role system + identity anonymity
- Extend the `app_role` enum and add a `delivery_companies` table.
- Update auth/signup to support customer, supplier, and delivery-company selection.
- Ensure all existing and new screens only expose alias, rating, verified badge, and completed-order count to counterparties; real identity is visible only to Admin.

## Notes
- This is a large project. Each phase will be built as a separate milestone and verified before moving to the next.
- We will use Lovable Cloud for the database and Lovable AI for the assistant.
- Phone OTP and social login (Google/Apple) will be configured when we reach the authentication milestone.
