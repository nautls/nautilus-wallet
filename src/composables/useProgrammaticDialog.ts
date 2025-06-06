import {
  AllowedComponentProps,
  Component,
  createVNode,
  getCurrentInstance,
  onUnmounted,
  render,
  VNode,
  VNodeProps
} from "vue";

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type ComponentProps<T extends Component, N = never> = T extends new (
  ...args: unknown[]
) => unknown
  ? Prettify<Omit<InstanceType<T>["$props"], keyof VNodeProps | keyof AllowedComponentProps>>
  : N;

export type DialogLikeComponent = new (...args: unknown[]) => {
  open: () => void;
  close: () => void;
} & Component;

export function useProgrammaticDialog<T extends DialogLikeComponent>(
  component: T,
  initialProps?: ComponentProps<T>
) {
  const props = { ...initialProps };
  const context = getCurrentInstance()?.appContext ?? null;
  let instance: InstanceType<T> | null;
  let vnode: VNode | null;
  let container: HTMLDivElement | null;

  const mount = (mountProps?: ComponentProps<T>) => {
    patchProps(mountProps);

    container = document.createElement("div");
    vnode = createVNode(component, props);
    vnode.appContext = context; // Required for components that use provide/inject and vue-i18n

    render(vnode, container);
    instance = vnode.component?.exposed as InstanceType<T>;

    document.body.appendChild(container);
  };

  const patchProps = (newProps?: ComponentProps<T>) => {
    if (!newProps || Object.keys(newProps).length === 0) return;

    Object.assign(props, newProps);
    if (vnode && vnode.component) {
      Object.assign(vnode.component.props, props);
    }
  };

  const open = (props?: ComponentProps<T>) => {
    if (!instance) {
      mount(props);
    } else {
      patchProps(props);
      instance.open();
    }
  };

  const close = () => instance?.close();

  const destroy = () => {
    if (!container || !instance) return;

    render(null, container);
    container.remove();
    container = null;
    instance = null;
    vnode = null;
  };

  onUnmounted(destroy);

  return {
    open,
    close
  };
}
