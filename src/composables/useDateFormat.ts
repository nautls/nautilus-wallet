import { DateFormatter, Translator } from "@/boot/i18n";

export interface DateFormatOptions {
  t: Translator;
  d: DateFormatter;
  maxRelativeTime?: number;
  showRelativeTimeQualifier?: boolean;
}

type DateInput = Date | number | string;

export function useRelativeDateFormatter(options: DateFormatOptions) {
  return {
    rd: (date: DateInput): string => {
      const target = new Date(date);
      const now = new Date();

      if (
        options.maxRelativeTime &&
        target.getTime() < now.setMilliseconds(options.maxRelativeTime * -1)
      ) {
        return options.d(date, { dateStyle: "long" });
      }

      return formatRelativeTime(target, options.showRelativeTimeQualifier ?? true, options.t);
    }
  };
}

export function formatRelativeTime(date: Date, showQualifier: boolean, t: DateFormatter): string {
  const now = new Date();
  const isFuture = date > now;
  let diff = Math.abs((date.getTime() - now.getTime()) / 1000);

  if (diff < 60) return t("datetime.now");
  if ((diff = d(diff, 60)) < 60) return fmt("datetime.minutes", diff, showQualifier, isFuture, t);
  if ((diff = d(diff, 60)) < 24) return fmt("datetime.hours", diff, showQualifier, isFuture, t);
  if ((diff = d(diff, 24)) < 30) return fmt("datetime.days", diff, showQualifier, isFuture, t);
  if ((diff = d(diff, 30)) < 12) return fmt("datetime.months", diff, showQualifier, isFuture, t);
  return fmt("datetime.years", d(diff, 12), showQualifier, isFuture, t);
}

function d(n: number, interval: number): number {
  return Math.floor(n / interval);
}

function fmt(
  tag: string,
  count: number,
  showQualifier: boolean,
  isFuture: boolean,
  t: Translator
): string {
  const time = t(tag, { count });

  return showQualifier
    ? t(isFuture ? "datetime.relativeIn" : "datetime.relativeAgo", { time })
    : time;
}
