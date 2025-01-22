<script setup lang="ts">
import { ref } from "vue";
import { StateAddress } from "@/stores/walletStore";
import QrCode from "@/components/QrCode.vue";
import { Button } from "@/components/ui/button";
// import {
//   Dialog,
//   DialogClose,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle
// } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";

const props = defineProps<{ address: StateAddress }>();
const emit = defineEmits(["close"]);

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
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Address Details</DrawerTitle>
        <DrawerDescription class="break-all px-2">
          {{ props.address.script }}
        </DrawerDescription>
      </DrawerHeader>

      <QrCode :data="props.address.script" class="mx-14" />

      <DrawerFooter>
        <DrawerClose as-child>
          <Button variant="outline" type="submit">Close</Button>
        </DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>
