<script setup lang="ts">
defineProps<{
  files: IFile[];
}>();
const emit = defineEmits(["update"]);
const email = ref("");
const invitee = ref<Invitee[]>([]);
const members = ref<Member[]>([]);
const addInvitee = () => {
  if (email.value) {
    invitee.value.push({
      email: email.value,
      role: "viewer",
    });
    email.value = "";
  }
};
const onUpdate = () => {
  emit("update", invitee.value);
};
</script>
<template>
  <UModal
    v-if="files.length > 0"
    :title="$t('share.title', { count: files.length })"
    :description="$t('share.description')"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <UInput
          v-model="email"
          type="email"
          :placeholder="$t('share.emailPlaceholder')"
          required
          @keydown.enter="addInvitee"
        />
        <div class="flex flex-col">
          <Member
            v-for="(member, index) in invitee"
            :key="index"
            :member="member"
          />
        </div>
        <template v-if="members.length > 0">
          <h3 class="font-semibold">{{ $t("share.peopleWithAccess") }}</h3>
          <div class="flex flex-col">
            <Member
              v-for="(member, index) in members"
              :key="index"
              :member="member"
            />
          </div>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="flex items-center justify-end w-full">
        <UButton
          :disabled="invitee.length === 0"
          color="primary"
          variant="solid"
          @click="onUpdate"
          >{{ $t("common.confirm") }}</UButton
        >
      </div>
    </template>
  </UModal>
</template>
