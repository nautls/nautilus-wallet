<script setup lang="ts">
import { h, ref, watch } from "vue";
import { EIP12UnsignedTransaction, SignedInput, SignedTransaction } from "@fleet-sdk/common";
import { ExternalLinkIcon } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/appStore";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import { ToastAction, useToast } from "@/components/ui/toast";
import { extractErrorMessage } from "@/common/utils";
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
const { t } = useI18n();

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
    const errorMessage = extractErrorMessage(e);
    toast({
      title: t("transaction.sign.buildError"),
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
    title: t("transaction.sign.success"),
    description: t("transaction.sign.successDesc"),
    action: h(
      ToastAction,
      {
        onClick: () => openExplorer(signed.id),
        altText: t("common.openInExplorer"),
        class: "size-9 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
      },
      { default: () => h(ExternalLinkIcon) }
    )
  });

  emit("success", signed.id);
  setOpened(false);
}

function onFail(errorMessage: string) {
  toast({
    title: t("transaction.sign.signError"),
    description: errorMessage,
    variant: "destructive"
  });

  emit("fail", errorMessage);
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
      <DrawerHeader v-once>
        <DrawerTitle>{{ t("transaction.sign.reviewTx") }}</DrawerTitle>
        <DrawerDescription>{{ t("transaction.sign.reviewTxDesc") }}</DrawerDescription>
      </DrawerHeader>

      <TransactionSign
        :transaction="transaction"
        :loading="loading"
        @success="onSuccess"
        @fail="onFail"
        @refused="setOpened(false)"
      />
    </DrawerContent>
  </Drawer>
</template>
