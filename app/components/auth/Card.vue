<script setup lang="ts">
const { t } = useI18n();
const { fetch: fetchSession } = useUserSession();
const colorMode = useColorMode();
const password = ref("");
const error = ref("");
const loading = ref(false);
const isDark = computed(() => colorMode.value === "dark");

const submit = async () => {
  error.value = "";
  loading.value = true;
  try {
    await $fetch("/api/auth/login", {
      method: "POST",
      body: { password: password.value },
    });
    await fetchSession();
    await navigateTo("/");
  } catch (e: any) {
    error.value = e?.data?.message || t("errors.invalidPassword");
  } finally {
    loading.value = false;
  }
};
</script>
<template>
  <div class="max-w-md w-full flex flex-col items-center gap-6">
    <img :src="isDark ? '/logo-dark.png' : '/logo.png'" class="w-30 mx-auto" />
    <UCard class="w-full">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <UFormField :label="$t('auth.password')" :error="error">
          <UInput
            v-model="password"
            type="password"
            :placeholder="$t('auth.passwordPlaceholder')"
            autocomplete="current-password"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          color="primary"
          variant="solid"
          :loading="loading"
          block
        >
          {{ $t("auth.signIn") }}
        </UButton>
      </form>
    </UCard>
  </div>
</template>
