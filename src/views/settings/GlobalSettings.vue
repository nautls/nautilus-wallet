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
  CommandList
} from "@/components/ui/command";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/ui/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { SUPPORTED_LOCALES } from "@/boot/i18n";
import { coinGeckoService } from "@/chains/ergo/services/coinGeckoService";
import {
  MIN_SERVER_VERSION,
  validateServerNetwork,
  validateServerVersion
} from "@/chains/ergo/services/graphQlService";
import { cn } from "@/common/utils";
import { validUrl } from "@/validators";

const app = useAppStore();
const { locale } = useI18n();

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
  app.settings.locale === "auto" ? "Auto" : app.settings.locale.toUpperCase()
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
  app.settings.conversionCurrency = currency;
  currencyState.isPopoverOpen = false;
}

function selectLocale(locale: Locale | "auto") {
  app.settings.locale = locale;
  localeState.isPopoverOpen = false;
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
      required: helpers.withMessage("Explorer URL is required.", required),
      validUrl
    },
    graphQLServer: {
      required: helpers.withMessage("GraphQL Server is required.", required),
      validUrl,
      network: helpers.withMessage(
        "Wrong server network.",
        helpers.withAsync(async (url: string) => {
          if (!url) return true;
          return await validateServerNetwork(url);
        })
      ),
      version: helpers.withMessage(
        `Unsupported server version. Nautilus requires at least version ${MIN_SERVER_VERSION.join(".")}.`,
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
    <Card class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between gap-4">
        <Label class="flex flex-col gap-2"
          >Display Language
          <div class="text-muted-foreground text-xs font-normal">
            Use this option to set the default app language.
          </div></Label
        >

        <Popover v-model:open="localeState.isPopoverOpen">
          <PopoverTrigger as-child>
            <Button variant="outline" class="min-w-[100px]">
              <span class="grow">{{ currentLocale }}</span>
              <ChevronsUpDownIcon class="size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent class="max-w-[130px] p-0">
            <Command reset-search-term-on-blur>
              <CommandInput placeholder="Search" />
              <CommandList class="max-h-[200px]">
                <CommandGroup>
                  <CommandItem
                    value="auto"
                    class="justify-between gap-2 whitespace-nowrap"
                    @select="selectLocale('auto')"
                  >
                    <div class="font-medium">
                      Auto (<span class="uppercase">{{ locale }}</span
                      >)
                    </div>

                    <CheckIcon
                      :class="
                        cn(
                          'mr-2 h-4 w-4',
                          app.settings.locale === 'auto' ? 'opacity-100' : 'opacity-0'
                        )
                      "
                    />
                  </CommandItem>

                  <CommandItem
                    v-for="lang in localeState.available"
                    :key="lang"
                    class="justify-between gap-2"
                    :value="lang"
                    @select="selectLocale(lang)"
                  >
                    <div class="uppercase">{{ lang }}</div>

                    <CheckIcon
                      :class="
                        cn(
                          'mr-2 h-4 w-4',
                          lang === app.settings.locale ? 'opacity-100' : 'opacity-0'
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
        <Label class="flex flex-col gap-2"
          >Conversion Currency
          <div class="text-muted-foreground text-xs font-normal">
            Use this option to set the default currency for conversion.
          </div></Label
        >

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
              <CommandInput placeholder="Search" />
              <CommandEmpty>No currencies found.</CommandEmpty>
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
        <Label for="dev-mode" class="flex flex-col gap-1"
          >Developer Mode
          <div class="text-muted-foreground text-xs font-normal">Enable advanced tools.</div></Label
        >
        <Switch id="dev-mode" v-model="app.settings.devMode" />
      </div>
    </Card>

    <Card class="flex flex-col gap-6 p-6">
      <Label class="flex flex-col gap-1"
        >Token Blacklists
        <div class="text-muted-foreground text-xs font-normal">
          Ergo
          <Link external href="https://github.com/sigmanauts/token-id-blacklist"
            >tokens blacklists</Link
          >
          are maintained by the
          <Link external href="https://sigmanauts.com/">Sigmanauts community.</Link>
        </div>
      </Label>

      <div class="flex items-center justify-between gap-4">
        <Label for="nsfw-blacklist" class="flex flex-col gap-1"
          >NSFW Tokens
          <div class="text-muted-foreground text-xs font-normal">Hide NSFW tokens.</div></Label
        >
        <Switch id="nsfw-blacklist" v-model="nsfwBlacklist" />
      </div>
      <div class="flex items-center justify-between gap-4">
        <Label for="scam-blacklist" class="flex flex-col gap-1"
          >Scam Tokens
          <div class="text-muted-foreground text-xs font-normal">Hide Scam tokens.</div></Label
        >
        <Switch id="scam-blacklist" v-model="scamBlacklist" />
      </div>
    </Card>

    <Card class="flex flex-col gap-6 p-6">
      <div class="flex flex-col gap-2">
        <FormField :validation="v$.graphQLServer">
          <Label for="gql-server">GraphQL Server</Label>
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
          <template #description>Set the main GraphQL server endpoint.</template>
        </FormField>
      </div>

      <div class="flex flex-col gap-2">
        <FormField :validation="v$.explorerUrl">
          <Label for="explorer-url">Explorer URL</Label>
          <Input id="explorer-url" v-model="explorerUrl" />
          <template #description>Set the default Ergo block explorer.</template>
        </FormField>
      </div>
    </Card>

    <Card class="bg-warning/10 flex flex-col gap-6 p-6">
      <Label class="flex flex-col gap-2">
        <div class="flex items-center gap-1">
          Experimental <TriangleAlertIcon class="text-warning size-3" />
        </div>

        <div class="text-xs font-normal">
          The features under this section are marked as experimental, which means they're not
          stable. Use it with caution, as it may contain bugs or undergo significant changes. It's a
          work in progress, so expect some rough edges.
        </div>
      </Label>

      <div class="flex items-center justify-between gap-4">
        <Label for="0-conf" class="flex flex-col gap-1"
          >Enable 0-conf
          <div class="text-muted-foreground text-xs font-normal">
            0-conf, short for zero-confirmations, lets you to spend assets without waiting for
            confirmations. It's fast but carries a risk of being double-spent until confirmed by the
            blockchain.
          </div></Label
        >
        <Switch id="0-conf" v-model="app.settings.zeroConf" />
      </div>
    </Card>
  </div>
</template>
