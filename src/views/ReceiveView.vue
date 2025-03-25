<script setup lang="ts">
import { computed } from "vue";
import {
  CirclePlusIcon,
  ExternalLinkIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  TriangleAlertIcon
} from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/appStore";
import { StateAddress, useWalletStore } from "@/stores/walletStore";
import { AddressQrCodeDialog, AddressVerifyDialog } from "@/components/address";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
import { QrCode } from "@/components/ui/qr-code";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { bn } from "@/common/bigNumber";
import { useFormat } from "@/composables";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { AddressState, WalletType } from "@/types/internal";

const app = useAppStore();
const wallet = useWalletStore();
const format = useFormat();
const { t } = useI18n();

const isLedger = computed(() => wallet.type === WalletType.Ledger);
const addresses = computed(() => wallet.filteredAddresses.slice().reverse());
const canAddNewAddress = computed(() => wallet.settings.addressFilter !== "active");

const { open: openQrCodeDialog } = useProgrammaticDialog(AddressQrCodeDialog);
const { open: openAddressVerifyDialog } = useProgrammaticDialog(AddressVerifyDialog);
const { toast } = useToast();

function setDefaultAddress(address: StateAddress) {
  if (wallet.settings.defaultChangeIndex === address.index) return;
  wallet.settings.defaultChangeIndex = address.index;
}

async function newAddress() {
  try {
    await wallet.deriveNewAddress();
  } catch (e) {
    toast({
      title: t("receive.newAddressErrorTitle"),
      description: (e as Error)?.message ?? t("receive.newAddressErrorFallbackMessage")
    });
  }
}

function getFormattedErgBalance(address: StateAddress, decimals = 3): string | undefined {
  if (address.state === AddressState.Unused) return t("receive.unusedState");
  let erg = address.assets?.find((a) => a.tokenId === ERG_TOKEN_ID)?.confirmedAmount;
  if (!erg) erg = bn(0);

  return `${format.bn.format(erg, decimals, 1_000)} ERG`;
}

function openExplorer(address: string | undefined) {
  const url = new URL(`/addresses/${address}`, app.settings.explorerUrl).toString();
  window.open(url, "_blank");
}
</script>

<template>
  <div class="flex flex-col gap-4 p-6 pb-3">
    <Card class="p-6 text-sm">
      <div class="flex h-full flex-row items-center gap-4">
        <div class="flex h-full w-full flex-col justify-between">
          <CardTitle class="leading-none font-semibold tracking-tight">
            {{
              t(
                wallet.settings.avoidAddressReuse
                  ? "receive.currentAddress"
                  : "receive.defaultAddress"
              )
            }}
          </CardTitle>
          <div class="break-all">
            {{ wallet.changeAddress?.script }}
            <CopyButton class="size-3" :content="wallet.changeAddress?.script" />
          </div>
        </div>

        <QrCode :data="wallet.changeAddress?.script" class="size-32" />
      </div>
    </Card>

    <Alert v-if="isLedger">
      <TriangleAlertIcon />
      <AlertDescription class="hyphens-auto">
        {{ t("receive.maxTokensWarning", { count: 20 }) }}
      </AlertDescription>
    </Alert>

    <Tabs v-model="wallet.settings.addressFilter" class="pt-4">
      <div class="flex flex-row">
        <TabsList>
          <TabsTrigger value="all">{{ t("receive.filterAll") }}</TabsTrigger>
          <TabsTrigger value="active">{{ t("receive.filterActive") }}</TabsTrigger>
          <TabsTrigger value="unused">{{ t("receive.filterUnused") }}</TabsTrigger>
        </TabsList>

        <div class="grow"></div>
        <Button variant="ghost" size="icon" :disabled="!canAddNewAddress" @click="newAddress"
          ><CirclePlusIcon
        /></Button>
      </div>
    </Tabs>
  </div>

  <ScrollArea type="scroll">
    <Transition name="slide-up" appear>
      <div class="flex flex-col gap-0 px-6 pb-6">
        <div
          v-for="address in addresses"
          :key="address.script"
          class="hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-2 rounded-md bg-transparent px-3 py-4 transition-colors"
        >
          <div class="flex items-center gap-2">
            <Button
              variant="minimal"
              size="condensed"
              class="flex h-4 items-center gap-2"
              @click="setDefaultAddress(address)"
            >
              <Checkbox :model-value="wallet.settings.defaultChangeIndex === address.index" />
              <span class="text-foreground font-mono whitespace-nowrap">{{
                format.string.shorten(address.script, 8)
              }}</span>
            </Button>

            <div class="space-x-1.5 pb-1">
              <TooltipProvider :delay-duration="100">
                <Tooltip>
                  <TooltipTrigger>
                    <CopyButton
                      :content="address.script"
                      class="size-4 align-middle [&_svg]:size-4"
                    />
                  </TooltipTrigger>
                  <TooltipContent class="max-w-52 hyphens-auto">
                    {{ t("common.copy") }}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider :delay-duration="100">
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      variant="minimal"
                      size="condensed"
                      class="size-4 align-middle"
                      @click="openExplorer(address.script)"
                    >
                      <ExternalLinkIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent class="max-w-52 hyphens-auto">
                    {{ t("receive.openInExplorer") }}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider :delay-duration="100">
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      variant="minimal"
                      size="condensed"
                      class="size-4 align-middle"
                      @click="openQrCodeDialog({ address })"
                    >
                      <QrCodeIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent class="max-w-52 hyphens-auto">
                    {{ t("receive.showQrCode") }}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider :delay-duration="100" v-if="isLedger">
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      variant="minimal"
                      size="condensed"
                      class="size-4 align-middle"
                      @click="openAddressVerifyDialog({ address })"
                    >
                      <ShieldCheckIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent class="max-w-52 hyphens-auto">
                    {{ t("receive.verifyOnLedger") }}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div class="text-right text-xs">
            <Skeleton v-if="app.settings.hideBalances" class="h-4 w-20 animate-none" />
            <template v-else>
              <span>{{ getFormattedErgBalance(address) }}</span>
              <span v-if="address.assets.length > 1" class="text-muted-foreground">
                +{{ address.assets.length - 1 }}</span
              >
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </ScrollArea>
</template>
