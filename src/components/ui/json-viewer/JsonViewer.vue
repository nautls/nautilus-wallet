<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import VueJsonPretty from "vue-json-pretty";
import { cn } from "@/common/utils";
import { CopyButton } from "../copy-button";

import "vue-json-pretty/lib/styles.css";

type JsonDataType = string | number | boolean | unknown[] | Record<string, unknown> | null;

interface Props {
  data?: JsonDataType;
  deep?: number;
  class?: HTMLAttributes["class"];
}

const props = defineProps<Props>();
</script>

<template>
  <div :class="cn('relative rounded-xl bg-secondary p-4 text-secondary-foreground shadow-sm', props.class)">
    <VueJsonPretty
      :data="props.data"
      :deep="props.deep"
      :highlight-selected-node="false"
      :show-double-quotes="true"
      :show-length="true"
      :show-line="false"
    />

    <CopyButton class="absolute top-4 right-4 size-4" :content="JSON.stringify(props.data, null, 2)" />
  </div>
</template>

<style>
@reference "../../../assets/styles/index.css";

.vjs-tree {
  @apply font-mono text-xs text-foreground;
}

.vjs-tree .vjs-tree-node,
.vjs-tree .vjs-tree__node {
  @apply -mx-4 px-4 py-0.5 text-xs;
}

.vjs-tree .vjs-tree-node:hover,
.vjs-tree .vjs-tree__node:hover {
  @apply bg-gray-500/10 dark:bg-gray-500/20;
}
</style>
