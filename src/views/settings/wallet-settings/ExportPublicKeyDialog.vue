<script setup lang="ts">
import { computed, ref } from "vue";
import { useWalletStore } from "@/stores/walletStore";
import QrCode from "@/components/QrCode.vue";
import StatsCard from "@/components/StatsCard.vue";
import { Button } from "@/components/ui/button";
import CopyButton from "@/components/ui/CopyButton.vue";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { mountExtendedPublicKey } from "@/common/serializer";

const wallet = useWalletStore();
const emit = defineEmits(["close"]);

const opened = ref(true);
const exPk = computed(() => mountExtendedPublicKey(wallet.publicKey, wallet.chainCode));

function handleOpenUpdates(open: boolean) {
  if (!open) emit("close");
}

function setOpened(open: boolean) {
  opened.value = open;
}

defineExpose({ open: () => setOpened(true), close: () => setOpened(false) });
</script>

<template>
  <Dialog v-model:open="opened" @update:open="handleOpenUpdates">
    <DialogContent class="sm:max-w-[410px]">
      <DialogHeader>
        <DialogTitle>Extended Public Key</DialogTitle>
        <DialogDescription>
          Extended public keys allow viewing transaction history and generating new addresses, but
          they cannot spend or move funds in any way.
        </DialogDescription>
      </DialogHeader>

      <QrCode :data="exPk" class="size-[200px] m-auto" />

      <StatsCard
        class="break-all bg-secondary text-secondary-foreground"
        :display-copy-button="true"
        :content="exPk"
      >
        <div class="font-mono">{{ exPk }} <CopyButton :content="exPk" class="size-3" /></div>
      </StatsCard>

      <DialogFooter>
        <DialogClose as-child>
          <Button variant="outline" type="submit">Close</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
