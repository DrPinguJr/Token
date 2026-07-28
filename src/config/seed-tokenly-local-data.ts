import { assertSafeAuditMetadata } from "@/modules/audit-logs";

import {
  initializeLocalData,
  type LocalDataInitializationResult,
} from "./local-data";
import type { LocalRepositoryRegistry } from "./local-repositories";
import {
  createTokenlySeedData,
  TOKENLY_SEED_VERSION,
  type SeedEvidenceContent,
  type TokenlySeedData,
} from "./tokenly-seed-data";

export interface InitializeTokenlyApplicationDataOptions {
  readonly now?: () => string;
}

export class SeedDataIntegrityError extends Error {
  readonly code = "SEED_DATA_INTEGRITY_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "SeedDataIntegrityError";
  }
}

async function createRecords<T>(
  records: readonly T[],
  create: (record: T) => Promise<void>,
): Promise<void> {
  for (const record of records) {
    await create(record);
  }
}

function findEvidenceContent(
  contents: readonly SeedEvidenceContent[],
  evidenceId: string,
): SeedEvidenceContent {
  const content = contents.find((item) => item.evidenceId === evidenceId);

  if (content === undefined) {
    throw new SeedDataIntegrityError(
      `Seed evidence content is missing for ${evidenceId}.`,
    );
  }

  return content;
}

/**
 * Writes an already-validated seed scenario through public repository contracts.
 *
 * The first-run lifecycle owns rollback of a failed seed. This function is kept
 * persistence-agnostic so later adapters can reuse the same deterministic data.
 */
export async function seedTokenlyRepositories(
  repositories: LocalRepositoryRegistry,
  seedData: TokenlySeedData = createTokenlySeedData(),
): Promise<void> {
  const credentialsByAccountId = new Map(
    seedData.accountPinCredentials.map((credential) => [
      credential.accountId,
      credential,
    ]),
  );

  await createRecords(seedData.accounts, (record) => {
    const credential = credentialsByAccountId.get(record.id);

    if (credential === undefined) {
      throw new SeedDataIntegrityError(
        `Seed PIN credential is missing for ${record.id}.`,
      );
    }

    return repositories.accounts.create(record, credential);
  });
  await createRecords(seedData.wallets, (record) =>
    repositories.wallets.create(record),
  );
  await createRecords(seedData.customers, (record) =>
    repositories.customers.create(record),
  );
  await createRecords(seedData.vendors, (record) =>
    repositories.vendors.create(record),
  );
  await createRecords(seedData.products, (record) =>
    repositories.products.create(record),
  );

  for (const record of seedData.evidence) {
    const content = findEvidenceContent(seedData.evidenceContents, record.id);

    if (
      content.mimeType !== record.mimeType ||
      content.bytes.length !== record.sizeBytes
    ) {
      throw new SeedDataIntegrityError(
        `Seed evidence metadata does not match content for ${record.id}.`,
      );
    }

    await repositories.evidence.create(
      record,
      new Blob([Uint8Array.from(content.bytes)], {
        type: content.mimeType,
      }),
    );
  }

  await createRecords(seedData.tokenIssuances, (record) =>
    repositories.tokenIssuances.create(record),
  );
  await createRecords(seedData.orders, (record) =>
    repositories.orders.create(record),
  );
  await createRecords(seedData.refunds, (record) =>
    repositories.refunds.create(record),
  );
  await createRecords(seedData.ledgerEntries, (record) =>
    repositories.ledgerEntries.append(record),
  );
  await createRecords(seedData.settlements, (record) =>
    repositories.settlements.create(record),
  );

  for (const record of seedData.auditLogs) {
    assertSafeAuditMetadata(record.metadata);
    await repositories.auditLogs.append(record);
  }

  await repositories.eventSettings.save(seedData.eventSettings);
}

export function initializeTokenlyApplicationData(
  options: InitializeTokenlyApplicationDataOptions = {},
): Promise<LocalDataInitializationResult> {
  return initializeLocalData({
    seedVersion: TOKENLY_SEED_VERSION,
    seed: (repositories) => seedTokenlyRepositories(repositories),
    ...(options.now === undefined ? {} : { now: options.now }),
  });
}
