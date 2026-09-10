<script setup>
const { t } = useI18n();
const bucketName = ref("");
const loading = ref(false);
const error = ref("");
const router = useRouter();

const createBucket = async () => {
  if (!bucketName.value) {
    error.value = t("bucket.required");
    return;
  }
  if (bucketName.value.length < 6) {
    error.value = t("bucket.tooShort");
    return;
  }
  if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(bucketName.value)) {
    error.value = t("bucket.invalid");
    return;
  }
  loading.value = true;
  try {
    await $fetch("/api/bucket", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: bucketName.value }),
    });
    window.location.reload();
  } catch (errors) {
    if (errors?.data.message) {
      error.value = errors.data.message;
    } else {
      error.value = t("errors.generic");
    }
    loading.value = false;
  }
};
</script>
<template>
  <div>
    <UCard class="max-w-md mx-auto">
      <template #header>
        <div class="">
          <h4 class="font-semibold">{{ $t("bucket.create") }}</h4>
          <p class="text-sm">
            {{ $t("bucket.hint") }}
          </p>
        </div>
      </template>
      <UFormField :label="$t('bucket.name')" :error="error">
        <UInput
          v-model="bucketName"
          :placeholder="$t('bucket.placeholder')"
          required
          class="w-full"
          maxlength="20"
        />
      </UFormField>
      <template #footer>
        <UButton
          variant="solid"
          color="primary"
          @click="createBucket"
          :loading="loading"
          >{{ $t("bucket.create") }}</UButton
        >
      </template>
    </UCard>
  </div>
</template>
