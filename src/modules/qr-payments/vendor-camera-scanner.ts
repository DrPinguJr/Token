export type VendorCameraPayloadOutcome = "accepted" | "invalid";

export interface VendorCameraScanSession {
  readonly stop: () => void | Promise<void>;
}

export interface VendorCameraScannerAdapter {
  readonly checkSupport: () => Promise<boolean>;
  readonly start: (
    video: HTMLVideoElement,
    onPayload: (payload: string) => Promise<VendorCameraPayloadOutcome>,
  ) => Promise<VendorCameraScanSession>;
}
