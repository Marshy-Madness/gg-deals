import { callable } from "@decky/api";

export interface Settings {
  api_key: string;
  region: string;
  include_keyshops: boolean;
}

export type PriceResult =
  | { status: "no_key" }
  | { status: "not_found" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      lowest: number;
      source: string;
      retail: number | null;
      keyshops: number | null;
      currency: string;
      url: string | null;
    };

export const getSettings = callable<[], Settings>("get_settings");
export const setSettings = callable<
  [api_key: string, region: string, include_keyshops: boolean],
  Settings
>("set_settings");
export const getPrice = callable<[app_id: string], PriceResult>("get_price");

// Lets the store badge refetch when settings change in the QAM panel.
const listeners = new Set<() => void>();
export const onSettingsChanged = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const notifySettingsChanged = () => listeners.forEach((fn) => fn());

export const formatPrice = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
};
