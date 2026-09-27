<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { BookUserIcon, ChevronLeftIcon, SendIcon, Trash2Icon } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { useWalletStore } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/toast";
import { addressBookDbService } from "@/database/addressBookDbService";
import { IDbAddressBookEntry, NotNullId } from "@/types/database";
import { validErgoAddress } from "@/validators";

const wallet = useWalletStore();
const route = useRoute();
const router = useRouter();
const { toast } = useToast();
const { t } = useI18n();

const entries = ref<NotNullId<IDbAddressBookEntry>[]>([]);
const name = ref("");
const address = ref("");
const saving = ref(false);
const selectingForSend = computed(() => route.query.select === "send");

async function loadEntries() {
  if (!wallet.id) return;
  entries.value = await addressBookDbService.getByWalletId(wallet.id);
}

onMounted(loadEntries);
watch(
  () => wallet.id,
  () => loadEntries()
);

async function saveEntry() {
  const normalizedName = name.value.trim();
  const normalizedAddress = address.value.trim();
  if (!normalizedName) {
    toast({ title: t("addressBook.addName"), description: t("addressBook.addNameDesc") });
    return;
  }
  if (!validErgoAddress.$validator(normalizedAddress)) {
    toast({
      title: t("addressBook.invalidAddress"),
      description: t("addressBook.invalidAddressDesc")
    });
    return;
  }

  saving.value = true;
  try {
    await addressBookDbService.put({
      walletId: wallet.id,
      name: normalizedName,
      address: normalizedAddress,
      createdAt: Date.now()
    });
    name.value = "";
    address.value = "";
    await loadEntries();
  } finally {
    saving.value = false;
  }
}

async function removeEntry(entry: NotNullId<IDbAddressBookEntry>) {
  await addressBookDbService.delete(entry.id);
  await loadEntries();
}

function selectEntry(entry: NotNullId<IDbAddressBookEntry>) {
  router.replace({ name: "send-page", query: { recipient: entry.address } });
}

function goBack() {
  router.back();
}
</script>

<template>
  <ScrollArea type="scroll" class="grow">
    <div class="space-y-4 p-4 pb-6">
      <div class="flex items-center gap-2">
        <Button variant="minimal" size="icon" aria-label="Go back" @click="goBack">
          <ChevronLeftIcon />
        </Button>
        <div>
          <h1 class="text-base font-semibold">{{ t("addressBook.title") }}</h1>
          <p class="text-muted-foreground text-xs">{{ t("addressBook.subtitle") }}</p>
        </div>
      </div>

      <Card class="space-y-3 p-4">
        <CardTitle class="text-sm">{{ t("addressBook.addContact") }}</CardTitle>
        <div class="space-y-1.5">
          <Label for="contact-name">{{ t("addressBook.name") }}</Label>
          <Input id="contact-name" v-model="name" maxlength="64" placeholder="e.g. Alice" />
        </div>
        <div class="space-y-1.5">
          <Label for="contact-address">{{ t("addressBook.ergoAddress") }}</Label>
          <Input
            id="contact-address"
            v-model="address"
            spellcheck="false"
            autocomplete="off"
            placeholder="9h..."
          />
        </div>
        <Button class="w-full" :disabled="saving" @click="saveEntry">
          {{ saving ? t("addressBook.saving") : t("addressBook.save") }}
        </Button>
      </Card>

      <div class="space-y-2">
        <div class="flex items-center justify-between px-1">
          <h2 class="text-sm font-semibold">{{ t("addressBook.contacts") }}</h2>
          <span class="text-muted-foreground text-xs">{{ entries.length }}</span>
        </div>
        <Card
          v-if="!entries.length"
          class="text-muted-foreground flex flex-col items-center gap-2 p-6 text-center text-sm"
        >
          <BookUserIcon class="size-6" />
          <span>{{ t("addressBook.empty") }}</span>
        </Card>
        <Card v-for="entry in entries" :key="entry.id" class="p-3">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ entry.name }}</p>
              <p class="text-muted-foreground font-mono text-xs break-all">{{ entry.address }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <CopyButton :content="entry.address" class="size-4" />
              <Button
                variant="minimal"
                size="icon"
                class="text-destructive hover:text-destructive size-7"
                :aria-label="`Delete ${entry.name}`"
                @click="removeEntry(entry)"
              >
                <Trash2Icon class="size-4" />
              </Button>
            </div>
          </div>
          <Button
            v-if="selectingForSend"
            variant="outline"
            size="sm"
            class="mt-3 w-full"
            @click="selectEntry(entry)"
          >
            <SendIcon /> {{ t("addressBook.useForSend") }}
          </Button>
        </Card>
      </div>
    </div>
  </ScrollArea>
</template>
