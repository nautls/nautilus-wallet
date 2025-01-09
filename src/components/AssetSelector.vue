<script setup lang="ts">
import { computed, ref } from "vue";
import { Check, ChevronsUpDown } from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { StateAssetSummary } from "@/stores/walletStore";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFormat } from "@/composables";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { cn } from "@/lib/utils";
import AssetIcon from "./AssetIcon.vue";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

interface Props {
  assets: StateAssetSummary[];
  showTokenId?: boolean;
  showBalance?: boolean;
  checkable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showTokenId: true,
  showBalance: true,
  checkable: false
});

const emit = defineEmits<{ select: [asset: StateAssetSummary] }>();
const format = useFormat();
const app = useAppStore();

const isOpen = ref(false);
const selected = ref<StateAssetSummary>();
const searchTerm = ref("");

const normalizedSearchTerm = computed(() => normalize(searchTerm.value));

async function emitSelected(asset: StateAssetSummary) {
  isOpen.value = false;
  selected.value = asset;

  setTimeout(() => {
    emit("select", asset);
    searchTerm.value = "";
  }, 100); // wait for the popover to close before emitting selected event to avoid blinking
}

function isErg(tokenId: string): boolean {
  return tokenId === ERG_TOKEN_ID;
}

function normalize(value?: string) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function filter(assets: StateAssetSummary[]) {
  const term = normalizedSearchTerm.value;
  return assets.filter((a) => normalize(a.metadata?.name).includes(term) || a.tokenId === term);
}
</script>

<template>
  <Popover v-model:open="isOpen">
    <slot v-if="$slots.default" />
    <PopoverTrigger v-else as-child>
      <Button
        ref="btn"
        :aria-expanded="isOpen"
        variant="secondary"
        role="combobox"
        class="w-full items-center gap-0"
      >
        <span class="flex-grow">Add asset</span>
        <ChevronsUpDown class="size-4 shrink-0 opacity-50 float-end -ml-4" />
      </Button>
    </PopoverTrigger>

    <PopoverContent class="p-0" :prioritize-position="false">
      <Command
        v-model:search-term="searchTerm"
        class="max-h-[220px]"
        :filter-function="(a: any) => filter(a)"
      >
        <CommandInput placeholder="Search asset..." />
        <CommandEmpty>No assets found.</CommandEmpty>
        <CommandList>
          <CommandGroup>
            <CommandItem
              v-for="asset in assets"
              :key="asset.tokenId"
              class="gap-2 py-2"
              :value="asset"
              @select.prevent="emitSelected(asset)"
            >
              <AssetIcon class="size-6" :token-id="asset.tokenId" :type="asset.metadata?.type" />

              <div
                class="flex flex-grow flex-col align-middle text-xs"
                :class="{ 'font-semibold': isErg(asset.tokenId) }"
              >
                <div>
                  {{ format.asset.name(asset) }}
                </div>
                <div v-if="props.showTokenId" class="text-muted-foreground">
                  {{
                    isErg(asset.tokenId) ? "Ergo" : format.string.shorten(asset.tokenId, 7, "none")
                  }}
                </div>
              </div>

              <div
                v-if="props.showBalance"
                class="whitespace-nowrap text-right align-middle text-xs"
              >
                <div v-if="app.settings.hideBalances" class="flex flex-col items-end gap-1">
                  <Skeleton class="h-4 w-12 animate-none" />
                </div>
                <template v-else>
                  <div>
                    {{ format.bn.format(asset.confirmedAmount) }}
                  </div>
                </template>
              </div>

              <Check
                v-if="props.checkable"
                :class="
                  cn(
                    'mr-2 h-4 w-4',
                    selected?.tokenId === asset.tokenId ? 'opacity-100' : 'opacity-0'
                  )
                "
              />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
