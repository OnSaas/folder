<script setup>
const route = useRoute();
const { folder } = useFolder();
const type = ref("files");
const uploadProgress = ref({});
const totalFiles = ref(0);
const uploadedFiles = ref(0);
const isUploading = ref(false);
const emit = defineEmits(["success"]);

const uploadFiles = async (event) => {
  const files = event.target.files;
  if (!files.length) return;

  totalFiles.value = files.length;
  uploadedFiles.value = 0;
  isUploading.value = true;

  await Promise.all([...files].map(uploadFile));

  // Reset after all uploads complete
  setTimeout(() => {
    if (
      Object.values(uploadProgress.value).every((progress) => progress === 100)
    ) {
      isUploading.value = false;
    }
  }, 1000);
};
const allUploaded = computed(() => {
  return Object.values(uploadProgress.value).every(
    (progress) => progress === 100
  );
});
watch(allUploaded, (value) => {
  if (value) {
    uploadProgress.value = {};
    emit("success");
  }
});

const uploadFile = async (file) => {
  // Get the relative path of the file within the uploaded folder structure
  // webkitRelativePath gives the path relative to the selected folder (e.g., "assets/images/background.png")
  const relativePath = file.webkitRelativePath || file.name;
  const fileType = file.type.split("/")[0];
  let dimensions = null;
  if (fileType === "image") {
    const image = new Image();
    image.src = URL.createObjectURL(file);
    await new Promise((resolve) => {
      image.onload = () => {
        dimensions = image.width + "x" + image.height;
        resolve();
      };
    });
  }
  // Use the relative path for progress tracking
  uploadProgress.value[relativePath] = 0;

  // Get the current folder path
  const currentFolderPath = folder.value?.path
    ? "/" + folder.value.path
    : route.params.bucket;

  // For folder uploads, extract directory path from webkitRelativePath
  let uploadPath = currentFolderPath;
  if (file.webkitRelativePath) {
    // Extract the folder structure from the webkitRelativePath
    // For a file like "assets/images/background.png", this gets "assets/images/"
    const pathParts = file.webkitRelativePath.split("/");

    // Remove the filename (last part) to get the directory structure
    pathParts.pop();

    if (pathParts.length > 0) {
      // Add the directory structure to the upload path
      uploadPath = `${currentFolderPath}/${pathParts.join("/")}`;
    }
  }
  const partSize = chunkSize(file.size);
  const upload = useMultipartUpload(
    `/upload/${route.params.bucket}/${route.params.id || "root"}`,
    {
      partSize: partSize,
      concurrent: 10,
      prefix: uploadPath,
      fetchOptions: {
        headers: {
          "x-amz-meta-dimensions": dimensions,
          "x-amz-meta-content-type": file.type,
        },
      },
    }
  );
  const { progress, completed, abort } = upload(file);
  // Watch the progress
  watch(progress, (value) => {
    uploadProgress.value[relativePath] = value;
  });

  // When completed
  await completed;
  uploadedFiles.value++;
  // uploadProgress.value[file.name] = 100;
  uploadProgress.value[relativePath] = 100;
};

const overallProgress = computed(() => {
  if (!Object.keys(uploadProgress.value).length) return 0;

  const sum = Object.values(uploadProgress.value).reduce(
    (acc, val) => acc + val,
    0
  );
  return Math.round(sum / Object.keys(uploadProgress.value).length);
});
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
        :label="type === 'folder' ? 'Upload Folder' : 'Upload Files'"
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

    <UModal v-model:open="isUploading" :dismissible="false">
      <template #title>{{ $t("file.upload") }}</template>
      <template #description
        >{{ uploadedFiles }} / {{ totalFiles }}</template
      >
      <template #body>
        <div class="space-y-4">
          <div>
            <p class="mb-1 font-medium">{{ $t("upload.progress") }}</p>
            <UProgress :value="overallProgress" color="primary" />
          </div>

          <div
            v-if="Object.keys(uploadProgress).length >= 1"
            class="max-h-60 overflow-y-auto space-y-2"
          >
            <div
              v-for="(progress, fileName) in uploadProgress"
              :key="fileName"
              class="text-sm"
            >
              <div class="flex justify-between mb-1">
                <p class="truncate">{{ fileName }}</p>
                <span>{{ progress.toFixed(1) }}%</span>
              </div>
              <UProgress :modelValue="progress" :max="100" color="primary" />
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
