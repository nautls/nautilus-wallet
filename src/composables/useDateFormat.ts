import { DateFormatter, Translator } from "@/i18n";

export interface DateFormatOptions {
  t: Translator;
  d: DateFormatter;
  maxRelativeTime?: number;
  showRelativeTimeQualifier?: boolean;
}

type DateInput = Date | number | string;

const enum TimeUnit {
  Now = "now",
  Second = "seconds",
  Minute = "minutes",
  Hour = "hours",
  Day = "days",
  Month = "months",
  Year = "years"
}

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

export function formatRelativeTime(date: Date, useQualifier: boolean, t: DateFormatter): string {
  const now = new Date();
  const isFuture = date > now;
  let diff = Math.abs((date.getTime() - now.getTime()) / 1000);

  if (diff < 60) return t("datetime.now");
  if ((diff = d(diff, 60)) < 60) return fmt(TimeUnit.Minute, diff, useQualifier, isFuture, t);
  if ((diff = d(diff, 60)) < 24) return fmt(TimeUnit.Hour, diff, useQualifier, isFuture, t);
  if ((diff = d(diff, 24)) < 30) return fmt(TimeUnit.Day, diff, useQualifier, isFuture, t);
  if ((diff = d(diff, 30)) < 12) return fmt(TimeUnit.Month, diff, useQualifier, isFuture, t);
  return fmt(TimeUnit.Year, d(diff, 12), useQualifier, isFuture, t);
}

function d(n: number, interval: number): number {
  return Math.floor(n / interval);
}

function fmt(
  unit: TimeUnit,
  count: number,
  useQualifier: boolean,
  isFuture: boolean,
  t: Translator
): string {
  return useQualifier
    ? t(isFuture ? `datetime.relative.future.${unit}` : `datetime.relative.past.${unit}`, { count })
    : t(`datetime.${unit}`, { count });
}
