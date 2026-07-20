import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup, act } from "@testing-library/react";

// Flush pending React microtasks before jsdom teardown to prevent React 19's
// resolveUpdatePriority from accessing window.event after window is gone.
// See https://github.com/facebook/react/blob/main/packages/react-dom-bindings/src/client/ReactDOMUpdatePriority.js
// Known issue: https://github.com/vitest-dev/vitest/issues/7339
afterEach(async () => {
  await act(async () => {
    cleanup();
  });
});

// Provide localStorage for jsdom (not available in Node 24 without --localstorage-file flag)
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// Ensure clean localStorage state between tests
beforeEach(() => {
  localStorage.clear();
});

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
