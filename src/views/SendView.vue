<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { isEmpty } from "@fleet-sdk/common";
import { mergeRegles, useRegle } from "@regle/core";
import { required, withMessage } from "@regle/rules";
import BigNumber from "bignumber.js";
import { CheckCheckIcon, UserPlusIcon, XIcon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { AssetBalance, useWalletStore } from "@/stores/walletStore";
import { AssetInput, AssetSelect } from "@/components/asset";
import ActionFooter from "@/components/ActionFooter.vue";
import { TransactionFeeConfig, TransactionSignDialog } from "@/components/transaction";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CommandItem, CommandSeparator } from "@/components/ui/command";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ScrollArea from "@/components/ui/scroll-area/ScrollArea.vue";
import {
  createP2PTransaction,
  estimateRecipientBoxValue,
  SAFE_MAX_CHANGE_TOKEN_LIMIT,
  TxRecipient
} from "@/chains/ergo/transaction/builder";
import { bn, decimalize } from "@/common/bigNumber";
import { isErg } from "@/common/utils";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import { useCollectChildValidations } from "@/composables/useValidationScope";
import { ERG_DECIMALS, ERG_TOKEN_ID, MIN_BOX_VALUE, SAFE_MIN_FEE_VALUE } from "@/constants/ergo";
import { FeeSettings } from "@/types/internal";
import { validErgoAddress } from "@/validators";

type Recipient = TxRecipient & { id: number };
type AssetSelectInstance = { close(): void; clearSearch(): void };

const INITIAL_FEE_VAL = decimalize(bn(SAFE_MIN_FEE_VALUE), ERG_DECIMALS);
const MIN_BOX_VAL = decimalize(bn(MIN_BOX_VALUE), ERG_DECIMALS);

const wallet = useWalletStore();
const route = useRoute();

const { t } = useI18n();
const { open: openTransactionSignDialog } = useProgrammaticDialog(TransactionSignDialog);

const assetSelectors = new Map<number, AssetSelectInstance>();
const recipients = ref<Recipient[]>([]);
const fee = ref<FeeSettings>({ tokenId: ERG_TOKEN_ID, value: INITIAL_FEE_VAL });
let nextRecipientId = 0;

const { r$ } = useRegle(
  { recipients },
  {
    recipients: {
      $each: {
        address: {
          required: withMessage(required, () => t("transaction.send.emptyAddressError")),
          validErgoAddress
        },
        assets: {
          required: withMessage(required, () => t("transaction.send.noSelectedAssetsError"))
        }
      }
    }
  },
  { autoDirty: false }
);

// collects child components validations, like asset amounts and fee settings
const { r$: children$ } = useCollectChildValidations();
const form$ = mergeRegles({ r$, children$ });

onMounted(() => {
  const address = typeof route.query.recipient === "string" ? route.query.recipient : "";
  recipients.value.push(createRecipient(address));
});

const selectedTotals = computed(() => {
  const totals = new Map<string, BigNumber>();
  for (const recipient of recipients.value) {
    for (const item of recipient.assets) {
      const total = totals.get(item.asset.tokenId) ?? bn(0);
      totals.set(item.asset.tokenId, item.amount ? total.plus(item.amount) : total);
    }
  }

  return totals;
});

const unselected = computed(() =>
  wallet.balance.filter((asset) => !selectedTotals.value.has(asset.tokenId))
);

const shouldReserveChange = computed(() => {
  if (unselected.value.length) return true;

  for (const asset of wallet.balance) {
    if (isErg(asset.tokenId)) continue;
    if (needsChangeFor(asset)) return true;
  }

  return false;
});

const reservedFeeAssetAmount = computed((): BigNumber => {
  const feeValue = fee.value.value;
  const feeAsset = wallet.balance.find((a) => a.tokenId === fee.value.tokenId);

  if (!feeAsset || !selectedTotals.value.has(feeAsset.tokenId) || feeAsset.balance.isZero()) {
    return bn(0);
  }
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

/**
 * With a Babel fee, the swap pays for the boxes of recipients without ERG, so the fee must
 * cover their minimum value.
 */
const feeFundedBoxesValue = computed(() => {
  if (isFeeInErg.value) return bn(0);

  return recipients.value
    .filter((r) => !r.assets.some((a) => isErg(a.asset.tokenId) && a.amount?.gt(0)))
    .reduce((total, r) => total.plus(estimateRecipientBoxValue(r)), bn(0));
});

watch(
  () => fee.value.tokenId,
  (newVal: string) => {
    if (isErg(newVal)) recipients.value.forEach(setErgAsSelected);
  }
);

watch(
  () => recipients.value.map((r) => r.assets.length),
  (lengths, oldLengths) => {
    if (lengths.length !== oldLengths.length) return;

    lengths.forEach((length, i) => {
      if (length !== oldLengths[i]) r$.recipients.$each[i]?.assets.$touch();
    });
  }
);

function createRecipient(address = ""): Recipient {
  const recipient: Recipient = { id: nextRecipientId++, address, assets: [] };
  setErgAsSelected(recipient);

  return recipient;
}

async function addRecipient() {
  const recipient = createRecipient();
  recipients.value.push(recipient);

  await nextTick();
  document.getElementById(`recipient-${recipients.value.length - 1}`)?.focus();
}

function removeRecipient(id: number) {
  const index = recipients.value.findIndex((r) => r.id === id);
  if (index === -1) return;

  recipients.value.splice(index, 1);
  assetSelectors.delete(id);
}

function availableFor(recipient: Recipient): AssetBalance[] {
  const selectedIds = new Set(recipient.assets.map((a) => a.asset.tokenId));
  return wallet.balance.filter((asset) => !selectedIds.has(asset.tokenId));
}

function getReserveAmountFor(recipient: Recipient, tokenId: string): BigNumber | undefined {
  let reserved: BigNumber | undefined;
  if (isFeeAsset(tokenId)) {
    reserved = reservedFeeAssetAmount.value;
  } else if (isErg(tokenId) && shouldReserveChange.value) {
    reserved = changeValue.value;
  }

  const allocatedElsewhere = getAllocatedAmount(tokenId, recipient.id);
  if (allocatedElsewhere.isZero()) return reserved;
  return reserved ? reserved.plus(allocatedElsewhere) : allocatedElsewhere;
}

function getAllocatedAmount(tokenId: string, exceptRecipientId: number): BigNumber {
  let total = bn(0);
  for (const recipient of recipients.value) {
    if (recipient.id === exceptRecipientId) continue;

    const item = recipient.assets.find((a) => a.asset.tokenId === tokenId);
    if (item?.amount) total = total.plus(item.amount);
  }

  return total;
}

async function scrollToErrorElement() {
  await nextTick();
  const errorEl = document.querySelector("[data-form-error]");
  if (!errorEl) return;

  errorEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function sendTransaction() {
  const { valid } = await form$.$validate();
  if (!valid) return scrollToErrorElement();

  openTransactionSignDialog({
    transactionBuilder: async () =>
      createP2PTransaction({
        recipients: recipients.value.map(({ address, assets }) => ({ address, assets })),
        fee: fee.value,
        walletType: wallet.type
      }),
    onSuccess: () => {
      assetSelectors.clear();
      recipients.value = [createRecipient()];
      form$.$reset();
    }
  });
}

function needsChangeFor(asset: AssetBalance): boolean {
  const total = selectedTotals.value.get(asset.tokenId) ?? bn(0);
  return isFeeAsset(asset.tokenId)
    ? !total.eq(asset.balance.minus(fee.value.value))
    : !total.eq(asset.balance);
}

function setErgAsSelected(recipient: Recipient): void {
  if (!isFeeInErg.value && !isEmpty(recipient.assets)) return;

  const isErgSelected = recipient.assets.find((a) => isErg(a.asset.tokenId));
  if (isErgSelected) return;

  const erg = wallet.balance.find((a) => isErg(a.tokenId));
  if (erg) {
    recipient.assets.unshift({ asset: erg, amount: undefined });
  }
}

function add(recipient: Recipient, asset: AssetBalance) {
  removeDisposableSelections(recipient);
  recipient.assets.push({ asset });

  if (isFeeInErg.value) setMinBoxValue(recipient);
}

function addAll(recipient: Recipient) {
  availableFor(recipient).forEach((asset) => recipient.assets.push({ asset }));
  setMinBoxValue(recipient);

  const selector = assetSelectors.get(recipient.id);
  selector?.close();
  selector?.clearSearch();
}

function removeAsset(recipient: Recipient, tokenId: string) {
  const index = recipient.assets.findIndex((a) => a.asset.tokenId === tokenId);
  if (index === -1) return;

  recipient.assets.splice(index, 1);
  setMinBoxValue(recipient);
}

function setMinBoxValue(recipient: Recipient) {
  if (recipient.assets.length === 1) return;

  const erg = recipient.assets.find((a) => isErg(a.asset.tokenId));
  if (!erg) return;

  if (!erg.amount || erg.amount.lt(MIN_BOX_VAL)) {
    erg.amount = MIN_BOX_VAL;
  }
}

function removeDisposableSelections(recipient: Recipient) {
  if (isFeeInErg.value) return;

  const first = recipient.assets[0];
  if (!first) return;

  if (!first.amount || first.amount.isZero()) {
    removeAsset(recipient, first.asset.tokenId);
  }
}

function setAssetSelector(id: number, el: unknown) {
  if (el) assetSelectors.set(id, el as AssetSelectInstance);
  else assetSelectors.delete(id);
}

function isFeeAsset(tokenId: string): boolean {
  return tokenId === fee.value.tokenId;
}
</script>

<template>
  <ScrollArea type="scroll" class="grow">
    <Form class="space-y-4 p-4" @submit="sendTransaction">
      <Card
        v-for="(recipient, index) in recipients"
        :key="recipient.id"
        :data-recipient="index"
        class="px-4"
      >
        <FormField :validation="r$.recipients.$each[index]?.address">
          <div class="flex h-5 items-center justify-between">
            <Label :for="`recipient-${index}`">{{
              recipients.length > 1
                ? t("transaction.send.recipientN", { n: index + 1 })
                : t("transaction.send.recipient")
            }}</Label>
            <Button
              v-if="recipients.length > 1"
              type="button"
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground hover:text-foreground -mr-1"
              :data-remove-recipient="index"
              :aria-label="t('transaction.send.removeRecipient')"
              @click="removeRecipient(recipient.id)"
            >
              <XIcon />
            </Button>
          </div>
          <Input
            :id="`recipient-${index}`"
            v-model="recipient.address"
            type="text"
            spellcheck="false"
            class="w-full"
            @blur="r$.recipients.$each[index]?.address.$touch()"
          />
        </FormField>

        <FormField>
          <Label>{{ t("transaction.send.assets") }}</Label>
          <div class="grid gap-4">
            <AssetInput
              v-for="item in recipient.assets"
              :key="item.asset.tokenId"
              v-model="item.amount"
              :asset="item.asset"
              :reserved-amount="getReserveAmountFor(recipient, item.asset.tokenId)"
              :min-amount="isErg(item.asset.tokenId) ? MIN_BOX_VAL : undefined"
              :disposable="!isErg(item.asset.tokenId) || !isFeeInErg"
              @remove="removeAsset(recipient, item.asset.tokenId)"
            />
          </div>
        </FormField>

        <FormField :validation="r$.recipients.$each[index]?.assets">
          <AssetSelect
            :ref="(el) => setAssetSelector(recipient.id, el)"
            :assets="availableFor(recipient)"
            @select="(asset) => add(recipient, asset)"
          >
            <template v-if="availableFor(recipient).length" #commands>
              <CommandSeparator class="my-1" />
              <CommandItem value="Add all" class="gap-2 py-2" @select.prevent="addAll(recipient)">
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
      </Card>

      <Button
        id="add-recipient"
        type="button"
        variant="dashed"
        size="lg"
        class="w-full rounded-lg"
        @click="addRecipient"
      >
        <UserPlusIcon />
        {{ t("transaction.send.addRecipient") }}
      </Button>
    </Form>
  </ScrollArea>

  <ActionFooter>
    <TransactionFeeConfig v-model="fee" :boxes-value="feeFundedBoxesValue" />
    <Button type="submit" size="lg" class="w-full" @click="sendTransaction">{{
      t("common.send")
    }}</Button>
  </ActionFooter>
</template>
