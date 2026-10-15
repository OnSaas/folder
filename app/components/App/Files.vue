<script setup lang="ts">
const props = defineProps<{
  title?: string;
  endpoint?: string;
}>();
const route = useRoute();
const router = useRouter();
const { folder } = useFolder();
const { files, isEnd, loadMore, loading, onSort, onFilter, refresh } = useFiles(
  props.endpoint
);
const { opened, limit } = usePreview();
const { selected, toggleSelected, selectRange, resetSelected } = useSelected();
const { openRename } = useRename();
const { openMove } = useMove();
const { openCopy } = useCopy();
const { deleteFiles, deleting, downloadFile } = useFileActions();
const view = useCookie<string>("folder_view", { default: () => "grid" });
const toast = useToast();
const { t } = useI18n();

watch(files, () => {
  if (files.value && files.value.length >= 0) {
    limit.value = 0;
  }
});
const onOpen = (file: IFile, index: number) => {
  if (file.type === "folder") {
    router.push(`/${route.params.bucket}/${file.id}`);
  } else {
    opened.value = index;
  }
};

const onDropInto = (targetId: string) => {
  refresh();
};

const onSelect = (file: IFile, index: number, event: MouseEvent) => {
  if (event.shiftKey) {
    selectRange(
      files.value.map((entry) => entry.id),
      index
    );
    return;
  }
  toggleSelected(file.id, index);
};

const selectedFiles = computed(() =>
  files.value.filter((file) => selected.value.includes(file.id))
);

const downloadSelected = () => {
  const first = selectedFiles.value[0];
  if (!first) return;
  window.open(downloadFile(String(route.params.bucket), first.id), "_blank");
};

defineShortcuts({
  meta_a: () => {
    if (selected.value.length === files.value.length) {
      resetSelected();
    } else {
      selected.value = files.value.map((file) => file.id);
    }
  },
  delete: () => {
    if (selected.value.length) deleteFiles(selected.value);
  },
  backspace: () => {
    if (selected.value.length) deleteFiles(selected.value);
  },
  f2: () => {
    if (selected.value.length === 1) openRename(selectedFiles.value[0]);
  },
  enter: () => {
    if (selected.value.length === 1) {
      const index = files.value.findIndex((file) => file.id === selected.value[0]);
      if (index >= 0) onOpen(files.value[index], index);
    }
  },
});

watch(deleting, (value) => {
  if (!value) refresh();
});
</script>
<template>
  <Title v-if="title">{{ title }}</Title>
  <Title v-else-if="folder">{{ folder.name }}</Title>
  <Title v-else>{{ route.params.bucket }}</Title>
  <FilePreview v-if="files" :files="files" />
  <AppMain :title="title">
    <template #actions>
      <Upload v-if="!endpoint" type="folder" @success="refresh" />
      <NewFile v-if="!endpoint" />
      <div class="ml-auto flex flex-wrap items-end gap-4">
        <SortFiles v-if="!endpoint" @update="onSort" />
        <Filter v-if="!endpoint" @update="onFilter" class="ml-auto" />
        <ToggleButton v-model="view" />
      </div>
    </template>
    <AppView :name="view" v-slot="{ dir }" :loading="loading">
      <DropTarget
        v-for="(file, index) in files"
        :key="file.id"
        :target-id="file.type === 'folder' ? file.id : ''"
        @dropped="onDropInto"
      >
        <File
          :dir="dir"
          :file="file"
          @select="onSelect(file, index, $event)"
          @open="onOpen(file, index)"
          @delete="refresh"
          :selected="selected.includes(file.id)"
        />
      </DropTarget>
    </AppView>
    <div
      v-if="!loading && files.length === 0"
      class="flex flex-col items-center justify-center min-h-[50vh] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black rounded-lg p-8 opacity-50"
    >
      <Icon name="lucide:hard-drive" class="size-16 *:stroke-[1px]" />
      <div class="text-lg">{{ $t("empty.noFiles") }}</div>
    </div>
    <div v-if="loading && files.length === 0" class="flex justify-center py-8">
      <UButton variant="ghost" loading>{{ $t("search.placeholder") }}</UButton>
    </div>
    <UButton
      v-if="!isEnd && !loading"
      @click="loadMore"
      class="mx-auto max-w-48"
    >
      {{ $t("list.loadMore") }}
    </UButton>
  </AppMain>

  <SelectionBar
    @move="selectedFiles[0] && openMove(selectedFiles[0])"
    @copy="selectedFiles[0] && openCopy(selectedFiles[0])"
    @download="downloadSelected"
    @delete="deleteFiles(selected)"
  />
</template>
