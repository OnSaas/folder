export const useSelected = () => {
  const route = useRoute();
  const selected = useState<string[]>("selected", () => []);
  const anchor = useState<number>("selected-anchor", () => -1);

  const resetSelected = () => {
    selected.value = [];
    anchor.value = -1;
  };

  const selectOne = (id: string, index: number) => {
    selected.value = [id];
    anchor.value = index;
  };

  const toggleSelected = (id: string, index?: number) => {
    if (selected.value.includes(id)) {
      selected.value = selected.value.filter((i) => i !== id);
    } else {
      selected.value = [...selected.value, id];
    }
    if (typeof index === "number") anchor.value = index;
  };

  const selectRange = (ids: string[], index: number) => {
    const start = anchor.value >= 0 ? anchor.value : index;
    const [from, to] = start <= index ? [start, index] : [index, start];
    const slice = ids.slice(from, to + 1);
    selected.value = [...new Set([...selected.value, ...slice])];
  };

  const selectAll = (ids: string[]) => {
    selected.value = ids;
  };

  watch(
    () => [route.params.id, route.params.mountPath, route.params.path],
    resetSelected
  );

  return {
    selected,
    anchor,
    toggleSelected,
    selectOne,
    selectRange,
    selectAll,
    resetSelected,
  };
};
