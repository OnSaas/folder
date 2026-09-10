import en from "../../i18n/locales/en.json";
import zhCN from "../../i18n/locales/zh-CN.json";

const catalogs: Record<string, any> = {
  en,
  "zh-CN": zhCN,
};

function lookup(dict: any, path: string): string | undefined {
  return path.split(".").reduce((acc, key) => acc?.[key], dict);
}

export function tError(event: any, key: string, fallback?: string) {
  const cookie = getCookie(event, "folder_locale") || "";
  const locale = cookie.startsWith("zh") ? "zh-CN" : "en";
  return lookup(catalogs[locale], key) || lookup(catalogs.en, key) || fallback || key;
}
