<script setup lang="ts">
import { computed, nextTick, Ref, ref, useTemplateRef } from "vue";
import { mergeRegles, Maybe, useRegle } from "@regle/core";
import { required, withMessage, withParams } from "@regle/rules";
import BigNumber from "bignumber.js";
import { useI18n } from "vue-i18n";
import ActionFooter from "@/components/ActionFooter.vue";
import { TransactionFeeConfig, TransactionSignDialog } from "@/components/transaction";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { bn, decimalize } from "@/common/bigNumber";
import { useFormat, useProgrammaticDialog } from "@/composables";
import { useNumericMask } from "@/composables/useNumericMask";
import { useCollectChildValidations } from "@/composables/useValidationScope";
import { ERG_DECIMALS, ERG_TOKEN_ID, SAFE_MIN_FEE_VALUE } from "@/constants/ergo";
import { FeeSettings } from "@/types/internal";
import { staticBigNumber } from "@/validators";
import { createMintTransaction, MINT_BOX_VALUE } from "../transactionFactory";

// amounts are stored as signed 64-bit integers (Long)
const MAX_TOKEN_AMOUNT = bn("9223372036854775807");
const MAX_DECIMALS = 18;
// keeps the minting box well below the 4096 bytes limit
const MAX_NAME_BYTES = 128;
const MAX_DESCRIPTION_BYTES = 1024;

const { t } = useI18n();
const format = useFormat();
const { open: openTransactionSignDialog } = useProgrammaticDialog(TransactionSignDialog);

const amountInput = useTemplateRef<InstanceType<typeof Input>>("amount-input");
const decimalsInput = useTemplateRef<InstanceType<typeof Input>>("decimals-input");
const inputElement = (input: Ref<InstanceType<typeof Input> | null>) =>
  computed(() => (input.value?.$el as HTMLInputElement | undefined) ?? null);

const { value: amount } = useNumericMask(inputElement(amountInput), {
  numeralDecimalScale: MAX_DECIMALS,
  numeralPositiveOnly: true
});

const { value: decimals } = useNumericMask(inputElement(decimalsInput), {
  numeralDecimalScale: 0,
  numeralIntegerScale: 2,
  numeralPositiveOnly: true
});

const name = ref("");
const description = ref("");
const fee = ref<FeeSettings>({
  tokenId: ERG_TOKEN_ID,
  value: decimalize(bn(SAFE_MIN_FEE_VALUE), ERG_DECIMALS)
});

const encoder = new TextEncoder();
const byteSize = (value: Maybe<string>) => (value ? encoder.encode(value).length : 0);

const parsedDecimals = computed(() => {
  const value = decimals.value?.toNumber() ?? 0;
  return Number.isInteger(value) && value <= MAX_DECIMALS ? value : undefined;
});

const emission = computed((): BigNumber | undefined => {
  if (!amount.value || parsedDecimals.value === undefined) return;
  return amount.value.shiftedBy(parsedDecimals.value);
});

const { r$ } = useRegle(
  {
    name,
    description,
    amount: staticBigNumber(amount),
    decimals: staticBigNumber(decimals)
  },
  {
    name: {
      required: withMessage(
        (value: Maybe<string>) => !!value?.trim(),
        () => t("dapps.nativeTokens.mint.nameRequired")
      ),
      maxBytes: withMessage(
        (value: Maybe<string>) => byteSize(value) <= MAX_NAME_BYTES,
        () => t("dapps.nativeTokens.mint.tooLong")
      )
    },
    description: {
      maxBytes: withMessage(
        (value: Maybe<string>) => byteSize(value) <= MAX_DESCRIPTION_BYTES,
        () => t("dapps.nativeTokens.mint.tooLong")
      )
    },
    decimals: {
      valid: withMessage(
        withParams(
          (_: Maybe<BigNumber>, parsed: number | undefined) => parsed !== undefined,
          [parsedDecimals]
        ),
        () => t("dapps.nativeTokens.mint.invalidDecimals", { max: MAX_DECIMALS })
      )
    },
    amount: {
      required: withMessage(required, () => t("dapps.nativeTokens.mint.amountRequired")),
      positive: withMessage(
        (value: Maybe<BigNumber>) => !value || value.gt(0),
        () => t("dapps.nativeTokens.mint.invalidAmount")
      ),
      precision: withMessage(
        withParams(
          (value: Maybe<BigNumber>, dec: number | undefined) =>
            !value || dec === undefined || (value.decimalPlaces() ?? 0) <= dec,
          [parsedDecimals]
        ),
        () => t("dapps.nativeTokens.mint.tooManyDecimals", { decimals: parsedDecimals.value ?? 0 })
      ),
      max: withMessage(
        withParams(
          (_: Maybe<BigNumber>, total: BigNumber | undefined) =>
            !total || total.lte(MAX_TOKEN_AMOUNT),
          [emission]
        ),
        () =>
          t("validation.maxAmount", {
            max: format.number.decimal(MAX_TOKEN_AMOUNT.shiftedBy(-(parsedDecimals.value ?? 0)))
          })
      )
    }
  },
  { autoDirty: false }
);

// collects child components validations, like fee settings
const { r$: children$ } = useCollectChildValidations();
const form$ = mergeRegles({ r$, children$ });

async function mint() {
  const { valid } = await form$.$validate();
  if (!valid || !emission.value || parsedDecimals.value === undefined) {
    return scrollToFirstError();
  }

  const token = {
    name: name.value.trim(),
    description: description.value.trim(),
    decimals: parsedDecimals.value,
    amount: BigInt(emission.value.toFixed(0))
  };

  openTransactionSignDialog({
    transactionBuilder: () => createMintTransaction(token, fee.value),
    onSuccess: reset
  });
}

async function scrollToFirstError() {
  await nextTick();
  document.querySelector("[data-form-error]")?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function reset() {
  name.value = "";
  description.value = "";
  amount.value = null;
  decimals.value = null;
  form$.$reset();
}
</script>

<template>
  <ScrollArea type="scroll" class="grow">
    <Form class="space-y-4 p-4" @submit="mint">
      <p class="text-muted-foreground text-xs hyphens-auto">
        {{ t("dapps.nativeTokens.mint.description") }}
      </p>

      <FormField :validation="r$.name">
        <Label for="token-name">{{ t("dapps.nativeTokens.mint.name") }}</Label>
        <Input
          id="token-name"
          v-model="name"
          type="text"
          spellcheck="false"
          @blur="r$.name.$touch()"
        />
      </FormField>

      <div class="grid grid-cols-3 items-start gap-4">
        <FormField :validation="r$.amount" class="col-span-2">
          <Label for="token-amount">{{ t("dapps.nativeTokens.mint.amount") }}</Label>
          <Input
            id="token-amount"
            ref="amount-input"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="0"
            @blur="r$.amount.$touch()"
          />
        </FormField>

        <FormField :validation="r$.decimals">
          <Label for="token-decimals">{{ t("dapps.nativeTokens.mint.decimals") }}</Label>
          <Input
            id="token-decimals"
            ref="decimals-input"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            placeholder="0"
            @blur="r$.decimals.$touch()"
          />
        </FormField>
      </div>

      <FormField :validation="r$.description">
        <Label for="token-description">{{ t("dapps.nativeTokens.mint.tokenDescription") }}</Label>
        <Textarea
          id="token-description"
          v-model="description"
          rows="2"
          class="min-h-16"
          @blur="r$.description.$touch()"
        />
      </FormField>
    </Form>
  </ScrollArea>

  <ActionFooter>
    <TransactionFeeConfig v-model="fee" :boxes-value="MINT_BOX_VALUE" />
    <Button type="submit" size="lg" class="w-full" @click="mint">{{
      t("dapps.nativeTokens.mint.mint")
    }}</Button>
  </ActionFooter>
</template>
