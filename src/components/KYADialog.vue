<script setup lang="ts">
import { ref } from "vue";
import { useAppStore } from "@/stores/appStore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Link } from "@/components/ui/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DEFAULT_EXPLORER_URL } from "@/constants/explorer";

const app = useAppStore();
const emit = defineEmits(["close"]);

const opened = ref(true);

function handleOpenUpdates(open: boolean) {
  if (!open) emit("close");
}

function setOpened(open: boolean) {
  opened.value = open;
}

defineExpose({ open: () => setOpened(true), close: () => setOpened(false) });
</script>

<template>
  <AlertDialog v-model:open="opened" @update:open="handleOpenUpdates">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Know Your Assumptions</AlertDialogTitle>
        <AlertDialogDescription>
          <ScrollArea type="hover" hide-outline>
            <div class="text-sm text-left space-y-2 px-2 h-[60dvh] text-foreground">
              <p>Nautilus is an open source tool for interacting with the Ergo Blockchain.</p>

              <h2 class="font-bold pt-4 text-base">Notice that:</h2>

              <ul class="list-outside list-disc pl-4 space-y-1">
                <li>
                  We do not log, collect, profile, share, or sell your data. For more information,
                  please refer to our
                  <Link
                    external
                    href="https://github.com/nautls/nautilus-wallet/blob/master/privacy-policy.md"
                    >Privacy Policy</Link
                  >;
                </li>
                <li>
                  Nautilus operates on a live blockchain, thus transactions are final, and
                  irreversible once they have
                  <span
                    class="font-semibold bg-secondary text-secondary-foreground px-1.5 border border-input rounded-sm"
                    >confirmed</span
                  >
                  status;
                </li>
                <li>
                  Every transaction can be viewed via
                  <Link external :href="DEFAULT_EXPLORER_URL">explorer</Link>;
                </li>
                <li>
                  <Link external href="https://github.com/nautls/nautilus-wallet"
                    >All code is open source and available</Link
                  >
                  for public review;
                </li>
                <li class="font-bold">
                  Nautilus Team doesn't guarantee the absence of bugs and errors;
                </li>
                <li class="font-bold">
                  NO assistance can offered if a user is hacked or cheated out of passwords,
                  currency or private keys;
                </li>
              </ul>

              <h2 class="font-bold pt-4 text-base">By accepting these KYA, you agree that:</h2>

              <ul class="indent-xs list-outside pl-4 list-decimal">
                <li>You will use the product at your own peril and risk;</li>
                <li>Only YOU are responsible for your assets;</li>
                <li>Only YOU are responsible for securely storing your recovery phrase.</li>
              </ul>
            </div>
          </ScrollArea>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogAction @click="app.settings.isKyaAccepted = true"
          >I understand and accept the KYA</AlertDialogAction
        >
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
