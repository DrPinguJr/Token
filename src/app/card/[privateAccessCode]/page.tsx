import type { Metadata } from "next";

import { PrivateAccountRoute } from "./private-account-route";

export const metadata: Metadata = {
  title: "Private Tokenly account",
};

interface PrivateAccountPageProps {
  readonly params: Promise<{
    privateAccessCode: string;
  }>;
}

export default async function PrivateAccountPage({
  params,
}: PrivateAccountPageProps) {
  const { privateAccessCode } = await params;

  return <PrivateAccountRoute privateAccessCode={privateAccessCode} />;
}
