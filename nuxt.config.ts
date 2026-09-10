export default defineNuxtConfig({
  devtools: { enabled: true },
  nitro: {
    preset: "cloudflare_module",
  },
  routeRules: {
    "/**": { ssr: false },
    "/api/**": { ssr: true },
    "/preview/**": { ssr: true },
    "/public/**": { cors: true, ssr: true },
  },
  modules: [
    "@nuxt/ui",
    "@nuxthub/core",
    "nuxt-auth-utils",
    "@formkit/auto-animate/nuxt",
    "@nuxtjs/i18n",
  ],
  css: ["~/assets/css/main.css"],
  hub: {
    blob: true,
    kv: true,
  },
  i18n: {
    locales: [
      { code: "en", language: "en-US", file: "en.json", name: "English" },
      { code: "zh-CN", language: "zh-CN", file: "zh-CN.json", name: "简体中文" },
    ],
    defaultLocale: "en",
    lazy: true,
    langDir: "locales",
    restructureDir: "i18n",
    strategy: "no_prefix",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "folder_locale",
      fallbackLocale: "en",
      redirectOn: "root",
    },
    vueI18n: "./i18n.config.ts",
    bundle: {
      optimizeTranslationDirective: false,
    },
  },
  icon: {
    mode: "svg",
  },
  future: {
    compatibilityVersion: 4,
  },
  compatibilityDate: "2024-11-27",
});
