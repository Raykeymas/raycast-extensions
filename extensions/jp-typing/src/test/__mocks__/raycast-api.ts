/* Minimal runtime stubs for @raycast/api used in Vitest */

type AsyncFn<T = unknown> = (...args: unknown[]) => Promise<T>;

export const LocalStorage = {
  getItem: (async () => undefined) as AsyncFn<string | undefined>,
  setItem: (async () => undefined) as AsyncFn<void>,
  removeItem: (async () => undefined) as AsyncFn<void>,
};

export function getPreferenceValues<T = Record<string, unknown>>(): T {
  return {} as T;
}

export const Toast = {
  Style: {
    Success: "success",
    Failure: "failure",
    Animated: "animated",
  },
} as const;

export async function showToast() {
  return;
}

const NullComponent = () => null;

export const Detail: typeof NullComponent = NullComponent;
export const Form: typeof NullComponent = NullComponent;
export const ActionPanel: typeof NullComponent = NullComponent;
export const Action: typeof NullComponent = NullComponent;
export const List: typeof NullComponent = NullComponent;

export const environment = {
  language: "en",
  isDevelopment: true,
  appearance: "dark" as const,
};
