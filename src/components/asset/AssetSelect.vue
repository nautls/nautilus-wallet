<script setup lang="ts" generic="T extends Asset">
import { computed, Ref, ref, useTemplateRef } from "vue";
import { useResizeObserver, useVModel } from "@vueuse/core";
import { BigNumber } from "bignumber.js";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { AssetIcon } from "@/components/asset";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, isErg } from "@/common/utils";
import { useFormat } from "@/composables";
import { AssetInfo } from "@/types/internal";

export interface Asset extends AssetInfo {
  balance?: BigNumber;
  disabled?: boolean;
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
          <span class="grow">Add asset</span>
          <ChevronsUpDownIcon class="float-end -ml-4 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
    </div>

    <PopoverContent class="min-w-[200px] p-0" :style="popoverWidth">
      <Command v-model:search-term="searchTerm" class="max-h-[210px]" :filter-function="filter">
        <CommandInput placeholder="Search asset..." />
        <CommandEmpty>No assets found.</CommandEmpty>
        <CommandList>
          <CommandGroup>
            <CommandItem
              v-for="asset in assets"
              :key="asset.tokenId"
              :disabled="asset.disabled"
              class="gap-2 py-2"
              :value="asset"
              @select.prevent="emitSelected(asset)"
            >
              <AssetIcon class="size-6" :token-id="asset.tokenId" :type="asset.metadata?.type" />

              <div
                class="flex grow flex-col justify-center text-xs"
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
                v-if="props.showBalance && asset.balance?.isPositive()"
                class="text-right align-middle text-xs whitespace-nowrap"
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

              <CheckIcon
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
