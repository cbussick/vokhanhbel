import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { de } from "./resources";

export const appLocale = "de" as const;
export const i18n = i18next;

void i18n.use(initReactI18next).init({
  lng: appLocale,
  fallbackLng: appLocale,
  resources: { de },
  interpolation: { escapeValue: false },
  returnNull: false,
});
