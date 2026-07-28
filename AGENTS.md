# Tokenly Agent Guide

Tokenly is a mobile-first event token wallet. The repository currently targets a complete local prototype; production infrastructure is intentionally deferred.

## Read before changing code

Read these documents in order:

1. `docs/PRODUCT.md`
2. `docs/IMPLEMENTATION_PLAN.md`
3. `docs/ARCHITECTURE.md`
4. `docs/CODING_STANDARDS.md`
5. `docs/DATABASE.md`
6. `docs/SECURITY.md`
7. `docs/DESIGN_SYSTEM.md` for UI work
8. `docs/USER_FLOWS.md` for workflow changes

Also check `docs/IMPLEMENTATION_STATUS.md` before starting and update it whenever implementation status changes.

## Current scope

- Current phase: **Phase 5 — Customer application (in progress)**.
- Build and validate the local prototype before adding production services.
- Use local IndexedDB repositories for persistent application data.
- Use `localStorage` only for small session and development preferences.
- Do not configure Supabase, Vercel, GitHub automation, SMS verification, PayNow verification, banking integrations, or real payouts in this phase.
- `supabase/planned-schema.sql` is non-executable planning material, not a migration.

Never describe a planned or mocked capability as implemented. Development simulators must be labelled honestly.

## Architecture boundaries

- Organise work as feature-first vertical slices under `src/modules`.
- Keep pages, layouts, and route handlers thin.
- Keep core business rules in services, not React components.
- Access data only through repository interfaces.
- Validate external input with Zod at the boundary.
- `src/shared` must never import from `src/modules`.
- Import another module only through its public `index.ts`.
- Do not import server-only code into client components.
- The append-only wallet ledger is the balance source of truth. Never add `setBalance`.
- Ledger, audit, and transaction mutations must preserve actor, idempotency, and traceability.

## Code conventions

- TypeScript strict mode; do not use `any`.
- `kebab-case` for files and folders.
- `PascalCase` for React components and TypeScript types.
- `camelCase` for variables and functions.
- `snake_case` for future database fields.
- Prefer named exports.
- Use descriptive, capability-specific filenames. Do not create `utils.ts`, `helpers.ts`, `common.ts`, or `misc.ts`.
- Keep secret values, PINs, and private data out of logs, errors, audit metadata, QR payloads, fixtures, and screenshots.
- Use “Tokener” only in warm customer-facing copy. Use “customer” in technical, staff, admin, audit, and database language.

## Implementation discipline

- Follow the phase order in `docs/IMPLEMENTATION_PLAN.md`.
- Do not build payment UI until wallet invariants and their tests pass.
- Protect wallet integrity when requirements are ambiguous, document the assumption, and continue.
- Preserve unrelated work in the shared worktree.
- Add or update tests with each business rule.
- Update documentation when architecture, workflows, security decisions, or delivered scope changes.

## Required validation

Use npm scripts from `package.json`. Before declaring the local prototype complete, run:

```bash
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Record the actual results and any exact environmental limitation in `docs/IMPLEMENTATION_STATUS.md`. Never claim a command passed unless it was run successfully.
