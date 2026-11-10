<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import {
  CircleCheckIcon,
  CircleXIcon,
  Loader2Icon,
  LockKeyholeIcon,
  WalletIcon
} from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/appStore";
import NewPasswordFields from "@/components/NewPasswordFields.vue";
import ActionFooter from "@/components/ActionFooter.vue";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormField } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/toast";
import { WalletItem } from "@/components/wallet";
import { PasswordError } from "@/common/errors";
import { log } from "@/common/logger";
import { cn, extractErrorMessage } from "@/common/utils";
import { MIN_PASSWORD_LENGTH, useNewPassword } from "@/composables/useNewPassword";
import { walletsDbService } from "@/database/walletsDbService";
import { numberSteps, Stepper, StepTitle } from "@/views/add/components";

const app = useAppStore();
const router = useRouter();
const { toast } = useToast();
const { t } = useI18n();

const step = ref(1);
const loading = ref(false);
const passwordDone = ref(false);
const master = useNewPassword();

const candidates = computed(() => app.wallets.filter((w) => w.type === "standard"));
const chosen = ref<number[]>([]);
const chosenWallets = computed(() => candidates.value.filter((w) => chosen.value.includes(w.id)));

const passwords = reactive<Record<number, string>>({});
const checks = reactive<Record<number, "checking" | "valid" | "invalid">>({});
const checkTimers = new Map<number, ReturnType<typeof setTimeout>>();
const CHECK_DELAY = 400;

const submitted = ref(false);

onMounted(() => {
  app.viewTitle = t("wallet.masterPassword");
});

let chosenOnce = false;
watch(
  candidates,
  (wallets) => {
    if (chosenOnce || !wallets.length) return;
    chosen.value = wallets.map((w) => w.id);
    chosenOnce = true;
  },
  { immediate: true }
);

const steps = computed(() =>
  numberSteps([
    {
      key: "password",
      title: t("wallet.masterPassword"),
      description: t("wallet.masterPasswordStepDesc"),
      icon: LockKeyholeIcon,
      enabled: ref(true)
    },
    candidates.value.length > 0 && {
      key: "wallets",
      title: t("masterSetup.walletsStep"),
      description: t("masterSetup.walletsStepDesc"),
      icon: WalletIcon,
      enabled: passwordDone
    }
  ])
);

const current = computed(() => steps.value[step.value - 1].key);
const isLast = computed(() => step.value === steps.value.length);

const nextButtonTitle = computed(() =>
  isLast.value ? t("settings.password.setUpMaster") : t("masterSetup.chooseWallets")
);

function toggle(id: number) {
  chosen.value = chosen.value.includes(id)
    ? chosen.value.filter((x) => x !== id)
    : [...chosen.value, id];
}

function fieldValidation(id: number, name: string) {
  const errors =
    submitted.value && !passwords[id]
      ? [t("wallet.enterWalletPassword", { name })]
      : checks[id] === "invalid"
        ? [t("masterSetup.wrongPassword")]
        : [];

  return { $error: errors.length > 0, $errors: errors };
}

function setPassword(id: number, value: string) {
  passwords[id] = value;
  delete checks[id];
  clearTimeout(checkTimers.get(id));
  if (value.length < MIN_PASSWORD_LENGTH) return;
  checkTimers.set(
    id,
    setTimeout(() => check(id, value), CHECK_DELAY)
  );
}

/** Shorter passwords are only checked once the field is left. */
function checkShort(id: number) {
  const value = passwords[id];
  if (value && value.length < MIN_PASSWORD_LENGTH && !checks[id]) check(id, value);
}

async function check(id: number, value: string) {
  checks[id] = "checking";
  const valid = await walletsDbService.verifyWalletPassword(id, value).catch((e) => {
    log.error(e);
    return undefined;
  });

  if (passwords[id] !== value) return;
  if (valid === undefined) delete checks[id];
  else checks[id] = valid ? "valid" : "invalid";
}

onUnmounted(() => checkTimers.forEach((timer) => clearTimeout(timer)));

async function next() {
  if (current.value === "password") {
    if (!(await master.validate())) return;
    passwordDone.value = true;
  }

  if (current.value === "wallets") {
    submitted.value = true;
    if (chosenWallets.value.some((w) => !passwords[w.id])) return focusFirstError();
  }

  if (isLast.value) await setUp();
  else step.value++;
}

async function focusFirstError() {
  await nextTick();
  const wallet = chosenWallets.value.find((w) => fieldValidation(w.id, w.name).$error);
  if (!wallet) return;

  const input = document.getElementById(`wallet-password-${wallet.id}`);
  input?.focus({ preventScroll: true });
  // the whole row, so its error message shows too
  input?.closest("[data-wallet-row]")?.scrollIntoView({ block: "nearest" });
}

async function setUp() {
  try {
    loading.value = true;
    await walletsDbService.setUpMasterPassword(
      master.password,
      chosenWallets.value.map((w) => ({ id: w.id, password: passwords[w.id] ?? "" }))
    );

    toast({ title: t("settings.password.masterSetUp") });
    if (window.history.state?.back) router.back();
    else router.push({ name: "assets" });
  } catch (e) {
    if (e instanceof PasswordError && e.walletIds) {
      for (const id of e.walletIds) checks[id] = "invalid";
      // disabled inputs can't take focus
      loading.value = false;
      return focusFirstError();
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
</script>

<template>
  <div class="flex min-h-0 grow flex-col">
    <Stepper v-model="step" :steps="steps" class="shrink-0 p-4" />
    <ScrollArea type="scroll" class="min-h-0 grow">
      <div class="flex flex-col gap-4 px-4 pb-4">
        <StepTitle :step="steps[step - 1]" />

        <Form class="flex flex-col gap-4" @submit="next">
          <NewPasswordFields
            v-if="current === 'password'"
            id="new-password"
            :form="master"
            :label="t('wallet.masterPassword')"
            :confirm-label="t('wallet.confirmPassword')"
            :warning="t('wallet.masterPasswordNotRecoverable')"
            :disabled="loading"
          />

          <div v-if="current === 'wallets'" class="flex flex-col gap-1">
            <div
              v-for="w in candidates"
              :key="w.id"
              data-wallet-row
              :class="cn('rounded-md', chosen.includes(w.id) && 'bg-accent')"
            >
              <Button
                :disabled="loading"
                type="button"
                tabindex="-1"
                variant="ghost"
                class="size-auto w-full gap-3 py-2 hover:bg-transparent"
                @click="toggle(w.id)"
              >
                <Checkbox :model-value="chosen.includes(w.id)" />
                <WalletItem :wallet="w" />
                <template v-if="chosen.includes(w.id)">
                  <Loader2Icon
                    v-if="checks[w.id] === 'checking'"
                    class="text-muted-foreground ml-auto animate-spin"
                  />
                  <CircleCheckIcon
                    v-else-if="checks[w.id] === 'valid'"
                    class="text-success ml-auto"
                    :aria-label="t('masterSetup.passwordCorrect')"
                  />
                  <CircleXIcon
                    v-else-if="checks[w.id] === 'invalid'"
                    class="text-destructive ml-auto"
                    :aria-label="t('masterSetup.wrongPassword')"
                  />
                </template>
              </Button>

              <FormField
                v-if="chosen.includes(w.id)"
                class="px-3 pb-3"
                :validation="fieldValidation(w.id, w.name)"
              >
                <PasswordInput
                  :id="`wallet-password-${w.id}`"
                  :model-value="passwords[w.id] ?? ''"
                  :placeholder="t('wallet.namedWalletPassword', { name: w.name })"
                  :disabled="loading"
                  class="bg-background"
                  @update:model-value="setPassword(w.id, String($event))"
                  @blur="checkShort(w.id)"
                />
              </FormField>
            </div>
          </div>
        </Form>
      </div>
    </ScrollArea>

    <ActionFooter>
      <Button
        :disabled="loading || (current === 'wallets' && chosen.length === 0)"
        size="lg"
        class="w-full"
        @click="next"
      >
        <Loader2Icon v-if="loading" class="animate-spin" />
        {{ nextButtonTitle }}
      </Button>
    </ActionFooter>
  </div>
</template>
