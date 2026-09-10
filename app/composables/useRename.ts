import Rename from "~/components/Rename.vue";

export const useRename = () => {
  const { t } = useI18n();
  const route = useRoute();
  const toast = useToast();
  const overlay = useOverlay();
  const modal = overlay.create(Rename);

  const loading = ref(false);
  const error = ref("");

  const renameFile = async (file: IFile, name: string) => {
    if (loading.value) return;
    loading.value = true;
    try {
      const data = (await ($fetch as any)(
        `/api/files/${route.params.bucket}/rename`,
        {
          method: "POST",
          body: { file, name },
        }
      )) as { status?: string };
      if (data?.status && data?.status === "success") {
        toast.add({
          title: t("common.success"),
          color: "success",
        });
        modal.close();
      }
    } catch (errors: any) {
      if (errors?.data?.message) {
        console.error(errors?.data.message);
        error.value = errors.data.message;
      } else {
        error.value = t("errors.generic");
      }
    } finally {
      loading.value = false;
    }
  };

  const openRename = (file: IFile) => {
    modal.open({
      file,
      loading,
      error,
      onSubmit: (value: string) => {
        renameFile(file, value);
      },
    });
  };
  return { openRename };
};
