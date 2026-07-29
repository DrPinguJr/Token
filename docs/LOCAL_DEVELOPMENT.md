# Tokenly Local Development

## Prerequisites

- A currently supported Node.js LTS release compatible with the repository’s Next.js version
- npm (the project package manager)
- A modern Chromium, Firefox, or WebKit browser
- A camera-capable secure browser context only if testing real QR scanning; manual entry and the development simulator remain available locally

Check the `engines` field in `package.json` once defined. Do not add external API keys for the prototype.

## Install and start

From the repository root:

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js, normally `http://localhost:3000`.

These commands are the intended workflow. Consult `docs/IMPLEMENTATION_STATUS.md` for whether they have been verified in the current repository state.

## Environment

Copy `.env.example` to `.env.local`:

```powershell
Copy-Item .env.example .env.local
```

The IndexedDB application slices require no external key. The Supabase-backed
admin tokener, transaction, claim/private-account, evidence, and vendor wallet
resolution routes require:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-server-secret
```

Never commit `.env.local` or expose `SUPABASE_SECRET_KEY` through a
`NEXT_PUBLIC_` variable. Restart `npm run dev` after changing environment
values because Next.js reads them at server startup.

```dotenv
NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS=false
```

Set the value to `true` only to expose the local role switcher, scan simulator, and reset/reseed controls. The flag is public browser configuration and is not an authorization mechanism.

Do not add Vercel or other production deployment configuration during the
local prototype phase. Supabase values are limited to the explicitly
Supabase-backed prototype routes listed above.

## Seed accounts

The intended core seed accounts are:

| Role                   | Local username | Mobile number | Development PIN |
| ---------------------- | -------------- | ------------- | --------------- |
| Customer               | QR-only        | `90000001`    | `2468`          |
| Vendor                 | Later          | `90000002`    | `2468`          |
| Event staff            | Later          | `90000003`    | `2468`          |
| Administrator          | `AdminLance`   | `90000004`    | `2468`          |
| Additional customer    | QR-only        | `90000005`    | `2468`          |
| Additional vendor      | Later          | `90000006`    | `2468`          |
| Additional vendor      | Later          | `90000007`    | `2468`          |
| Additional event staff | Later          | `90000008`    | `2468`          |
| Additional customer    | QR-only        | `90000009`    | `2468`          |

`2468` is deliberately shared development data and must never be used as a
production default. Seed records persist only its documented prototype digest
format, not the literal digits.

The account entry screen is for local operational users. The seeded super-admin signs in with username `AdminLance` and password `Lance888!`. Tokeners do not sign in there; they use the one-time claim QR and saved private account link.

## Local data

- Application data persists in a versioned Tokenly IndexedDB database.
- Small session/onboarding/development preferences may use localStorage.
- Wallet balances are calculated from ledger entries.
- PayNow evidence is local prototype data and has not been automatically verified.

With development tools enabled:

- `/dev/role-switcher` switches among seeded accounts.
- `/dev/data` resets and reseeds deterministic application data.
- the scanner UI can select a seeded customer or vendor.

Reset/reseed targets only the exact Tokenly database and discards its local
prototype records. Session and onboarding preferences are preserved unless a
caller explicitly includes them through the separately scoped preference-reset
hook. It does not affect unrelated browser data.

If seed contracts change, bump the seed version and provide an explicit reseed path. Do not silently overwrite a user’s local prototype data during a normal schema upgrade.

The current local data and deterministic seed versions are both `5`. Version
`1` ledger data predates prefix-free operation reservations and strict
entry-type semantics. Version `2` data predates the one-time claim QR, private
account link, and regeneratable wallet QR fields. Version `3` data predates the
admin username/password entry flow. Version `4` data predates numeric
private-account links. The application rejects older versions without clearing
any records. During local development, explicitly use the confirmed Tokenly
reset/reseed flow to replace older data with the version `5` seed.

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

`npm run check` should run formatting check, lint, typecheck, unit/integration tests, and production build. Playwright remains an explicit command because it may require one-time browser installation:

```bash
npx playwright install
```

Record exact environmental limitations instead of skipping failures silently.

## Test data isolation

- Unit tests use pure values or injected deterministic providers.
- IndexedDB tests use isolated database names and close/delete them after each suite.
- End-to-end tests reset and reseed deterministic local data before a scenario.
- Never point tests at a real Supabase project or production-like data.
- Never include real personal information in fixtures, recordings, or screenshots.

## Camera testing

Camera APIs commonly require a secure context, though browsers generally treat localhost as secure. If camera access is unsupported, denied, or unavailable:

1. verify the permission state shown by the UI;
2. use manual opaque-code entry; or
3. enable development tools and choose a seeded record in the scan simulator.

The simulator should exercise the same validated lookup path as a scanned QR.

## Troubleshooting

### IndexedDB is unavailable

Use a normal browser context (not a heavily restricted/private policy context), confirm site storage is allowed, then reload. The app should display a recoverable storage error rather than showing a fabricated balance.

### Seed data appears outdated

Enable development tools, open `/dev/data`, and use the confirmed reseed action. Do not delete broad browser profile directories.

### Playwright browser is missing

Run `npx playwright install` and retry `npm run test:e2e`.

### Port 3000 is in use

Follow the alternate local URL printed by Next.js or stop the known process occupying the port. Do not terminate unrelated processes without checking them.

## Production boundary

No local-development step should configure Supabase, Vercel, GitHub automation, SMS, PayNow APIs, banking, or payouts. Future adapter work is documented in `supabase/README.md`.
