import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminAddCreditsDialog } from "./admin-add-credits-dialog";

describe("AdminAddCreditsDialog", () => {
  it("requires evidence before moving to the amount step", async () => {
    const user = userEvent.setup();

    render(
      <AdminAddCreditsDialog
        customerId="customer-1"
        customerName="Lance Tan"
        onClose={vi.fn()}
        onComplete={vi.fn()}
        submitCredits={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Next: enter amount" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      /take or upload an evidence photo/i,
    );
    expect(
      screen.getByRole("heading", { name: "Capture payment evidence" }),
    ).toBeVisible();
  });

  it("captures the method, image, and amount in the guided order", async () => {
    const user = userEvent.setup();
    const submitCredits = vi.fn(async () => undefined);
    const onComplete = vi.fn();
    const evidence = new File(["safe-image-bytes"], "paynow.webp", {
      type: "image/webp",
    });

    render(
      <AdminAddCreditsDialog
        customerId="customer-1"
        customerName="Lance Tan"
        onClose={vi.fn()}
        onComplete={onComplete}
        submitCredits={submitCredits}
      />,
    );

    await user.click(screen.getByText("Cash"));
    await user.upload(screen.getByLabelText("Upload evidence image"), evidence);

    expect(
      screen.getByRole("heading", { name: "Enter amount received" }),
    ).toBeVisible();

    await user.type(screen.getByPlaceholderText("0.00"), "12.50");
    expect(screen.getByText("12.5", { selector: "strong" })).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Confirm add credits" }),
    );

    expect(submitCredits).toHaveBeenCalledWith({
      amountCents: 1250,
      customerId: "customer-1",
      evidence,
      paymentMethod: "cash",
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("shows the one-to-one token amount before confirmation", async () => {
    const user = userEvent.setup();
    const evidence = new File(["safe-image-bytes"], "cash.webp", {
      type: "image/webp",
    });

    render(
      <AdminAddCreditsDialog
        customerId="customer-1"
        customerName="Lance Tan"
        onClose={vi.fn()}
        onComplete={vi.fn()}
        submitCredits={vi.fn()}
      />,
    );

    await user.upload(screen.getByLabelText("Upload evidence image"), evidence);
    await user.type(screen.getByPlaceholderText("0.00"), "50");

    expect(screen.getByText("S$1.00 = 1 token.")).toBeVisible();
    expect(screen.getByText("50", { selector: "strong" })).toBeVisible();
  });

  it("issues a fractional token amount from cents", async () => {
    const user = userEvent.setup();
    const submitCredits = vi.fn();
    const evidence = new File(["safe-image-bytes"], "cash.webp", {
      type: "image/webp",
    });

    render(
      <AdminAddCreditsDialog
        customerId="customer-1"
        customerName="Lance Tan"
        onClose={vi.fn()}
        onComplete={vi.fn()}
        submitCredits={submitCredits}
      />,
    );

    await user.upload(screen.getByLabelText("Upload evidence image"), evidence);
    await user.type(screen.getByPlaceholderText("0.00"), "0.50");
    expect(screen.getByText("0.5", { selector: "strong" })).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Confirm add credits" }),
    );

    expect(submitCredits).toHaveBeenCalledWith({
      amountCents: 50,
      customerId: "customer-1",
      evidence,
      paymentMethod: "paynow",
    });
  });

  it("rejects unsupported or oversized evidence before submission", () => {
    render(
      <AdminAddCreditsDialog
        customerId="customer-1"
        customerName="Lance Tan"
        onClose={vi.fn()}
        onComplete={vi.fn()}
        submitCredits={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Upload evidence image"), {
      target: {
        files: [
          new File(["not-an-image"], "receipt.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      /use a HEIC, HEIF, JPEG, PNG, or WebP image/i,
    );
  });

  it("offers separate camera and upload inputs", () => {
    render(
      <AdminAddCreditsDialog
        customerId="customer-1"
        customerName="Lance Tan"
        onClose={vi.fn()}
        onComplete={vi.fn()}
        submitCredits={vi.fn()}
      />,
    );

    expect(screen.getByText("Take photo")).toBeVisible();
    expect(screen.getByText("Upload image")).toBeVisible();
    expect(screen.getByLabelText("Take evidence photo")).toHaveAttribute(
      "capture",
      "environment",
    );
    expect(screen.getByLabelText("Upload evidence image")).not.toHaveAttribute(
      "capture",
    );
  });

  it("accepts an iPhone HEIC photo and advances automatically", async () => {
    const user = userEvent.setup();

    render(
      <AdminAddCreditsDialog
        customerId="customer-1"
        customerName="Lance Tan"
        onClose={vi.fn()}
        onComplete={vi.fn()}
        submitCredits={vi.fn()}
      />,
    );

    await user.upload(
      screen.getByLabelText("Upload evidence image"),
      new File(["heic-image"], "IMG_1001.HEIC", { type: "image/heic" }),
    );

    expect(
      screen.getByRole("heading", { name: "Enter amount received" }),
    ).toBeVisible();
  });
});
