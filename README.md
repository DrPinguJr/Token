# Tokenly

Tokenly is a mobile-first event token wallet for a two-day floorball event. Customers (“Tokeners” in friendly customer copy) receive tokens from event staff after a **manual** PayNow check, then spend them with event vendors. Vendors manage products, payments, refunds, and manually recorded settlements; administrators can trace value-changing activity.

## Current status

**Phase 1 — Foundation is in progress.**

The target is a complete local prototype using Next.js, strict TypeScript, Tailwind CSS, IndexedDB, and a replaceable repository layer. Product flows must not be considered implemented until `docs/IMPLEMENTATION_STATUS.md` records working behaviour and validation.

No Supabase, Vercel, GitHub publishing, SMS, PayNow API, banking, or deployment configuration belongs in this phase.

## Intended local start

```bash
npm install
npm run dev
```

Open the URL printed by Next.js, normally `http://localhost:3000`.

These are the required project commands; see [implementation status](docs/IMPLEMENTATION_STATUS.md) for current verification evidence.

The prototype requires no external API key. Development-only role/data/scanner tools are disabled by default:

```dotenv
NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS=false
```

Copy `.env.example` to `.env.local` and set the flag to `true` only when testing local simulators.

## Development accounts

The required core seed contract is:

| Role          | Local username | Mobile number | Development PIN |
| ------------- | -------------- | ------------- | --------------- |
| Customer      | QR-only        | `90000001`    | `2468`          |
| Vendor        | Later          | `90000002`    | `2468`          |
| Event staff   | Later          | `90000003`    | `2468`          |
| Administrator | `AdminLance`   | `90000004`    | `2468`          |

Additional fictional accounts and event records are required in the implemented seed. The shared PIN is public development data, not production security. Tokeners do not sign in with mobile numbers; they receive QR/private-link access.

## Architecture

Tokenly is a feature-first modular monolith:

```text
thin route or page
  -> feature action/component
    -> Zod-validated service
      -> repository interface
        -> versioned IndexedDB adapter
```

The append-only ledger is the source of wallet balances. Purchases and refunds create paired customer/vendor entries in one atomic local transaction. No component or repository may set a wallet balance directly.

Planned top-level structure:

```text
.
├── AGENTS.md
├── docs/
│   └── DECISIONS/
├── public/
├── src/
│   ├── app/
│   ├── modules/
│   ├── shared/
│   └── config/
├── tests/
│   ├── integration/
│   └── end-to-end/
└── supabase/
```

Only create module subfolders that contain real code; avoid placeholder architecture.

## Quality commands

```bash
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:watch
npm run build
npm run test:e2e
npm run check
```

Do not report a command as passing unless it was run successfully on the current working tree.

## Documentation

Start with:

1. [Product definition](docs/PRODUCT.md)
2. [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
3. [Architecture](docs/ARCHITECTURE.md)
4. [Coding standards](docs/CODING_STANDARDS.md)
5. [Local data model](docs/DATABASE.md)
6. [Security model](docs/SECURITY.md)
7. [Design system](docs/DESIGN_SYSTEM.md)
8. [User flows](docs/USER_FLOWS.md)
9. [Local development](docs/LOCAL_DEVELOPMENT.md)
10. [Implementation status](docs/IMPLEMENTATION_STATUS.md)

Future coding agents must follow `AGENTS.md` and keep the status and plan aligned with observed implementation.

## Local prototype limitations

- Account entry does not verify mobile-number ownership.
- The PIN service and lockout are local simulations, not production credential security.
- PayNow screenshots are local mock evidence; Tokenly does not verify payments.
- Browser-local data can be modified by the browser user.
- Settlement records do not trigger bank transfers.
- Camera scanning depends on browser support; manual entry and a development simulator provide fallbacks.
- Production authorization, row-level security, monitoring, rate limiting, malware scanning, deployment, and real integrations are deferred.

The future Supabase boundary is documented in `supabase/README.md`; `supabase/planned-schema.sql` is non-executable design material and is not a migration.
