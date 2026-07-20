import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../../test/utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SetupPage from "../SetupPage";

const { mockNavigate, mockApi } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockApi: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../../lib/api", () => ({
  api: mockApi,
}));

beforeEach(() => {
  vi.clearAllMocks();
  // AuthProvider calls api("/auth/me") on mount — reject by default (no user)
  mockApi.mockImplementation((path: string) => {
    if (path === "/auth/me") return Promise.reject(new Error("Not logged in"));
    return Promise.reject(new Error("Unknown endpoint"));
  });
});

const pseudoRegex = /pseudo|username|nom d.*/i;
const passwordRegex = /mot de passe|password/i;

describe("SetupPage", () => {
  it("renders the setup form", async () => {
    render(<SetupPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading")).toHaveTextContent(/initial setup|configuration initiale/i);
    });
  });

  it("shows error when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<SetupPage />);

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: pseudoRegex })).toBeInTheDocument();
    });

    await user.type(screen.getByRole("textbox", { name: pseudoRegex }), "admin");
    await user.type(screen.getByRole("textbox", { name: /email/i }), "admin@test.com");

    const passwordInputs = screen.getAllByLabelText(passwordRegex);
    await user.type(passwordInputs[0], "password123456");
    await user.type(passwordInputs[1], "different123456");

    await user.click(screen.getByRole("button", { name: /configurer|configure/i }));

    await waitFor(() => {
      expect(screen.getByText(/ne correspondent pas|do not match/i)).toBeInTheDocument();
    });
    // /auth/setup should NOT be called (client-side validation catches it first)
    expect(mockApi).not.toHaveBeenCalledWith("/auth/setup", expect.anything());
  });

  it("shows error when password is too short", async () => {
    const user = userEvent.setup();
    render(<SetupPage />);

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: pseudoRegex })).toBeInTheDocument();
    });

    await user.type(screen.getByRole("textbox", { name: pseudoRegex }), "admin");
    await user.type(screen.getByRole("textbox", { name: /email/i }), "admin@test.com");

    const passwordInputs = screen.getAllByLabelText(passwordRegex);
    await user.type(passwordInputs[0], "short");
    await user.type(passwordInputs[1], "short");

    await user.click(screen.getByRole("button", { name: /configurer|configure/i }));

    await waitFor(() => {
      expect(screen.getByText(/12 caract|12 char/i)).toBeInTheDocument();
    });
  });

  it("calls setup API and redirects on success", async () => {
    const user = userEvent.setup();

    // First call: /auth/me fails (no user logged in)
    // Second call: /auth/setup succeeds
    let callCount = 0;
    mockApi.mockImplementation((path: string, _options?: RequestInit) => {
      callCount++;
      if (path === "/auth/me") return Promise.reject(new Error("Not logged in"));
      if (path === "/auth/setup") return Promise.resolve({ user: { id: "1", role: "QUIZADMIN" } });
      return Promise.reject(new Error("Unknown"));
    });

    render(<SetupPage />);

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: pseudoRegex })).toBeInTheDocument();
    });

    await user.type(screen.getByRole("textbox", { name: pseudoRegex }), "admin");
    await user.type(screen.getByRole("textbox", { name: /email/i }), "admin@test.com");

    const passwordInputs = screen.getAllByLabelText(passwordRegex);
    await user.type(passwordInputs[0], "supersecret1234");
    await user.type(passwordInputs[1], "supersecret1234");

    await user.click(screen.getByRole("button", { name: /configurer|configure/i }));

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith("/auth/setup", {
        method: "POST",
        body: JSON.stringify({
          pseudo: "admin",
          email: "admin@test.com",
          password: "supersecret1234",
          confirmPassword: "supersecret1234",
          language: "fr",
        }),
      });
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/admin");
    });
  });

  it("displays API error message", async () => {
    const user = userEvent.setup();

    mockApi.mockImplementation((path: string) => {
      if (path === "/auth/me") return Promise.reject(new Error("Not logged in"));
      if (path === "/auth/setup") return Promise.reject(new Error("Setup already done"));
      return Promise.reject(new Error("Unknown"));
    });

    render(<SetupPage />);

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: pseudoRegex })).toBeInTheDocument();
    });

    await user.type(screen.getByRole("textbox", { name: pseudoRegex }), "admin");
    await user.type(screen.getByRole("textbox", { name: /email/i }), "admin@test.com");

    const passwordInputs = screen.getAllByLabelText(passwordRegex);
    await user.type(passwordInputs[0], "supersecret1234");
    await user.type(passwordInputs[1], "supersecret1234");

    await user.click(screen.getByRole("button", { name: /configurer|configure/i }));

    await waitFor(() => {
      expect(screen.getByText("Setup already done")).toBeInTheDocument();
    });
  });

  it("toggles language selection", async () => {
    const user = userEvent.setup();
    render(<SetupPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading")).toBeInTheDocument();
    });

    const englishBtn = screen.getByRole("button", { name: "English" });
    expect(englishBtn).toBeTruthy();

    await user.click(englishBtn);
    expect(englishBtn.className).toContain("bg-tv-gold");
  });
});
