# Tokenly Security Model

## Scope and posture

Tokenly’s current deliverable is a browser-local prototype. It is not a secure payment system, identity provider, or production wallet. Security work in this phase protects integrity inside the prototype, avoids obvious data leakage, and preserves boundaries required for later server enforcement.

The UI must disclose:

- local operational credentials are prototype-only;
- tokeners access their QR page through a bearer private link;
- anyone with a tokener private link can open that account QR page;
- PayNow checks are manual and not automatically verified;
- evidence is retained locally as mock/prototype data;
- settlement records do not initiate bank transfers;
- development role switching and scan simulation are not production capabilities.

## Trust boundaries

Treat all of the following as untrusted:

- form fields and route parameters;
- QR payloads and manual scan codes;
- basket quantities and client-displayed totals;
- file names, MIME declarations, and uploaded evidence;
- localStorage/IndexedDB contents, which a browser user can edit;
- role/session values persisted by the prototype;
- CSV filter/query parameters.

Zod validation is necessary at each input boundary but does not make client execution trustworthy. Services must load authoritative repository records and apply business invariants again before mutation.

## Authorization matrix

| Capability                     |              Customer |                Vendor |                 Staff |                                 Administrator |
| ------------------------------ | --------------------: | --------------------: | --------------------: | --------------------------------------------: |
| View own wallet/activity       |                   Yes |                   Yes |                    No |                                       Inspect |
| Purchase from vendor           |                   Yes |                    No |                    No |                                            No |
| Show customer QR               |                   Own |                    No |                    No |                             Inspect code only |
| Manage vendor profile/products |                    No |            Own vendor |                    No | Inspect/manage only if explicitly implemented |
| Refund vendor order            |                    No |  Own vendor, with PIN |                    No |                                       Inspect |
| Search customers for issuance  |                    No |                    No |                   Yes |                                       Inspect |
| Issue tokens                   |                    No |                    No |                   Yes |                                       Inspect |
| Record settlements             |                    No |              View own |                    No |                                           Yes |
| Administrative adjustment      |                    No |                    No |                    No |                          Yes, reason required |
| Configure event settings       |                    No |                    No |                    No |                                           Yes |
| Reset/reseed/switch roles      | Development flag only | Development flag only | Development flag only |                         Development flag only |

Route guards improve navigation, but every sensitive service must validate actor role and relevant ownership. Client-only role checks are a prototype limitation and will move server-side in production.

## Wallet integrity controls

- Calculate balances from immutable ledger entries.
- Never expose or implement `setBalance`.
- Require positive integer amounts and quantities.
- Recalculate product prices and availability from repositories.
- Reject negative balance, duplicate idempotency, zero-item order, completed-order modification, and over-refund.
- Record an actor and transaction-group ID for every mutation.
- Commit related business, ledger, and audit records atomically.
- Abort a value mutation if its audit entry cannot be committed.
- Require a reason for administrative adjustments.
- Link refund entries to originals and preserve the originals.

Paired customer/vendor entries provide conservation inside purchase/refund transaction groups. Issuance and administrative adjustment are explicit sources or corrections, never disguised transfers.

## PIN handling

The prototype must expose a `PinVerificationService` abstraction so production verification can be replaced.

- Accept exactly four ASCII digits at the validation boundary.
- Do not write a PIN to logs, analytics, audit metadata, error messages, URLs, QR payloads, persistent form state, or screenshots.
- Do not retain plain-text PINs in ordinary React/global state after one verification attempt.
- Keep credential access behind the service/repository boundary.
- Use constant-shape generic failure messages for wrong PIN and unknown account.
- Lock an account after five consecutive failed attempts for five minutes. The
  fifth attempt returns the typed locked state, and the lock expires at its
  stored `lockedUntil` timestamp.
- Reset failed-attempt and lock state after successful verification.
- Audit a failed attempt without the attempted value.
- Update a failed-attempt counter and append its
  `pin_verification_failed` audit entry in one repository transaction.
- Allow first-time PIN setup only for the actor's own active customer or vendor
  account with an existing unconfigured credential record. A configured account
  must use the current-PIN-verified change operation instead.
- Treat verification and change attempts against an unconfigured credential as
  generic failures while still doing the fixed-shape prototype comparison.
- Append successful setup/change as `pin_setup` without PIN or credential
  metadata.

The development PIN `2468` is public test data and not a safe credential. Production requires server-side salted password hashing using a current password-hashing algorithm, server-side rate limiting, account recovery controls, monitoring, and secure secret handling.

Deterministic seed accounts do not persist that literal value. Their
`pinCredential` uses the prototype-only format
`prototype-sha256-v1$<lowercase-hex-digest>`, where the digest is SHA-256 over
the four ASCII PIN digits with no salt. The Phase 4 local
`PinVerificationService` reproduces that format with browser WebCrypto before
opening its repository transaction.
This deliberately simple, public format is not suitable for production
authentication and must not be logged or copied into audit metadata.

## Session handling

- Persist only the minimum account/session identifier and small UI preferences in localStorage.
- Resolve current account and role through the account repository.
- Clear session data on sign-out and reset only explicitly scoped preferences.
- Do not store full profiles, balances, ledger records, or evidence in localStorage.
- Reject role mismatch at the service boundary.

The prototype session is user-editable and not proof of identity. Production will require server-validated sessions.

## Evidence uploads

Local evidence is a mock PayNow screenshot, not a verified payment.

- Allow only the documented maintained set of raster image MIME types.
- Enforce a conservative maximum size before reading/storing.
- Ignore user-provided paths; use generated opaque storage keys.
- Escape/safely render filenames as text.
- Render images without executing active content.
- Store validation metadata and staff actor.
- Do not infer verification status from file presence.
- Do not log bytes or embed the image in audit metadata.

Production requires server-side MIME/signature validation, storage policies, retention rules, access checks, and malware scanning.

## QR safety

- Encode only an opaque public code or an internal route carrying it.
- Never encode PINs, balances, mobile numbers, private account details, or permissions.
- Validate scheme, origin/path, payload version, length, and character set.
- Resolve the opaque code through the repository and re-check expected entity type.
- Rate-limit lookup and scanning server-side in production.
- Offer manual entry when camera access is denied or unavailable.
- Keep the one-time claim QR, private account link, and vendor-facing wallet QR
  as separate local credentials.
- A one-time claim QR may reveal only the private account link, expires after
  its configured short window, and is marked used after a successful claim.
- The private account link is bearer access in the local prototype and must not
  be embedded in the vendor-facing wallet QR.
- Regenerating the wallet QR changes the vendor-facing customer public code and
  invalidates older wallet QR payloads without changing the private account
  link.

## Sensitive logging and error handling

Forbidden in console/error/audit output:

- PINs and credential representations;
- evidence bytes;
- secrets and environment values;
- local database dumps;
- unnecessary mobile numbers or private account data.

Customer-visible errors are short and safe. Operational errors use stable error codes and precise context without secrets. Audit descriptions are technical, not playful.

## CSV export safety

- Export only fields permitted for the administrator view.
- Apply the same filters and authorization as the on-screen query.
- Prefix spreadsheet-formula-leading values (`=`, `+`, `-`, `@`) safely.
- Use explicit UTC timestamp formatting and integer amounts.
- Avoid including credential, PIN-attempt detail, evidence bytes, or internal secrets.

## Development tools

Development routes and controls require `NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS=true`. The default is false.

- Hidden navigation alone is insufficient; route and action entry points must check the flag.
- Pages must display a persistent development/simulator label.
- Reset targets only the exact Tokenly database.
- Seed selection must use fictional records.
- Production builds should not enable the flag.

Because a `NEXT_PUBLIC_` value is visible to the browser, it is an availability switch, not a security control. Production deployment must remove/disable the tools and enforce privileged operations on a server.

## Future production controls

Deferred work includes:

- Supabase Auth and verified identity;
- Postgres constraints and server-side transactions;
- row-level security and least-privilege service roles;
- server-side PIN hashing, throttling, monitoring, and recovery;
- SMS OTP/mobile ownership verification;
- Supabase Storage policies, validation, retention, and malware scanning;
- real payment verification only through an approved, auditable integration;
- secure headers, origin protections, CSP, abuse controls, backups, and incident response;
- monitoring and reconciliation alerts;
- Vercel/environment secret configuration.

These controls must be designed and threat-modelled before treating Tokenly as production-ready.
