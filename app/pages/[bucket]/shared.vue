<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const bucket = route.params.bucket;
</script>
<template>
  <AppFiles v-if="bucket" :title="t('pages.shared')" endpoint="shared" />
</template>
