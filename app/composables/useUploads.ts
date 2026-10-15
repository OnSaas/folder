import { reactive } from "vue";

export type UploadStatus = "queued" | "uploading" | "done" | "error" | "cancelled";

export type UploadItem = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: UploadStatus;
  error?: string;
  targetLabel: string;
};

type StartOptions = {
  bucket: string;
  parentId: string;
  targetPath: string;
  targetLabel: string;
  onDone?: () => void;
};

type Entry = {
  item: UploadItem;
  abort?: () => void;
  cancelled?: boolean;
  file?: File;
  options?: StartOptions;
};

const state = reactive({
  items: [] as UploadItem[],
  open: false,
});

const entries = new Map<string, Entry>();

function newId() {
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function imageDimensions(file: File) {
  if (!file.type.startsWith("image/")) return "";
  try {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    const size = await new Promise<string>((resolve) => {
      image.onload = () => resolve(`${image.width}x${image.height}`);
      image.onerror = () => resolve("");
    });
    URL.revokeObjectURL(url);
    return size;
  } catch {
    return "";
  }
}

async function start(item: UploadItem, file: File, options: StartOptions) {
  const entry = entries.get(item.id);
  if (!entry) return;
  entry.cancelled = false;
  item.status = "uploading";
  item.error = undefined;
  state.open = true;

  const dimensions = await imageDimensions(file);
  const headers: Record<string, string> = {
    "x-amz-meta-content-type": file.type,
  };
  if (dimensions) headers["x-amz-meta-dimensions"] = dimensions;

  const uploadPath = options.targetPath || options.bucket;
  const upload = useMultipartUpload(`/upload/${options.bucket}/${options.parentId}`, {
    partSize: chunkSize(file.size),
    concurrent: 10,
    prefix: uploadPath,
    fetchOptions: { headers },
  });

  try {
    const { progress, completed, abort } = upload(file);
    entry.abort = abort;
    watch(progress, (value) => {
      const next = Number(value) || 0;
      if (next > item.progress) item.progress = next;
    });
    await completed;
    if (entry.cancelled) return;
    item.progress = 100;
    item.status = "done";
    options.onDone?.();
  } catch (err: any) {
    if (entry.cancelled) {
      item.status = "cancelled";
      return;
    }
    item.status = "error";
    item.error = err?.data?.message || err?.message || "Upload failed";
  }
}

export const useUploads = () => {
  const enqueue = (files: File[], options: StartOptions) => {
    const list = [...files];
    if (!list.length) return;
    for (const file of list) {
      const item: UploadItem = {
        id: newId(),
        name: file.webkitRelativePath || file.name,
        size: file.size,
        progress: 0,
        status: "queued",
        targetLabel: options.targetLabel,
      };
      state.items.unshift(item);
      entries.set(item.id, { item, file, options });
      void start(item, file, options);
    }
  };

  const cancel = (id: string) => {
    const entry = entries.get(id);
    if (!entry) return;
    entry.cancelled = true;
    entry.abort?.();
    entry.item.status = "cancelled";
  };

  const retry = (id: string) => {
    const entry = entries.get(id);
    if (!entry?.file || !entry.options) return;
    entry.item.progress = 0;
    void start(entry.item, entry.file, entry.options);
  };

  const clearFinished = () => {
    state.items = state.items.filter((item) => {
      if (item.status === "done" || item.status === "cancelled") {
        entries.delete(item.id);
        return false;
      }
      return true;
    });
  };

  const remove = (id: string) => {
    entries.delete(id);
    state.items = state.items.filter((item) => item.id !== id);
  };

  return {
    state,
    enqueue,
    cancel,
    retry,
    remove,
    clearFinished,
  };
};
