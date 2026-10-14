<script setup>
import { onClickOutside } from "@vueuse/core";

const route = useRoute();
const { aside, close } = useAside();
const { folder } = useFolder();
const asideRef = ref(null);

// 桌面端也自动收回；想让桌面端保持常驻，改成 false
const AUTO_CLOSE_ON_DESKTOP = true;
const shouldClose = () =>
  aside.value && (AUTO_CLOSE_ON_DESKTOP || window.innerWidth < 640);

onClickOutside(
  asideRef,
  () => {
    if (shouldClose()) close();
  },
  { ignore: ["[data-aside-toggle]"] }
);
watch(
  () => route.fullPath,
  () => {
    if (shouldClose()) close();
  }
);
</script>
<template>
  <div
    class="flex flex-col justify-start min-h-screen bg-neutral-100 dark:bg-neutral-900"
  >
    <AppHeader />
    <div class="flex px-4 sm:px-18 h-screen overflow-auto relative">
      <AppAside v-if="route.params?.bucket" ref="asideRef" />
      <div
        :class="[
          'py-24 grow transition-all duration-200 ease-in-out',
          aside ? 'sm:ml-48' : 'ml-0',
        ]"
      >
        <slot />
      </div>
    </div>
    <AppFooter v-if="route.params?.bucket" />
  </div>
</template>
