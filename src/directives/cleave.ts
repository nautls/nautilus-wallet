import Cleave from "cleave.js";
import { DirectiveBinding } from "vue";

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
