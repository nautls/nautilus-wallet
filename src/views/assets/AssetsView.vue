<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { EyeIcon, EyeOffIcon, SearchCheckIcon, SearchIcon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { AssetBalance, useWalletStore } from "@/stores/walletStore";
import { AssetIcon, AssetImageSandbox, AssetInfoDialog } from "@/components/asset";
import HiddenAmount from "@/components/HiddenAmount.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BigNumber, bn } from "@/common/bigNumber";
import { cn, isErg } from "@/common/utils";
import { useFormat } from "@/composables/useFormat";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import WalletAlerts from "./components/WalletAlerts.vue";

const app = useAppStore();
const assetsStore = useAssetsStore();
const wallet = useWalletStore();
const format = useFormat();

const { t } = useI18n({ useScope: "global" });

const LOADER_DELAY_MS = 300;

const filter = ref("");
const currentTab = ref<"tokens" | "collectibles">("tokens");
const { open: _openAssetInfoDialog } = useProgrammaticDialog(AssetInfoDialog);

const ergPrice = computed(() => assetsStore.prices.get(ERG_TOKEN_ID)?.fiat ?? 0);
const containsArtwork = computed(() => wallet.artworkBalance.length > 0);
const tokens = computed(() => filtered(wallet.nonArtworkBalance));
const collectibles = computed(() => filtered(wallet.artworkBalance));
const normalizedFilter = computed(() =>
  filter.value !== "" ? filter.value.trim().toLocaleLowerCase() : filter.value
);

// a wallet that has never synced has no balance to show yet, only a placeholder ERG row
const balancePending = computed(
  () => wallet.loading || (wallet.syncing && !wallet.synced) || !assetsStore.pricesLoaded
);
const hasFiatRate = computed(() => ergPrice.value > 0);

// loads that finish within the delay would only flash the loader
const showLoader = ref(false);
watch(
  balancePending,
  (pending, _, onCleanup) => {
    if (!pending) {
      showLoader.value = false;
      return;
    }

    const timer = setTimeout(() => (showLoader.value = true), LOADER_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
  },
  { immediate: true }
);

// until the first load ends there are no amounts to keep showing, only the placeholder ERG row
const firstLoadDone = ref(!wallet.loading);
watch(
  () => wallet.loading,
  (loading) => {
    if (!loading) firstLoadDone.value = true;
  }
);

const hideAmounts = computed(
  () =>
    (wallet.syncing && !wallet.synced) ||
    !assetsStore.pricesLoaded ||
    (wallet.loading && (showLoader.value || !firstLoadDone.value))
);

const ergTotal = computed(() =>
  wallet.nonArtworkBalance.reduce(
    (acc, a) => acc.plus(a.balance.times(isErg(a.tokenId) ? 1 : rate(a.tokenId))),
    bn(0)
  )
);

const formattedTotal = computed(() =>
  hasFiatRate.value
    ? formatCurrencyAmount(ergTotal.value.times(ergPrice.value), 2)
    : format.number.currency(ergTotal.value, "erg", 2)
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
  return format.number.currency(BigNumber(amount ?? 0), "erg", decimals);
}

function openAssetInfoDialog(tokenId: string) {
  if (tokenId === ERG_TOKEN_ID) return;
  _openAssetInfoDialog({ tokenId });
}
</script>

<template>
  <ScrollArea type="scroll">
    <div class="flex flex-col gap-4 p-4">
      <div class="flex flex-col items-center gap-1 pt-2 pb-2 text-center">
        <div class="relative max-w-[calc(100%-4rem)]">
          <h2
            class="truncate text-3xl leading-9 tabular-nums"
            :aria-busy="balancePending && !app.settings.hideBalances"
          >
            <template v-if="app.settings.hideBalances">
              <HiddenAmount :length="6" :label="t('asset.balanceHidden')" />
            </template>
            <template v-else-if="hideAmounts">
              <Skeleton
                class="mt-1 inline-block h-7 w-32 align-top"
                :class="{ invisible: !showLoader }"
              />
              <span class="sr-only">{{ t("asset.loadingBalance") }}</span>
            </template>
            <template v-else>{{ formattedTotal }}</template>
          </h2>
          <Button
            v-if="app.settings.hideBalances || !hideAmounts"
            id="toggle-balances"
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground hover:text-foreground absolute top-1/2 left-full ml-1 -translate-y-1/2"
            :aria-label="
              app.settings.hideBalances
                ? t('header.menu.showBalances')
                : t('header.menu.hideBalances')
            "
            @click="app.settings.hideBalances = !app.settings.hideBalances"
          >
            <EyeIcon v-if="app.settings.hideBalances" />
            <EyeOffIcon v-else />
          </Button>
        </div>
        <p class="text-muted-foreground text-xs">
          {{
            hasFiatRate || hideAmounts || app.settings.hideBalances
              ? t("asset.totalBalance")
              : t("asset.totalBalanceNoRate", {
                  currency: app.settings.conversionCurrency.toUpperCase()
                })
          }}
        </p>
      </div>

      <WalletAlerts />

      <Tabs v-model="currentTab" class="w-full" @update:model-value="() => (filter = '')">
        <div class="flex flex-row">
          <TabsList>
            <TabsTrigger value="tokens">{{ t("asset.tabs.tokens") }}</TabsTrigger>
            <TabsTrigger value="collectibles" :disabled="!containsArtwork">
              {{ t("asset.tabs.collectibles") }}
            </TabsTrigger>
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
          <p
            v-if="tokens.length === 0 && normalizedFilter"
            class="text-muted-foreground py-8 text-center text-sm"
          >
            {{ t("asset.noAssetsFound") }}
          </p>
          <Transition name="slide-up" appear>
            <div data-token-list class="flex flex-col">
              <Button
                v-for="asset in tokens"
                :key="asset.tokenId"
                variant="ghost"
                :class="
                  cn(
                    'h-auto gap-3 p-3 text-left [&_svg]:size-9',
                    isErg(asset.tokenId) && 'cursor-default'
                  )
                "
                @click="openAssetInfoDialog(asset.tokenId)"
              >
                <AssetIcon class="size-9" :token-id="asset.tokenId" :type="asset.metadata?.type" />

                <div
                  class="flex grow flex-col gap-0.5 align-middle text-sm"
                  :class="{ 'font-semibold': isErg(asset.tokenId) }"
                >
                  <p>{{ format.asset.name(asset) }}</p>

                  <p class="text-muted-foreground truncate text-xs">
                    {{ format.asset.id(asset.tokenId) }}
                  </p>
                </div>

                <div class="flex flex-col items-end gap-0.5 whitespace-nowrap tabular-nums">
                  <template v-if="app.settings.hideBalances">
                    <HiddenAmount />
                  </template>
                  <template v-else-if="hideAmounts">
                    <Skeleton class="my-0.5 h-4 w-16" :class="{ invisible: !showLoader }" />
                    <span class="sr-only">{{ t("asset.loadingBalance") }}</span>
                  </template>
                  <template v-else>
                    <span>{{ format.number.decimal(asset.balance) }}</span>

                    <TooltipProvider :delay-duration="100" v-if="rate(asset.tokenId)">
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <span class="text-muted-foreground text-xs">
                            {{ formatCurrencyAmount(asset.balance.times(price(asset.tokenId)), 2) }}
                          </span>
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
          <p
            v-if="collectibles.length === 0 && normalizedFilter"
            class="text-muted-foreground py-8 text-center text-sm"
          >
            {{ t("asset.noAssetsFound") }}
          </p>
          <Transition name="slide-up" appear>
            <div
              class="grid grid-cols-2 justify-stretch gap-4 pt-3 pb-4 sm:grid-cols-4 md:grid-cols-2"
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
                  class="bg-scrim/70 text-scrim-foreground absolute bottom-1 left-1 max-w-32 truncate rounded-md px-2.5 py-0.5 font-normal"
                >
                  {{ nft.metadata?.name ?? nft.tokenId }}
                </div>
                <div
                  v-if="!nft.balance.eq(1) && !app.settings.hideBalances"
                  class="bg-scrim/70 text-scrim-foreground absolute top-1 right-1 flex h-6 min-w-6 rounded-full px-2 py-0.5 font-normal"
                >
                  <span class="m-auto">{{ format.number.decimal(nft.balance) }}</span>
                </div>

                <!-- clickable overlay -->
                <Button
                  class="hover:bg-scrim absolute top-0 left-0 h-40 w-full bg-transparent opacity-30"
                  variant="ghost"
                  @click="openAssetInfoDialog(nft.tokenId)"
                ></Button>
              </div>
            </div>
          </Transition>
        </TabsContent>
      </Tabs>
    </div>
  </ScrollArea>
</template>
