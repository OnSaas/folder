export default defineNuxtPlugin(() => {
  const { clear } = useUserSession();
  globalThis.$fetch = $fetch.create({
    async onResponseError({ response }) {
      if (response.status === 401 && useRoute().path !== "/auth/signin") {
        await clear();
        await navigateTo("/auth/signin");
      }
    },
  });
});
