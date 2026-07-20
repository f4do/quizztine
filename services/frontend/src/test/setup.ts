import "@testing-library/jest-dom";

// Suppress unhandled rejections from React 19 + jsdom (window not defined in
// promise callbacks that fire after test teardown). The actual test assertions
// remain valid — these are false-positive environment errors.
process.on("unhandledRejection", (reason) => {
  if (
    reason instanceof ReferenceError &&
    reason.message === "window is not defined"
  ) {
    return; // benign — React 19 resolveUpdatePriority after test cleanup
  }
  // Let other unhandled rejections surface
  console.error("Unhandled Rejection:", reason);
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
