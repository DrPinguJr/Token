# ADR 0001: Local-first modular monolith with repository boundaries

- Status: Accepted
- Date: 2026-07-27

## Context

Tokenly’s immediate deliverable is a complete local prototype for a two-day event. It must work without Supabase, Vercel, external API keys, deployment, or network-backed identity/payment services. The product nevertheless has several business capabilities—accounts, wallets, issuance, vendors, orders, refunds, settlements, evidence, settings, and auditing—that must later move to production infrastructure without rewriting every screen and rule.

A flat component/service structure would make boundaries unclear. A distributed architecture would add operational complexity that provides no value for a 500-attendee local prototype. Direct IndexedDB calls from components would couple the UI to temporary persistence and make later migration expensive.

## Decision

Build one Next.js App Router application as a feature-first modular monolith.

- Group source by business capability under `src/modules`.
- Expose cross-module contracts only through each module’s `index.ts`.
- Keep `src/shared` capability-neutral and independent of modules.
- Put business invariants in services and external validation in Zod schemas.
- Access persistent data only through repository interfaces.
- Implement local browser adapters with IndexedDB.
- Use localStorage only for small session and development preferences.
- Coordinate multi-record local mutations through one atomic transaction service.
- Replace adapters—not domain rules or UI contracts—when Supabase is introduced.

## Consequences

### Positive

- The prototype has no external service dependency.
- Business rules can be tested without React or browser views.
- Repository contracts make the future Supabase boundary explicit.
- Capabilities remain understandable in one deployable unit.
- IndexedDB transactions can commit linked records atomically.

### Trade-offs

- Browser-local authorization and data can be modified by a user and are not production security.
- Care is required around Next.js client/server boundaries because IndexedDB is browser-only.
- Repository abstractions add initial code compared with direct storage access.
- Cross-module workflows need explicit public contracts and a transaction coordinator.

## Rejected alternatives

- **Direct IndexedDB use in components:** quick initially, but couples persistence, business rules, and rendering.
- **Supabase during the prototype:** conflicts with the no-configuration/no-API-key scope.
- **Microservices:** unnecessary deployment and transaction complexity for this product and scale.
- **A global technical-layer folder structure:** makes capabilities and ownership harder to trace.

## Follow-up

The future production migration must implement each repository contract with Supabase/Postgres, move atomic value changes to a server transaction/function, replace local sessions, and enforce role/row access server-side. See `supabase/README.md`.
