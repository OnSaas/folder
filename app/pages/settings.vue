<script setup lang="ts">
const { t } = useI18n();
definePageMeta({ middleware: "auth" });
useSeoMeta({ title: "Settings" });

const password = ref("");
const saving = ref(false);
const saved = ref(false);
const error = ref("");
const davUrl = computed(() => {
  if (!import.meta.client) return "/dav";
  return `${window.location.origin}/dav`;
});
const { data: dav, refresh } = await useFetch("/api/user/dav");

const saveDav = async () => {
  error.value = "";
  saved.value = false;
  if (password.value.length < 8) {
    error.value = t("settings.davPasswordShort");
    return;
  }
  saving.value = true;
  try {
    await $fetch("/api/user/dav-password", {
      method: "POST",
      body: { password: password.value },
    });
    password.value = "";
    saved.value = true;
    await refresh();
  } catch (e: any) {
    error.value = e?.data?.message || t("errors.generic");
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <AppMain :title="t('settings.title')">
    <div class="flex flex-col gap-6 max-w-md">
      <UCard>
        <UFormField :label="t('settings.language')">
          <LanguageSwitcher />
        </UFormField>
      </UCard>
      <UCard>
        <h3 class="font-medium mb-2">{{ t("settings.dav") }}</h3>
        <p class="text-sm opacity-70 mb-4">{{ t("settings.davHint") }}</p>
        <UFormField :label="t('settings.davUrl')">
          <UInput :model-value="davUrl" readonly />
        </UFormField>
        <UFormField :label="t('settings.davUsername')" class="mt-4">
          <UInput :model-value="dav?.username || ''" readonly />
        </UFormField>
        <p class="text-sm mt-2 mb-4">
          {{ dav?.enabled ? t("settings.davEnabled") : t("settings.davDisabled") }}
        </p>
        <UFormField :label="t('settings.davPassword')" :error="error">
          <UInput v-model="password" type="password" autocomplete="new-password" />
        </UFormField>
        <UButton class="mt-4" color="primary" variant="solid" :loading="saving" @click="saveDav">
          {{ t("settings.saveDav") }}
        </UButton>
        <p v-if="saved" class="text-sm mt-2">{{ t("common.success") }}</p>
      </UCard>
    </div>
  </AppMain>
</template>
