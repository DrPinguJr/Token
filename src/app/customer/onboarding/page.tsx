import type { Metadata } from "next";

import { CustomerOnboardingRoute } from "./customer-onboarding-route";

export const metadata: Metadata = {
  title: "Welcome",
};

export default function CustomerOnboardingPage() {
  return <CustomerOnboardingRoute />;
}
