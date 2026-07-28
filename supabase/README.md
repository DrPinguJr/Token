# Future Supabase Integration

Supabase is **not configured in the current local prototype**. This directory contains planning material only:

- no Supabase project is linked;
- no CLI configuration is required;
- no migration has been created;
- no environment key is required;
- no remote command should be run.

`planned-schema.sql` is deliberately non-executable. It records proposed tables, relationships, constraints, and policy questions for a later production phase.

## Replacement boundary

The domain and service contracts should remain stable. Future work replaces these local facilities:

| Local prototype adapter/facility          | Future Supabase facility                                             |
| ----------------------------------------- | -------------------------------------------------------------------- |
| Local account repository                  | Supabase Auth identity plus `account_profiles` repository            |
| Local customer repository                 | `customers` Postgres repository                                      |
| Local wallet repository                   | `wallets` Postgres repository                                        |
| Local ledger entry repository             | Append-only `ledger_entries` repository with database constraints    |
| Local token issuance repository           | `token_issuances` Postgres repository                                |
| Local evidence repository/blob storage    | `evidence` metadata plus private Supabase Storage bucket             |
| Local vendor repository                   | `vendors` Postgres repository                                        |
| Local product repository                  | `products` Postgres repository                                       |
| Local order repository                    | `orders` and `order_items` Postgres repository                       |
| Local refund repository                   | `refunds` Postgres repository                                        |
| Local settlement repository               | `settlements` Postgres repository                                    |
| Local audit log repository                | Append-only `audit_logs` Postgres repository                         |
| Local event settings repository           | `events` and `event_settings` Postgres repository                    |
| IndexedDB transaction coordinator         | Server-side database transaction / security-definer RPC after review |
| localStorage session                      | Supabase Auth session managed with secure server integration         |
| Local PIN verification/lockout simulation | Server-side credential hashing and rate-limit/lockout service        |
| Development reset/reseed                  | Controlled non-production seed/migration workflow                    |

Likely code locations will be the adapter implementations below each module’s `repositories/` folder, the repository composition root under `src/config` or `src/shared/data`, the local session provider, the evidence storage adapter, and the atomic transaction service. Exact file names must be taken from the implemented source tree rather than invented in documentation.

## Production design requirements

Before converting the plan into migrations:

1. Confirm identity linkage between Supabase Auth users and account profiles.
2. Decide event tenancy and whether one user can participate in multiple events/roles.
3. Review all constraints, indexes, status transitions, and amount limits.
4. Move issuance, purchase, refund, adjustment, and settlement operations into server-controlled transactions.
5. Design row-level security for customers, vendors, staff, and administrators.
6. Prevent direct client inserts/updates to ledger and audit tables.
7. Establish immutable/append-only enforcement with restricted grants and database triggers where appropriate.
8. Define idempotency scope and uniqueness in the database.
9. Add private Storage policies, server-side file signature/size checks, retention, and malware scanning.
10. Implement server-side PIN hashing, throttling, lockout, recovery, logging, and monitoring.
11. Add verified mobile ownership only through an approved authentication flow.
12. Decide how real PayNow verification and vendor payouts will be integrated and reconciled.
13. Define backups, point-in-time recovery, data retention, privacy, incident response, and observability.
14. Run a formal threat model and reconciliation test before production use.

## Transaction functions

The following operations should become server-controlled database transactions or RPCs:

- `issue_tokens`
- `complete_purchase`
- `refund_order`
- `create_administrative_adjustment`
- `create_settlement`
- `change_settlement_status`

Each operation must:

- resolve the authenticated actor server-side;
- validate role and ownership;
- reload authoritative records;
- lock or otherwise serialize relevant wallet/order/idempotency rows;
- validate positive integer values and sufficient balance;
- enforce idempotency;
- append ledger and audit records atomically;
- return a safe receipt/read model.

Clients must never receive permission to write arbitrary ledger/audit rows or pass a trusted balance/total.

## Row-level security direction

Policy details are intentionally not final, but the target posture is:

- customers can read only their own safe account/customer/wallet/order/refund records;
- vendors can read/manage only their vendor profile/products and read linked sales/refunds/settlements;
- staff can perform only approved issuance/customer-lookup functions for the active event;
- administrators can inspect event records and call controlled adjustment/settlement functions;
- evidence uses signed, short-lived access after authorization;
- ledger and audit inserts occur only through controlled server functions;
- append-only records cannot be updated/deleted by application roles.

Service-role keys must never be exposed to the browser.

## Planning schema caveats

The proposed SQL intentionally leaves open:

- exact Supabase Auth schema references;
- rate representation if fractional token conversion is required;
- settlement accounting/clearing-wallet semantics;
- multi-event role membership;
- evidence retention and legal/privacy requirements;
- real payment/provider reconciliation identifiers.

Resolve these with product, security, and finance stakeholders before implementation.
