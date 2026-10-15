export const usePreview = () => {
  const opened = useState("opened-preview", () => -1);
  const open = useState("preview-open", () => false);
  const limit = ref(0);

  const direction = ref("right");
  const nextPage = () => {
    if (opened.value >= 0 && opened.value < limit.value - 1) {
      direction.value = "right";
      opened.value++;
    }
  };

  function prevPage() {
    if (opened.value > 0) {
      direction.value = "left";
      opened.value--;
    }
  }

  watch(opened, (value) => {
    if (value >= 0) open.value = true;
  });

  watch(open, (isOpen) => {
    if (!isOpen) opened.value = -1;
  });

  return {
    open,
    opened,
    limit,
    prevPage,
    nextPage,
  };
};
