<script setup lang="ts">
const { clear } = useUserSession();
const { t } = useI18n();
const route = useRoute();
const { bucket } = useBucket();
const settingsTo = () => {
  const name = (route.params.bucket as string) || bucket.value?.name;
  return name ? `/${name}/settings` : "/settings";
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
        content: 'w-48',
      }"
    >
      <UButton icon="lucide:user" variant="text" size="xl" />
    </UDropdownMenu>
  </div>
</template>
