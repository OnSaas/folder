<script setup lang="ts">
const route = useRoute();
const { selected, resetSelected } = useSelected();
defineShortcuts({
  escape: () => {
    if (selected.value.length) resetSelected();
  },
});
const emit = defineEmits(["move", "download", "copy", "delete"]);
const { t } = useI18n();
</script>
<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="translate-y-4 opacity-0"
    leave-active-class="transition duration-100 ease-in"
    leave-to-class="translate-y-4 opacity-0"
  >
    <div
      v-if="selected.length"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 shadow-lg px-2 py-2"
    >
      <span class="px-2 text-sm font-medium">
        {{ t("common.selected", { count: selected.length }) }}
      </span>
      <UButton
        v-if="selected.length === 1"
        icon="lucide:folder-input"
        variant="ghost"
        :label="t('file.moveTo')"
        @click="emit('move')"
      />
      <UButton
        icon="lucide:download"
        variant="ghost"
        :label="t('file.download')"
        @click="emit('download')"
      />
      <UButton
        icon="lucide:copy"
        variant="ghost"
        :label="t('copy.action')"
        @click="emit('copy')"
      />
      <UButton
        icon="lucide:trash"
        variant="ghost"
        color="error"
        :label="t('common.delete')"
        @click="emit('delete')"
      />
      <UButton
        icon="lucide:x"
        variant="ghost"
        :aria-label="t('common.cancel')"
        @click="resetSelected"
      />
    </div>
  </Transition>
</template>
