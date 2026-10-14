<script setup>
const route = useRoute();
const { aside, toggle } = useAside();
defineShortcuts({
  meta_b: toggle,
});
</script>
<template>
  <header
    class="flex items-center gap-2 sm:gap-4 pr-4 sm:pr-18 bg-white dark:bg-neutral-950 fixed top-0 left-0 right-0 z-10 shadow-lg shadow-neutral-400/5 dark:shadow-neutral-900/5"
  >
    <Logo class="shrink-0" />
    <template v-if="route.params.bucket">
      <UTooltip
        :text="$t('header.openSidebar')"
        arrow
        :delay-duration="0"
        :kbds="['meta', 'B']"
      >
        <UButton
          :icon="aside ? 'lucide:x' : 'lucide:menu'"
          variant="text"
          size="xl"
          class="shrink-0"
          data-aside-toggle
          @click="toggle"
        />
      </UTooltip>
    </template>
    <div v-if="route.params.bucket" class="min-w-0 flex-1">
      <Search />
    </div>
    <div v-else class="grow"></div>
    <div class="flex items-center gap-1 sm:gap-2 shrink-0">
      <LanguageSwitcher />
      <ColorMode />
      <ProfileMenu />
    </div>
  </header>
</template>
