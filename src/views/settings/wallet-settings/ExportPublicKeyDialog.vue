<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useWalletStore } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import { QrCode } from "@/components/ui/qr-code";
import { StatsCard } from "@/components/ui/stats-card";
import { mountExtendedPublicKey } from "@/common/serializer";

const wallet = useWalletStore();
const { t } = useI18n();

const emit = defineEmits(["close"]);

const opened = ref(true);
const xpk = computed(() => mountExtendedPublicKey(wallet.publicKey, wallet.chainCode));

function handleOpenUpdates(open: boolean) {
  if (!open) emit("close");
}

function setOpened(open: boolean) {
  opened.value = open;
}

defineExpose({ open: () => setOpened(true), close: () => setOpened(false) });
</script>

<template>
  <Drawer v-model:open="opened" @update:open="handleOpenUpdates">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>{{ t("wallet.xPubKey") }}</DrawerTitle>
        <DrawerDescription class="hyphens-auto">{{ t("wallet.xPubKeyDesc") }}</DrawerDescription>
      </DrawerHeader>

      <QrCode :data="xpk" class="m-auto size-[200px]" />
      <StatsCard
        class="bg-secondary text-secondary-foreground break-all"
        :display-copy-button="true"
        :content="xpk"
      >
        <div class="font-mono">{{ xpk }} <CopyButton :content="xpk" class="size-3" /></div>
      </StatsCard>

      <DrawerFooter>
        <DrawerClose as-child>
          <Button variant="outline" type="submit">{{ t("common.close") }}</Button>
        </DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>
