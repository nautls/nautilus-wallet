<script setup lang="ts">
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConnectedApps from "./ConnectedApps.vue";
import GlobalSettings from "./GlobalSettings.vue";
import WalletSettings from "./wallet-settings/WalletSettings.vue";
</script>

<template>
  <ScrollArea type="scroll">
    <Tabs default-value="global-settings" class="w-full p-6">
      <TabsList class="flex w-full">
        <TabsTrigger class="w-full" value="global-settings">Global</TabsTrigger>
        <TabsTrigger class="w-full" value="wallet-settings">Wallet</TabsTrigger>
        <TabsTrigger class="w-full" value="connections">Connections</TabsTrigger>
      </TabsList>

      <div class="py-4">
        <TabsContent value="global-settings"><GlobalSettings /></TabsContent>
        <TabsContent value="wallet-settings"><WalletSettings /></TabsContent>
        <TabsContent value="connections"><ConnectedApps /> </TabsContent>
      </div>
    </Tabs>
  </ScrollArea>
</template>
