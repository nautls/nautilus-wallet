<script setup lang="ts">
import { UR, URDecoder } from "@keystonehq/keystone-sdk";
import { QrcodeStream } from "vue-qrcode-reader";
import { Progress } from "@/components/ui/progress";
import { ref } from "vue";
import { useToast } from "@/components/ui/toast";

interface Props {
  handleScan: (ur: UR) => void;
}

const props = defineProps<Props>();

const { toast } = useToast();


const progress = ref(0);
const expectedParts = ref(0);

const urDecoder = new URDecoder();

const onDetect = (detectedCodes) => {
  try {
    const result = urDecoder.receivePart(detectedCodes[0].rawValue);
    if (result && urDecoder.isSuccess()) {
      // qr code complete
      const ur = urDecoder.resultUR();
      props.handleScan(ur);
    } else if (urDecoder.isError()) {
      // failed to scan qr
      toast({
        variant: "destructive",
        title: "Error reading qr",
        description: urDecoder.resultError(),
      });
    } else {
      // progress ongoing update progress bar
      progress.value = urDecoder.getProgress() * 100;
      expectedParts.value = urDecoder.expectedPartCount();
    }
  } catch (e) {
    toast({
      variant: "destructive",
      title: "Error invalid qr",
      description: "" + e,
    });
  }
};
</script>

<template>
  <div class="flex flex-col gap-2 items-center">
    <Progress v-show="expectedParts > 1" v-bind:progress="progress"></Progress>
    <qrcode-stream class="h-10" @detect="onDetect"></qrcode-stream>
  </div>
</template>
