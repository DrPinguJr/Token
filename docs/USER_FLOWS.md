# Tokenly User Flows

## Flow conventions

- Every route checks the current local session and role.
- Customer onboarding is independent from authentication and never blocks vendor, staff, or administrator accounts.
- Every mutation validates input, disables or guards duplicate submission, and provides pending, success, and recoverable error states.
- Every wallet mutation goes through the atomic transaction service and appends an audit record.
- “Verified” must never describe a PayNow payment in the local prototype.

## Local account entry

1. An operational user opens `/enter`.
2. The two-panel page presents the Tokenly × Big Blue Floorball identity on the
   left and a minimal operational login on the right.
3. The seeded super-admin signs in with username `AdminLance` and password `Lance888!`.
4. The account repository resolves the active seeded administrator; failures use a generic message.
5. The local session stores only the minimum session identifier and preference data.
6. The super-admin is routed to `/admin/dashboard`.
7. An account-entry audit event is appended without recording the password.
8. A tokener can open **QR mode** below the login and scan a same-origin
   one-time claim QR or private account QR.
9. QR mode rejects public vendor-payment wallet QRs and external URLs. If a
   private link is lost, an administrator refreshes the claim QR in
   `/admin/tokeners` and the tokener scans that refreshed QR.

Development mode may expose a role switcher for seeded accounts. Switching creates the same shaped local session and is visibly marked as a simulator.

## Customer onboarding

Route: `/customer/onboarding`

1. “Welcome to Tokenly.”
2. Explain event tokens in one short panel.
3. Introduce the wallet and its ledger-derived balance.
4. Confirm “You’re now a Tokener.”
5. Persist onboarding completion locally and append an audit event.
6. Enter `/customer`.

Requirements:

- Back/next controls retain progress.
- Completion is stored independently from the authentication session.
- A development-only skip records completion consistently.
- Animation is lightweight and disabled or reduced under `prefers-reduced-motion`.
- Vendor, staff, and administrator accounts are never redirected here.

## Customer views wallet and account QR

1. `/customer` loads event identity, customer name, and wallet read model.
2. The calculated balance is the strongest visual element.
3. Recent ledger activity and clear actions appear beneath it.
4. `/customer/wallet` shows ledger-derived history.
5. `/customer/wallet/qr` generates a QR from an opaque customer code.
6. Staff resolves that code to a customer through a repository; the code contains no balance, PIN, mobile number, or permission.

Empty, loading, IndexedDB error, and no-activity states remain usable.

## One-time claim and private account link

1. An administrator opens `/admin/tokeners`.
2. They select a customer, such as Lance, and display a one-time claim QR.
3. The claim QR links to `/claim/[claimCode]`.
4. Claiming succeeds only once and only before `claimExpiresAt`.
5. A successful claim marks the local customer record as claimed and reveals the stable private account link `/card/[privateAccessCode]`.
6. The private account page shows the customer display name, ledger-derived balance, recent activity, and the vendor-facing wallet QR.
7. The customer can bookmark or save that private account link.
8. The customer can regenerate the wallet QR from the private account page.
9. Regeneration changes only the vendor-facing wallet QR `publicCode` and immediately makes older wallet QR payloads fail lookup.
10. The private account link remains active and is never placed inside the wallet QR payload.

This is a local prototype recovery flow. The private link is bearer access in
browser-local data, not production authentication.

## Customer purchase

1. Customer opens `/customer/vendors` or scans/manually enters a vendor code.
2. `/customer/vendors/[vendorId]` shows the current vendor profile and available products.
3. Customer selects positive quantities and opens the basket.
4. `/customer/pay/[vendorId]` displays a review, not an authoritative total.
5. On confirmation, the purchase service reloads products from the repository.
6. It rejects missing, unavailable, sold-out, archived, or invalid-quantity items.
7. It recalculates the total using authoritative token prices.
8. Customer enters the four-digit wallet PIN for a single verification attempt.
9. `PinVerificationService` returns success, generic failure, or simulated-lockout state.
10. The service recalculates the customer balance and rejects overspending with “Not enough tokens.”
11. In one transaction, it creates:
    - a completed order with price snapshots;
    - customer debit entry;
    - vendor credit entry;
    - purchase audit entry.
12. The operation rejects a duplicate idempotency key.
13. A success receipt displays the reference, vendor, items, token total, and timestamp.

The basket remains recoverable after safe validation errors but is cleared only after a confirmed commit. Completed orders cannot be modified.

## Staff token issuance

Route: `/staff/issue`

1. Staff scans a customer QR, selects a seeded customer in the development simulator, or searches by allowed customer fields.
2. Staff reviews the resolved customer and current calculated balance.
3. The screen states that staff must manually check PayNow; Tokenly does not verify it.
4. Staff enters a positive PayNow amount.
5. The issuance service reads the current configured conversion rate and calculates the integer token amount according to the documented event-rate rule.
6. Staff captures or selects a screenshot.
7. The client validates supported image type and maximum file size before retaining local mock evidence.
8. Staff optionally enters a payment reference and note.
9. A matching normalized reference produces a duplicate warning and requires correction or an explicit, traceable continuation policy; it does not silently duplicate an issuance.
10. The review step shows customer, PayNow amount, rate, tokens, evidence metadata, reference, and note.
11. Staff confirms once.
12. In one transaction, the service creates evidence metadata, issuance, customer credit entry, and audit entries for evidence attachment/issuance.
13. A receipt clearly describes a locally recorded manual issuance.

Staff never edits a balance directly. Any commit failure leaves all related records uncommitted.

## Vendor product management

1. Vendor opens `/vendor/products`.
2. They create or edit a product through a Zod-validated form.
3. Token price is a positive integer; display order is a non-negative integer.
4. Availability, sold-out, and archived states are explicit.
5. Reordering persists deterministic display positions.
6. Create, update, and availability-state actions append actor-aware audit events.
7. Archived products disappear from customer sale views but remain traceable in historical order snapshots.

The vendor may preview `/vendor/storefront`, display `/vendor/qr`, and inspect transactions without changing ledger records.

## Vendor full or partial refund

1. Vendor opens a completed order from transaction history.
2. The UI shows original total, prior refunds, and remaining refundable tokens.
3. Vendor enters a positive integer amount no greater than the remaining amount.
4. Vendor enters a mandatory reason.
5. Vendor reviews customer, order, refund amount, and resulting remaining amount.
6. Vendor enters the prototype PIN.
7. The service verifies actor/vendor ownership, PIN, order state, cumulative refunds, and vendor balance.
8. In one transaction, it creates:
   - a refund record;
   - a reversing customer credit linked to the original customer debit;
   - a reversing vendor debit linked to the original vendor credit;
   - a refund audit entry.
9. The original order and ledger entries remain unchanged.
10. The receipt and both parties’ histories show full or partial status.

Duplicate idempotency, over-refund, invalid amount, insufficient vendor balance, and repeated submission are rejected safely.

## Administrator settlement recording

1. Administrator opens `/admin/settlements`.
2. They select a vendor and period.
3. The service derives eligible earned-token totals from authoritative records and existing settlement coverage.
4. Administrator creates a `draft` settlement with optional payout reference and notes.
5. A confirmation states that this is a manual record and no bank transfer occurs.
6. Allowed status transitions move the record to `approved` and then `paid`; invalid transitions are rejected.
7. Every create/update appends an audit event with actor and prior/new status.
8. Vendor settlement history shows the record as manually recorded.

## Administrator adjustment

1. Administrator opens the target wallet.
2. They choose credit or debit and enter a positive integer token amount.
3. They enter a mandatory, operational reason.
4. The review step shows actor, wallet owner, direction, amount, and projected balance.
5. The service rejects an overdrawing debit or duplicate idempotency key.
6. One transaction appends the adjustment ledger entry and audit record.
7. The balance is recalculated; no stored balance is assigned.

## Administrator adds customer credits

1. An administrator opens a customer profile from `/admin/tokeners`.
2. They choose **Add credits**, which opens a two-step modal.
3. Step 1 provides separate **Take photo** and **Upload image** controls for a
   HEIC, HEIF, JPEG, PNG, or WebP image of the PayNow confirmation or cash
   received and records the manual payment method. The image is limited to 10
   MB, and a valid selection advances directly to the amount step.
4. The screen states that the image is manual evidence and does not mean
   Tokenly verified the payment.
5. Step 2 requires a positive Singapore-dollar amount.
6. The service reads the current event conversion rate and derives a positive
   whole-token credit.
7. The image is uploaded under an opaque private storage key. Image bytes are
   never written into audit metadata.
8. One database transaction records the evidence row and evidence audit first,
   then appends the issuance, customer ledger credit, and issuance audit.
9. If the database transaction fails, the uploaded object is removed and no
   wallet credit is reported as complete.
10. The refreshed tokener profile shows the ledger-derived balance.

This is a manually recorded payment flow. It does not verify PayNow, cash, or
customer identity.

## Administrator transaction trace

1. Administrator searches or filters transactions.
2. They open `/admin/transactions/[transactionId]`.
3. The transaction-group query gathers linked:
   - actor account;
   - customer and customer wallet;
   - vendor and vendor wallet;
   - order;
   - evidence and issuance;
   - ledger entries;
   - refunds;
   - settlement where relevant;
   - audit entries.
4. The page separates missing/not-applicable relationships from load errors.
5. Links open related detail views without losing trace context.

Filtered CSV exports use the same query/filter semantics and safe, technical field labels.

The current incremental administrator activity page at `/admin/transactions`
loads ledger entries from Supabase. Before detailed trace relationships exist,
it shows issued, spent, refunded, and transaction-group metrics. A connected
database with no ledger entries displays zero metrics and an explicit empty
state rather than failing or implying local IndexedDB data.

## Camera and scan fallback

1. Scanner checks secure-context/browser support.
2. Before permission, it explains why camera access is needed.
3. While the camera starts, the video surface is already rendered so mobile
   browsers can establish playback.
4. On permission, the scanner displays a live preview and targeting frame and
   scans only expected Tokenly QR formats.
5. Denied, unavailable, invalid, and timed-out states offer manual code entry.
6. With development tools enabled, the simulator can choose a seeded customer or vendor.
7. Every path resolves an opaque code through the same validated lookup.

## Development data safety

No browser route exposes destructive reset or reseed controls. Deterministic
reset helpers are limited to isolated automated-test databases. A developer
recovering a broken local prototype must deliberately clear only Tokenly's site
data through browser settings.
