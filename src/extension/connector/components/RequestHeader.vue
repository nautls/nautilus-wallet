<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { LockOpenIcon } from "@lucide/vue";
import { ComponentI18nScope, I18nT, PickupPaths, useI18n } from "vue-i18n";
import { displayOrigin, isSecureOrigin } from "@/common/origin";
import { MessageSchema } from "@/i18n";

interface Props {
  origin?: string;
  favicon?: string;
  i18nKeypath: PickupPaths<MessageSchema>;
  i18nScope?: ComponentI18nScope;
}

const props = defineProps<Props>();
const { t } = useI18n();

const faviconFailed = ref(false);
watch(
  () => props.favicon,
  () => (faviconFailed.value = false)
);

const domain = computed(() => (props.origin ? displayOrigin(props.origin) : "???"));
const secure = computed(() => !props.origin || isSecureOrigin(props.origin));
const monogram = computed(() => {
  if (!props.origin) return "?";
  const hostname = URL.canParse(props.origin) ? new URL(props.origin).hostname : props.origin;
  return (
    hostname
      .replace(/^www\./, "")
      .match(/[\p{L}\p{N}]/u)?.[0]
      ?.toUpperCase() ?? "?"
  );
});
</script>

<template>
  <div class="bg-header flex shrink-0 items-center gap-3 border-b p-4" data-request-header>
    <span
      class="bg-background ring-foreground/10 flex size-9 shrink-0 items-center justify-center rounded-lg ring-1"
      aria-hidden="true"
    >
      <img
        v-if="favicon && !faviconFailed"
        :src="favicon"
        class="size-6 rounded-sm"
        alt=""
        @error="faviconFailed = true"
      />
      <span v-else class="text-muted-foreground text-base font-semibold">{{ monogram }}</span>
    </span>

    <I18nT
      :keypath="props.i18nKeypath"
      :scope="props.i18nScope ?? 'global'"
      tag="div"
      class="text-muted-foreground min-w-0 text-sm leading-tight"
    >
      <template #host>
        <span class="flex flex-wrap items-center gap-x-2">
          <span
            data-request-origin
            class="text-foreground text-base leading-tight font-medium break-all"
          >
            {{ domain }}
          </span>
          <span
            v-if="!secure"
            data-request-insecure
            class="border-destructive/50 text-destructive inline-flex items-center gap-1 rounded-full border px-1.5 text-xs leading-5 font-medium"
          >
            <LockOpenIcon class="size-3" />
            {{ t("connector.notSecure") }}
          </span>
        </span>
      </template>
    </I18nT>
  </div>
</template>
