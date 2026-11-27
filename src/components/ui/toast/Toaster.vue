<script setup lang="ts">
import { isVNode } from "vue";
import { omit } from "es-toolkit";
import { CircleAlertIcon, CircleCheckIcon, SendIcon } from "@lucide/vue";
import {
  Toast,
  ToastClose,
  ToastDescription,
  type ToastIcon,
  ToastProvider,
  ToastTitle,
  ToastViewport
} from ".";
import { useToast } from "./use-toast";

const { toasts } = useToast();

function iconOf(toast: { icon?: ToastIcon; variant?: string | null }): ToastIcon | undefined {
  return toast.icon ?? (toast.variant === "destructive" ? "error" : undefined);
}
</script>

<template>
  <ToastProvider>
    <Toast v-for="toast in toasts" :key="toast.id" v-bind="omit(toast, ['icon'])" class="pr-3">
      <div class="flex min-w-0 grow items-center gap-3">
        <SendIcon
          v-if="iconOf(toast) === 'sent'"
          data-toast-icon="sent"
          aria-hidden="true"
          class="text-success size-5 shrink-0"
        />
        <CircleCheckIcon
          v-else-if="iconOf(toast) === 'done'"
          data-toast-icon="done"
          aria-hidden="true"
          class="text-success size-5 shrink-0"
        />
        <CircleAlertIcon
          v-else-if="iconOf(toast) === 'error'"
          data-toast-icon="error"
          aria-hidden="true"
          class="size-5 shrink-0"
        />
        <div class="grid gap-1">
          <ToastTitle v-if="toast.title">
            {{ toast.title }}
          </ToastTitle>
          <template v-if="toast.description">
            <ToastDescription v-if="isVNode(toast.description)">
              <component :is="toast.description" />
            </ToastDescription>
            <ToastDescription v-else>
              {{ toast.description }}
            </ToastDescription>
          </template>
        </div>
      </div>
      <component :is="toast.action" />
      <ToastClose class="static shrink-0 opacity-100" />
    </Toast>
    <ToastViewport />
  </ToastProvider>
</template>
