import type { Metadata } from "next";

import { AdminTokenersRoute } from "./tokeners-route";

export const metadata: Metadata = {
  title: "Tokeners",
};

export default function AdminTokenersPage() {
  return <AdminTokenersRoute />;
}
