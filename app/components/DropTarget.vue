<script setup lang="ts">
const props = defineProps<{
  targetId: string;
  targetLabel?: string;
}>();
const emit = defineEmits(["dropped"]);
const { dragging, clear } = useDragDrop();
const { t } = useI18n();
const toast = useToast();
const route = useRoute();
const over = ref(false);

const canDrop = computed(() => dragging.value.length > 0 && Boolean(props.targetId));

const drop = async () => {
  if (!canDrop.value) return;
  const ids = [...dragging.value];
  over.value = false;
  clear();
  if (ids.includes(props.targetId)) return;
  try {
    for (const id of ids) {
      await $fetch(`/api/files/${route.params.bucket}/move`, {
        method: "POST",
        body: { file: id, parentId: props.targetId },
      });
    }
    toast.add({ title: t("mount.moved"), color: "success" });
    emit("dropped");
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t("errors.generic"), color: "error" });
  }
};
</script>

<template>
  <div
    :class="[
      'relative transition',
      over && canDrop ? 'ring-2 ring-primary-400' : '',
    ]"
    @dragenter.prevent="canDrop && (over = true)"
    @dragover.prevent="canDrop && (over = true)"
    @dragleave.prevent="over = false"
    @drop.prevent="drop"
  >
    <slot />
  </div>
</template>
