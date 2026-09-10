<script setup>
const { t } = useI18n();
const route = useRoute();
const { setFavorite, deleteFiles, deleting } = useFileActions();
const { openPublish } = usePublish();
const { openMove } = useMove();
const { openCopy } = useCopy();
const { openRename } = useRename();
const { openShare } = useShare();
const props = defineProps(["file"]);
const emit = defineEmits(["delete"]);
const fileMenuItems = computed(() => [
  [
    {
      label: t("file.open"),
      icon: "lucide:eye",
      type: "link",
      href: `/preview/${props.file.path}`,
      target: "_blank",
      disabled: props.file.type === "folder",
    },
    {
      label: t("file.openWith"),
      icon: "lucide:external-link",
      children: [
        {
          label: t("file.editor"),
          icon: "i-lucide-monitor",
          disabled: true,
        },
      ],
    },
    {
      label: props.file.isFavorite
        ? t("file.removeFavorite")
        : t("file.addFavorite"),
      icon: "lucide:star",
      color: props.file.isFavorite && "error",
      onSelect: () => {
        setFavorite(props.file.id, !props.file.isFavorite);
      },
    },
  ],
  [
    {
      label: t("file.download"),
      icon: "i-lucide-download",
      href: `/api/files/${route.params.bucket}/download/${props.file.id}`,
      target: "_blank",
    },
    {
      label: t("file.rename"),
      icon: "lucide:pencil",
      kbds: ["meta", "R"],
      onSelect: () => {
        openRename(props.file);
      },
    },
    {
      label: t("file.makeCopy"),
      icon: "lucide:copy",
      kbds: ["meta", "D"],
      onSelect: () => {
        openCopy(props.file);
      },
    },
  ],
  [
    {
      label: t("file.share"),
      icon: "lucide:user-plus",
      onSelect: () => {
        openShare([props.file]);
      },
    },
    {
      label: t("file.moveTo"),
      icon: "lucide:folder-input",
      onSelect: () => {
        openMove(props.file);
      },
    },
    {
      label: t("file.publish"),
      icon: "lucide:globe",
      onSelect: () => {
        openPublish(props.file);
      },
    },
    {
      type: "separator",
    },
    {
      label: t("file.moveToTrash"),
      icon: "lucide:trash",
      kbds: ["meta", "backspace"],
      onSelect: () => {
        deleteFiles([props.file.id]);
      },
    },
  ],
]);

watch(deleting, (value) => {
  if (!value) {
    emit("delete");
  }
});
</script>
<template>
  <UContextMenu
    :disabled="!!file.deletedAt"
    :items="fileMenuItems"
    size="xl"
    :ui="{
      content: 'w-64',
      itemLabel: 'text-sm font-light',
      itemLeadingIcon: '*:stroke-[1px]',
      itemTrailingIcon: '*:stroke-[1px]',
      itemTrailingKbdsSize: 'sm',
    }"
  >
    <slot />
  </UContextMenu>
</template>
