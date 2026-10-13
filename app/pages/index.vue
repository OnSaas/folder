<script setup lang="ts">
const router = useRouter();
const { bucket, loading } = useBucket();
watch(bucket, () => {
  if (bucket.value?.name) {
    router.push(`/${bucket.value.name}`);
  }
});
onMounted(() => {
  if (bucket.value?.name) {
    router.push(`/${bucket.value.name}`);
  }
});
</script>
<template>
  <div v-if="loading" class="flex justify-center py-24">
    <UIcon name="lucide:loader-circle" class="animate-spin size-6" />
  </div>
</template>
