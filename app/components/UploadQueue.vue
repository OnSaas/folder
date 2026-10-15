<script setup lang="ts">
const { t } = useI18n();
const { state, cancel, retry, remove, clearFinished } = useUploads();

const items = computed(() => state.items);
const active = computed(() => items.value.filter((item) => item.status === "uploading" || item.status === "queued"));
const overall = computed(() => {
  if (!active.value.length) return 0;
  const sum = active.value.reduce((acc, item) => acc + item.progress, 0);
  return Math.round(sum / active.value.length);
});
const hasFinished = computed(() => items.value.some((item) => item.status === "done" || item.status === "cancelled"));

const statusIcon = (status: string) =>
  status === "done"
    ? "lucide:check"
    : status === "error"
      ? "lucide:alert-circle"
      : status === "cancelled"
        ? "lucide:ban"
        : "lucide:loader";
</script>

<template>
  <div
    v-if="items.length"
    class="fixed bottom-4 right-4 z-30 w-80 max-w-[calc(100vw-2rem)]"
  >
    <div class="border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 shadow-lg">
      <button
        class="w-full flex items-center gap-2 px-3 py-2 text-sm"
        @click="state.open = !state.open"
      >
        <Icon :name="state.open ? 'lucide:chevron-down' : 'lucide:chevron-up'" class="size-4" />
        <span class="font-medium">{{ t("upload.queue") }}</span>
        <span v-if="active.length" class="opacity-70">{{ active.length }}</span>
        <span class="ml-auto opacity-70">{{ overall }}%</span>
      </button>

      <div v-if="state.open" class="border-t border-neutral-200 dark:border-neutral-700">
        <div class="max-h-64 overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800">
          <div v-for="item in items" :key="item.id" class="px-3 py-2 text-sm">
            <div class="flex items-center gap-2">
              <Icon :name="statusIcon(item.status)" class="size-4 shrink-0" />
              <span class="truncate grow">{{ item.name }}</span>
              <span class="text-xs opacity-60 shrink-0">{{ formatBytes(item.size) }}</span>
            </div>
            <div class="mt-1 flex items-center gap-2">
              <UProgress :modelValue="item.progress" :max="100" size="xs" class="grow" />
              <span class="text-xs w-10 text-right">{{ Math.round(item.progress) }}%</span>
              <UButton
                v-if="item.status === 'uploading' || item.status === 'queued'"
                size="xs"
                color="neutral"
                variant="ghost"
                icon="lucide:x"
                :aria-label="t('common.cancel')"
                @click="cancel(item.id)"
              />
              <UButton
                v-else-if="item.status === 'error'"
                size="xs"
                color="neutral"
                variant="ghost"
                icon="lucide:rotate-cw"
                :aria-label="t('common.submit')"
                @click="retry(item.id)"
              />
              <UButton
                v-else
                size="xs"
                color="neutral"
                variant="ghost"
                icon="lucide:x"
                :aria-label="t('common.delete')"
                @click="remove(item.id)"
              />
            </div>
            <p v-if="item.error" class="mt-1 text-xs text-red-500 break-all">{{ item.error }}</p>
            <p class="mt-0.5 text-xs opacity-50 truncate">{{ t("upload.target") }}: {{ item.targetLabel }}</p>
          </div>
        </div>
        <div v-if="hasFinished" class="border-t border-neutral-200 dark:border-neutral-700 px-3 py-2">
          <UButton size="xs" variant="ghost" @click="clearFinished">{{ t("upload.clear") }}</UButton>
        </div>
      </div>
    </div>
  </div>
</template>
