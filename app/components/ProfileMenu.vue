<script setup lang="ts">
const { t, locale, setLocale } = useI18n();
const { user } = useUserSession();
const { clear } = useUserSession();
const route = useRoute();
const colorMode = useColorMode();
const { bucket } = useBucket();

const settingsTo = () => {
  const name = (route.params.bucket as string) || bucket.value?.name;
  return name ? `/${name}/settings` : "/settings";
};

const languageItems = computed(() =>
  [
    { label: t("language.en"), value: "en" as const },
    { label: t("language.zhCN"), value: "zh-CN" as const },
  ].map((item) => ({
    label: item.label,
    icon: locale.value === item.value ? "i-lucide-check" : undefined,
    onSelect: () => persistLocale(item.value),
  }))
);

const themeItems = computed(() => [
  { label: t("theme.light"), value: "light" },
  { label: t("theme.dark"), value: "dark" },
  { label: t("theme.system"), value: "system" },
].map((item) => ({
  label: item.label,
  icon: colorMode.preference === item.value ? "i-lucide-check" : undefined,
  onSelect: () => {
    colorMode.preference = item.value;
  },
})));

const persistLocale = async (code: "en" | "zh-CN") => {
  await setLocale(code);
  if (user.value) {
    try {
      await $fetch("/api/user/locale", { method: "POST", body: { locale: code } });
    } catch {
      // cookie still holds the choice
    }
  }
};

const signOut = async () => {
  try {
    await $fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // session already gone
  }
  await clear();
  await navigateTo("/auth/signin");
};

const items = computed(() => [
  [
    {
      label: t("navigation.settings"),
      icon: "i-lucide-settings",
      onSelect: () => navigateTo(settingsTo()),
    },
    {
      label: t("language.label"),
      icon: "i-lucide-languages",
      children: languageItems.value,
    },
    {
      label: t("theme.label"),
      icon: "i-lucide-sun-moon",
      children: themeItems.value,
    },
  ],
  [
    {
      label: t("auth.logout"),
      icon: "i-lucide-log-out",
      onSelect: signOut,
    },
  ],
]);
</script>

<template>
  <div class="relative">
    <UDropdownMenu
      :items="items"
      :ui="{
        content: 'w-52',
      }"
    >
      <UButton icon="lucide:user" variant="text" size="xl" :aria-label="t('navigation.settings')" />
    </UDropdownMenu>
  </div>
</template>
