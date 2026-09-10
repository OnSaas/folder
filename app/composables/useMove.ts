import Move from "~/components/Move.vue";

export const useMove = () => {
  const { t } = useI18n();
  const route = useRoute();
  const overlay = useOverlay();
  const modal = overlay.create(Move);

  const open = useState("move-open", () => false);
  const loading = ref(false);
  const error = ref("");

  const moveFile = async (file: IFile, parentId: string) => {
    if (loading.value) return;
    loading.value = true;
    try {
      const data = await $fetch(`/api/files/${route.params.bucket}/move`, {
        method: "POST",
        body: { file, parentId },
      });
      modal.close();
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

  const openMove = (file: IFile) => {
    modal.open({
      file,
      loading,
      error,
      onSubmit: (value: string) => {
        moveFile(file, value);
      },
    });
  };
  return { open, openMove };
};
