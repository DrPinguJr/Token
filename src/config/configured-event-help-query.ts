import {
  EventHelpQuery,
  type DevelopmentHelpAccess,
  type EventHelpReadModel,
} from "@/modules/event-help";

import { areDevelopmentToolsEnabled } from "./development-tools";
import { createLocalRepositories } from "./local-repositories";
import { seededDevelopmentAccounts } from "./tokenly-seed-data";

const developmentHelpAccess: DevelopmentHelpAccess = Object.freeze({
  pin: "2468",
  accounts: Object.freeze([
    Object.freeze({
      role: "customer",
      mobileNumber: seededDevelopmentAccounts.customer,
    }),
    Object.freeze({
      role: "vendor",
      mobileNumber: seededDevelopmentAccounts.vendor,
    }),
    Object.freeze({
      role: "staff",
      mobileNumber: seededDevelopmentAccounts.staff,
    }),
    Object.freeze({
      role: "administrator",
      mobileNumber: seededDevelopmentAccounts.administrator,
    }),
  ]),
});

export async function loadConfiguredEventHelp(): Promise<EventHelpReadModel> {
  const repositories = await createLocalRepositories();
  return new EventHelpQuery({
    developmentAccess: developmentHelpAccess,
    isDevelopmentToolsEnabled: areDevelopmentToolsEnabled,
    repositories,
  }).get();
}
