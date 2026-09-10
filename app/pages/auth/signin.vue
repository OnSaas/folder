<script setup lang="ts">
definePageMeta({ layout: "guest" });
const { t } = useI18n();
useSeoMeta({
  title: t("auth.signIn"),
});
</script>

<template>
  <section class="grow flex justify-center items-center">
    <AuthCard
      :title="$t('auth.signInOrUp')"
      :description="$t('auth.signInHint')"
    />
  </section>
</template>
