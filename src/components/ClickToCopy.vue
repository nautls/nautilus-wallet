<template>
  <tool-tip :label="copied ? 'Copied!' : 'Copy'">
    <a @click="copy()" class="cursor-pointer">
      <vue-feather type="copy" :size="size" />
    </a>
  </tool-tip>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "ClickToCopy",
  props: {
    size: { type: String, default: "16" },
    content: { type: String, required: true }
  },
  data: () => {
    return { copied: false };
  },
  methods: {
    copy() {
      navigator.clipboard.writeText(this.content);
      this.setCopied();
      setTimeout(() => {
        this.setCopied(false);
      }, 1000 * 5);
    },
    setCopied(value = true) {
      this.copied = value;
    }
  }
});
</script>
