<script setup lang="ts">
defineProps<{
  file: IFile;
  loading: boolean;
  error: string;
}>();
const parent = ref<IFile | null>(null);
const emit = defineEmits(["update"]);
const onSelect = (folder: IFile) => {
  parent.value = folder;
};
const onMove = () => {
  if (!parent.value) return;
  emit("submit", parent.value.id);
};
</script>
<template>
  <UModal
    :title="$t('move.title', { name: file.name, type: file.type })"
    :description="$t('move.description', { type: file.type })"
  >
    <template #body>
      <UAlert
        v-if="error"
        :title="$t('common.error')"
        :description="error"
        color="error"
        variant="soft"
        icon="lucide:message-circle-warning"
        class="mb-4"
      />

      <UFormField :label="$t('move.selectFolder')">
        <FolderPicker @select="onSelect" />
      </UFormField>
      <UAlert
        v-if="parent"
        class="mt-4"
        :title="$t('move.action')"
        color="neutral"
        variant="subtle"
      >
        <template #description>
          <div class="flex justify-start items-center gap-2">
            {{ file.path }}
            <Icon name="lucide:arrow-right" class="" />
            {{ parent.path + "/" + file.name }}
          </div>
        </template>
      </UAlert>
    </template>
    <template #footer>
      <UButton
        @click="onMove"
        :loading="loading"
        color="primary"
        variant="solid"
        >{{ $t("move.action") }}</UButton
      >
    </template>
  </UModal>
</template>
