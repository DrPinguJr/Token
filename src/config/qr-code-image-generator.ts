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
