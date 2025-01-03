<script setup lang="ts">
import { ref } from "vue";
import QrCode from "@/components/QrCode.vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { StateAddress } from "@/types/internal";

const opened = ref(true);
const props = defineProps<{ address: StateAddress }>();
const emit = defineEmits(["close"]);

function handleOpenUpdates(open: boolean) {
  if (!open) emit("close");
}

function openDialog() {
  opened.value = true;
}

function closeDialog() {
  opened.value = false;
}

defineExpose({ open: openDialog, close: closeDialog });
</script>

<template>
  <Dialog v-model:open="opened" @update:open="handleOpenUpdates">
    <DialogContent class="sm:max-w-[410px]">
      <DialogHeader>
        <DialogTitle>Address Details</DialogTitle>
        <DialogDescription class="break-all">
          {{ props.address.script }}
        </DialogDescription>
      </DialogHeader>

      <QrCode :data="props.address.script" />

      <DialogFooter>
        <DialogClose as-child>
          <Button variant="outline" type="submit">Close</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
