<script setup lang="ts">
const { t } = useI18n();
definePageMeta({ middleware: "auth" });
useSeoMeta({ title: "Settings" });
</script>

<template>
  <AppMain :title="t('settings.title')">
    <UCard class="max-w-md">
      <UFormField :label="t('settings.language')">
        <LanguageSwitcher />
      </UFormField>
    </UCard>
  </AppMain>
</template>
