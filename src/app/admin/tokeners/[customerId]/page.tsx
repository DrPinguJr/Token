import type { Metadata } from "next";

import { AdminTokenersRoute } from "../tokeners-route";

export const metadata: Metadata = {
  title: "Tokener detail",
};

interface AdminTokenerDetailPageProps {
  readonly params: Promise<{
    customerId: string;
  }>;
}

export default async function AdminTokenerDetailPage({
  params,
}: AdminTokenerDetailPageProps) {
  const { customerId } = await params;

  return <AdminTokenersRoute selectedCustomerId={customerId} />;
}
