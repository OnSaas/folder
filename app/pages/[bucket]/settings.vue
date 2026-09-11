<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
useSeoMeta({ title: "Settings" });

const username = ref("");
const password = ref("");
const saving = ref(false);
const saved = ref(false);
const error = ref("");
const davUrl = computed(() => {
  if (!import.meta.client) return "/dav";
  return `${window.location.origin}/dav`;
});
const webdavUrl = computed(() => {
  if (!import.meta.client) return "/webdav";
  return `${window.location.origin}/webdav`;
});
const { data: dav, refresh } = await useFetch("/api/user/dav");
watch(
  dav,
  (value) => {
    if (!value) return;
    username.value = value.username || "";
    password.value = value.password || "";
  },
  { immediate: true }
);

const saveDav = async () => {
  error.value = "";
  saved.value = false;
  if (!username.value.trim()) {
    error.value = t("settings.davUsernameRequired");
    return;
  }
  if (password.value.length < 8) {
    error.value = t("settings.davPasswordShort");
    return;
  }
  saving.value = true;
  try {
    await $fetch("/api/user/dav-password", {
      method: "POST",
      body: { username: username.value, password: password.value },
    });
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
    <div class="flex flex-col gap-8 max-w-lg">
      <UFormField :label="t('settings.language')">
        <LanguageSwitcher />
      </UFormField>
      <div class="flex flex-col gap-4">
        <h3 class="text-lg font-light">{{ t("settings.dav") }}</h3>
        <p class="text-sm opacity-70">{{ t("settings.davHint") }}</p>
        <UFormField :label="t('settings.davUrl')">
          <UInput :model-value="davUrl" readonly class="w-full" />
        </UFormField>
        <UFormField :label="t('settings.webdavUrl')">
          <UInput :model-value="webdavUrl" readonly class="w-full" />
        </UFormField>
        <UFormField :label="t('settings.davUsername')">
          <UInput v-model="username" autocomplete="off" class="w-full" />
        </UFormField>
        <UFormField :label="t('settings.davPassword')" :error="error">
          <UInput v-model="password" type="text" autocomplete="off" class="w-full" />
        </UFormField>
        <div class="flex items-center gap-4">
          <UButton color="primary" variant="solid" :loading="saving" @click="saveDav">
            {{ t("settings.saveDav") }}
          </UButton>
          <p v-if="saved" class="text-sm">{{ t("common.success") }}</p>
        </div>
      </div>
    </div>
  </AppMain>
</template>
