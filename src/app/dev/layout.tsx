import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { areDevelopmentToolsEnabled } from "@/config/development-tools";

import { DevelopmentToolsShell } from "./development-tools-shell";

type DevelopmentLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function DevelopmentLayout({
  children,
}: DevelopmentLayoutProps) {
  if (!areDevelopmentToolsEnabled()) {
    notFound();
  }

  return <DevelopmentToolsShell>{children}</DevelopmentToolsShell>;
}
