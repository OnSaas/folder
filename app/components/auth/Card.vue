<script setup lang="ts">
const { t } = useI18n();
const { auth } = useAppConfig();
const colorMode = useColorMode();
const props = defineProps<{
  title: string;
  description: string;
}>();
const isDark = computed(() => colorMode.value === "dark");
</script>
<template>
  <div class="max-w-md w-full flex flex-col items-center gap-6">
    <img :src="isDark ? '/logo-dark.png' : '/logo.png'" class="w-30 mx-auto" />
    <p class="text-center text-sm">
      {{ $t("auth.welcomeDemo") }}<br />{{ $t("auth.pleaseSignUp") }}
    </p>
    <UCard class="w-full">
      <h3 class="font-semibold text-neutral-950 dark:text-neutral-50">
        {{ title }}
      </h3>
      <p class="text-neutral-500 dark:text-neutral-400 text-sm">
        {{ description }}
      </p>
      <div class="flex flex-col gap-4 py-4">
        <AuthButton
          v-for="provider in auth.providers"
          :key="provider"
          :provider="provider"
        />
        <UAlert
          :title="$t('common.note')"
          icon="lucide:message-square-warning"
          color="neutral"
          variant="subtle"
          :description="$t('auth.demoNote')"
        />
      </div>
    </UCard>
    <span class="text-sm"
      >{{ $t("auth.hostYour") }}
      <a href="https://folder.run" class="text-primary-500">Folder</a></span
    >
  </div>
</template>
