import type { Metadata } from "next";

import { DevelopmentDataRoute } from "./development-data-route";

export const metadata: Metadata = {
  title: "Development local data",
};

export default function DevelopmentDataPage() {
  return <DevelopmentDataRoute />;
}
