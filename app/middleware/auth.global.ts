export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession();
  if (!loggedIn.value && to.path !== "/auth/signin") {
    return navigateTo("/auth/signin");
  }
  if (loggedIn.value && to.path === "/auth/signin") {
    return navigateTo("/");
  }
});
