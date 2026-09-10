<script setup lang="ts">
import { useDropZone } from "@vueuse/core";
const dropZoneRef = ref<HTMLDivElement>();
function onDrop(files: File[] | null) {
  // called when files are dropped on zone
  alert("Can't Upload Files");
}

const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop,
  // specify the types of data to be received.
  // dataTypes: ["image/jpeg"],
  // control multi-file drop
  multiple: true,
  // whether to prevent default behavior for unhandled events
  preventDefaultForUnhandled: false,
});
</script>
<template>
  <div
    ref="dropZoneRef"
    :class="[
      'w-full h-[50vh]  rounded-xl flex flex-col gap-4 items-center justify-center',
      isOverDropZone &&
        'ring-2 ring-primary-100 bg-white dark:ring-primary-900 dark:bg-neutral-950',
    ]"
  >
    <div
      :class="[
        'p-4 rounded-full bg-primary-100 dark:bg-primary-900 dark:bg-opacity-50',
        isOverDropZone &&
          'ring-5 ring-primary-200 dark:ring-primary-800/50 bg-primary-500 dark:bg-primary-700/50 text-white scale-110 ease-in duration-200',
      ]"
    >
      <Icon name="lucide:upload" :class="['size-8 *:stroke-[1.5px]']" />
    </div>
    <span class="text-sm opacity-70">{{ $t("upload.drop") }}</span>
  </div>
</template>
