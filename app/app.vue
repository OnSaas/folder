<script setup lang="ts">
const { locale, setLocale } = useI18n();
const { user } = useUserSession();

const mapBrowser = (lang?: string) => {
  if (!lang) return null;
  const lower = lang.toLowerCase();
  if (lower.startsWith("zh")) return "zh-CN" as const;
  if (lower.startsWith("en")) return "en" as const;
  return null;
};

onMounted(() => {
  if (user.value?.locale) {
    setLocale(user.value.locale);
    return;
  }
  const mapped = mapBrowser(navigator.language);
  if (mapped && mapped !== locale.value) setLocale(mapped);
});

watch(
  () => user.value?.locale,
  (next) => {
    if (next && next !== locale.value) setLocale(next);
  }
);
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
