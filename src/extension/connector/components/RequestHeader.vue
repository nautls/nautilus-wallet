<script setup lang="ts">
import { computed } from "vue";
import { ComponentI18nScope, I18nT, PickupPaths } from "vue-i18n";
import { MessageSchema } from "@/boot/i18n";

interface Props {
  origin?: string;
  favicon?: string;
  i18nKeypath: PickupPaths<MessageSchema>;
  i18nScope?: ComponentI18nScope;
}

const props = defineProps<Props>();
const domain = computed(() => props.origin || "???");
</script>

<template>
  <div class="text-center">
    <img v-if="favicon" :src="favicon" class="mr-1 inline size-6" />
    <I18nT :keypath="props.i18nKeypath" :scope="props.i18nScope ?? 'global'">
      <template #host>
        <span class="font-semibold">{{ domain }}</span>
      </template>
    </I18nT>
  </div>
</template>
