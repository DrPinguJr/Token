import { paymentReferenceSchema } from "./token-issuance-schema";

export function normalizePaymentReference(paymentReference: string): string {
  const parsedReference = paymentReferenceSchema.parse(paymentReference);

  return parsedReference
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-SG");
}
