<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const toast = useToast();
const mountPath = computed(() => String(route.params.mountPath || ""));
const rest = computed(() => {
  const raw = route.params.path;
  if (Array.isArray(raw)) return raw.join("/");
  return String(raw || "");
});
const { data, refresh } = await useFetch(() => `/api/mounts/${mountPath.value}/list`, {
  query: { path: rest },
});
const mkdirName = ref("");
const uploading = ref(false);

const open = (item: any) => {
  const bucket = route.params.bucket;
  if (item.type === "folder") {
    navigateTo(`/${bucket}/mount/${mountPath.value}/${item.path}`);
  } else {
    window.open(`/api/mounts/${mountPath.value}/file?path=${encodeURIComponent(item.path)}`, "_blank");
  }
};

const makeDir = async () => {
  const path = [rest.value, mkdirName.value].filter(Boolean).join("/");
  await $fetch(`/api/mounts/${mountPath.value}/mkdir`, { method: "POST", body: { path } });
  mkdirName.value = "";
  await refresh();
};

const remove = async (item: any) => {
  if (!confirm(t("settings.confirmDelete"))) return;
  await $fetch(`/api/mounts/${mountPath.value}/delete`, { method: "POST", body: { path: item.path } });
  await refresh();
};

const onUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const path = [rest.value, file.name].filter(Boolean).join("/");
    await $fetch(`/api/mounts/${mountPath.value}/upload/part`, {
      method: "POST",
      headers: {
        "x-object-path": path,
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
  <AppMain :title="mountPath">
    <div class="flex flex-col gap-4 max-w-3xl">
      <p class="text-sm font-mono opacity-70">/{{ rest || "" }}</p>
      <div class="flex flex-wrap gap-2 items-center">
        <UInput v-model="mkdirName" :placeholder="t('settings.mkdir')" class="w-40" />
        <UButton size="sm" @click="makeDir">{{ t("settings.mkdir") }}</UButton>
        <label class="text-sm underline cursor-pointer">
          {{ t("settings.uploadHere") }}
          <input type="file" class="hidden" :disabled="uploading" @change="onUpload" />
        </label>
      </div>
      <ul class="divide-y divide-neutral-200 dark:divide-neutral-800">
        <li
          v-for="item in data?.items || []"
          :key="item.id"
          class="py-2 flex items-center justify-between gap-2"
        >
          <button class="text-left min-w-0 truncate" @click="open(item)">
            {{ item.type === "folder" ? "📁" : "📄" }} {{ item.name }}
          </button>
          <UButton size="xs" color="error" variant="ghost" @click="remove(item)">
            {{ t("common.delete") }}
          </UButton>
        </li>
      </ul>
    </div>
  </AppMain>
</template>
