<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from "vue";
import { useRegle } from "@regle/core";
import { required, requiredIf, withMessage } from "@regle/rules";
import { Loader2Icon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { useWalletStore } from "@/stores/walletStore";
import NewPasswordFields from "@/components/NewPasswordFields.vue";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import { Form, FormField } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { PasswordError } from "@/common/errors";
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { useNewPassword } from "@/composables/useNewPassword";
import { usePasswordTexts } from "@/composables/usePasswordPrompt";
import { PasswordKind, walletsDbService } from "@/database/walletsDbService";

/**
 * - `change`: changes the wallet's own password;
 * - `changeMaster`: changes the master password;
 * - `toMaster`, `toOwn`: moves the wallet to the master password or to its own.
 */
export type PasswordAction = "change" | "changeMaster" | "toMaster" | "toOwn";

const props = defineProps<{ action: PasswordAction }>();
const emit = defineEmits<{ close: []; done: [] }>();

const wallet = useWalletStore();
const { toast } = useToast();
const { t } = useI18n();

const currentInput = useTemplateRef("current-input");
const masterInput = useTemplateRef("master-input");

const opened = ref(true);
const loading = ref(false);
const hasMaster = ref<boolean>();
const walletId = ref(wallet.id);
const walletName = ref(wallet.name);
const currentPassword = ref("");
const masterPassword = ref("");
const newPassword = useNewPassword(() => [walletName.value]);
const passwordTexts = usePasswordTexts(walletName);

loadMaster();

const current = computed<PasswordKind>(() =>
  props.action === "change" || props.action === "toMaster" ? "password" : "master"
);

const asksMaster = computed(() => props.action === "toMaster" && hasMaster.value === true);

const creates = computed<PasswordKind | undefined>(() => {
  if (asksMaster.value) return;
  return props.action === "change" || props.action === "toOwn" ? "password" : "master";
});

const texts = computed(() => {
  const name = walletName.value;
  switch (props.action) {
    case "change":
      return {
        title: t("settings.wallet.changeSpendingPassword"),
        description: t("settings.wallet.changeSpendingPasswordDesc"),
        current: t("settings.wallet.currentPassword"),
        done: t("settings.wallet.spendingPasswordChanged")
      };
    case "changeMaster":
      return {
        title: t("settings.password.changeMaster"),
        description: t("settings.password.changeMasterDesc"),
        current: t("settings.password.currentMasterPassword"),
        done: t("settings.password.masterChanged")
      };
    case "toMaster":
      return {
        title: t("settings.password.useMaster"),
        description: hasMaster.value
          ? t("settings.password.useMasterDesc", { name })
          : t("settings.password.useNewMasterDesc", { name }),
        current: t("wallet.namedWalletPassword", { name }),
        done: t("settings.password.usesMaster", { name })
      };
    case "toOwn":
      return {
        title: t("settings.password.useOwn"),
        description: t("settings.password.useOwnDesc", { name }),
        current: t("wallet.masterPassword"),
        done: t("settings.password.usesOwn", { name })
      };
    default:
      throw Error(`unknown password action: ${props.action}`);
  }
});

const newLabel = computed(() => {
  if (props.action === "toMaster") {
    return t("wallet.masterPassword");
  }
  return props.action === "changeMaster"
    ? t("settings.password.newMasterPassword")
    : t("settings.wallet.newPassword");
});

const { r$ } = useRegle(
  { currentPassword, masterPassword },
  {
    currentPassword: {
      required: withMessage(required, () => passwordTexts.required(current.value))
    },
    masterPassword: {
      required: withMessage(requiredIf(asksMaster), () => passwordTexts.required("master"))
    }
  },
  { autoDirty: false }
);

async function submit() {
  const { valid } = await r$.$validate();
  const created = creates.value ? await newPassword.validate() : "";
  if (!valid || created === undefined) return;

  try {
    loading.value = true;
    await run(created);

    toast({ title: texts.value.done });
    emit("done");
    setOpened(false);
  } catch (e) {
    if (e instanceof PasswordError) {
      const kind = e.kind ?? current.value;
      toast({
        title: passwordTexts.wrong(kind),
        variant: "destructive",
        description: passwordTexts.wrongHint()
      });

      const input = kind === current.value ? currentInput : masterInput;
      nextTick(() => input.value?.input?.$el.focus());
      return;
    }

    log.error(e);
    toast({
      title: t("settings.password.changeFailed"),
      variant: "destructive",
      description: extractErrorMessage(e)
    });
  } finally {
    loading.value = false;
  }
}

function run(created: string): Promise<void> {
  const id = walletId.value;
  switch (props.action) {
    case "change":
      return walletsDbService.changePassword(id, currentPassword.value, created);
    case "changeMaster":
      return walletsDbService.changeMasterPassword(currentPassword.value, created);
    case "toMaster":
      return walletsDbService.moveToMasterPassword(
        id,
        currentPassword.value,
        asksMaster.value ? masterPassword.value : created
      );
    case "toOwn":
      return walletsDbService.moveToOwnPassword(id, currentPassword.value, created);
  }
}

async function loadMaster() {
  hasMaster.value = undefined;
  hasMaster.value = await walletsDbService.hasMasterPassword();
}

function reset() {
  currentPassword.value = "";
  masterPassword.value = "";
  newPassword.reset();
  r$.$reset();
}

function handleOpenUpdates(open: boolean) {
  if (open) return;

  reset();
  emit("close");
}

function setOpened(open: boolean) {
  if (open) {
    walletId.value = wallet.id;
    walletName.value = wallet.name;
    loadMaster();
  } else {
    reset();
  }

  opened.value = open;
}

defineExpose({ open: () => setOpened(true), close: () => setOpened(false) });
</script>

<template>
  <Drawer v-model:open="opened" @update:open="handleOpenUpdates">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>{{ texts.title }}</DrawerTitle>
        <DrawerDescription class="hyphens-auto">{{ texts.description }}</DrawerDescription>
      </DrawerHeader>

      <Form class="flex flex-col gap-4" @submit="submit">
        <FormField :validation="r$.currentPassword">
          <Label for="current-password">{{ texts.current }}</Label>
          <PasswordInput
            id="current-password"
            ref="current-input"
            v-model="currentPassword"
            :disabled="loading"
            @blur="r$.currentPassword.$touch()"
          />
        </FormField>

        <FormField v-if="asksMaster" :validation="r$.masterPassword">
          <Label for="master-password">{{ t("wallet.masterPassword") }}</Label>
          <PasswordInput
            id="master-password"
            ref="master-input"
            v-model="masterPassword"
            :disabled="loading"
            @blur="r$.masterPassword.$touch()"
          />
        </FormField>

        <NewPasswordFields
          v-if="creates && hasMaster !== undefined"
          id="new-password"
          :form="newPassword"
          :label="newLabel"
          :confirm-label="t('wallet.confirmPassword')"
          :warning="
            creates === 'master'
              ? t('wallet.masterPasswordNotRecoverable')
              : t('wallet.walletPasswordNotRecoverable')
          "
          :disabled="loading"
        />
      </Form>

      <DrawerFooter class="flex-row gap-4">
        <DrawerClose as-child>
          <Button class="flex-1" variant="outline" :disabled="loading">{{
            t("common.cancel")
          }}</Button>
        </DrawerClose>
        <Button class="flex-2" :disabled="loading || hasMaster === undefined" @click="submit">
          <Loader2Icon v-if="loading" class="animate-spin" />
          {{ t("common.confirm") }}
        </Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>
