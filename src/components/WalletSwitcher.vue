<script setup lang="ts">
import { computed, ref } from "vue";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  LoaderCircleIcon,
  Maximize2Icon,
  MoonIcon,
  PlusCircleIcon,
  SettingsIcon,
  SunIcon,
  SunMoonIcon
} from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import WalletItem from "@/components/WalletItem.vue";
import { browser, isPopup } from "@/common/browser";
import { EXT_ENTRY_ROOT } from "@/constants/extension";
import { IDbWallet } from "@/types/database";

const wallet = useWalletStore();
const app = useAppStore();
const router = useRouter();

const current = computed(() => app.wallets.find((w) => w.id === wallet.id));

const isOpen = ref(false);
const selected = ref<IDbWallet>();
const loadingId = ref<number | false>();

function normalize(value?: string) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function goTo(name: string) {
  router.push({ name });
  closePopover();
}

async function loadWallet(walletId: number) {
  setLoading(walletId);
  await wallet.load(walletId);

  setLoading(false);
  closePopover();
}

function setLoading(id: number | false) {
  loadingId.value = id;
}

function closePopover() {
  isOpen.value = false;
}

function toggleValuesVisibility() {
  app.settings.hideBalances = !app.settings.hideBalances;
}

function toggleColorMode() {
  const mode = app.settings.colorMode;
  switch (mode) {
    case "auto":
      app.settings.colorMode = "dark";
      break;
    case "dark":
      app.settings.colorMode = "light";
      break;
    case "light":
    default:
      app.settings.colorMode = "auto";
      break;
  }
}

async function expandView() {
  if (!browser?.tabs) return;

  const url = browser.runtime.getURL(`${EXT_ENTRY_ROOT}/popup/index.html`);
  browser.tabs.create({ url, active: true });
  window.close();
}
</script>
<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        role="combobox"
        :aria-expanded="isOpen"
        class="w-[210px] justify-between h-full bg-transparent"
      >
        <WalletItem v-if="current" :wallet="current" />
        <ChevronsUpDownIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[210px] p-0">
      <Command
        v-model="selected"
        class="max-h-[500px]"
        :reset-search-term-on-blur="true"
        :filter-function="
          (list: any[], filter: string) =>
            list.filter((w) => normalize(w.name).includes(normalize(filter)))
        "
      >
        <CommandInput placeholder="Search..." />
        <CommandEmpty>No wallet found.</CommandEmpty>
        <CommandList>
          <CommandGroup>
            <CommandItem
              v-for="w in app.wallets"
              :key="w.id"
              class="gap-2"
              :value="w"
              @select="loadWallet(w.id)"
            >
              <WalletItem v-if="current" :wallet="w" concise />

              <div class="w-4 h-4 transition-all duration-700">
                <LoaderCircleIcon v-if="loadingId === w.id" class="animate-spin h-full w-full" />
                <CheckIcon v-else-if="current?.id === w.id" class="h-full w-full" />
              </div>
            </CommandItem>
          </CommandGroup>
        </CommandList>

        <CommandSeparator />

        <div class="flex flex-row items-center justify-center pt-2 gap-2">
          <Button variant="ghost" size="icon" @click="toggleValuesVisibility">
            <EyeOffIcon v-if="app.settings.hideBalances" />
            <EyeIcon v-else />
          </Button>
          <Button variant="ghost" size="icon" @click="toggleColorMode">
            <MoonIcon v-if="app.settings.colorMode === 'dark'" />
            <SunIcon v-else-if="app.settings.colorMode === 'light'" />
            <SunMoonIcon v-else />
          </Button>
          <Button variant="ghost" size="icon" :disabled="!isPopup()" @click="expandView"
            ><Maximize2Icon
          /></Button>
        </div>

        <CommandList>
          <CommandGroup>
            <CommandItem class="gap-2" value="add-wallet" @select.prevent="goTo('add-wallet')">
              <PlusCircleIcon class="h-5 w-5 shrink-0" />
              New wallet
            </CommandItem>

            <CommandItem class="gap-2" value="settings" @select.prevent="goTo('wallet-settings')">
              <SettingsIcon class="h-5 w-5 shrink-0" />
              Settings
            </CommandItem>

            <CommandItem class="gap-2" value="about" @select.prevent="goTo('about-nautilus')">
              <InfoIcon class="h-5 w-5 shrink-0" />
              About
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
