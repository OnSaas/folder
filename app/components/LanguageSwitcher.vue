<script setup lang="ts">
const { locale, setLocale, t } = useI18n();
const { user } = useUserSession();

const options = computed(() => [
  { value: "en", label: t("language.en") },
  { value: "zh-CN", label: t("language.zhCN") },
]);

const persist = async (code: "en" | "zh-CN") => {
  await setLocale(code);
  if (user.value) {
    try {
      await $fetch("/api/user/locale", {
        method: "POST",
        body: { locale: code },
      });
    } catch {
      // cookie still holds the choice
    }
  }
};
</script>

<template>
  <USelect
    :model-value="locale"
    :items="options"
    :aria-label="t('language.label')"
    size="sm"
    class="w-28"
    @update:model-value="persist"
  />
</template>
