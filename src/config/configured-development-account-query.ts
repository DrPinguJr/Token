import type { AccountRepository } from "@/modules/accounts";
import {
  DevelopmentAccountQuery,
  type DevelopmentAccountQueryDependencies,
} from "@/modules/development-tools";

import { areDevelopmentToolsEnabled } from "./development-tools";

export function createConfiguredDevelopmentAccountQuery(
  accounts: Pick<AccountRepository, "list">,
): DevelopmentAccountQuery {
  const dependencies: DevelopmentAccountQueryDependencies = {
    accounts,
    isDevelopmentToolsEnabled: areDevelopmentToolsEnabled,
  };

  return new DevelopmentAccountQuery(dependencies);
}
