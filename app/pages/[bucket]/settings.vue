<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
useSeoMeta({ title: t("settings.title") });

const username = ref("");
const password = ref("");
const saving = ref(false);
const saved = ref(false);
const error = ref("");
const copiedUser = ref(false);
const copiedPass = ref(false);
let userTimer: ReturnType<typeof setTimeout> | undefined;
let passTimer: ReturnType<typeof setTimeout> | undefined;
const toast = useToast();
const { copy, isSupported } = useClipboard({ legacy: true });

const davUrl = computed(() => {
  if (!import.meta.client) return "/dav";
  return `${window.location.origin}/dav`;
});
const webdavUrl = computed(() => {
  if (!import.meta.client) return "/webdav";
  return `${window.location.origin}/webdav`;
});
const rcloneSnippet = computed(
  () =>
    `[folder]\ntype = webdav\nurl = ${davUrl.value}\nvendor = other\nuser = ${username.value || "<username>"}\npass = <password>`
);
const windowsHint = computed(
  () => t("settings.davExampleWindows", { url: davUrl.value })
);
const macHint = computed(() => t("settings.davExampleMac", { url: davUrl.value }));

const { data: dav, refresh } = await useFetch("/api/user/dav");
watch(
  dav,
  (value) => {
    if (!value) return;
    username.value = value.username || "";
    password.value = value.password || "";
  },
  { immediate: true }
);

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

const copyValue = async (text: string) => {
  try {
    if (isSupported.value) await copy(text);
    else if (!fallbackCopy(text)) return false;
  } catch {
    if (!fallbackCopy(text)) return false;
  }
  toast.add({ title: t("settings.copied"), color: "success" });
  return true;
};

const copyUsername = async () => {
  if (!(await copyValue(username.value))) return;
  copiedUser.value = true;
  if (userTimer) clearTimeout(userTimer);
  userTimer = setTimeout(() => {
    copiedUser.value = false;
  }, 2000);
};

const copyPassword = async () => {
  if (!(await copyValue(password.value))) return;
  copiedPass.value = true;
  if (passTimer) clearTimeout(passTimer);
  passTimer = setTimeout(() => {
    copiedPass.value = false;
  }, 2000);
};

onBeforeUnmount(() => {
  if (userTimer) clearTimeout(userTimer);
  if (passTimer) clearTimeout(passTimer);
});

const saveDav = async () => {
  error.value = "";
  saved.value = false;
  if (!username.value.trim()) {
    error.value = t("settings.davUsernameRequired");
    return;
  }
  if (password.value.length < 8) {
    error.value = t("settings.davPasswordShort");
    return;
  }
  saving.value = true;
  try {
    await $fetch("/api/user/dav-password", {
      method: "POST",
      body: { username: username.value, password: password.value },
    });
    saved.value = true;
    await refresh();
  } catch (e: any) {
    error.value = e?.data?.message || t("errors.generic");
  } finally {
    saving.value = false;
  }
};
</script>
<template>
  <AppMain :title="t('settings.title')">
    <div class="flex flex-col gap-8 max-w-lg min-w-0">
      <UFormField :label="t('settings.language')">
        <LanguageSwitcher />
      </UFormField>
      <div class="flex flex-col gap-4 min-w-0">
        <h3 class="text-lg font-light">{{ t("settings.dav") }}</h3>
        <p class="text-sm opacity-70">{{ t("settings.davHint") }}</p>
        <CopyField :label="t('settings.davPrimary')" :value="davUrl" />
        <CopyField :label="t('settings.davAlias')" :value="webdavUrl" />
        <UFormField :label="t('settings.davUsername')">
          <UInput v-model="username" autocomplete="off" class="w-full">
            <template #trailing>
              <UButton
                :icon="copiedUser ? 'lucide:check' : 'lucide:copy'"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="t('settings.copy')"
                @click="copyUsername"
              />
            </template>
          </UInput>
        </UFormField>
        <UFormField :label="t('settings.davPassword')" :error="error">
          <UInput v-model="password" type="text" autocomplete="off" class="w-full">
            <template #trailing>
              <UButton
                :icon="copiedPass ? 'lucide:check' : 'lucide:copy'"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="t('settings.copy')"
                @click="copyPassword"
              />
            </template>
          </UInput>
        </UFormField>
        <div class="flex items-center gap-4">
          <UButton color="primary" variant="solid" :loading="saving" @click="saveDav">
            {{ t("settings.saveDav") }}
          </UButton>
          <p v-if="saved" class="text-sm">{{ t("common.success") }}</p>
        </div>
        <details class="text-sm">
          <summary class="cursor-pointer opacity-80">{{ t("settings.davExamples") }}</summary>
          <div class="mt-3 flex flex-col gap-3 min-w-0">
            <div>
              <p class="font-medium">{{ t("settings.davExampleWindowsTitle") }}</p>
              <p class="font-mono text-xs break-all opacity-80">{{ windowsHint }}</p>
            </div>
            <div>
              <p class="font-medium">{{ t("settings.davExampleMacTitle") }}</p>
              <p class="font-mono text-xs break-all opacity-80">{{ macHint }}</p>
            </div>
            <div>
              <p class="font-medium">{{ t("settings.davExampleRcloneTitle") }}</p>
              <pre class="font-mono text-xs whitespace-pre-wrap break-all opacity-80">{{ rcloneSnippet }}</pre>
            </div>
          </div>
        </details>
      </div>
      <StorageManager />
    </div>
  </AppMain>
</template>
