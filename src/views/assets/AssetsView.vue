<script setup lang="ts">
import { computed, ref, watch } from "vue";
import BigNumber from "bignumber.js";
import { CheckIcon, Globe2Icon, SearchCheckIcon, SearchIcon } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { AssetBalance, useWalletStore } from "@/stores/walletStore";
import { AssetIcon, AssetImageSandbox, AssetInfoDialog } from "@/components/asset";
import BuyErgButton from "@/components/BuyErgButton.vue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { bn } from "@/common/bigNumber";
import { isErg } from "@/common/utils";
import { useFormat } from "@/composables/useFormat";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import WalletAlerts from "./components/WalletAlerts.vue";

const app = useAppStore();
const assetsStore = useAssetsStore();
const wallet = useWalletStore();
const format = useFormat();

const { t } = useI18n({ useScope: "global" });

const filter = ref("");
const currentTab = ref<"tokens" | "collectibles" | "names">("tokens");
const { open: _openAssetInfoDialog } = useProgrammaticDialog(AssetInfoDialog);

const ergPrice = computed(() => assetsStore.prices.get(ERG_TOKEN_ID)?.fiat ?? 0);
const containsArtwork = computed(() => wallet.artworkBalance.length > 0);
const tokens = computed(() => filtered(wallet.nonArtworkBalance));
const collectibles = computed(() => filtered(wallet.artworkBalance));
const normalizedFilter = computed(() =>
  filter.value !== "" ? filter.value.trim().toLocaleLowerCase() : filter.value
);
const domains = computed(() =>
  wallet.ergoDomains.filter((domain) =>
    normalizedFilter.value === "" ? true : domain.name.includes(normalizedFilter.value)
  )
);

const walletTotal = computed(() =>
  wallet.nonArtworkBalance
    .reduce((acc, a) => acc.plus(a.balance.times(rate(a.tokenId))), bn(0))
    .times(ergPrice.value)
);

watch(
  () => wallet.id,
  () => {
    filter.value = "";
    currentTab.value = "tokens";
  }
);

function filtered(assets: AssetBalance[]): AssetBalance[] {
  if (normalizedFilter.value === "" || assets.length === 0) return assets;

  return assets.filter((a) =>
    a.metadata?.name?.toLocaleLowerCase().includes(normalizedFilter.value)
  );
}

function price(tokenId: string): BigNumber {
  const r = rate(tokenId);
  return r ? bn(r).times(ergPrice.value) : bn(0);
}

function rate(tokenId: string): number {
  return assetsStore.prices.get(tokenId)?.erg ?? 0;
}

function formatCurrencyAmount(value: BigNumber, decimals?: number): string {
  return format.number.currency(value, app.settings.conversionCurrency, decimals);
}

function formatCoinPrice(amount: number, decimals = 9): string {
  return `Σ ${format.number.decimal(BigNumber(amount ?? 0), decimals)}`;
}

function openAssetInfoDialog(tokenId: string) {
  if (tokenId === ERG_TOKEN_ID) return;
  _openAssetInfoDialog({ tokenId });
}

function shortAddress(address: string) {
  return format.string.shorten(address, 8);
}

function isPrimaryDomain(tokenId: string) {
  return wallet.primaryErgoDomain?.tokenId === tokenId;
}
</script>

<template>
  <ScrollArea type="scroll">
    <div class="flex flex-col gap-4 p-4">
      <WalletAlerts />

      <div class="flex cursor-default items-center justify-around bg-transparent py-4">
        <div>
          <h2 class="text-2xl">
            <span v-if="!app.settings.hideBalances"
              >{{ formatCurrencyAmount(walletTotal, 2) }}
            </span>
            <Skeleton v-else class="inline-block h-7 w-24 animate-none" />
          </h2>
          <p class="text-muted-foreground text-xs font-light">{{ t("asset.totalBalance") }}</p>
        </div>

        <BuyErgButton />
      </div>

      <Tabs v-model="currentTab" class="w-full" @update:model-value="() => (filter = '')">
        <div class="flex flex-row">
          <TabsList>
            <TabsTrigger value="tokens">{{ t("asset.tabs.tokens") }}</TabsTrigger>
            <TabsTrigger value="collectibles" :disabled="!containsArtwork">
              {{ t("asset.tabs.collectibles") }}
            </TabsTrigger>
            <TabsTrigger value="names">{{ t("asset.tabs.names") }}</TabsTrigger>
          </TabsList>

          <div class="grow"></div>

          <Popover>
            <PopoverTrigger>
              <Button variant="ghost" size="icon">
                <SearchIcon v-if="normalizedFilter === ''" />
                <SearchCheckIcon v-else />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="left">
              <Input
                v-model="filter"
                :placeholder="t('common.search')"
                class="w-full"
                clearable
                clear-icon
              />
            </PopoverContent>
          </Popover>
        </div>

        <TabsContent value="tokens">
          <Transition name="slide-up" appear>
            <div class="flex flex-col pt-1">
              <Button
                v-for="asset in tokens"
                :key="asset.tokenId"
                variant="ghost"
                @click="openAssetInfoDialog(asset.tokenId)"
                class="h-auto p-3 text-left [&_svg]:size-10"
              >
                <AssetIcon class="size-10" :token-id="asset.tokenId" :type="asset.metadata?.type" />

                <div
                  class="flex grow flex-col gap-0.5 align-middle text-sm"
                  :class="{ 'font-semibold': isErg(asset.tokenId) }"
                >
                  <p>{{ format.asset.name(asset) }}</p>

                  <p class="text-muted-foreground truncate text-xs">
                    {{ format.asset.id(asset.tokenId) }}
                  </p>
                </div>

                <div class="flex flex-col items-end gap-0.5 whitespace-nowrap">
                  <template v-if="app.settings.hideBalances">
                    <Skeleton class="h-5 w-24 animate-none" />
                    <Skeleton class="h-3 w-3/4 animate-none" />
                  </template>
                  <template v-else>
                    <span>{{ format.number.decimal(asset.balance) }}</span>

                    <TooltipProvider :delay-duration="100" v-if="rate(asset.tokenId)">
                      <Tooltip>
                        <TooltipTrigger class="text-muted-foreground text-xs">
                          {{ formatCurrencyAmount(asset.balance.times(price(asset.tokenId)), 2) }}
                        </TooltipTrigger>
                        <TooltipContent class="text-center">
                          <p class="pb-1 font-bold">
                            {{ format.number.namedCurrency(1, asset.metadata?.name) }}
                          </p>
                          <p>{{ formatCurrencyAmount(price(asset.tokenId), 2) }}</p>
                          <p v-if="!isErg(asset.tokenId)">
                            {{ formatCoinPrice(rate(asset.tokenId)) }}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </template>
                </div>
              </Button>
            </div>
          </Transition>
        </TabsContent>

        <TabsContent value="collectibles">
          <Transition name="slide-up" appear>
            <div
              class="grid grid-cols-2 justify-stretch gap-4 px-2 py-4 sm:grid-cols-4 md:grid-cols-2"
            >
              <div
                v-for="nft in collectibles"
                :key="nft.tokenId"
                class="bg-card text-card-foreground relative rounded-md border shadow-sm"
              >
                <AssetImageSandbox
                  :src="nft.metadata?.artworkUrl"
                  class="h-40 w-full overflow-hidden rounded-md"
                  height="10rem"
                  object-fit="cover"
                  overflow="hidden"
                />

                <div
                  class="absolute bottom-1 left-1 max-w-32 truncate rounded-md bg-slate-900/70 px-2.5 py-0.5 font-normal text-neutral-100"
                >
                  {{ nft.metadata?.name ?? nft.tokenId }}
                </div>
                <div
                  v-if="!nft.balance.eq(1) && !app.settings.hideBalances"
                  class="absolute top-1 right-1 flex h-6 min-w-6 rounded-full bg-slate-900/70 px-2 py-0.5 font-normal text-neutral-100"
                >
                  <span class="m-auto">{{ format.number.decimal(nft.balance) }}</span>
                </div>

                <!-- clickable overlay -->
                <Button
                  class="absolute top-0 left-0 h-40 w-full bg-transparent opacity-30 hover:bg-neutral-900"
                  variant="ghost"
                  @click="openAssetInfoDialog(nft.tokenId)"
                ></Button>
              </div>
            </div>
          </Transition>
        </TabsContent>

        <TabsContent value="names">
          <Transition name="slide-up" appear>
            <div class="space-y-3 px-1 py-3">
              <Card
                v-if="!domains.length"
                class="text-muted-foreground flex flex-col items-center gap-2 p-7 text-center text-sm"
              >
                <Globe2Icon class="size-7" />
                <p>{{ t("asset.names.empty") }}</p>
              </Card>

              <Card v-for="domain in domains" :key="domain.tokenId" class="p-4">
                <div class="flex items-start gap-3">
                  <div
                    class="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg"
                  >
                    <Globe2Icon class="size-5" />
                  </div>
                  <div class="min-w-0 grow">
                    <div class="flex items-center gap-2">
                      <p class="truncate text-sm font-semibold">{{ domain.name }}</p>
                      <span
                        v-if="isPrimaryDomain(domain.tokenId)"
                        class="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      >
                        {{ t("asset.names.primary") }}
                      </span>
                    </div>
                    <p class="text-muted-foreground mt-1 text-xs">
                      {{ t("asset.names.resolvesTo") }} {{ shortAddress(domain.address) }}
                    </p>
                    <p class="text-muted-foreground text-xs">
                      {{
                        t("asset.names.expiresAt", {
                          height: format.number.decimal(domain.expiryHeight)
                        })
                      }}
                    </p>
                  </div>
                  <CopyButton :content="domain.name" class="mt-0.5 size-4 shrink-0" />
                </div>

                <div class="mt-3 flex items-center gap-2 border-t pt-3">
                  <span class="text-muted-foreground min-w-0 grow truncate font-mono text-xs">
                    {{ domain.tokenId }}
                  </span>
                  <Button
                    v-if="!isPrimaryDomain(domain.tokenId)"
                    variant="outline"
                    size="xs"
                    @click="wallet.setPrimaryErgoDomain(domain.tokenId)"
                  >
                    {{ t("asset.names.setPrimary") }}
                  </Button>
                  <span v-else class="text-primary flex items-center gap-1 text-xs font-medium">
                    <CheckIcon class="size-3" /> {{ t("asset.names.primary") }}
                  </span>
                </div>
              </Card>
            </div>
          </Transition>
        </TabsContent>
      </Tabs>
    </div>
  </ScrollArea>
</template>
