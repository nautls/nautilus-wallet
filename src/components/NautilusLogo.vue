<script setup lang="ts">
import { HTMLAttributes } from "vue";
import { cn } from "@/common/utils";
import { MAINNET } from "@/constants/ergo";

interface Props {
  class?: HTMLAttributes["class"];
}

const props = defineProps<Props>();

const testnet = !MAINNET;
const staging = import.meta.env.MODE === "staging";
const displayName = staging ? "Abyss" : testnet ? "Testnet" : "Mainnet";
const logo = "/icons/app/logo.svg?url";
</script>

<template>
  <img :src="logo" :class="cn('size-10', props.class)" :alt="displayName" />
</template>
