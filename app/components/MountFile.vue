<script setup lang="ts">
const { t } = useI18n();
const props = defineProps<{
  item: any;
  mountPath: string;
  readonly?: boolean;
}>();
const emit = defineEmits(["open", "changed"]);

const toast = useToast();

const renameOpen = ref(false);
const moveOpen = ref(false);
const copyOpen = ref(false);
const newName = ref("");
const targetPath = ref("");
const busy = ref(false);

const menuItems = computed(() => [
  [
    {
      label: t("file.open"),
      icon: "lucide:eye",
      disabled: props.item.type === "folder",
      onSelect: () => window.open(downloadUrl(), "_blank"),
    },
    {
      label: t("file.download"),
      icon: "lucide:download",
      disabled: props.item.type === "folder",
      onSelect: () => window.open(downloadUrl(true), "_blank"),
    },
  ],
  [
    {
      label: t("mount.rename"),
      icon: "lucide:pencil",
      disabled: props.readonly,
      onSelect: () => {
        newName.value = props.item.name;
        renameOpen.value = true;
      },
    },
    {
      label: t("mount.move"),
      icon: "lucide:folder-input",
      disabled: props.readonly,
      onSelect: () => {
        targetPath.value = props.item.path;
        moveOpen.value = true;
      },
    },
    {
      label: t("mount.copy"),
      icon: "lucide:copy",
      onSelect: () => {
        targetPath.value = props.item.path;
        copyOpen.value = true;
      },
    },
  ],
  [
    {
      type: "separator",
    },
    {
      label: t("common.delete"),
      icon: "lucide:trash",
      color: "error",
      disabled: props.readonly,
      onSelect: remove,
    },
  ],
]);

function downloadUrl(download = false) {
  const params = new URLSearchParams({ path: props.item.path });
  if (download) params.set("download", "1");
  return `/api/mounts/${props.mountPath}/file?${params.toString()}`;
}

async function remove() {
  if (!confirm(t("settings.confirmDelete"))) return;
  busy.value = true;
  try {
    await $fetch(`/api/mounts/${props.mountPath}/delete`, {
      method: "POST",
      body: { path: props.item.path },
    });
    emit("changed");
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t("errors.generic"), color: "error" });
  } finally {
    busy.value = false;
  }
}

async function submitRename() {
  if (!newName.value.trim()) return;
  busy.value = true;
  try {
    await $fetch(`/api/mounts/${props.mountPath}/rename`, {
      method: "POST",
      body: { from: props.item.path, name: newName.value.trim() },
    });
    toast.add({ title: t("mount.renamed"), color: "success" });
    renameOpen.value = false;
    emit("changed");
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t("errors.generic"), color: "error" });
  } finally {
    busy.value = false;
  }
}

async function submitMove() {
  if (!targetPath.value.trim()) return;
  busy.value = true;
  try {
    await $fetch(`/api/mounts/${props.mountPath}/move`, {
      method: "POST",
      body: { from: props.item.path, to: targetPath.value.trim() },
    });
    toast.add({ title: t("mount.moved"), color: "success" });
    moveOpen.value = false;
    emit("changed");
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t("errors.generic"), color: "error" });
  } finally {
    busy.value = false;
  }
}

async function submitCopy() {
  if (!targetPath.value.trim()) return;
  busy.value = true;
  try {
    await $fetch(`/api/mounts/${props.mountPath}/copy`, {
      method: "POST",
      body: { from: props.item.path, to: targetPath.value.trim() },
    });
    toast.add({ title: t("mount.copied"), color: "success" });
    copyOpen.value = false;
    emit("changed");
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t("errors.generic"), color: "error" });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <UContextMenu :items="menuItems" size="xl">
    <div
      class="flex w-full items-center gap-3 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-900"
      @dblclick="emit('open', item)"
    >
      <Icon
        :name="item.type === 'folder' ? 'lucide:folder' : 'lucide:file'"
        class="size-8 shrink-0 opacity-70 *:stroke-[1px]"
      />
      <div class="min-w-0 grow">
        <p class="text-sm font-medium truncate">{{ item.name }}</p>
        <p class="text-xs opacity-60">
          <span v-if="item.type !== 'folder'">{{ formatBytes(item.size || 0) }}</span>
        </p>
      </div>
      <Icon v-if="readonly" name="lucide:lock" class="size-4 opacity-50" />
    </div>
  </UContextMenu>

  <UModal v-model:open="renameOpen" :title="t('mount.rename')">
    <template #body>
      <UInput v-model="newName" :placeholder="t('mount.newName')" class="w-full" />
    </template>
    <template #footer>
      <UButton variant="ghost" @click="renameOpen = false">{{ t("common.cancel") }}</UButton>
      <UButton :loading="busy" @click="submitRename">{{ t("common.submit") }}</UButton>
    </template>
  </UModal>

  <UModal v-model:open="moveOpen" :title="t('mount.move')">
    <template #body>
      <UInput v-model="targetPath" :placeholder="t('mount.targetPath')" class="w-full" />
    </template>
    <template #footer>
      <UButton variant="ghost" @click="moveOpen = false">{{ t("common.cancel") }}</UButton>
      <UButton :loading="busy" @click="submitMove">{{ t("common.submit") }}</UButton>
    </template>
  </UModal>

  <UModal v-model:open="copyOpen" :title="t('mount.copy')">
    <template #body>
      <UInput v-model="targetPath" :placeholder="t('mount.targetPath')" class="w-full" />
    </template>
    <template #footer>
      <UButton variant="ghost" @click="copyOpen = false">{{ t("common.cancel") }}</UButton>
      <UButton :loading="busy" @click="submitCopy">{{ t("common.submit") }}</UButton>
    </template>
  </UModal>
</template>
