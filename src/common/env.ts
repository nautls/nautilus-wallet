export function target(t: "mobile" | "browser") {
  const { TARGET } = import.meta.env;
  if (t === "browser" && (TARGET === "chrome" || TARGET === "firefox")) return true;
  if (t === "mobile" && (TARGET === "ios" || TARGET === "android")) return true;
  return false;
}
