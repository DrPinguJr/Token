import {
  CustomerAccountQrQuery,
  DevelopmentVendorSimulator,
  VendorQrResolver,
  type CustomerAccountQrReadModel,
  type DevelopmentVendorOption,
  type ResolvedVendorQrTarget,
} from "@/modules/qr-payments";

import {
  areDevelopmentToolsEnabled,
  assertDevelopmentToolsEnabled,
} from "./development-tools";
import { createLocalRepositories } from "./local-repositories";

export async function loadConfiguredCustomerAccountQr(
  actorAccountId: string,
): Promise<CustomerAccountQrReadModel> {
  const repositories = await createLocalRepositories();
  return new CustomerAccountQrQuery(repositories).getForAccount(actorAccountId);
}

export async function resolveConfiguredScannedVendor(
  actorAccountId: string,
  payload: string,
): Promise<ResolvedVendorQrTarget> {
  const repositories = await createLocalRepositories();
  return new VendorQrResolver(repositories).resolveScannedPayload({
    actorAccountId,
    payload,
  });
}

export async function resolveConfiguredManualVendorCode(
  actorAccountId: string,
  publicCode: string,
): Promise<ResolvedVendorQrTarget> {
  const repositories = await createLocalRepositories();
  return new VendorQrResolver(repositories).resolveManualCode({
    actorAccountId,
    publicCode,
  });
}

function createDevelopmentVendorSimulator(
  repositories: Awaited<ReturnType<typeof createLocalRepositories>>,
): DevelopmentVendorSimulator {
  return new DevelopmentVendorSimulator({
    repositories,
    isDevelopmentToolsEnabled: areDevelopmentToolsEnabled,
  });
}

export async function listConfiguredDevelopmentVendorOptions(
  actorAccountId: string,
): Promise<readonly DevelopmentVendorOption[]> {
  assertDevelopmentToolsEnabled();
  const repositories = await createLocalRepositories();
  return createDevelopmentVendorSimulator(repositories).listOptions(
    actorAccountId,
  );
}

export async function resolveConfiguredDevelopmentVendorSelection(
  actorAccountId: string,
  vendorId: string,
): Promise<ResolvedVendorQrTarget> {
  assertDevelopmentToolsEnabled();
  const repositories = await createLocalRepositories();
  return createDevelopmentVendorSimulator(repositories).resolveSelection(
    actorAccountId,
    vendorId,
  );
}
