<script setup lang="ts">
import { ref } from "vue";
import { CheckIcon, ChevronsUpDownIcon, TriangleAlertIcon } from "lucide-vue-next";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/ui/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const selectedCurrency = ref("usd");
const currencies = [
  "btc",
  "eth",
  "ltc",
  "bch",
  "bnb",
  "eos",
  "xrp",
  "xlm",
  "link",
  "dot",
  "yfi",
  "usd",
  "aed",
  "ars",
  "aud",
  "bdt",
  "bhd",
  "bmd",
  "brl",
  "cad",
  "chf",
  "clp",
  "cny",
  "czk",
  "dkk",
  "eur",
  "gbp",
  "gel",
  "hkd",
  "huf",
  "idr",
  "ils",
  "inr",
  "jpy",
  "krw",
  "kwd",
  "lkr",
  "mmk",
  "mxn",
  "myr",
  "ngn",
  "nok",
  "nzd",
  "php",
  "pkr",
  "pln",
  "rub",
  "sar",
  "sek",
  "sgd",
  "thb",
  "try",
  "twd",
  "uah",
  "vef",
  "vnd",
  "zar",
  "xdr",
  "xag",
  "xau",
  "bits",
  "sats"
];

const isCurrencyPopoverOpen = ref(false);

function selectCurrency(currency: string) {
  selectedCurrency.value = currency;
  isCurrencyPopoverOpen.value = false;
}
</script>

<template>
  <div class="space-y-6">
    <Card class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between gap-2">
        <Label class="flex flex-col gap-2"
          >Conversion Currency
          <div class="text-muted-foreground text-xs">
            Use this option to set the default currency for conversion.
          </div></Label
        >

        <Popover v-model:open="isCurrencyPopoverOpen">
          <PopoverTrigger as-child>
            <Button variant="outline" class="min-w-[100px]">
              <span class="flex-grow uppercase">{{ selectedCurrency }}</span>
              <ChevronsUpDownIcon class="size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent class="p-0 max-w-[110px]">
            <Command reset-search-term-on-blur>
              <CommandInput placeholder="Search..." />
              <CommandEmpty>No currencies found.</CommandEmpty>
              <CommandList class="max-h-[200px]">
                <CommandGroup>
                  <CommandItem
                    v-for="currency in currencies"
                    :key="currency"
                    class="gap-2 justify-between"
                    :value="currency"
                    @select="selectCurrency(currency)"
                  >
                    <div class="uppercase">{{ currency }}</div>

                    <CheckIcon
                      :class="
                        cn(
                          'mr-2 h-4 w-4',
                          currency === selectedCurrency ? 'opacity-100' : 'opacity-0'
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
      <div class="flex items-center justify-between gap-2">
        <Label for="dev-mode" class="flex flex-col gap-1"
          >Developer Mode
          <div class="text-muted-foreground text-xs">Enable advanced tools.</div></Label
        >
        <Switch id="dev-mode" />
      </div>
    </Card>

    <Card class="flex flex-col gap-6 p-6">
      <Label class="flex flex-col gap-1"
        >Token Blacklists
        <div class="text-muted-foreground text-xs">
          Ergo
          <Link external href="https://github.com/sigmanauts/token-id-blacklist"
            >tokens blacklists</Link
          >
          are maintained by the Sigmanauts community.
        </div></Label
      >

      <div class="flex items-center justify-between gap-2">
        <Label for="nsfw-blacklist" class="flex flex-col gap-1"
          >NSFW Tokens
          <div class="text-muted-foreground text-xs">Hide NSFW tokens.</div></Label
        >
        <Switch id="nsfw-blacklist" />
      </div>
      <div class="flex items-center justify-between gap-2">
        <Label for="scam-blacklist" class="flex flex-col gap-1"
          >Scam Tokens
          <div class="text-muted-foreground text-xs">Hide Scam tokens.</div></Label
        >
        <Switch id="scam-blacklist" />
      </div>
    </Card>

    <Card class="flex flex-col gap-6 p-6">
      <div class="flex flex-col gap-2">
        <Label for="gql-server">GraphQL Server</Label>
        <Input id="gql-server" />
        <div class="text-muted-foreground text-xs">Set the main GraphQL server endpoint.</div>
      </div>

      <div class="flex flex-col gap-2">
        <Label for="explorer-url">Explorer URL</Label>
        <Input id="explorer-url" />
        <div class="text-muted-foreground text-xs">Set the default Ergo block explorer.</div>
      </div>
    </Card>

    <Card class="flex flex-col gap-6 p-6 bg-yellow-500/10">
      <Label class="flex flex-col gap-2">
        <div class="flex items-center gap-1">
          Experimental <TriangleAlertIcon class="size-3 text-yellow-600/70" />
        </div>

        <div class="text-muted-foreground text-xs">
          The features under this section are marked as experimental, which means they're not
          stable. Use it with caution, as it may contain bugs or undergo significant changes. It's a
          work in progress, so expect some rough edges.
        </div>
      </Label>

      <div class="flex items-center justify-between gap-2">
        <Label for="0-conf" class="flex flex-col gap-1"
          >Enable 0-conf
          <div class="text-muted-foreground text-xs">
            0-conf, short for zero-confirmations, lets you to spend assets without waiting for
            confirmations. It's fast but carries a risk of being double-spent until confirmed by the
            blockchain.
          </div></Label
        >
        <Switch id="0-conf" />
      </div>
    </Card>
  </div>
</template>
