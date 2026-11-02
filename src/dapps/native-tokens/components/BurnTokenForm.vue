<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from "vue";
import { mergeRegles, useRegle } from "@regle/core";
import { required, withMessage } from "@regle/rules";
import BigNumber from "bignumber.js";
import { differenceBy } from "es-toolkit";
import { EyeOffIcon, FlameIcon, ShieldAlertIcon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { useAssetsStore } from "@/stores/assetsStore";
import { AssetBalance, useWalletStore } from "@/stores/walletStore";
import { AssetInput, AssetSelect } from "@/components/asset";
import { TransactionFeeConfig, TransactionSignDialog } from "@/components/transaction";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CommandItem, CommandSeparator } from "@/components/ui/command";
import { Form, FormField } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TxAssetAmount } from "@/chains/ergo/transaction/builder";
import { bn, decimalize, undecimalize } from "@/common/bigNumber";
import { isErg } from "@/common/utils";
import { useProgrammaticDialog } from "@/composables";
import { useCollectChildValidations } from "@/composables/useValidationScope";
import { ERG_DECIMALS, ERG_TOKEN_ID, SAFE_MIN_FEE_VALUE } from "@/constants/ergo";
import { FeeSettings } from "@/types/internal";
import { createBurnTransaction } from "../transactionFactory";

const wallet = useWalletStore();
const assets = useAssetsStore();
const { t } = useI18n();
const { open: openTransactionSignDialog } = useProgrammaticDialog(TransactionSignDialog);

const selected = ref<TxAssetAmount[]>([]);
const fee = ref<FeeSettings>({
  tokenId: ERG_TOKEN_ID,
  value: decimalize(bn(SAFE_MIN_FEE_VALUE), ERG_DECIMALS)
});

const { r$ } = useRegle(
  { selected },
  {
    selected: {
      required: withMessage(required, () => t("dapps.nativeTokens.burn.noSelectedTokens"))
    }
  },
  { autoDirty: false }
);

// collects child components validations, like asset amounts and fee settings
const { r$: children$ } = useCollectChildValidations();
const form$ = mergeRegles({ r$, children$ });

const unselected = computed(() =>
  differenceBy(
    wallet.balance.filter((asset) => !isErg(asset.tokenId)),
    selected.value.map((item) => item.asset),
    (asset) => asset.tokenId
  )
);

function add(asset: AssetBalance) {
  selected.value.push({ asset });
}

const assetSelector = useTemplateRef("asset-selector");

type BlacklistName = "scam" | "nsfw";
const BLACKLISTS: BlacklistName[] = ["scam", "nsfw"];
const BLACKLIST_ICONS = { scam: ShieldAlertIcon, nsfw: EyeOffIcon };

// held and not yet selected tokens flagged by each blacklist, including the ones
// hidden from the wallet. Lists without such tokens are kept to be shown as disabled.
const blacklisted = computed(() => {
  const selectedIds = new Set(selected.value.map((item) => item.asset.tokenId));
  const held = wallet.unfilteredBalance.filter(
    (asset) => !isErg(asset.tokenId) && asset.balance.gt(0) && !selectedIds.has(asset.tokenId)
  );

  return BLACKLISTS.map((list) => {
    const ids = new Set(assets.blacklists[list]);
    return { list, tokens: held.filter((asset) => ids.has(asset.tokenId)) };
  });
});

/** Adds every given token to the burning list, at their full available balances. */
async function addBlacklisted(added: AssetBalance[]) {
  assetSelector.value?.close();
  assetSelector.value?.clearSearch();
  selected.value.push(...added.map((asset) => ({ asset })));

  // amount inputs only pick model changes up once they are mounted
  await nextTick();
  for (const item of selected.value) {
    if (added.some((asset) => asset.tokenId === item.asset.tokenId)) {
      item.amount = getAvailableAmount(item.asset);
    }
  }
}

function getAvailableAmount(asset: AssetBalance): BigNumber {
  const reserved = getReservedAmountFor(asset.tokenId);
  return reserved ? BigNumber.max(asset.balance.minus(reserved), 0) : asset.balance;
}

function remove(tokenId: string) {
  selected.value = selected.value.filter((item) => item.asset.tokenId !== tokenId);
}

// when paying the fee with a token being burned, its fee amount can't be burned
function getReservedAmountFor(tokenId: string): BigNumber | undefined {
  return tokenId === fee.value.tokenId ? fee.value.value : undefined;
}

async function burn() {
  const { valid } = await form$.$validate();
  if (!valid) return;

  const tokens = selected.value
    .filter((item) => item.amount && item.amount.gt(0))
    .map((item) => ({
      tokenId: item.asset.tokenId,
      amount: BigInt(undecimalize(item.amount!, item.asset.metadata?.decimals).toFixed(0))
    }));

  openTransactionSignDialog({
    transactionBuilder: () => createBurnTransaction(tokens, fee.value),
    onSuccess: reset
  });
}

function reset() {
  selected.value = [];
  form$.$reset();
}
</script>

<template>
  <ScrollArea type="scroll" class="grow">
    <Form class="space-y-4 p-4 pb-2" @submit="burn">
      <Alert variant="destructive-outline">
        <FlameIcon />
        <AlertDescription class="hyphens-auto">
          {{ t("dapps.nativeTokens.burn.warning") }}
        </AlertDescription>
      </Alert>

      <FormField v-if="selected.length">
        <Label>{{ t("dapps.nativeTokens.burn.tokens") }}</Label>
        <div class="grid gap-4">
          <AssetInput
            v-for="item in selected"
            :key="item.asset.tokenId"
            v-model="item.amount"
            :asset="item.asset"
            :reserved-amount="getReservedAmountFor(item.asset.tokenId)"
            disposable
            @remove="remove(item.asset.tokenId)"
          />
        </div>
      </FormField>

      <FormField :validation="r$.selected">
        <AssetSelect ref="asset-selector" :assets="unselected" @select="add">
          <template #commands>
            <CommandSeparator v-if="unselected.length" class="my-1" />
            <CommandItem
              v-for="entry in blacklisted"
              :key="entry.list"
              :value="t(`dapps.nativeTokens.burn.${entry.list}Tokens`)"
              :disabled="entry.tokens.length === 0"
              class="gap-2 py-2"
              @select.prevent="addBlacklisted(entry.tokens)"
            >
              <component :is="BLACKLIST_ICONS[entry.list]" class="size-6 shrink-0" />
              <div class="flex flex-col items-start justify-center text-xs font-bold">
                {{ t(`dapps.nativeTokens.burn.${entry.list}Tokens`) }}
                <div class="text-muted-foreground font-normal">
                  {{
                    t(
                      `dapps.nativeTokens.burn.${entry.list}TokensDesc`,
                      { count: entry.tokens.length },
                      entry.tokens.length
                    )
                  }}
                </div>
              </div>
            </CommandItem>
          </template>
        </AssetSelect>
      </FormField>
    </Form>
  </ScrollArea>

  <div class="space-y-4 p-4">
    <TransactionFeeConfig v-model="fee" />
    <Button type="submit" variant="destructive" size="lg" class="w-full" @click="burn">{{
      t("dapps.nativeTokens.burn.burn")
    }}</Button>
  </div>
</template>
