<script setup>
const route = useRoute();
const { folder } = useFolder();
const { enqueue } = useUploads();
const type = ref("files");
const emit = defineEmits(["success"]);

const targetLabel = computed(() => {
  const base = folder.value?.path ? `/${folder.value.path}` : `/${route.params.bucket}`;
  return base;
});

const targetPath = computed(() => {
  if (folder.value?.path) return folder.value.path;
  return String(route.params.bucket || "");
});

const uploadFiles = (event) => {
  const files = event.target.files;
  if (!files?.length) return;
  enqueue([...files], {
    bucket: String(route.params.bucket),
    parentId: String(route.params.id || "root"),
    targetPath: targetPath.value,
    targetLabel: targetLabel.value,
    onDone: () => emit("success"),
  });
  event.target.value = "";
};
</script>
<template>
  <div>
    <UButtonGroup>
      <UButton
        color="primary"
        variant="solid"
        :icon="type === 'files' ? 'lucide:file-up' : 'lucide:folder-up'"
        @click="type = type === 'folder' ? 'files' : 'folder'"
        class="opacity-80"
      />
      <UButton
        color="primary"
        variant="solid"
        :label="type === 'folder' ? $t('upload.folder') : $t('upload.files')"
        @click="$refs.fileInput.click()"
      />
      <input
        ref="fileInput"
        type="file"
        :accept="type === 'files' && '*'"
        :webkitdirectory="type === 'folder'"
        :multiple="type === 'files'"
        @change="uploadFiles"
        class="hidden"
      />
    </UButtonGroup>
  </div>
</template>
