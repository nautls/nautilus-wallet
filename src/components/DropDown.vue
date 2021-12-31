<template>
  <div class="dropdown">
    <button @click="troggle()" class="trigger flex flex-row" :class="active ? 'active' : ''">
      <slot name="trigger" />
    </button>

    <div v-show="active" @click="troggle()" class="items-list" tabindex="-1">
      <slot name="items" />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "DropDown",
  data: () => {
    return { active: false };
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
