<script setup lang="ts">
const { t } = useI18n();
const sort = ref({
  sortBy: "createdAt",
  order: "asc",
});
const sortOptions = computed(() => [
  { value: "name", label: t("sort.name") },
  { value: "updatedAt", label: t("sort.modified") },
  { value: "createdAt", label: t("sort.created") },
]);
const emit = defineEmits(["update"]);
watch(
  sort,
  () => {
    emit("update", sort.value);
  },
  { deep: true }
);
</script>
<template>
  <UButtonGroup>
    <UTooltip :text="$t('sort.changeOrder')" arrow :delay-duration="0">
      <UButton
        :icon="
          sort.order === 'asc'
            ? 'lucide:arrow-down-wide-narrow'
            : 'lucide:arrow-up-narrow-wide'
        "
        @click="sort.order = sort.order === 'asc' ? 'desc' : 'asc'"
      />
    </UTooltip>
    <USelect v-model="sort.sortBy" :items="sortOptions" class="w-32" />
  </UButtonGroup>
</template>
