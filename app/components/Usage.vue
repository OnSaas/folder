<script setup lang="ts">
const { bucket } = useBucket();
const config = useRuntimeConfig();
const limit = (config.public.storageLimitGb as number) * 1000 * 1000 * 1000;
const used = computed(() => bucket.value?.size || 0);
const usedPercentage = computed(() => (limit ? (used.value / limit) * 100 : 0));
</script>
<template>
  <UFormField
    :label="$t('usage.storage')"
    :help="$t('usage.usedOf', { used: formatBytes(used), limit: formatBytes(limit) })"
    size="sm"
    class="w-full"
  >
    <UProgress :modelValue="usedPercentage" />
  </UFormField>
</template>
