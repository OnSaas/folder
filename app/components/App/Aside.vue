<script setup lang="ts">
const route = useRoute();
const { aside } = useAside();
const { t } = useI18n();

const { data: storages } = await useFetch("/api/storages");
const { data: syncSummary } = await useFetch("/api/sync/summary");

const statusColor = (status?: string) =>
  status === "ok" ? "bg-green-500" : status === "error" ? "bg-red-500" : "bg-neutral-400";

const mounts = computed(() =>
  (storages.value || []).filter((item: any) => item.id !== "primary")
);

const syncLabel = computed(() => {
  const failed = syncSummary.value?.failed || 0;
  return failed ? `${t("navigation.sync")} (${failed})` : t("navigation.sync");
});

const groups = computed(() => [
  {
    key: "files",
    title: t("navigation.groupFiles"),
    items: [
      { label: t("navigation.home"), icon: "lucide:home", to: `/${route.params.bucket}/` },
      { label: t("navigation.recent"), icon: "lucide:clock", to: `/${route.params.bucket}/recent` },
      { label: t("navigation.favorites"), icon: "lucide:star", to: `/${route.params.bucket}/favorites` },
      { label: t("navigation.published"), icon: "lucide:globe", to: `/${route.params.bucket}/published` },
    ],
  },
  {
    key: "storage",
    title: t("navigation.groupStorage"),
    items: [
      { label: t("settings.storages"), icon: "lucide:hard-drive", to: `/${route.params.bucket}/settings#storage` },
    ],
  },
  {
    key: "sync",
    title: t("navigation.groupSync"),
    items: [
      { label: syncLabel, icon: "lucide:refresh-cw", to: `/${route.params.bucket}/settings#sync` },
    ],
  },
  {
    key: "system",
    title: t("navigation.groupSystem"),
    items: [
      { label: t("navigation.trash"), icon: "lucide:trash", to: `/${route.params.bucket}/trash` },
      { label: t("navigation.settings"), icon: "lucide:settings", to: `/${route.params.bucket}/settings` },
    ],
  },
]);
</script>

<template>
  <div
    :class="[
      'border-r border-neutral-100 dark:border-neutral-700/50 h-screen px-4 pt-24 pb-12 fixed top-0 bottom-0 left-0 z-8 bg-white dark:bg-neutral-950 overflow-y-auto transition-all duration-200 ease-in-out w-60',
      aside ? 'translate-x-0' : '-translate-x-full',
    ]"
  >
    <div class="flex flex-col gap-5">
      <div v-for="group in groups" :key="group.key" class="flex flex-col gap-1">
        <p class="px-2 text-xs uppercase tracking-wide opacity-50">{{ group.title }}</p>
        <UNavigationMenu orientation="vertical" :items="[group.items]" />
        <ul v-if="group.key === 'storage' && mounts.length" class="flex flex-col">
          <li v-for="mount in mounts" :key="mount.id">
            <NuxtLink
              :to="`/${route.params.bucket}/mount/${mount.mountPath}/`"
              class="flex items-center gap-2.5 px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <Icon name="lucide:hard-drive" class="size-4 opacity-70" />
              <span :class="['size-1.5 rounded-full shrink-0', statusColor(mount.status)]" />
              <span class="truncate">{{ mount.name }}</span>
              <span v-if="mount.readOnly" class="ml-auto text-xs opacity-50">{{ t("settings.readOnly") }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>

      <div class="pt-2">
        <Usage />
      </div>
    </div>
  </div>
</template>
