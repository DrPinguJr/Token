import { positiveSafeIntegerSchema } from "@/shared/validation";

import { TokenIssuanceError } from "./token-issuance-errors";

const centsPerDollar = 100;

/**
 * Converts integer cents using the snapshotted tokens-per-dollar rate. Any
 * fractional token is deliberately rounded down because tokens are indivisible.
 */
export function calculateIssuedTokenAmount(
  paynowAmountCents: number,
  tokensPerDollar: number,
): number {
  const parsedAmount = positiveSafeIntegerSchema.safeParse(paynowAmountCents);
  const parsedRate = positiveSafeIntegerSchema.safeParse(tokensPerDollar);

  if (!parsedAmount.success || !parsedRate.success) {
    throw new TokenIssuanceError(
      "TOKEN_ISSUANCE_CONVERSION_INPUT_INVALID",
      "PayNow cents and the token conversion rate must be positive safe integers.",
    );
  }

  const wholeDollarAmount = Math.floor(parsedAmount.data / centsPerDollar);
  const remainingCents = parsedAmount.data % centsPerDollar;
  const wholeRateHundreds = Math.floor(parsedRate.data / centsPerDollar);
  const remainingRate = parsedRate.data % centsPerDollar;

  if (
    wholeDollarAmount > Math.floor(Number.MAX_SAFE_INTEGER / parsedRate.data)
  ) {
    throw new TokenIssuanceError(
      "TOKEN_ISSUANCE_CONVERSION_OVERFLOW",
      "The converted token amount is outside the supported range.",
    );
  }

  const wholeDollarTokens = wholeDollarAmount * parsedRate.data;
  const partialDollarTokens =
    remainingCents * wholeRateHundreds +
    Math.floor((remainingCents * remainingRate) / centsPerDollar);

  if (wholeDollarTokens > Number.MAX_SAFE_INTEGER - partialDollarTokens) {
    throw new TokenIssuanceError(
      "TOKEN_ISSUANCE_CONVERSION_OVERFLOW",
      "The converted token amount is outside the supported range.",
    );
  }

  const convertedAmount = wholeDollarTokens + partialDollarTokens;

  if (convertedAmount < 1) {
    throw new TokenIssuanceError(
      "TOKEN_ISSUANCE_CONVERSION_BELOW_MINIMUM",
      "The PayNow amount converts to fewer than one whole token.",
    );
  }

  return convertedAmount;
}
