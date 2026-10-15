export type MountItem = {
  id: string;
  name: string;
  type: "folder" | "file";
  size?: number;
  updatedAt?: number;
  storageId: string;
  path: string;
};

export const useMountFiles = (mountPath: MaybeRefOrGetter<string>) => {
  const route = useRoute();
  const items = ref<MountItem[]>([]);
  const cursor = ref<string | undefined>();
  const loading = ref(false);
  const error = ref("");
  const storage = ref<any>(null);

  const restPath = computed(() => {
    const raw = route.params.path;
    if (Array.isArray(raw)) return raw.join("/");
    return String(raw || "");
  });

  const base = () => toValue(mountPath);
  const api = (suffix: string) => `/api/mounts/${base()}${suffix}`;

  const fetchList = async (reset = true) => {
    if (reset) {
      items.value = [];
      cursor.value = undefined;
    }
    loading.value = true;
    error.value = "";
    try {
      const res = await $fetch<{ items: MountItem[]; cursor?: string }>(api("/list"), {
        query: { path: restPath.value, cursor: cursor.value },
      });
      if (reset) items.value = res.items || [];
      else items.value.push(...(res.items || []));
      cursor.value = res.cursor;
    } catch (e: any) {
      error.value = e?.data?.message || String(e?.message || e);
    } finally {
      loading.value = false;
    }
  };

  const loadMore = () => {
    if (cursor.value) return fetchList(false);
  };

  const refresh = () => fetchList(true);

  watch(restPath, () => refresh());
  onMounted(async () => {
    await refresh();
    try {
      const list = await $fetch<any[]>("/api/storages");
      storage.value = (list || []).find((item) => item.mountPath === base()) || null;
    } catch {
      storage.value = null;
    }
  });

  const readonly = computed(() => Boolean(storage.value?.readOnly));

  const joinPath = (name: string) => [restPath.value, name].filter(Boolean).join("/");

  return {
    items,
    loading,
    error,
    cursor,
    restPath,
    storage,
    readonly,
    refresh,
    loadMore,
    joinPath,
    api,
  };
};
