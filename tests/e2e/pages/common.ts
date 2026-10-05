import type { Locator, Page } from "@playwright/test";

/** Toast notification containing `title`. */
export function toast(page: Page, title: string | RegExp): Locator {
  return page.locator("ol > li").filter({ hasText: title }).first();
}
