<script setup lang="ts">
const { t } = useI18n();
defineProps<{
  provider: "linkedin" | "github" | "google";
  label?: string;
}>();
const providers = computed(() => ({
  github: {
    icon: "logos:github-icon",
    label: t("auth.continueGithub"),
    class: "size-6 *:fill-white dark:*:fill-neutral-900",
  },
  google: {
    icon: "logos:google-icon",
    label: t("auth.continueGoogle"),
    class: "size-6",
  },
}));
</script>
<template>
  <UButton
    v-if="providers[provider]"
    variant="solid"
    color="neutral"
    size="xl"
    class="text-sm"
    block
    as-child
  >
    <a :href="`/api/auth/${provider}`">
      <Icon
        :name="providers[provider].icon"
        :class="providers[provider].class"
      />
      <span class="ml-2">{{ label || providers[provider].label }}</span>
    </a>
  </UButton>
</template>
