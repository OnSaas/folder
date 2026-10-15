const DRAG_KEY = "file-drag";

export const useDragDrop = () => {
  const dragging = useState<string[]>(DRAG_KEY, () => []);

  const start = (ids: string[]) => {
    dragging.value = ids;
  };
  const clear = () => {
    dragging.value = [];
  };

  return { dragging, start, clear };
};
