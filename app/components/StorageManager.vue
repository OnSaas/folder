<script setup lang="ts">
const { t } = useI18n();
const toast = useToast();
const { data: storages, refresh } = await useFetch("/api/storages");
const editing = ref<any>({
  name: "",
  mountPath: "",
  type: "s3",
  template: "b2",
  endpoint: "",
  region: "us-west-000",
  bucket: "",
  accessKeyId: "",
  secretAccessKey: "",
  forcePathStyle: true,
  username: "",
  password: "",
  rootPrefix: "",
  clientId: "",
  clientSecret: "",
  refreshToken: "",
  rootFolderId: "",
});
const saving = ref(false);

const templates: Record<string, { endpoint: string; region: string }> = {
  aws: { endpoint: "https://s3.amazonaws.com", region: "us-east-1" },
  b2: { endpoint: "https://s3.us-west-000.backblazeb2.com", region: "us-west-000" },
  r2: { endpoint: "https://<accountid>.r2.cloudflarestorage.com", region: "auto" },
  wasabi: { endpoint: "https://s3.wasabisys.com", region: "us-east-1" },
  minio: { endpoint: "https://minio.example.com", region: "us-east-1" },
  oss: { endpoint: "https://s3.oss-cn-hangzhou.aliyuncs.com", region: "oss-cn-hangzhou" },
  cos: { endpoint: "https://cos.ap-guangzhou.myqcloud.com", region: "ap-guangzhou" },
};

const types = [
  { label: t("settings.typeS3"), value: "s3" },
  { label: t("settings.typeWebdav"), value: "webdav" },
  { label: t("settings.typeOnedrive"), value: "onedrive" },
  { label: t("settings.typeGdrive"), value: "gdrive" },
];

watch(
  () => editing.value.template,
  (name) => {
    if (editing.value.type !== "s3") return;
    const preset = templates[name];
    if (!preset) return;
    editing.value.endpoint = preset.endpoint;
    editing.value.region = preset.region;
  }
);

const save = async () => {
  saving.value = true;
  try {
    await $fetch("/api/storages", { method: "POST", body: editing.value });
    toast.add({ title: t("common.success"), color: "success" });
    await refresh();
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t("errors.generic"), color: "error" });
  } finally {
    saving.value = false;
  }
};

const testOne = async (id: string) => {
  try {
    const res = await $fetch<{ ok: boolean; message?: string }>(`/api/storages/${id}/test`, {
      method: "POST",
    });
    toast.add({
      title: res.ok ? t("settings.statusOk") : t("settings.statusError"),
      description: res.message,
      color: res.ok ? "success" : "error",
    });
    await refresh();
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t("errors.generic"), color: "error" });
  }
};

const remove = async (id: string) => {
  if (id === "primary") return;
  await $fetch(`/api/storages/${id}`, { method: "DELETE" });
  await refresh();
};
</script>
<template>
  <div class="flex flex-col gap-4">
    <h3 class="text-lg font-light">{{ t("settings.storages") }}</h3>
    <p class="text-sm opacity-70">{{ t("settings.sessionSecretHint") }}</p>
    <p class="text-sm opacity-70">{{ t("settings.corsHint") }}</p>
    <div
      v-for="item in storages || []"
      :key="item.id"
      class="border border-neutral-200 dark:border-neutral-700 p-3 flex flex-col gap-2"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="font-medium truncate">{{ item.name }}</p>
          <p class="text-xs font-mono opacity-70">/{{ item.mountPath }} · {{ item.type }}</p>
        </div>
        <span class="text-xs">{{ t(`settings.status${item.status === "ok" ? "Ok" : item.status === "error" ? "Error" : "Unknown"}`) }}</span>
      </div>
      <div class="flex gap-2">
        <UButton size="xs" variant="outline" @click="testOne(item.id)">{{ t("settings.testConnection") }}</UButton>
        <UButton
          v-if="item.id !== 'primary'"
          size="xs"
          color="error"
          variant="ghost"
          @click="remove(item.id)"
        >
          {{ t("settings.deleteStorage") }}
        </UButton>
      </div>
    </div>
    <div class="flex flex-col gap-2">
      <p class="font-medium">{{ t("settings.addStorage") }}</p>
      <UInput v-model="editing.name" :placeholder="t('settings.addStorage')" />
      <UInput v-model="editing.mountPath" :placeholder="t('settings.mountPath')" />
      <USelect v-model="editing.type" :items="types" />
      <template v-if="editing.type === 's3'">
        <USelect
          v-model="editing.template"
          :items="Object.keys(templates).map((key) => ({ label: key, value: key }))"
        />
        <UInput v-model="editing.endpoint" :placeholder="t('settings.endpoint')" />
        <UInput v-model="editing.region" :placeholder="t('settings.region')" />
        <UInput v-model="editing.bucket" :placeholder="t('settings.bucketName')" />
        <UInput v-model="editing.accessKeyId" :placeholder="t('settings.accessKey')" autocomplete="off" />
        <UInput v-model="editing.secretAccessKey" :placeholder="t('settings.secretKey')" autocomplete="off" />
      </template>
      <template v-else-if="editing.type === 'webdav'">
        <UInput v-model="editing.endpoint" :placeholder="t('settings.endpoint')" />
        <UInput v-model="editing.username" :placeholder="t('settings.username')" autocomplete="off" />
        <UInput v-model="editing.password" :placeholder="t('settings.davPassword')" autocomplete="off" />
        <UInput v-model="editing.rootPrefix" :placeholder="t('settings.rootPrefix')" />
      </template>
      <template v-else>
        <p class="text-sm opacity-70">{{ t("settings.oauthHint") }}</p>
        <UInput v-model="editing.clientId" :placeholder="t('settings.clientId')" autocomplete="off" />
        <UInput v-model="editing.clientSecret" :placeholder="t('settings.clientSecret')" autocomplete="off" />
        <UInput v-model="editing.refreshToken" :placeholder="t('settings.refreshToken')" autocomplete="off" />
        <UInput v-model="editing.rootPrefix" :placeholder="t('settings.rootPrefix')" />
        <UInput
          v-if="editing.type === 'gdrive'"
          v-model="editing.rootFolderId"
          :placeholder="t('settings.rootFolderId')"
        />
      </template>
      <UButton :loading="saving" @click="save">{{ t("common.submit") }}</UButton>
    </div>
  </div>
</template>
