<script setup>
const route = useRoute();
const { aside, toggle } = useAside();
defineShortcuts({
  meta_b: toggle,
});
</script>
<template>
  <header
    class="flex items-center gap-4 pr-4 sm:pr-18 bg-white dark:bg-neutral-950 fixed top-0 left-0 right-0 z-10 shadow-lg shadow-neutral-400/5 dark:shadow-neutral-900/5"
  >
    <Logo />
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
          @click="toggle"
        />
      </UTooltip>
    </template>
    <Search v-if="route.params.bucket" />
    <div v-else class="grow"></div>
    <LanguageSwitcher />
    <ColorMode />
    <ProfileMenu />
  </header>
</template>
