export default defineNuxtPlugin(() => {
  const { locale, setLocale } = useI18n();
  const { user } = useUserSession();

  const mapBrowser = (lang?: string) => {
    if (!lang) return null;
    const lower = lang.toLowerCase();
    if (lower.startsWith("zh")) return "zh-CN";
    if (lower.startsWith("en")) return "en";
    return null;
  };

  if (import.meta.client) {
    const cookie = useCookie("folder_locale");
    if (user.value?.locale) {
      setLocale(user.value.locale);
    } else if (!cookie.value) {
      const mapped = mapBrowser(navigator.language);
      if (mapped && mapped !== locale.value) setLocale(mapped);
    }
  }

  watch(
    () => user.value?.locale,
    (next) => {
      if (next && next !== locale.value) setLocale(next);
    }
  );
});
