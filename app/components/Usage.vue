<script setup lang="ts">
const { bucket } = useBucket();
const config = useRuntimeConfig();
const limit = (config.public.storageLimitGb as number) * 1000 * 1000 * 1000;
const used = computed(() => {
  if (bucket.value && bucket.value.size) return bucket.value.size;
  else return 0;
});
const usedPercentage = computed(() => {
  return (used.value / limit) * 100;
});
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
