<script setup lang="ts" generic="T extends AssetBalance">
import { computed, Ref, ref, useTemplateRef } from "vue";
import { useResizeObserver, useVModel } from "@vueuse/core";
import { BigNumber } from "bignumber.js";
import { Check, ChevronsUpDown } from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { AssetBalance } from "@/stores/walletStore";
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
import { AssetInfo } from "@/types/internal";
import AssetIcon from "./AssetIcon.vue";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

export interface Asset extends AssetInfo {
  confirmedAmount?: BigNumber;
}

interface Props {
  assets: T[];
  showTokenId?: boolean;
  showBalance?: boolean;
  selectable?: boolean;
  modelValue?: T;
}

const props = withDefaults(defineProps<Props>(), {
  showTokenId: true,
  showBalance: true,
  selectable: false,
  modelValue: undefined
});

const emit = defineEmits<{
  (e: "select", payload: T): void;
  (e: "update:modelValue", payload: T): void;
}>();

defineExpose({ close: closePopover, clearSearch });

const format = useFormat();
const app = useAppStore();

const selected = useVModel(props, "modelValue", emit, { passive: true }) as Ref<T | undefined>;
const isOpen = ref(false);
const searchTerm = ref("");
const popoverWidth = ref("");

const normalizedSearchTerm = computed(() => normalize(searchTerm.value));

useResizeObserver(useTemplateRef("test"), ([entry]) => {
  popoverWidth.value = `width: ${Math.floor(entry.contentRect.width)}px;`;
});

async function emitSelected(asset: T) {
  closePopover();
  selected.value = asset;

  setTimeout(() => {
    emit("select", asset);
    searchTerm.value = "";
  }, 100); // wait for the popover to close before emitting selected event to avoid blinking
}

function closePopover() {
  isOpen.value = false;
}

function clearSearch() {
  searchTerm.value = "";
}

function isErg(tokenId: string): boolean {
  return tokenId === ERG_TOKEN_ID;
}

function normalize(value?: string) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function filter(items: (T | string)[]) {
  const term = normalizedSearchTerm.value;
  return items.filter((a) =>
    typeof a === "string"
      ? normalize(a).includes(term)
      : normalize(a?.metadata?.name).includes(term) || a.tokenId === term
  );
}
</script>

<template>
  <Popover v-model:open="isOpen">
    <div ref="test">
      <slot v-if="$slots.default" />
      <PopoverTrigger v-else as-child>
        <Button
          :aria-expanded="isOpen"
          variant="secondary"
          role="combobox"
          class="w-full items-center gap-0"
        >
          <span class="flex-grow">Add asset</span>
          <ChevronsUpDown class="size-4 shrink-0 opacity-50 float-end -ml-4" />
        </Button>
      </PopoverTrigger>
    </div>

    <PopoverContent class="p-0 min-w-[200px]" :style="popoverWidth">
      <Command v-model:search-term="searchTerm" class="max-h-[210px]" :filter-function="filter">
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
                class="flex flex-grow flex-col justify-center text-xs"
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
                v-if="props.showBalance && asset.balance"
                class="whitespace-nowrap text-right align-middle text-xs"
              >
                <div v-if="app.settings.hideBalances" class="flex flex-col items-end gap-1">
                  <Skeleton class="h-4 w-12 animate-none" />
                </div>
                <template v-else>
                  <div>
                    {{ format.bn.format(asset.balance) }}
                  </div>
                </template>
              </div>

              <Check
                v-if="props.selectable"
                :class="
                  cn(
                    'mr-2 h-4 w-4',
                    selected?.tokenId === asset.tokenId ? 'opacity-100' : 'opacity-0'
                  )
                "
              />
            </CommandItem>

            <slot name="commands" />
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
