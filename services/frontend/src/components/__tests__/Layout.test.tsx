import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "../../test/utils";
import Layout from "../Layout";

describe("Layout", () => {
  it("renders children", () => {
    render(<Layout>Hello</Layout>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
