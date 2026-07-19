import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.js";
import { HostProvider } from "./lib/HostProvider";
import "./index.css";
import "./lib/i18n.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <HostProvider>
        <App />
      </HostProvider>
    </BrowserRouter>
  </StrictMode>,
);
