<template>
  <div class="dropdown" :class="[{ active: active, discrete: discrete }, rootClass]">
    <button
      @click="toggle()"
      :disabled="disabled"
      :class="[{ active: active }, position, triggerClass]"
      class="trigger flex flex-row items-center"
    >
      <slot name="trigger" :active="active" />
    </button>
    <div
      ref="its"
      v-show="active"
      @click="toggle()"
      :class="[position, listClass]"
      class="items-list"
      tabindex="-1"
    >
      <slot name="items" />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "DropDown",
  props: {
    discrete: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    rootClass: { type: String, required: false },
    triggerClass: { type: String, required: false },
    listClass: { type: String, required: false }
  },
  data: () => {
    return { active: false, position: "bottom", topBorder: false };
  },
  watch: {
    active() {
      this.calculatePosition();
    }
  },
  methods: {
    toggle(): void {
      this.active = !this.active;
    },
    close(e: Event): void {
      if (!this.active) {
        return;
      }

      if (!this.$el.contains(e.target)) {
        this.active = false;
      }
    },
    calculatePosition() {
      const clientHeight = window.innerHeight || document.documentElement.clientHeight;
      const el = this.$refs.its as HTMLElement;
      if (!el) {
        return;
      }

      this.$nextTick(() => {
        const rect = el.getBoundingClientRect();
        const isVerticallyInViewport = rect.top >= 0 && rect.bottom <= clientHeight;

        this.position = isVerticallyInViewport ? "bottom" : "top";
      });
    }
  },
  mounted() {
    addEventListener("click", this.close);
  },
  deactivated() {
    removeEventListener("click", this.close);
  }
});
</script>
