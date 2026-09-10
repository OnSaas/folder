<script setup>
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const open = ref(false);
const loading = ref(false);
const error = ref("");
const form = ref({
  name: "",
  type: "folder",
});

const { folder } = useFolder();

const items = computed(() => [
  [
    {
      label: t("folder.newFolder"),
      icon: "i-lucide-folder-plus",
      onSelect: () => {
        form.value.type = "folder";
        open.value = true;
      },
      kbds: ["meta", "n"],
    },
    {
      label: t("file.newFile"),
      icon: "i-lucide-file-plus",
      onSelect: () => {
        form.value.type = "file";
        open.value = true;
      },
    },
  ],
]);
const onSubmit = async () => {
  if (!form.value.name) {
    error.value = t("create.nameRequired");
    return;
  }
  if (form.value.type === "file" && !form.value.name.includes(".")) {
    error.value = t("create.needExtension");
    return;
  }
  if (form.value.name.includes("/")) {
    error.value = t("create.noSlash");
    return;
  }
  loading.value = true;
  try {
    const data = await $fetch(
      `/api/folder/${route.params.bucket}/${route.params.id || "root"}`,
      {
        method: "POST",
        body: form.value,
      }
    );
    if (data.id) {
      open.value = false;
      form.value.name = "";
      if (form.value.type === "folder") {
        router.push(`/${route.params.bucket}/${data.id}`);
      } else {
        window.location.reload();
      }
    }
    loading.value = false;
  } catch (errors) {
    if (errors?.data?.message) {
      error.value = errors.data.message;
    } else {
      error.value = t("errors.generic");
    }
    loading.value = false;
  }
};
</script>
<template>
  <UModal
    v-model:open="open"
    :title="$t('create.title', { type: form.type })"
    :description="$t('create.description', { type: form.type })"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField
          :error="error"
          :help="`${folder?.path ? folder.path : route.params.bucket}/${
            form.name
          }`"
        >
          <UInput
            :label="$t('sort.name')"
            v-model="form.name"
            :placeholder="$t('create.placeholder', { type: form.type })"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <div class="flex justify-end gap-4 mt-8">
          <UButton :label="$t('common.cancel')" color="neutral" @click="open = false" />
          <UButton
            :label="$t('common.submit')"
            color="primary"
            variant="solid"
            :loading="loading"
            @click="onSubmit"
          />
        </div>
      </div>
    </template>
  </UModal>
  <UDropdownMenu
    :items="items"
    :ui="{
      content: 'w-48',
    }"
  >
    <UButton icon="lucide:plus" :label="$t('common.new')" />
  </UDropdownMenu>
</template>
