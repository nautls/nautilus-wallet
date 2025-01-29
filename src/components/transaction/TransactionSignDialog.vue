<script setup lang="ts">
import { h, ref, watch } from "vue";
import { EIP12UnsignedTransaction, SignedInput, SignedTransaction } from "@fleet-sdk/common";
import { ExternalLinkIcon } from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import { ToastAction, useToast } from "@/components/ui/toast";
import { TransactionBuilderFunction } from "@/types/internal";
import TransactionSign from "./TransactionSign.vue";

interface Props {
  transactionBuilder: TransactionBuilderFunction;
}

interface Emits {
  (e: "success", payload: string): void;
  (e: "fail", payload: string): void;
  (e: "refused"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const app = useAppStore();

const { toast } = useToast();

const transaction = ref<EIP12UnsignedTransaction>();
const opened = ref(true);
const loading = ref(false);

watch(
  opened,
  async () => {
    if (!opened.value) return;
    transaction.value = await buildTransaction();
  },
  { immediate: true }
);

async function buildTransaction() {
  try {
    loading.value = true;
    return await props.transactionBuilder();
  } catch (e) {
    const errorMessage = typeof e === "string" ? e : (e as Error).message;
    toast({
      title: "Transaction build failed",
      description: errorMessage,
      variant: "destructive"
    });

    emit("fail", errorMessage);
    setOpened(false);
  } finally {
    loading.value = false;
  }
}

function openExplorer(txId: string) {
  const url = new URL(`/transactions/${txId}`, app.settings.explorerUrl).toString();
  window.open(url, "_blank");
}

async function onSuccess(signed: SignedTransaction | SignedInput[]) {
  if (Array.isArray(signed)) return;

  toast({
    title: "Transaction sent!",
    description: "Your transaction has been successfully signed and sent.",
    action: h(
      ToastAction,
      {
        onClick: () => openExplorer(signed.id),
        altText: "View in explorer",
        class: "size-9 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
      },
      { default: h(ExternalLinkIcon) }
    )
  });

  emit("success", signed.id);
  setOpened(false);
}

function handleOpenUpdates(open: boolean) {
  if (!open) emit("refused");
}

function setOpened(open: boolean) {
  opened.value = open;
}

defineExpose({ open: () => setOpened(true), close: () => setOpened(false) });
</script>

<template>
  <Drawer v-model:open="opened" @update:open="handleOpenUpdates">
    <DrawerContent class="max-h-[90vh]">
      <DrawerHeader>
        <DrawerTitle>Transaction Review</DrawerTitle>
        <DrawerDescription>Review the transaction before signing.</DrawerDescription>
      </DrawerHeader>

      <TransactionSign
        :transaction="transaction"
        :loading="loading"
        @success="onSuccess"
        @refused="setOpened(false)"
      />
    </DrawerContent>
  </Drawer>
</template>
