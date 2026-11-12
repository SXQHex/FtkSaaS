import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import common from "../locales/tr/common.json";

export const i18n = i18next.createInstance();

await i18n.use(initReactI18next).init({
  lng: "tr",
  fallbackLng: "tr",
  supportedLngs: ["tr"],
  defaultNS: "common",
  ns: ["common"],
  resources: {
    tr: { common },
  },
  initAsync: false,
  interpolation: {
    escapeValue: false,
  },
});
