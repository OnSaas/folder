<script setup lang="ts">
const { t } = useI18n();
const props = defineProps<{
  file: IFile;
  publishing: boolean;
}>();
const emit = defineEmits(["update"]);
const domain = ref<string>();
const visibility = ref<string>(props.file.visibility);
const visibilityItems = computed(() =>
  visibilityOptions.map((item) => ({
    ...item,
    label: t("filter." + item.value),
  }))
);
const onConfirm = () => {
  emit("update", { visibility: visibility.value, domain: domain.value });
};
</script>
<template>
  <UModal
    v-if="file"
    :title="$t('publish.title', { name: file.name })"
    :description="$t('publish.description')"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <div class="flex flex-row items-center justify-between gap-4">
          <label class="text-sm font-light min-w-24">{{ $t("publish.visibility") }}</label>
          <USelect
            :icon="visibilityOptions.find((item) => item.value === visibility)?.icon"
            v-model="visibility"
            :items="visibilityItems"
            variant="outline"
            class="w-full"
          />
        </div>
        <template v-if="visibility === 'public' && file.type === 'folder'">
          <div class="text-sm font-light">
            {{ $t("publish.websiteHint") }}
          </div>
          <div class="flex flex-row items-center justify-between gap-4">
            <label class="text-sm font-light min-w-24">{{ $t("publish.domain") }}</label>
            <UInput
              v-model="domain"
              type="url"
              :placeholder="$t('publish.domainPlaceholder')"
              required
              class="w-full"
            />
          </div>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="flex items-center justify-end w-full">
        <UButton
          :loading="publishing"
          color="primary"
          variant="solid"
          @click="onConfirm"
          >{{ $t("common.confirm") }}</UButton
        >
      </div>
    </template>
  </UModal>
</template>
