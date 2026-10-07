import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusRegion } from "./status-region";

// C28 (nomadwiz/kete#285). A live region inserted already holding its text is
// commonly not announced, so the element must exist, empty, before the write.
describe("StatusRegion", () => {
  it("is in the page and empty until it is given a sentence", () => {
    const { rerender } = render(<StatusRegion />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    rerender(<StatusRegion>Your details are saved.</StatusRegion>);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your details are saved.",
    );
  });

  it("is the same element before and after, not a replacement", () => {
    const { rerender } = render(<StatusRegion />);
    const before = screen.getByRole("status");
    rerender(<StatusRegion>Saved.</StatusRegion>);
    expect(screen.getByRole("status")).toBe(before);
  });
});
