<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from "vue";
import { isEmpty } from "@fleet-sdk/common";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";
import BigNumber from "bignumber.js";
import { differenceBy } from "es-toolkit";
import { CheckCheckIcon, CheckCircle2Icon, Globe2Icon, Loader2Icon, TriangleAlertIcon } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { AssetBalance, useWalletStore } from "@/stores/walletStore";
import { AssetInput, AssetSelect } from "@/components/asset";
import { TransactionFeeConfig, TransactionSignDialog } from "@/components/transaction";
import { Button } from "@/components/ui/button";
import { CommandItem, CommandSeparator } from "@/components/ui/command";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ScrollArea from "@/components/ui/scroll-area/ScrollArea.vue";
import {
  createP2PTransaction,
  SAFE_MAX_CHANGE_TOKEN_LIMIT,
  TxAssetAmount
} from "@/chains/ergo/transaction/builder";
import { bn, decimalize } from "@/common/bigNumber";
import { isErg } from "@/common/utils";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import { ERG_DECIMALS, ERG_TOKEN_ID, MIN_BOX_VALUE, SAFE_MIN_FEE_VALUE } from "@/constants/ergo";
import { FeeSettings } from "@/types/internal";
import { validErgoAddress } from "@/validators";
import { isErgoDomain, resolveErgoDomain, ResolvedErgoDomain } from "@/chains/ergo/services/domainResolver";

const INITIAL_FEE_VAL = decimalize(bn(SAFE_MIN_FEE_VALUE), ERG_DECIMALS);
const MIN_BOX_VAL = decimalize(bn(MIN_BOX_VALUE), ERG_DECIMALS);

const wallet = useWalletStore();
const route = useRoute();

const { t } = useI18n();
const { open: openTransactionSignDialog } = useProgrammaticDialog(TransactionSignDialog);

const assetSelector = useTemplateRef("asset-selector");
const selected = ref<TxAssetAmount[]>([]);
const fee = ref<FeeSettings>({ tokenId: ERG_TOKEN_ID, value: INITIAL_FEE_VAL });
const password = ref("");
const recipient = ref("");
const resolvedDomain = ref<ResolvedErgoDomain>();
const resolvingDomain = ref(false);
const domainError = ref("");

const recipientAddress = computed(() => resolvedDomain.value?.address ?? recipient.value.trim());
const typedDomain = computed(() => isErgoDomain(recipient.value));

const v$ = useVuelidate(
  {
    recipient: {
      required: helpers.withMessage(t("transaction.send.emptyAddressError"), required),
      validErgoAddress: (value: string) => isErgoDomain(value) || validErgoAddress.$validator(value)
    },
    selected: {
      required: helpers.withMessage(t("transaction.send.noSelectedAssetsError"), required)
    }
  },
  { selected, recipient }
);

onMounted(() => {
  if (route.query.recipient && typeof route.query.recipient === "string") {
    recipient.value = route.query.recipient;
  }

  setErgAsSelected();
});

const unselected = computed(() => {
  return differenceBy(
    wallet.balance,
    selected.value.map((a) => a.asset),
    (a) => a.tokenId
  );
});

const shouldReserveChange = computed(() => {
  if (unselected.value.length) return true;

  for (const item of selected.value) {
    if (isErg(item.asset.tokenId)) continue;
    if (needsChangeFor(item)) return true;
  }

  return false;
});

const reservedFeeAssetAmount = computed((): BigNumber => {
  const feeValue = fee.value.value;
  const feeAsset = selected.value.find((a) => a.asset.tokenId === fee.value.tokenId);

  if (!feeAsset || feeAsset.asset.balance.isZero()) return bn(0);
  if (!changeValue.value) return feeValue;
  if (isErg(fee.value.tokenId)) return feeValue.plus(changeValue.value);
  return feeValue;
});

const isFeeInErg = computed(() => isErg(fee.value.tokenId));

const changeBoxesCount = computed(() => {
  if (!shouldReserveChange.value) return 0;

  const count = Math.ceil(unselected.value.length / SAFE_MAX_CHANGE_TOKEN_LIMIT);
  // if count is equal to 0 and we need to reserve change, then we need at least 1 box
  return count === 0 && shouldReserveChange.value ? 1 : count;
});

const changeValue = computed(() =>
  shouldReserveChange.value ? MIN_BOX_VAL.times(changeBoxesCount.value) : undefined
);

watch(
  () => fee.value.tokenId,
  (newVal: string) => {
    if (isErg(newVal)) setErgAsSelected();
  }
);

watch(recipient, async (value) => {
  resolvedDomain.value = undefined;
  domainError.value = "";
  const name = value.trim().toLowerCase();
  if (!isErgoDomain(name)) return;
  resolvingDomain.value = true;
  try {
    const result = await resolveErgoDomain(name);
    if (recipient.value.trim().toLowerCase() === name) resolvedDomain.value = result;
  } catch (error) {
    if (recipient.value.trim().toLowerCase() === name) {
      domainError.value = error instanceof Error ? error.message : "This name could not be resolved.";
    }
  } finally {
    if (recipient.value.trim().toLowerCase() === name) resolvingDomain.value = false;
  }
});

watch(
  () => selected.value.length,
  () => v$.value.selected.$touch()
);

function getReserveAmountFor(tokenId: string): BigNumber | undefined {
  if (isFeeAsset(tokenId)) {
    return reservedFeeAssetAmount.value;
  } else if (isErg(tokenId) && shouldReserveChange.value) {
    return changeValue.value;
  }
}

function scrollToErrorElement() {
  const errorEl = document.getElementById(v$.value.$errors[0].$uid);
  if (!errorEl) return;

  errorEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function sendTransaction() {
  const valid = await v$.value.$validate();
  if (!valid) return scrollToErrorElement();
  if (isErgoDomain(recipient.value) && (!resolvedDomain.value || resolvingDomain.value)) {
    domainError.value = "Wait for the domain to resolve before sending.";
    return;
  }

  openTransactionSignDialog({
    transactionBuilder: async () =>
      createP2PTransaction({
        recipientAddress: recipientAddress.value,
        assets: selected.value,
        fee: fee.value,
        walletType: wallet.type
      }),
    onSuccess: () => {
      selected.value = [];
      setErgAsSelected();
      recipient.value = "";
      resolvedDomain.value = undefined;
      domainError.value = "";
      password.value = "";
      v$.value.$reset();
    }
  });
}

function needsChangeFor(item: TxAssetAmount): boolean {
  if (!item.amount) return true;
  return isFeeAsset(item.asset.tokenId)
    ? !item.amount.eq(item.asset.balance.minus(fee.value.value))
    : !item.amount.eq(item.asset.balance);
}

function setErgAsSelected(): void {
  if (!isFeeInErg.value && !isEmpty(selected.value)) return;

  const isErgSelected = selected.value.find((a) => isErg(a.asset.tokenId));
  if (isErgSelected) return;

  const erg = wallet.balance.find((a) => isErg(a.tokenId));
  if (erg) {
    selected.value.unshift({ asset: erg, amount: undefined });
  }
}

function add(asset: AssetBalance) {
  removeDisposableSelections();
  selected.value.push({ asset });

  if (isErg(fee.value.tokenId)) setMinBoxValue();
}

function addAll() {
  unselected.value.forEach((asset) => selected.value.push({ asset }));
  setMinBoxValue();
  assetSelector.value?.close();
  assetSelector.value?.clearSearch();
}

function removeAsset(tokenId: string) {
  const index = selected.value.findIndex((a) => a.asset.tokenId === tokenId);
  if (index === -1) return;

  selected.value.splice(index, 1);
  setMinBoxValue();
}

function setMinBoxValue() {
  if (selected.value.length === 1) return;

  const erg = selected.value.find((a) => isFeeAsset(a.asset.tokenId));
  if (!erg) return;

  if (!erg.amount || erg.amount.lt(MIN_BOX_VAL)) {
    erg.amount = MIN_BOX_VAL;
  }
}

function removeDisposableSelections() {
  if (isErg(fee.value.tokenId)) return;

  const first = selected.value[0];
  if (!first) return;

  if (!first.amount || first.amount.isZero()) {
    removeAsset(first.asset.tokenId);
  }
}

function isFeeAsset(tokenId: string): boolean {
  return tokenId === fee.value.tokenId;
}
</script>

<template>
  <ScrollArea type="scroll" class="grow">
    <Form class="space-y-4 p-4 pb-2" @submit="sendTransaction">
      <FormField :validation="v$.recipient">
        <Label for="recipient">Address or ErgoName</Label>
        <div class="relative">
          <Input
            id="recipient"
            v-model="recipient"
            type="text"
            spellcheck="false"
            autocomplete="off"
            placeholder="Enter an Ergo address or name.erg"
            :class="{ 'pr-10': typedDomain }"
            @blur="v$.recipient.$touch()"
          />
          <Loader2Icon
            v-if="resolvingDomain"
            class="text-muted-foreground absolute top-2 right-3 size-5 animate-spin"
          />
          <Globe2Icon
            v-else-if="typedDomain"
            class="text-muted-foreground absolute top-2 right-3 size-5"
          />
        </div>
        <p class="text-muted-foreground text-xs">Send to an Ergo address or resolve an ErgoName ending in .erg or .ergo.</p>

        <Alert v-if="resolvingDomain" class="bg-muted/40 mt-2 space-x-2 py-2">
          <Loader2Icon class="size-4 animate-spin" />
          <AlertTitle>Resolving Ergo Domain</AlertTitle>
          <AlertDescription>{{ recipient.trim().toLowerCase() }}</AlertDescription>
        </Alert>
        <Alert v-else-if="resolvedDomain" class="border-success/40 bg-success/5 mt-2 space-x-2 py-2">
          <CheckCircle2Icon class="text-success size-4" />
          <AlertTitle>{{ resolvedDomain.name }} resolved</AlertTitle>
          <AlertDescription class="grid gap-1">
            <span class="text-muted-foreground text-xs">Recipient address</span>
            <span class="font-mono text-xs break-all">{{ resolvedDomain.address }}</span>
            <span class="text-muted-foreground text-xs">Valid through block {{ resolvedDomain.expiryHeight }}</span>
          </AlertDescription>
        </Alert>
        <Alert v-else-if="domainError" variant="destructive-outline" class="mt-2 space-x-2 py-2">
          <TriangleAlertIcon class="size-4" />
          <AlertTitle>Domain unavailable</AlertTitle>
          <AlertDescription>{{ domainError }}</AlertDescription>
        </Alert>
      </FormField>

      <FormField>
        <Label>{{ t("transaction.send.assets") }}</Label>
        <div class="grid gap-4">
          <AssetInput
            v-for="item in selected"
            :key="item.asset.tokenId"
            v-model="item.amount"
            :asset="item.asset"
            :reserved-amount="getReserveAmountFor(item.asset.tokenId)"
            :min-amount="isErg(item.asset.tokenId) ? MIN_BOX_VAL : undefined"
            :disposable="!isErg(item.asset.tokenId) || !(isErg(item.asset.tokenId) && isFeeInErg)"
            @remove="removeAsset(item.asset.tokenId)"
          />
        </div>
      </FormField>

      <FormField :validation="v$.selected">
        <AssetSelect ref="asset-selector" :assets="unselected" @select="add">
          <template v-if="unselected.length" #commands>
            <CommandSeparator class="my-1" />
            <CommandItem value="Add all" class="gap-2 py-2" @select.prevent="addAll">
              <CheckCheckIcon class="size-6 shrink-0" />
              <div class="flex flex-col items-start justify-center text-xs font-bold">
                {{ t("transaction.send.addAllAssets") }}
                <div class="text-muted-foreground font-normal">
                  {{ t("transaction.send.addAllAssetsDesc") }}
                </div>
              </div>
            </CommandItem>
          </template>
        </AssetSelect>
      </FormField>
    </Form>
  </ScrollArea>

  <div class="space-y-4 p-4">
    <TransactionFeeConfig v-model="fee" :include-min-amount-per-box="changeBoxesCount" />
    <Button type="submit" size="lg" class="w-full" @click="sendTransaction">{{
      t("common.send")
    }}</Button>
  </div>
</template>
