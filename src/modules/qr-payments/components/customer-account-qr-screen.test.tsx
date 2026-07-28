import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  CUSTOMER_ACCOUNT_QR_LOAD_ERROR_MESSAGE,
  CustomerAccountQrScreen,
} from "./customer-account-qr-screen";

const accountQr = Object.freeze({
  customerId: "customer-001",
  publicCode: "cus_7F3Q9K2M",
  payload: "tokenly://qr/v1/customer/cus_7F3Q9K2M",
});

describe("CustomerAccountQrScreen", () => {
  it("renders only the opaque account code and generated QR image", async () => {
    const generateQrImage = vi.fn(async () => "data:image/png;base64,abc");

    render(
      <CustomerAccountQrScreen
        loadAccountQr={vi.fn(async () => accountQr)}
        generateQrImage={generateQrImage}
      />,
    );

    expect(
      await screen.findByRole("img", {
        name: "Tokenly customer account QR code",
      }),
    ).toHaveAttribute("src", "data:image/png;base64,abc");
    expect(screen.getByText(accountQr.publicCode)).toBeVisible();
    expect(generateQrImage).toHaveBeenCalledWith(accountQr.payload);
    expect(screen.getByText(/does not contain your mobile number/i)).toBeVisible();
    expect(screen.queryByText("90000001")).not.toBeInTheDocument();
    expect(screen.queryByText("2468")).not.toBeInTheDocument();
  });

  it("maps loading failures to safe copy and supports retry", async () => {
    const user = userEvent.setup();
    const loadAccountQr = vi
      .fn<() => Promise<typeof accountQr>>()
      .mockRejectedValueOnce(new Error("customers/private-record"))
      .mockResolvedValue(accountQr);

    render(
      <CustomerAccountQrScreen
        loadAccountQr={loadAccountQr}
        generateQrImage={vi.fn(async () => "data:image/png;base64,abc")}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      CUSTOMER_ACCOUNT_QR_LOAD_ERROR_MESSAGE,
    );
    expect(screen.queryByText(/private-record/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(
        screen.getByRole("img", {
          name: "Tokenly customer account QR code",
        }),
      ).toBeVisible();
    });
    expect(loadAccountQr).toHaveBeenCalledTimes(2);
  });
});
