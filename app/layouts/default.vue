<script setup lang="ts">
import { onClickOutside } from "@vueuse/core";

const route = useRoute();
const { aside, close } = useAside();
const { selected, resetSelected } = useSelected();
const { open, opened } = usePreview();
const asideRef = ref(null);

const shouldClose = () => aside.value;

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

defineShortcuts({
  meta_b: useAside().toggle,
  escape: () => {
    // Priority: preview > selection > sidebar
    if (open.value) {
      open.value = false;
      opened.value = -1;
      return;
    }
    if (selected.value.length) {
      resetSelected();
      return;
    }
    if (aside.value) close();
  },
});
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
          aside ? 'sm:ml-60' : 'ml-0',
        ]"
      >
        <slot />
      </div>
    </div>
    <AppFooter v-if="route.params?.bucket" />
    <UploadQueue v-if="route.params?.bucket" />
  </div>
</template>
