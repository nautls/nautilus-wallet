<script setup lang="ts">
import { computed, ref } from "vue";
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
        <DrawerTitle>Extended Public Key</DrawerTitle>
        <DrawerDescription>
          Extended public keys allow viewing transaction history and generating new addresses, but
          they cannot spend or move funds in any way.
        </DrawerDescription>
      </DrawerHeader>

      <QrCode :data="xpk" class="m-auto size-[200px]" />
      <StatsCard
        class="break-all bg-secondary text-secondary-foreground"
        :display-copy-button="true"
        :content="xpk"
      >
        <div class="font-mono">{{ xpk }} <CopyButton :content="xpk" class="size-3" /></div>
      </StatsCard>

      <DrawerFooter>
        <DrawerClose as-child>
          <Button variant="outline" type="submit">Close</Button>
        </DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>
