<template>
  <div
    class="flex flex-col justify-center items-center min-h-screen w-full bg-neutral-100 dark:bg-neutral-900"
  >
    <div class="absolute top-4 right-4">
      <LanguageSwitcher />
    </div>
    <div class="w-full">
      <slot />
    </div>
  </div>
</template>
