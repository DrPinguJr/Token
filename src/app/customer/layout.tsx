import type { ReactNode } from "react";

import { CustomerApplicationLayout } from "./customer-application-layout";

export default function CustomerLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <CustomerApplicationLayout>{children}</CustomerApplicationLayout>;
}
