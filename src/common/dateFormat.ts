import dayjs, { isDayjs, type Dayjs } from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export interface DateFormatOptions {
  maxRelativeTime?: number;
  suffixRelativeTime?: boolean;
}

export function formatDate(date: Dayjs | Date | number, opt?: DateFormatOptions): string {
  if (!isDayjs(date)) {
    date = dayjs(date);
  }

  if (
    opt?.maxRelativeTime !== undefined &&
    opt.maxRelativeTime > 0 &&
    date.isBefore(dayjs().add(opt.maxRelativeTime * -1))
  ) {
    return date.format("MMMM D, YYYY");
  }

  return date.fromNow(opt?.suffixRelativeTime === undefined ? false : !opt.suffixRelativeTime);
}
