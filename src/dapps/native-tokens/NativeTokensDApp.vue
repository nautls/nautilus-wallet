<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = ["native-tokens-mint", "native-tokens-burn"] as const;
type Tab = (typeof TABS)[number];

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const current = computed<Tab>(() =>
  TABS.includes(route.name as Tab) ? (route.name as Tab) : "native-tokens-mint"
);

function select(tab: string | number) {
  if (tab === current.value) return;
  router.replace({ name: tab as Tab });
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <Tabs :model-value="current" class="px-4 pt-4" @update:model-value="select">
      <TabsList class="w-full">
        <TabsTrigger value="native-tokens-mint">{{ t("dapps.nativeTokens.mint.tab") }}</TabsTrigger>
        <TabsTrigger value="native-tokens-burn">{{ t("dapps.nativeTokens.burn.tab") }}</TabsTrigger>
      </TabsList>
    </Tabs>

    <router-view v-slot="{ Component }">
      <component :is="Component" :key="current" />
    </router-view>
  </div>
</template>
