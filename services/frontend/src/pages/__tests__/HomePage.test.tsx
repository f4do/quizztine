import { screen } from "@testing-library/react";
import { render } from "../../test/utils";
import { describe, it, expect } from "vitest";
import HomePage from "../HomePage";

describe("HomePage", () => {
  it("renders the home page title", () => {
    render(<HomePage />);
    const heading = screen.getByRole("heading");
    expect(heading).toHaveTextContent("Quizztine");
  });

  it("renders a create room button", () => {
    render(<HomePage />);
    const createBtn = screen.getByRole("button", {
      name: /créer un salon|create a room/i,
    });
    expect(createBtn).toBeInTheDocument();
  });

  it("renders a join input and button", () => {
    render(<HomePage />);
    const joinInput = screen.getByPlaceholderText(/code du salon|room code/i);
    expect(joinInput).toBeInTheDocument();

    const joinBtn = screen.getByRole("button", {
      name: /rejoindre|join/i,
    });
    expect(joinBtn).toBeInTheDocument();
  });
});
