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
  Minimize2Icon,
  MoonIcon,
  PlusCircleIcon,
  SettingsIcon,
  SunIcon,
  SunMoonIcon
} from "lucide-vue-next";
import { useI18n } from "vue-i18n";
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
import { WalletItem } from "@/components/wallet";
import { browser, isPopup } from "@/common/browser";
import { EXT_ENTRY_ROOT } from "@/constants/extension";
import { IDbWallet } from "@/types/database";

const wallet = useWalletStore();
const app = useAppStore();
const router = useRouter();
const { t } = useI18n();

const current = computed(() => app.wallets.find((w) => w.id === wallet.id));

const isPopupView = isPopup();

const isOpen = ref(false);
const searchTerm = ref("");
const loadingId = ref<number | false>();

const normalizedSearchTerm = computed(() => normalize(searchTerm.value));

function normalize(value?: string) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function goToAndClose(name: string) {
  goTo(name);
  closePopover();
}

function goTo(name: string) {
  if (router.currentRoute.value.name !== name) router.push({ name });
}

async function loadWallet(walletId: number) {
  setLoading(walletId);

  await wallet.load(walletId);
  goTo("assets");

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

function prefersDarkColors() {
  return window.matchMedia("(prefers-color-scheme: dark)");
}

function toggleColorMode() {
  const mode = app.settings.colorMode;
  if (mode === "auto") {
    app.settings.colorMode = prefersDarkColors() ? "light" : "dark";
  } else {
    app.settings.colorMode = mode === "dark" ? "light" : "dark";
  }
}

async function toggleViewMode() {
  if (!browser) return;
  const viewMode = app.settings.extension.viewMode;

  if (import.meta.env.TARGET === "firefox") {
    app.settings.extension.viewMode = viewMode === "popup" ? "sidebar" : "popup";
    await browser.sidebarAction.toggle();

    if (viewMode === "popup") window.close();
    return;
  }

  if (isPopupView) {
    const currentWindow = await browser.windows.getCurrent();
    if (currentWindow?.id) {
      app.settings.extension.viewMode = "sidebar";
      chrome.sidePanel.open({ windowId: currentWindow.id });
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } else {
      const url = browser.runtime.getURL(`${EXT_ENTRY_ROOT}/popup/index.html`);
      browser.tabs.create({ url, active: false });
    }
  } else {
    app.settings.extension.viewMode = "popup";
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  }

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
        class="h-full w-[210px] justify-between bg-transparent"
      >
        <WalletItem v-if="current" :wallet="current" />
        <ChevronsUpDownIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[210px] p-0">
      <Command
        v-model:search-term="searchTerm"
        class="max-h-[500px]"
        reset-search-term-on-blur
        :filter-function="
          (wallets: IDbWallet[]) =>
            wallets.filter((w) => normalize(w.name).includes(normalizedSearchTerm))
        "
      >
        <CommandInput :placeholder="t('common.search')" />
        <CommandEmpty>{{ t("header.menu.noWalletsFound") }}</CommandEmpty>
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

              <div class="h-4 w-4 transition-all duration-700">
                <LoaderCircleIcon v-if="loadingId === w.id" class="h-full w-full animate-spin" />
                <CheckIcon v-else-if="current?.id === w.id" class="h-full w-full" />
              </div>
            </CommandItem>
          </CommandGroup>
        </CommandList>

        <CommandSeparator />

        <div class="flex flex-row items-center justify-center gap-2 pt-2">
          <Button
            class="cursor-default"
            variant="ghost"
            size="icon"
            @click="toggleValuesVisibility"
          >
            <EyeIcon v-if="app.settings.hideBalances" />
            <EyeOffIcon v-else />
          </Button>
          <Button class="cursor-default" variant="ghost" size="icon" @click="toggleColorMode">
            <SunIcon v-if="app.settings.colorMode === 'dark'" />
            <MoonIcon v-else-if="app.settings.colorMode === 'light'" />
            <SunMoonIcon v-else />
          </Button>
          <Button class="cursor-default" variant="ghost" size="icon" @click="toggleViewMode">
            <Maximize2Icon v-if="isPopupView" />
            <Minimize2Icon v-else />
          </Button>
        </div>

        <CommandList>
          <CommandGroup>
            <CommandItem
              class="gap-2"
              value="add-wallet"
              @select.prevent="goToAndClose('add-wallet')"
              v-once
            >
              <PlusCircleIcon class="h-5 w-5 shrink-0" />
              {{ t("header.menu.newWallet") }}
            </CommandItem>

            <CommandItem
              class="gap-2"
              value="settings"
              @select.prevent="goToAndClose('wallet-settings')"
              v-once
            >
              <SettingsIcon class="h-5 w-5 shrink-0" />
              {{ t("header.menu.settings") }}
            </CommandItem>

            <CommandItem
              class="gap-2"
              value="about"
              @select.prevent="goToAndClose('about-nautilus')"
              v-once
            >
              <InfoIcon class="h-5 w-5 shrink-0" />
              {{ t("header.menu.about") }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
