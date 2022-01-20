<template>
  <!-- SVG-Loaders by https://github.com/SamHerbert/SVG-Loaders -->
  <!-- By Sam Herbert (@sherb), for everyone. More @ http://goo.gl/7AJzbL -->
  <svg
    v-if="type === 'pulse'"
    viewBox="0 0 44 44"
    xmlns="http://www.w3.org/2000/svg"
    :class="class"
    class="stroke-current inline-block"
  >
    <g fill="none" fill-rule="evenodd" stroke-width="2">
      <circle cx="22" cy="22" r="1">
        <animate
          attributeName="r"
          begin="0s"
          dur="1.8s"
          values="1; 20"
          calcMode="spline"
          keyTimes="0; 1"
          keySplines="0.165, 0.84, 0.44, 1"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-opacity"
          begin="0s"
          dur="1.8s"
          values="1; 0"
          calcMode="spline"
          keyTimes="0; 1"
          keySplines="0.3, 0.61, 0.355, 1"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="22" cy="22" r="1">
        <animate
          attributeName="r"
          begin="-0.9s"
          dur="1.8s"
          values="1; 20"
          calcMode="spline"
          keyTimes="0; 1"
          keySplines="0.165, 0.84, 0.44, 1"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-opacity"
          begin="-0.9s"
          dur="1.8s"
          values="1; 0"
          calcMode="spline"
          keyTimes="0; 1"
          keySplines="0.3, 0.61, 0.355, 1"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  </svg>
  <!-- By Sam Herbert (@sherb), for everyone. More @ http://goo.gl/7AJzbL -->
  <svg
    v-else
    viewBox="0 0 38 38"
    xmlns="http://www.w3.org/2000/svg"
    :class="class"
    class="stroke-current inline-block"
  >
    <g fill="none" fill-rule="evenodd">
      <g transform="translate(1 1)" stroke-width="2">
        <circle stroke-opacity=".5" cx="18" cy="18" r="18" />
        <path d="M36 18c0-9.94-8.06-18-18-18">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 18 18"
            to="360 18 18"
            dur="1s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </g>
  </svg>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "LoadingIndicator",
  props: {
    class: { type: String, require: false },
    type: {
      type: String,
      default: "pulse",
      validator(value: string) {
        return ["pulse", "circular"].includes(value);
      }
    }
  }
});
</script>
