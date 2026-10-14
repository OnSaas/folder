<script setup lang="ts">
const route = useRoute();
const { aside } = useAside();
const { t } = useI18n();

const { data: storages } = await useFetch("/api/storages");

const items = computed(() => {
  const bucket = route.params.bucket;
  const mounts = (storages.value || [])
    .filter((item: any) => item.id !== "primary")
    .map((item: any) => ({
      label: item.name,
      icon: "lucide:hard-drive",
      to: `/${bucket}/mount/${item.mountPath}/`,
    }));
  return [
    [
      {
        label: t("navigation.home"),
        icon: "lucide:home",
        to: `/${bucket}/`,
      },
      {
        label: t("navigation.recent"),
        icon: "lucide:clock",
        to: `/${bucket}/recent`,
      },
      {
        label: t("navigation.favorites"),
        icon: "lucide:star",
        to: `/${bucket}/favorites`,
      },
    ],
    [
      {
        label: t("navigation.published"),
        icon: "lucide:globe",
        to: `/${bucket}/published`,
      },
    ],
    mounts,
    [
      {
        label: t("navigation.trash"),
        icon: "lucide:trash",
        to: `/${bucket}/trash`,
      },
      {
        label: t("navigation.settings"),
        icon: "lucide:settings",
        to: `/${bucket}/settings`,
      },
    ],
  ];
});
</script>

<template>
  <div
    :class="[
      'border-r border-neutral-100 dark:border-neutral-700/50 h-screen px-4 pt-24 pb-12 fixed top-0 bottom-0 left-0 z-8 bg-white dark:bg-neutral-950 overflow-hidden transition-all duration-200 ease-in-out',
      aside ? 'translate-x-0' : '-translate-x-full',
    ]"
  >
    <div class="flex flex-col gap-4 h-full">
      <UNavigationMenu
        orientation="vertical"
        :items="items"
        class="data-[orientation=vertical]:w-48"
      />
      <div class="grow flex items-end justify-center">
        <Usage />
      </div>
    </div>
  </div>
</template>
