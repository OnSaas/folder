<script setup lang="ts">
const { clear, user } = useUserSession();
const { t } = useI18n();
const route = useRoute();
const { bucket } = useBucket();
const settingsTo = () => {
  const name = (route.params.bucket as string) || bucket.value?.name;
  return name ? `/${name}/settings` : "/settings";
};
const signOut = () => {
  clear();
  navigateTo("/auth/signin");
};
const items = computed(() => [
  [
    {
      label: user.value?.name,
      avatar: {
        src: user.value?.avatar,
      },
      type: "label",
    },
  ],
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
  <div v-if="user" class="relative">
    <UDropdownMenu
      :items="items"
      :ui="{
        content: 'w-48',
      }"
    >
      <UAvatar
        v-if="user?.provider === 'github'"
        :src="user?.avatar"
        :alt="user?.name"
        size="xl"
        class="border border-neutral-200 dark:border-neutral-700"
      />
      <UButton v-else icon="lucide:user" variant="text" size="xl" />
    </UDropdownMenu>
  </div>
</template>
