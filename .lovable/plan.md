# MazzadTech Build Plan

## Goal
Transform the remixed project into a production-grade reverse-auction electronics marketplace for the Palestinian market, serving four parties: Customers, Suppliers, Delivery Company, and Platform Administration.

## Guiding principles
- Keep current functionality working while adding features.
- Customers and Suppliers never see each other's real identity; only Admin sees real names, contacts, and company identity.
- Build mobile-first, bilingual Arabic/English with full RTL/LTR support.
- Wire flows end-to-end, not as isolated UI screens.
- Keep operationally simple where possible — avoid over-engineering parts of the system that don't need it yet (e.g., delivery logistics).

## Build Sequence

### Phase 1: Features & flow (core product logic)
- Extend the role system to four parties: customer, supplier, delivery, admin.
- Refactor the AI Assistant into a multi-turn, situation-based conversation (supporting text, voice, and image input) that produces a structured technical specification form with individual fields per spec (not a single paragraph).
- Let the customer edit the generated form directly per field, or jump back into the AI conversation for a specific field to clarify/adjust it.
- Capture an optional free-text customer priority note (e.g., "price matters most to me") to bias match-ratio ranking — no numeric weight sliders.
- Build the request lifecycle: draft → open → bidding → awarded → closed, with no auction time limit (stays open until the customer manually selects a winning bid).
- Allow the customer to edit or cancel their request as long as no bids have been submitted yet.
- Implement supplier bidding with: price (validated to never exceed the customer's stated budget), warranty duration (preset dropdown), delivery/preparation time (preset dropdown), dynamic spec fields mirroring the customer's requested spec, a mandatory product video upload, and an optional free-text note.
- Let suppliers see the count/value of competing bids on the same request, without revealing competitor identities.
- Compute match-ratio scoring with human-readable match reasons AND a transparent list of unmet criteria per offer.
- Add customer offer comparison and acceptance flow.
- Wire order creation, electronic payment only (no COD in this phase), commission deduction from both customer and supplier sides, and instant automatic supplier payout to their wallet.
- Enforce identity anonymity across all customer/supplier touch points (bids, chat, ratings, order history) — only Admin can see real identities.
- Add a simple delivery flow: a single onboarded delivery-company account can view the list of orders assigned to them and manually update status (e.g., Received from Supplier → In Transit → Delivered). With small map icon when clicked opens live GPS map, ETA calculation for customer and admin just.
- Require explicit customer confirmation ("Mark as Received") plus a mandatory 1–5 star rating with an optional comment to close out an order (this is the proof-of-delivery mechanism).
- Add dispute filing (separate submission forms for customer/supplier) with AI-driven initial triage/categorization, admin review, optional admin-initiated chat with one or both parties, and admin resolution actions (refund, deduct from supplier balance, warn/suspend supplier).
- Add post-order ratings (both directions, 1–5 stars + comment) and supplier performance metrics, always identity-anonymized.
- Add AI-powered customer support with escalation to a real human agent.
- Add external push notifications only (no in-app notification center) for: new matching auction to supplier, new offer to customer, admin verification warnings, wallet transfer confirmations.
- Allow guest browsing of the public landing page; require account registration only when the customer starts an actual auction request.
- Build admin operations: supplier verification queue (approve/reject/request-more-info with notes), disputes, commission control (per-category % + global default %), category management (add/edit/delete), user management (search by name/ID/phone/email, automatic smart segmentation like VIP/new/inactive for customers and trusted/new/low-rated for suppliers, AI-driven automatic discount engine with push notification + auto-applied discount, suspend/ban with logged reason, full user history), and an overview dashboard with drill-down analytics.
- Add supplier ad-hoc reporting: text/chart/both, exportable to PDF, with an archive of past reports, configurable via manual filters (dropdowns/radio buttons) or AI-assisted natural-language report requests.
- Support multiple saved payment cards (masked, PCI-style — last 4 digits only) and multiple saved delivery addresses in the customer profile, selectable or addable at checkout.
- Automatically generate a transaction contract/invoice the moment an order is successfully completed, referencing the customer, supplier, and delivery company, plus price, quantity, order date, and the platform commission deducted (broken down as customer-side and supplier-side). Produce three privacy-aware versions of the same document, all sharing the same integrity hash: Admin version — fully unredacted, showing real names/identities of all parties (customer, supplier, delivery company) for legal/tax record-keeping. Customer version — shows the customer's own real identity, but displays the supplier only as a verified business/trade name or "Verified Supplier #ID" — never personal contact info. Supplier version — shows the supplier's own real identity, but displays the customer only as "Customer #ID" — never personal contact info. Automatically deliver each version to its respective party immediately after order completion (in-app + email), and permanently archive it under that party's own order history. Allow each party to download their version as a PDF directly from their Order History page at any time.

### Phase 2: Data & backend
- Extend `app_role` enum with `delivery`.
- Add a delivery_company table/entity and role wiring in the signup trigger (kept simple — a single company record for now, no complex multi-provider logic needed).
- Add categories table with a per-category commission percentage (supplier side and customer side) and a global default percentage fallback.
- Add wallets and transactions tables for supplier payouts and platform commission tracking (customer side does not need a wallet — payments are direct).
- Add disputes and ratings tables.
- Add reports table to archive supplier-generated ad-hoc reports.
- Update RLS policies and GRANTs for every new table, enforcing identity-anonymity rules at the data layer (customers/suppliers query views that exclude each other's PII; only Admin role bypasses this).
- Update `handle_new_user()` trigger to support delivery-company signups.
- Add server functions for requests, offers, orders, wallets, disputes, ratings, categories, and admin reports.
- Add a transaction_contracts table storing: order reference, seller/buyer/delivery-company references, price, quantity, commission breakdown, timestamp, and a SHA-256 integrity hash computed from the full unredacted record at creation time. The hash must be stored immutably; any later tampering with the underlying record must cause hash verification to fail, proving tampering — no need for a full blockchain, just hash-based tamper-evidence.
- Add server-side rendering logic to generate the three redaction levels (Admin/Customer/Supplier) from the single source-of-truth record, and a PDF export endpoint accessible from each party's Order History page.

### Phase 3: Design direction
- Apply the blue & white color palette with deep teal/blue gradient hero/banner sections.
- Apply rounded UI elements (buttons, cards) consistently across all screens.
- Implement full bilingual support: Arabic (RTL, primary) and English (LTR), with a site-wide language toggle.
- Apply contextual iconography as specified: chat bubble+heart, gavel, sparkles/match-ratio, green checkmark (verified), blue shield (secure payment), headset (support).
- Ensure mobile-first responsive layouts across all four role dashboards.

### Phase 4: Branding and copy
- Finalize the landing page hero copy, "How It Works" steps, and "Trust & Security" section using the exact content already defined in the spec.
- Add the "Why MazzadTech" benefits section with dedicated cards for each party (Customer, Supplier, Delivery Company).
- Add an FAQ section covering: what reverse auction means, payment security, identity privacy, cancellation policy, delivery tracking, and dispute/support process.
- Add a footer with: brand logo + tagline, contact info (support email, phone/WhatsApp), quick links (About, FAQ), social media icons, and copyright line.

## First milestone (start here)
Phase 1, Step 1: Role system + identity anonymity
- Extend the `app_role` enum and add a `delivery_companies` table.
- Update auth/signup to support customer, supplier, and delivery-company selection.
- Ensure all existing and new screens only expose alias, rating, verified badge, and completed-order count to counterparties; real identity is visible only to Admin.

## Notes
- This is a large project. Each phase will be built as a separate milestone and verified before moving to the next.
- We will use Lovable Cloud for the database and Lovable AI for the assistant.
- Simple email and password login and signup will be built first, in the first milestone. Phone OTP and social login (Google/Apple) will be configured later when we reach the extended authentication milestone.
