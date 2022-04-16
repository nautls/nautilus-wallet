<template>
  <tool-tip :label="copied ? 'Copied' : 'Copy'" :type="type">
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
    content: { type: String, required: false }
  },
  data: () => {
    return {
      copied: false,
      type: "default"
    };
  },
  methods: {
    copy() {
      navigator.clipboard.writeText(this.content ?? "");
      this.setCopied();
      setTimeout(() => {
        this.setCopied(false);
      }, 1000 * 2);
    },
    setCopied(value = true) {
      if (value) {
        this.type = "success";
      } else {
        this.type = "default";
      }

      this.copied = value;
    }
  }
});
</script>
