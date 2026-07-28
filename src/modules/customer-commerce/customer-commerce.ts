import type { VendorOperatingStatus } from "@/modules/vendors";

export interface CustomerVendorSummary {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly stallLocation: string;
  readonly operatingStatus: VendorOperatingStatus;
  readonly logo: string | null;
  readonly banner: string | null;
  readonly availableProductCount: number;
  readonly categories: readonly string[];
}

export interface CustomerProductReadModel {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly image: string | null;
  readonly tokenPrice: number;
  readonly category: string;
  readonly displayOrder: number;
}

export interface CustomerVendorStorefront {
  readonly vendor: CustomerVendorSummary;
  readonly products: readonly CustomerProductReadModel[];
}

export interface CustomerPaymentReviewItem extends CustomerProductReadModel {
  readonly quantity: number;
  readonly lineTokenTotal: number;
}

export interface CustomerPaymentReviewReadModel {
  readonly vendor: CustomerVendorSummary;
  readonly customerBalance: number;
  readonly items: readonly CustomerPaymentReviewItem[];
  readonly estimatedTokenTotal: number;
}
