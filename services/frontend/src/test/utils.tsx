import { render, type RenderOptions } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { ThemeProvider } from "../lib/theme";
import { AuthProvider } from "../lib/auth";
import { HostProvider } from "../lib/HostProvider";
import i18n from "../lib/i18n";
import type { ReactElement } from "react";

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <HostProvider>
            <AuthProvider>{children}</AuthProvider>
          </HostProvider>
        </ThemeProvider>
      </I18nextProvider>
    </BrowserRouter>
  );
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export { customRender as render };
