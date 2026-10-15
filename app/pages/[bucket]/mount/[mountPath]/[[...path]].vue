<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const mountPath = computed(() => String(route.params.mountPath || ""));
const {
  items,
  loading,
  error,
  cursor,
  restPath,
  storage,
  readonly,
  refresh,
  loadMore,
  joinPath,
  api,
} = useMountFiles(mountPath);

const mkdirOpen = ref(false);
const mkdirName = ref("");
const busy = ref(false);
const uploading = ref(false);
const toast = useToast();

const crumbs = computed(() => {
  const parts = restPath.value.split("/").filter(Boolean);
  const list = [{ label: storage.value?.name || mountPath.value, to: `/${route.params.bucket}/mount/${mountPath.value}/` }];
  let acc = "";
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    list.push({ label: part, to: `/${route.params.bucket}/mount/${mountPath.value}/${acc}` });
  }
  return list;
});

const open = (item: any) => {
  if (item.type === "folder") {
    navigateTo(`/${route.params.bucket}/mount/${mountPath.value}/${item.path}`);
  } else {
    window.open(`${api("/file")}?path=${encodeURIComponent(item.path)}`, "_blank");
  }
};

const makeDir = async () => {
  if (!mkdirName.value.trim()) return;
  busy.value = true;
  try {
    await $fetch(api("/mkdir"), { method: "POST", body: { path: joinPath(mkdirName.value.trim()) } });
    mkdirName.value = "";
    mkdirOpen.value = false;
    await refresh();
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t("errors.generic"), color: "error" });
  } finally {
    busy.value = false;
  }
};

const onUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    await $fetch(api("/upload/part"), {
      method: "POST",
      headers: {
        "x-object-path": joinPath(file.name),
        "content-type": file.type || "application/octet-stream",
      },
      body: file,
    });
    toast.add({ title: t("common.success"), color: "success" });
    await refresh();
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t("errors.generic"), color: "error" });
  } finally {
    uploading.value = false;
    input.value = "";
  }
};
</script>
<template>
  <AppMain :title="storage?.name || mountPath" :crumbs="crumbs" :badge="storage?.type">
    <div class="flex flex-col gap-6">
      <div v-if="readonly" class="text-sm opacity-70">{{ t("mount.readOnlyHint") }}</div>

      <div v-if="!readonly" class="flex flex-wrap items-center gap-2">
        <UButton size="sm" icon="lucide:folder-plus" @click="mkdirOpen = true">
          {{ t("settings.mkdir") }}
        </UButton>
        <label>
          <span
            class="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-neutral-200 dark:border-neutral-700 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Icon name="lucide:upload" class="size-4" />
            {{ t("settings.uploadHere") }}
          </span>
          <input type="file" class="hidden" :disabled="uploading" @change="onUpload" />
        </label>
      </div>

      <p v-if="error" class="text-sm text-red-500 break-all">{{ error }}</p>

      <div class="flex flex-col gap-2">
        <MountFile
          v-for="item in items"
          :key="item.id"
          :item="item"
          :mount-path="mountPath"
          :readonly="readonly"
          @open="open"
          @changed="refresh"
        />
        <p v-if="loading" class="text-sm opacity-60">{{ t("search.placeholder") }}…</p>
        <div
          v-else-if="!items.length"
          class="flex flex-col items-center justify-center min-h-[30vh] opacity-50 border border-neutral-200 dark:border-neutral-800"
        >
          <Icon name="lucide:hard-drive" class="size-12 *:stroke-[1px]" />
          <span>{{ t("empty.noFiles") }}</span>
        </div>
      </div>

      <UButton v-if="cursor" class="mx-auto max-w-48" @click="loadMore">
        {{ t("list.loadMore") }}
      </UButton>
    </div>
  </AppMain>

  <UModal v-model:open="mkdirOpen" :title="t('settings.mkdir')">
    <template #body>
      <UInput v-model="mkdirName" :placeholder="t('settings.mkdir')" class="w-full" />
    </template>
    <template #footer>
      <UButton variant="ghost" @click="mkdirOpen = false">{{ t("common.cancel") }}</UButton>
      <UButton :loading="busy" @click="makeDir">{{ t("common.submit") }}</UButton>
    </template>
  </UModal>
</template>
