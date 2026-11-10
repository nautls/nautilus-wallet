<script setup lang="ts">
import { computed } from "vue";
import { ComponentI18nScope, I18nT, PickupPaths } from "vue-i18n";
import { displayOrigin } from "@/common/origin";
import { MessageSchema } from "@/i18n";

interface Props {
  origin?: string;
  favicon?: string;
  i18nKeypath: PickupPaths<MessageSchema>;
  i18nScope?: ComponentI18nScope;
}

const props = defineProps<Props>();
const domain = computed(() => (props.origin ? displayOrigin(props.origin) : "???"));
</script>

<template>
  <!-- every locale starts these messages with {host}, so it can take a line of its own -->
  <I18nT
    :keypath="props.i18nKeypath"
    :scope="props.i18nScope ?? 'global'"
    tag="div"
    class="text-muted-foreground py-2 text-center text-sm"
    data-request-header
  >
    <template #host>
      <span
        data-request-origin
        class="text-foreground mb-1 flex items-center justify-center gap-2 text-base font-semibold break-all"
      >
        <img v-if="favicon" :src="favicon" class="size-6 shrink-0 rounded-sm" alt="" />
        {{ domain }}
      </span>
    </template>
  </I18nT>
</template>
