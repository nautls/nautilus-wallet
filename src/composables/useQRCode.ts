import { FunctionalComponent, h } from "vue";
import { QrCodeGenerateData, QrCodeGenerateOptions, renderSVG } from "uqr";

type QrCodeProps = {
  data: QrCodeGenerateData;
  options?: QrCodeGenerateOptions;
};

export function useQrCode(options?: QrCodeGenerateOptions): FunctionalComponent<QrCodeProps> {
  return (props: QrCodeProps) => {
    return h("div", {
      innerHTML: renderSVG(props.data, props.options ?? options)
    });
  };
}
