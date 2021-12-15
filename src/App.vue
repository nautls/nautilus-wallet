<template>
  <div class="flex flex-col h-full h-600px max-h-600px w-400px gap-0">
    <wallet-header v-show="!$route.meta.fullPage" />
    <nav-header v-if="!$route.meta.fullPage" />
    <div class="flex-grow overflow-y-auto overflow-x-hidden">
      <div class="p-4">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import NavHeader from "@/components/NavHeader.vue";
import WalletHeader from "@/components/WalletHeader.vue";

export default defineComponent({
  name: "App",
  components: {
    NavHeader,
    WalletHeader
  }
});
</script>
