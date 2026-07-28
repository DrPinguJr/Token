import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it } from "vitest";

import { TokenlyMark } from "./tokenly-mark";

describe("TokenlyMark", () => {
  it("keeps the Tokenly name available to assistive technology", () => {
    render(
      <Link href="/">
        <TokenlyMark compact />
      </Link>,
    );

    expect(screen.getByRole("link", { name: "Tokenly" })).toBeInTheDocument();
  });
});
