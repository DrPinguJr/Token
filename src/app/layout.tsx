import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { TokenlyRuntimeProvider } from "@/config/tokenly-runtime-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Tokenly",
    template: "%s · Tokenly",
  },
  description:
    "A local-first event token wallet for customers, vendors, staff, and administrators.",
  applicationName: "Tokenly",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8f4",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <TokenlyRuntimeProvider>{children}</TokenlyRuntimeProvider>
      </body>
    </html>
  );
}
