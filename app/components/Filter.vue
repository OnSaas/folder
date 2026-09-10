<script setup lang="ts">
const { t } = useI18n();
const open = ref(false);
const emit = defineEmits(["update"]);
const defaultValue = {
  drive: false,
  contentType: "",
  visibility: "",
  shared: "",
};
const filters = ref({ ...defaultValue });
const fileTypeOptions = computed(() => {
  return Object.keys(fileIcons).map((key) => ({
    value: key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    icon: fileIcons[key],
  }));
});
const sharedOptions = computed(() => [
  { value: "yes", label: t("filter.shared") },
  { value: "no", label: t("filter.notShared") },
]);
const reset = () => {
  filters.value = { ...defaultValue };
  emit("update", null);
};
const onApply = () => {
  emit("update", filters.value);
  open.value = false;
};
const hasFilters = computed(() => {
  return Object.values(filters.value).some((value) => value);
});
</script>
<template>
  <UPopover arrow v-model:open="open">
    <UChip :show="hasFilters" inset>
      <UButton icon="lucide:filter" class="ml-auto" />
    </UChip>
    <template #content>
      <div class="flex flex-col gap-4 p-4 w-48">
        <USwitch v-model="filters.drive" :label="$t('filter.entireDrive')" />
        <USelect
          :placeholder="$t('filter.fileType')"
          v-model="filters.contentType"
          :items="fileTypeOptions"
          variant="outline"
        />
        <USelect
          :placeholder="$t('filter.visibility')"
          v-model="filters.visibility"
          :items="['public', 'private']"
          variant="outline"
        />
        <USelect
          :placeholder="$t('filter.sharing')"
          v-model="filters.shared"
          :items="sharedOptions"
          variant="outline"
        />
        <div class="flex flex-row items-center justify-between gap-2">
          <UButton color="primary" variant="solid" @click="onApply">
            {{ $t("common.apply") }}
          </UButton>
          <UButton @click="reset" color="primary"> {{ $t("common.reset") }} </UButton>
        </div>
      </div>
    </template>
  </UPopover>
</template>
