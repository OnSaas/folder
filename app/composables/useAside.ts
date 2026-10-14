export const useAside = () => {
  const aside = useState("aside", () => false);
  const toggle = () => {
    aside.value = !aside.value;
  };
  const close = () => {
    aside.value = false;
  };
  return { aside, toggle, close };
};
