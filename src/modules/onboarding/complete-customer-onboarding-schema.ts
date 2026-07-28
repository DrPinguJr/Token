import { z } from "zod";

import { domainIdSchema } from "@/shared/validation";

export const onboardingCompletionMethodSchema = z.enum([
  "guided",
  "development_skip",
]);

export const completeCustomerOnboardingCommandSchema = z
  .object({
    actorAccountId: domainIdSchema,
    completionMethod: onboardingCompletionMethodSchema,
  })
  .strict();

export type OnboardingCompletionMethod = z.infer<
  typeof onboardingCompletionMethodSchema
>;

export type CompleteCustomerOnboardingCommand = Readonly<
  z.infer<typeof completeCustomerOnboardingCommandSchema>
>;
