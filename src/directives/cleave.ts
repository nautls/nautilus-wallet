import Cleave from "cleave.js";

export const vueCleave = {
  mounted(el: any, binding: any) {
    el.cleave = new Cleave(el, binding.value || {});
  },
  unmounted(el: any) {
    el.cleave.destroy();
  },
  updated: (el: HTMLElement) => {
    const event = new Event("input");
    el.dispatchEvent(event);
  }
};
