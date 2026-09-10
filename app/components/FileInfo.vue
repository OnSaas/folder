<script setup lang="ts">
defineProps<{
  file: IFile;
}>();
</script>
<template>
  <div class="flex flex-col items-start justify-start gap-4 h-full p-6">
    <div>
      <div class="text-neutral-950 text-xs font-semibold uppercase">
        {{ $t("file.path") }}
      </div>
      <div class="text-neutral-700 font-light">
        {{ file?.path }}
      </div>
    </div>
    <div>
      <div class="text-neutral-950 text-xs font-semibold uppercase">
        {{ $t("file.size") }}
      </div>
      <div class="text-neutral-700 font-light">
        {{ formatBytes(file?.size ?? 0) }}
      </div>
    </div>
    <div>
      <div class="text-neutral-950 text-xs font-semibold uppercase">
        {{ $t("file.type") }}
      </div>
      <div class="text-neutral-700 font-light">{{ file?.type }}</div>
    </div>
    <div>
      <div class="text-neutral-950 text-xs font-semibold uppercase">
        {{ $t("file.contentType") }}
      </div>
      <div class="text-neutral-700 font-light">
        {{ file?.contentType }}
      </div>
    </div>
    <div>
      <div class="text-neutral-950 text-xs font-semibold uppercase">
        {{ $t("file.visibility") }}
      </div>
      <div class="text-neutral-700 font-light">
        {{ file?.visibility }}
      </div>
    </div>
    <div>
      <div class="text-neutral-950 text-xs font-semibold uppercase">
        {{ $t("file.addedOn") }}
      </div>
      <div class="text-neutral-700 font-light">
        {{ file?.createdAt }}
      </div>
    </div>
    <div v-if="file?.updatedAt !== file?.createdAt">
      <div class="text-neutral-950 text-xs font-semibold uppercase">
        {{ $t("file.modifiedOn") }}
      </div>
      <div class="text-neutral-700 font-light">
        {{ file?.updatedAt }}
      </div>
    </div>
  </div>
</template>
