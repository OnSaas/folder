import Copy from "~/components/MakeCopy.vue";

export const useCopy = () => {
  const { t } = useI18n();
  const route = useRoute();
  const overlay = useOverlay();
  const modal = overlay.create(Copy);

  const open = useState("copy-open", () => false);
  const loading = ref(false);
  const error = ref("");

  const copyFile = async (file: IFile, name: string) => {
    if (loading.value) return;
    loading.value = true;
    error.value = "";
    try {
      const data = await $fetch(`/api/files/${route.params.bucket}/copy`, {
        method: "POST",
        body: { file, name },
      });
      modal.close();
    } catch (errors: any) {
      if (errors?.data?.message) {
        error.value = errors.data.message;
      } else {
        error.value = t("errors.generic");
      }
    } finally {
      loading.value = false;
    }
  };

  const openCopy = (file: IFile) => {
    modal.open({
      file,
      loading,
      error,
      onSubmit: (value: string) => {
        copyFile(file, value);
      },
    });
  };
  return { open, openCopy };
};
