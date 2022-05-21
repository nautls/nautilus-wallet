<template>
  <o-modal
    :active="active"
    :auto-focus="true"
    :can-cancel="closable"
    @onClose="emitOnClose()"
    scroll="clip"
    content-class="!w-auto rounded"
  >
    <div class="p-5 w-60 text-center">
      <div :class="stateClass" class="w-full h-26">
        <vue-feather type="check-circle" v-if="state === 'success'" class="w-25 h-25" />
        <vue-feather type="alert-circle" v-else-if="state === 'error'" class="w-25 h-25" />
        <loading-indicator v-else type="circular" class="w-25 h-25 !stroke-gray-500" />
      </div>
      <h1 class="pt-4 font-semibold text-xl" :class="stateClass">{{ titleText }}</h1>
      <p class="pt-1 font-normal text-sm" v-html="message" v-if="message"></p>
    </div>
  </o-modal>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "LoadingModal",
  props: {
    title: { type: String, required: true },
    message: { type: String, required: false },
    state: {
      type: String,
      required: true,
      validate(value: string) {
        return ["unknown", "success", "loading", "error"].includes(value);
      }
    }
  },
  methods: {
    emitOnClose(): void {
      this.$emit("close");
    }
  },
  computed: {
    stateClass(): string {
      if (this.state === "success") {
        return "text-green-600";
      } else if (this.state === "error") {
        return "text-red-600";
      } else {
        return "text-gray-600";
      }
    },
    titleText(): string {
      if (this.state === "success") {
        return "Success!";
      } else if (this.state === "error") {
        return "Error";
      } else {
        return this.title;
      }
    },
    active(): boolean {
      return this.state !== "unknown";
    },
    closable(): boolean {
      return ["success", "error"].includes(this.state);
    }
  }
});
</script>
