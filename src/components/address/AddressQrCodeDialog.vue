<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { StateAddress } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import { QrCode } from "@/components/ui/qr-code";

const props = defineProps<{ address: StateAddress }>();
const emit = defineEmits(["close"]);

const { t } = useI18n();

const opened = ref(true);

function handleOpenUpdates(open: boolean) {
  if (!open) emit("close");
}

function setOpened(open: boolean) {
  opened.value = open;
}

defineExpose({ open: () => setOpened(true), close: () => setOpened(false) });
</script>

<template>
  <Drawer v-model:open="opened" @update:open="handleOpenUpdates">
    <DrawerContent v-once>
      <DrawerHeader>
        <DrawerTitle>{{ t("address.qrCode.title") }}</DrawerTitle>
        <DrawerDescription class="break-all">
          {{ t("address.qrCode.description", { address: props.address.script }) }}
        </DrawerDescription>
      </DrawerHeader>

      <QrCode :data="props.address.script" class="mx-14" />

      <DrawerFooter>
        <DrawerClose as-child>
          <Button variant="outline" type="submit">{{ t("common.close") }}</Button>
        </DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>
