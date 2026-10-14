<script setup lang="ts">
const props = defineProps<{
  label: string;
  value: string;
  hint?: string;
}>();

const { t } = useI18n();
const toast = useToast();
const copied = ref(false);
let resetTimer: ReturnType<typeof setTimeout> | undefined;
const { copy, isSupported } = useClipboard({ legacy: true });

const fallbackCopy = (text: string) => {
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(el);
  return ok;
};

const onCopy = async () => {
  try {
    if (isSupported.value) await copy(props.value);
    else if (!fallbackCopy(props.value)) return;
  } catch {
    if (!fallbackCopy(props.value)) return;
  }
  copied.value = true;
  toast.add({ title: t("settings.copied"), color: "success" });
  if (resetTimer) clearTimeout(resetTimer);
  resetTimer = setTimeout(() => {
    copied.value = false;
  }, 2000);
};

onBeforeUnmount(() => {
  if (resetTimer) clearTimeout(resetTimer);
});
</script>

<template>
  <div class="flex flex-col gap-1 min-w-0">
    <p class="text-sm font-medium">{{ label }}</p>
    <div
      class="flex items-center gap-2 border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 min-w-0"
    >
      <span class="font-mono text-sm truncate select-all min-w-0 flex-1">{{ value }}</span>
      <UButton
        :icon="copied ? 'lucide:check' : 'lucide:copy'"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="t('settings.copy')"
        @click="onCopy"
      />
    </div>
    <p v-if="hint" class="text-xs opacity-70">{{ hint }}</p>
  </div>
</template>
