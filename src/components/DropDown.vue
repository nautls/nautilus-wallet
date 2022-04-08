<template>
  <div class="dropdown" :class="{ active: active, discrete: discrete }">
    <button
      @click="troggle()"
      :disabled="disabled"
      class="trigger flex flex-row"
      :class="[{ active: active }, position]"
    >
      <slot name="trigger" :active="active" />
    </button>

    <div
      ref="its"
      v-show="active"
      @click="troggle()"
      :class="position"
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
    disabled: { type: Boolean, default: false }
  },
  data: () => {
    return { active: false, position: "bottom" };
  },
  watch: {
    active() {
      this.calcPosition();
    }
  },
  methods: {
    troggle(): void {
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
    calcPosition() {
      const clientHeight = window.innerHeight || document.documentElement.clientHeight;
      let el = this.$refs.its as HTMLElement;
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
