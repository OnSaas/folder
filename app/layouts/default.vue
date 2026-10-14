<script setup>
const route = useRoute();
const { aside } = useAside();
const { folder } = useFolder();
</script>
<template>
  <div
    class="flex flex-col justify-start min-h-screen bg-neutral-100 dark:bg-neutral-900"
  >
    <AppHeader />
    <div class="flex px-4 sm:px-18 h-screen overflow-auto relative">
      <AppAside v-if="route.params?.bucket" />
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
