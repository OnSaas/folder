<script setup lang="ts">
const route = useRoute();
const { bucket } = useBucket();
watch(
  [() => route.params.bucket, bucket],
  () => {
    const name = (route.params.bucket as string) || bucket.value?.name;
    if (name) navigateTo(`/${name}/settings`, { replace: true });
  },
  { immediate: true }
);
</script>
<template>
  <div />
</template>
