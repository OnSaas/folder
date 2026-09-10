<script setup lang="ts">
const props = defineProps<{
  file: IFile;
  loading: boolean;
  error: string;
}>();
const name = ref<string>("duplicate-" + props.file.name);
const emit = defineEmits(["submit"]);
const onSubmit = () => {
  emit("submit", name.value);
};
</script>
<template>
  <UModal
    :title="$t('copy.title')"
    :description="$t('file.makeCopy')"
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
      <UFormField :label="$t('rename.newName', { type: file.type })" class="w-full">
        <UInput v-model="name" class="w-full" />
      </UFormField>
    </template>
    <template #footer>
      <UButton
        @click="onSubmit"
        :loading="loading"
        color="primary"
        variant="solid"
        >{{ $t("copy.action") }}</UButton
      >
    </template>
  </UModal>
</template>
