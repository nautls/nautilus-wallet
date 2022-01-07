import Cleave from "cleave.js";

export const vueCleave = {
  mounted: (el: any, binding: any) => {
    el.cleave = new Cleave(el, binding.value || {});
  },
  updated: (el: any) => {
    const event = new Event("input", { bubbles: true });
    setTimeout(function () {
      el.value = el.cleave.properties.result;
      el.dispatchEvent(event);
    }, 100);
  }
};
