import { DirectiveBinding } from "vue";
import Cleave from "cleave.js";

interface CleaveHTMLElement extends HTMLElement {
  cleave?: Cleave;
}

export const vueCleave = {
  mounted(el: CleaveHTMLElement, binding: DirectiveBinding) {
    el.cleave = new Cleave(el, binding.value || {});
  },
  unmounted(el: CleaveHTMLElement) {
    el.cleave?.destroy();
  }
};
