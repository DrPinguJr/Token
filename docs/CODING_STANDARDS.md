# Tokenly Coding Standards

## TypeScript

- Enable strict mode and keep it passing.
- Do not use `any`. Use `unknown` at untrusted boundaries and narrow it with Zod or type guards.
- Prefer discriminated unions for domain states and service results.
- Model IDs as opaque domain types where confusion is plausible.
- Model token and quantity invariants through schemas and service validation; never accept an unchecked `number`.
- Use `satisfies` when validating object shape without widening literals.
- Prefer named exports. Default exports are used only where the framework requires them.
- Avoid non-null assertions; prove presence or handle absence.

## Naming

- Files and folders: `kebab-case`.
- React components and TypeScript types: `PascalCase`.
- Functions, variables, and object fields: `camelCase`.
- Future database columns: `snake_case`.
- Constants: descriptive `camelCase` or `SCREAMING_SNAKE_CASE` only for true global constants.
- Tests: `subject.test.ts` or `subject.test.tsx`.

Use capability names such as:

- `calculate-wallet-balance.ts`
- `generate-transaction-reference.ts`
- `verify-wallet-pin.ts`
- `wallet-balance-card.tsx`

Do not create generic dumping grounds named `utils.ts`, `helpers.ts`, `common.ts`, or `misc.ts`.

## Imports and boundaries

- Import a module only through its public `index.ts`.
- Do not import another module’s internal service, repository, component, schema, or type path.
- `src/shared` must not import from `src/modules`.
- Keep client/server boundaries explicit. A file using browser APIs begins at or below a client boundary; client code must not import server-only code.
- Use configured absolute aliases for cross-feature imports and relative imports within a small local slice.
- Avoid barrel exports that expose private internals or introduce cycles.

## Routes and React

- Keep App Router pages/layouts/handlers thin.
- Put business rules in services, not components, hooks, pages, or form submit callbacks.
- Components receive prepared read models and call explicit feature actions.
- Default to server components where browser state is not required; use `"use client"` at the narrowest practical boundary.
- Do not access IndexedDB or localStorage during render.
- Handle loading, empty, error, success, and disabled/pending states.
- Use semantic HTML before adding ARIA.
- Keep touch targets and focus behaviour consistent with `docs/DESIGN_SYSTEM.md`.

## Validation

- Parse every external input with Zod: forms, route/search parameters, QR strings, storage records, file metadata, environment variables, and imported seed data.
- Do not use a TypeScript cast as runtime validation.
- Validate at the boundary, then enforce authoritative business invariants in the service.
- Normalize mobile numbers, references, and opaque codes once in named functions.
- Keep safe user messages separate from internal error context.

## Repositories and services

- Define the repository interface before its local adapter.
- Repository interfaces speak domain types, not IndexedDB/Supabase response objects.
- No React imports in domain services or repositories.
- No raw persistence calls in components.
- Services own pricing, balance, permission, refund, settlement, and idempotency rules.
- Inject repositories and clock/ID providers where tests require determinism.
- Do not add `setBalance`; query ledger entries and calculate the balance.
- Append-only repositories must not expose update/delete.

## Numeric and time rules

- Token amounts are positive fixed-decimal values with at most two decimal
  places. Product quantities remain positive safe integers.
- Money is integer cents.
- Never calculate currency with binary floating-point.
- Persist UTC timestamps; format them in the user’s locale at the view boundary.
- Snapshot conversion rates and product prices on immutable business records.
- Apply explicit rounding rules for token conversion and test boundary cases.

## Security and privacy

- Never log or audit PINs, credential values, evidence bytes, secrets, or full local database dumps.
- QR payloads contain only opaque codes or safe internal routes.
- Treat local persisted state as untrusted.
- Use generic PIN/account-entry failure messages.
- Require role and ownership checks inside mutation services.
- Escape spreadsheet formula prefixes in CSV exports.
- Follow `docs/SECURITY.md` for development tool and evidence requirements.

## Error handling

- Prefer typed domain errors or discriminated service results over parsing error strings.
- Give stable codes to business conflicts such as insufficient balance, duplicate submission, unavailable product, over-refund, and lockout.
- Do not catch and ignore a failed value mutation.
- Map errors to friendly/operational UI copy at the presentation boundary.
- Preserve the original error as a safe cause only when it contains no secret data.

## Comments and documentation

- Comment why an invariant or unusual browser workaround exists, not what obvious code does.
- Public interfaces and security-sensitive services should document invariants and failure modes.
- Update ADRs for consequential architectural changes.
- Update `docs/IMPLEMENTATION_STATUS.md` with implementation and actual command results.
- Do not label mocked, simulated, static, or planned capability as complete.

## Formatting and linting

Prettier is authoritative for formatting. ESLint handles correctness and framework rules. Do not disable rules broadly to make checks pass; use the smallest justified suppression with a comment.

Expected commands:

```bash
npm run format
npm run format:check
npm run lint
npm run typecheck
```

## Tests

- Unit-test business rules through public service/functions.
- Contract-test local repository adapters against their interfaces.
- Use isolated IndexedDB databases and deterministic seed data.
- Integration tests verify all related records commit or none do.
- React Testing Library tests behaviour and accessibility, not component internals.
- Playwright covers the four critical role flows.
- Every regression fix adds a failing test first where practical.
- Never make tests order-dependent or share mutable database state.

## Git and change hygiene

- Keep changes scoped to one capability or coherent foundation task.
- Preserve unrelated work in a dirty/shared worktree.
- Do not commit generated build output, environment secrets, browser databases, screenshots containing private data, or test reports unless intentionally required.
- Do not claim a validation command passed unless it ran successfully in the current working state.
