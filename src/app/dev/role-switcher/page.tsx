import type { Metadata } from "next";

import { DevelopmentRoleSwitcherRoute } from "./role-switcher-route";

export const metadata: Metadata = {
  title: "Development role switcher",
};

export default function DevelopmentRoleSwitcherPage() {
  return <DevelopmentRoleSwitcherRoute />;
}
