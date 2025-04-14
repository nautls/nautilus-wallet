<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";
import { CheckIcon, ChevronsUpDownIcon, Loader2Icon, TriangleAlertIcon } from "lucide-vue-next";
import { Locale, useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { LANGUAGE_LABELS, setLocale, SUPPORTED_LOCALES } from "@/boot/i18n";
import { coinGeckoService } from "@/chains/ergo/services/coinGeckoService";
import {
  MIN_SERVER_VERSION,
  validateServerNetwork,
  validateServerVersion
} from "@/chains/ergo/services/graphQlService";
import { cn } from "@/common/utils";
import { validUrl } from "@/validators";

const app = useAppStore();
const { t } = useI18n();

const localeState = reactive({
  available: SUPPORTED_LOCALES,
  isPopoverOpen: false
});

const currencyState = reactive({
  available: [app.settings.conversionCurrency ?? "usd"],
  isPopoverOpen: false,
  loading: true
});

const explorerUrl = ref(app.settings.explorerUrl);
const graphQLServer = ref(app.settings.graphQLServer);

const nsfwBlacklist = computedBlacklist("nsfw");
const scamBlacklist = computedBlacklist("scam");
const currentLocale = computed(() =>
  app.settings.locale === "auto"
    ? t("settings.systemDefault")
    : LANGUAGE_LABELS.get(app.settings.locale)
);

onMounted(async () => {
  currencyState.loading = true;

  const newCurrencies = await coinGeckoService.getSupportedCurrencyConversion();
  if (newCurrencies.length) {
    currencyState.available = newCurrencies;
  }

  currencyState.loading = false;
});

watch(explorerUrl, async () => {
  const valid = await v$.value.explorerUrl.$validate();
  if (!valid) return;

  app.settings.explorerUrl = explorerUrl.value;
});

watch(graphQLServer, async () => {
  const valid = await v$.value.graphQLServer.$validate();
  if (!valid) return;

  app.settings.graphQLServer = graphQLServer.value;
});

function selectCurrency(currency: string) {
  currencyState.isPopoverOpen = false;
  app.settings.conversionCurrency = currency;
}

async function selectLocale(locale: Locale | "auto") {
  localeState.isPopoverOpen = false;

  app.settings.locale = locale;
  setLocale(locale);
}

function computedBlacklist(list: string) {
  return computed<boolean>({
    get: () => app.settings.blacklistedTokensLists.includes(list),
    set: (value) => {
      if (value) {
        app.settings.blacklistedTokensLists.push(list);
      } else {
        const index = app.settings.blacklistedTokensLists.indexOf(list);
        if (index !== -1) {
          app.settings.blacklistedTokensLists.splice(index, 1);
        }
      }
    }
  });
}

const v$ = useVuelidate(
  {
    explorerUrl: {
      required: helpers.withMessage(t("settings.global.requiredExplorer"), required),
      validUrl
    },
    graphQLServer: {
      required: helpers.withMessage(t("settings.global.requiredGql"), required),
      validUrl,
      network: helpers.withMessage(
        t("settings.global.wrongServerNetwork"),
        helpers.withAsync(async (url: string) => {
          if (!url) return true;
          return await validateServerNetwork(url);
        })
      ),
      version: helpers.withMessage(
        t("settings.global.unsupportedServerVersion", { version: MIN_SERVER_VERSION.join(".") }),
        helpers.withAsync(async (url: string) => {
          if (!url) return true;
          return await validateServerVersion(url);
        })
      )
    }
  },
  { explorerUrl, graphQLServer }
);
</script>

<template>
  <div class="space-y-6">
    <Card class="flex flex-col gap-4 p-6">
      <div class="flex items-center justify-between gap-4">
        <Label class="flex flex-col gap-2">
          {{ t("settings.global.displayLanguage") }}
          <div class="text-muted-foreground text-xs font-normal">
            {{ t("settings.global.displayLanguageDesc") }}
          </div>
        </Label>
      </div>

      <Popover v-model:open="localeState.isPopoverOpen">
        <PopoverTrigger as-child>
          <Button variant="outline">
            <span class="grow">{{ currentLocale }}</span>
            <ChevronsUpDownIcon class="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent class="p-0">
          <Command reset-search-term-on-blur>
            <CommandInput :placeholder="t('common.search')" />
            <CommandList class="max-h-[200px]">
              <CommandGroup>
                <CommandItem
                  value="auto"
                  class="justify-between gap-2 whitespace-nowrap"
                  @select="selectLocale('auto')"
                >
                  <div class="font-medium">{{ t("settings.systemDefault") }}</div>

                  <CheckIcon
                    :class="
                      cn(
                        'mr-2 h-4 w-4',
                        app.settings.locale === 'auto' ? 'opacity-100' : 'opacity-0'
                      )
                    "
                  />
                </CommandItem>
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup>
                <CommandItem
                  v-for="lang in localeState.available"
                  :key="lang"
                  class="justify-between gap-2"
                  :value="lang"
                  @select="selectLocale(lang)"
                >
                  <div>{{ LANGUAGE_LABELS.get(lang) }}</div>

                  <CheckIcon
                    :class="
                      cn('mr-2 h-4 w-4', lang === app.settings.locale ? 'opacity-100' : 'opacity-0')
                    "
                  />
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </Card>

    <Card class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between gap-4">
        <Label class="flex flex-col gap-2">
          {{ t("settings.global.conversionCurrency") }}
          <div class="text-muted-foreground text-xs font-normal">
            {{ t("settings.global.conversionCurrencyDesc") }}
          </div>
        </Label>

        <Popover v-model:open="currencyState.isPopoverOpen">
          <PopoverTrigger as-child>
            <Button :disabled="currencyState.loading" variant="outline" class="min-w-[90px]">
              <span class="grow uppercase">{{ app.settings.conversionCurrency }}</span>

              <Loader2Icon
                v-if="currencyState.loading"
                class="size-4 shrink-0 animate-spin opacity-50"
              />
              <ChevronsUpDownIcon v-else class="size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent class="max-w-[110px] p-0">
            <Command reset-search-term-on-blur>
              <CommandInput :placeholder="t('common.search')" />
              <CommandEmpty>{{ t("settings.global.noCurrenciesFound") }}</CommandEmpty>
              <CommandList class="max-h-[200px]">
                <CommandGroup>
                  <CommandItem
                    v-for="currency in currencyState.available"
                    :key="currency"
                    class="justify-between gap-2"
                    :value="currency"
                    @select="selectCurrency(currency)"
                  >
                    <div class="uppercase">{{ currency }}</div>

                    <CheckIcon
                      :class="
                        cn(
                          'mr-2 h-4 w-4',
                          currency === app.settings.conversionCurrency ? 'opacity-100' : 'opacity-0'
                        )
                      "
                    />
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </Card>

    <Card class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between gap-4">
        <Label for="dev-mode" class="flex flex-col gap-1">
          {{ t("settings.global.devMode") }}
          <div class="text-muted-foreground text-xs font-normal">
            {{ t("settings.global.devModeDesc") }}
          </div></Label
        >
        <Switch id="dev-mode" v-model="app.settings.devMode" />
      </div>
    </Card>

    <Card class="flex flex-col gap-6 p-6">
      <Label class="flex flex-col gap-1">
        {{ t("settings.global.tokenBlacklists") }}
        <div class="text-muted-foreground text-xs font-normal">
          {{ t("settings.global.tokenBlacklistsDesc") }}
        </div>
      </Label>

      <div class="flex items-center justify-between gap-4">
        <Label for="nsfw-blacklist" class="flex flex-col gap-1">
          {{ t("settings.global.nsfwTokensBlacklist") }}
          <div class="text-muted-foreground text-xs font-normal">
            {{ t("settings.global.nsfwTokensBlacklistDesc") }}
          </div>
        </Label>
        <Switch id="nsfw-blacklist" v-model="nsfwBlacklist" />
      </div>
      <div class="flex items-center justify-between gap-4">
        <Label for="scam-blacklist" class="flex flex-col gap-1"
          >{{ t("settings.global.scamTokensBlacklist") }}
          <div class="text-muted-foreground text-xs font-normal">
            {{ t("settings.global.scamTokensBlacklistDesc") }}
          </div></Label
        >
        <Switch id="scam-blacklist" v-model="scamBlacklist" />
      </div>
    </Card>

    <Card class="flex flex-col gap-6 p-6">
      <div class="flex flex-col gap-2">
        <FormField :validation="v$.graphQLServer">
          <Label for="gql-server">{{ t("settings.global.gqlServer") }}</Label>
          <div class="relative w-full max-w-sm items-center">
            <Input
              id="gql-server"
              v-model="graphQLServer"
              :class="{ 'pr-7': v$.graphQLServer.$pending }"
            />
            <span
              v-if="v$.graphQLServer.$pending"
              class="absolute inset-y-0 end-0 flex items-center justify-center px-2"
            >
              <Loader2Icon class="text-muted-foreground size-4 animate-spin" />
            </span>
          </div>
          <template #description>{{ t("settings.global.gqlServerDesc") }}</template>
        </FormField>
      </div>

      <div class="flex flex-col gap-2">
        <FormField :validation="v$.explorerUrl">
          <Label for="explorer-url">{{ t("settings.global.explorerUrl") }}</Label>
          <Input id="explorer-url" v-model="explorerUrl" />
          <template #description>{{ t("settings.global.explorerUrlDesc") }}</template>
        </FormField>
      </div>
    </Card>

    <Card class="bg-warning/10 flex flex-col gap-6 p-6">
      <Label class="flex flex-col gap-2">
        <div class="flex items-center gap-1">
          {{ t("settings.global.experimental") }}
          <TriangleAlertIcon class="text-warning size-3" />
        </div>

        <div class="text-xs font-normal hyphens-auto">
          {{ t("settings.global.experimentalDesc") }}
        </div>
      </Label>

      <div class="flex items-center justify-between gap-4">
        <Label for="0-conf" class="flex flex-col gap-1">
          {{ t("settings.global.zeroConf") }}
          <div class="text-muted-foreground text-xs font-normal hyphens-auto">
            {{ t("settings.global.zeroConfDesc") }}
          </div></Label
        >
        <Switch id="0-conf" v-model="app.settings.zeroConf" />
      </div>
    </Card>
  </div>
</template>
