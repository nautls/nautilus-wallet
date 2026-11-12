<script setup lang="ts">
import { ChevronRightIcon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import { dappsManifest } from "@/dapps/dappsManifest";

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-col p-4">
    <router-link
      v-for="dapp in dappsManifest"
      :key="dapp.path"
      v-slot="{ navigate }"
      :to="dapp.path"
      custom
    >
      <Button
        variant="ghost"
        class="h-auto justify-start gap-3 p-3 text-left font-normal whitespace-normal"
        :data-dapp="dapp.path"
        @click="navigate"
      >
        <span
          class="bg-secondary text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_img]:size-7 [&>svg]:size-6"
        >
          <component :is="dapp.icon.component" v-bind="dapp.icon.props" />
        </span>

        <span class="flex min-w-0 grow flex-col gap-0.5">
          <span class="text-sm font-medium">{{ t(`dapps.${dapp.titleKeyPath}`) }}</span>
          <span class="text-muted-foreground text-xs">{{ t(`dapps.${dapp.summaryKeyPath}`) }}</span>
        </span>

        <ChevronRightIcon class="text-muted-foreground shrink-0" aria-hidden="true" />
      </Button>
    </router-link>
  </div>
</template>
