<script setup lang="ts">
import { computed, ref, useTemplateRef, type HTMLAttributes } from "vue";
import { ChevronDownIcon } from "@lucide/vue";
import { useResizeObserver } from "@vueuse/core";
import hljs from "highlight.js/lib/core";
import json from "highlight.js/lib/languages/json";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/common/utils";
import { CopyButton } from "../copy-button";

hljs.registerLanguage("json", json);

// collapsed view only shows ~10 lines, so avoid highlighting and laying out the full document
const PREVIEW_LINES = 16;

type JsonDataType = string | number | boolean | unknown[] | Record<string, unknown> | null;

interface Props {
  data?: JsonDataType;
  class?: HTMLAttributes["class"];
}

const props = defineProps<Props>();

const { t } = useI18n({ useScope: "global" });

const container = useTemplateRef("container");
const content = useTemplateRef("content");
const expanded = ref(false);
const overflowing = ref(false);

const code = computed(() => JSON.stringify(props.data ?? null, null, 2));
const preview = computed(() => {
  let end = -1;
  for (let i = 0; i < PREVIEW_LINES; i++) {
    end = code.value.indexOf("\n", end + 1);
    if (end === -1) return code.value;
  }

  return code.value.slice(0, end);
});
const truncated = computed(() => preview.value.length < code.value.length);
const html = computed(
  () => hljs.highlight(expanded.value ? code.value : preview.value, { language: "json" }).value
);

useResizeObserver(content, () => {
  if (!container.value || !content.value || expanded.value) return;
  overflowing.value = truncated.value || content.value.offsetHeight > container.value.clientHeight;
});
</script>

<template>
  <div :class="cn('json-viewer relative rounded-xl bg-secondary p-4 shadow-sm', props.class)">
    <div ref="container" :class="cn('relative', { 'max-h-40 overflow-hidden': !expanded })">
      <!-- eslint-disable-next-line vue/no-v-html -- highlight.js escapes all token content -->
      <pre ref="content"><code v-html="html" /></pre>

      <div
        v-if="overflowing && !expanded"
        class="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-secondary"
      />
    </div>

    <Button
      v-if="overflowing"
      variant="minimal"
      size="condensed"
      class="mt-2 w-full gap-1 text-xs"
      @click="expanded = !expanded"
    >
      {{ expanded ? t("common.showLess") : t("common.showMore") }}
      <ChevronDownIcon :class="cn('size-4! transition-transform', { 'rotate-180': expanded })" />
    </Button>

    <CopyButton class="absolute top-4 right-4 size-4" :content="code" />
  </div>
</template>

<style>
@reference "../../../assets/styles/index.css";

.json-viewer pre {
  @apply font-mono text-xs break-all whitespace-pre-wrap text-[#24292e] dark:text-[#e1e4e8];
}

.json-viewer .hljs-attr,
.json-viewer .hljs-number,
.json-viewer .hljs-literal {
  @apply text-[#005cc5] dark:text-[#79b8ff];
}

.json-viewer .hljs-string {
  @apply text-[#032f62] dark:text-[#9ecbff];
}
</style>
