import { describe, it, expect } from "vitest";
import { mediaUrl } from "../api";

describe("mediaUrl", () => {
  it("returns null for null input", () => {
    expect(mediaUrl(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(mediaUrl(undefined)).toBeNull();
  });

  it("returns absolute URLs as-is", () => {
    expect(mediaUrl("http://example.com/img.jpg")).toBe(
      "http://example.com/img.jpg",
    );
    expect(mediaUrl("https://example.com/img.jpg")).toBe(
      "https://example.com/img.jpg",
    );
  });

  it("prepends API_BASE for relative URLs", () => {
    const result = mediaUrl("/uploads/file.jpg");
    expect(result).toContain("/uploads/file.jpg");
  });
});
