<script setup lang="ts">
const props = defineProps<{
  crumbs?: { label: string; to: string }[];
  badge?: string;
}>();

const route = useRoute();
const { folder } = useFolder();
const toast = useToast();
const { t } = useI18n();

const list = computed(() => {
  if (props.crumbs?.length) {
    return props.crumbs.map((crumb) => ({ label: crumb.label, to: crumb.to }));
  }
  const out: { label: string; to: string }[] = [
    { label: String(route.params.bucket), to: `/${route.params.bucket}` },
  ];
  folder.value?.breadcrumb?.forEach((item) => {
    out.push({ label: item.name, to: `/${route.params.bucket}/${item.id}` });
  });
  return out;
});

const copyPath = async () => {
  const path = list.value.map((item) => item.label).join("/");
  try {
    await navigator.clipboard.writeText(`/${path}`);
    toast.add({ title: t("settings.copied"), color: "success" });
  } catch {
    toast.add({ title: t("errors.generic"), color: "error" });
  }
};
</script>
<template>
  <div class="flex items-center gap-1 min-w-0">
    <UBreadcrumb v-if="route.params.bucket" :items="list" :ui="{ list: 'gap-1' }">
      <template #separator>
        <span>/</span>
      </template>
    </UBreadcrumb>
    <UBadge v-if="badge" size="xs" variant="subtle" class="shrink-0">{{ badge }}</UBadge>
    <UButton
      icon="lucide:copy"
      size="xs"
      color="neutral"
      variant="ghost"
      :aria-label="t('settings.copy')"
      @click="copyPath"
    />
  </div>
</template>
