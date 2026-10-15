<script setup lang="ts">
defineProps<{
  title?: string;
  crumbs?: { label: string; to: string }[];
  badge?: string;
}>();
</script>
<template>
  <div class="flex flex-col gap-6 pb-48">
    <FileBreadcrumb :crumbs="crumbs" :badge="badge" />
    <div class="flex justify-start items-center flex-wrap gap-4 w-full">
      <h2
        v-if="title"
        class="text-2xl text-neutral-950 dark:text-neutral-100 font-light"
      >
        {{ title }}
      </h2>
      <slot name="actions" />
    </div>
    <slot />
  </div>
</template>
