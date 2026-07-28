import QRCode from "qrcode";

import { parseTokenlyQrPayload } from "@/modules/qr-payments";

export async function generateTokenlyQrCodeDataUrl(
  payload: string,
): Promise<string> {
  parseTokenlyQrPayload(payload);

  return QRCode.toDataURL(payload, {
    type: "image/png",
    width: 320,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#17243B",
      light: "#FFFFFF",
    },
  });
}

export async function generateRouteQrCodeDataUrl(
  path: string,
): Promise<string> {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Route QR paths must be same-origin application paths.");
  }

  const url =
    typeof window === "undefined"
      ? path
      : new URL(path, window.location.origin).toString();

  return QRCode.toDataURL(url, {
    type: "image/png",
    width: 320,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#17243B",
      light: "#FFFFFF",
    },
  });
}
