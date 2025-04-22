<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConnectedApps from "./ConnectedApps.vue";
import GlobalSettings from "./GlobalSettings.vue";
import WalletSettings from "./wallet-settings/WalletSettings.vue";

const { t } = useI18n();
</script>

<template>
  <ScrollArea type="scroll">
    <Tabs default-value="global-settings" class="w-full p-4">
      <TabsList class="flex w-full">
        <TabsTrigger class="w-full" value="global-settings">{{
          t("settings.tabs.global")
        }}</TabsTrigger>
        <TabsTrigger class="w-full" value="wallet-settings">{{
          t("settings.tabs.wallet")
        }}</TabsTrigger>
        <TabsTrigger class="w-full" value="connections">{{
          t("settings.tabs.connections")
        }}</TabsTrigger>
      </TabsList>

      <div class="py-2">
        <TabsContent value="global-settings"><GlobalSettings /></TabsContent>
        <TabsContent value="wallet-settings"><WalletSettings /></TabsContent>
        <TabsContent value="connections"><ConnectedApps /> </TabsContent>
      </div>
    </Tabs>
  </ScrollArea>
</template>
