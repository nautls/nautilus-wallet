import { expect, test } from "../fixtures/test";
import { DAPP_ORIGIN } from "../mocks/services";

const ATTACKER_ORIGIN = "https://attacker.test";
// RPC_NAMESPACE from src/extension/connector/rpc/protocol.ts, scoped to the framed dApp
const SCOPE = `0e689455-8013-478d-827e-13e96888576a/${DAPP_ORIGIN}`;

/**
 * The framed dApp holds back its own port offer, so the attacker's offers are the
 * first the content script sees, as if the attacker had won the race against
 * `injected.js`. `offerOwnPort()` sends the held-back offer later.
 */
const VICTIM_HTML = `<!doctype html><html><head><script>
  const post = window.postMessage.bind(window);
  window.postMessage = (msg, ...rest) => {
    if (msg?.cmd === "webext-port-offer") return void (window.held = [msg, ...rest]);
    return post(msg, ...rest);
  };
  window.offerOwnPort = () => new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => resolve(e.data === "port-accepted" ? "accepted" : e.data);
    post({ ...window.held[0] }, "*", [ch.port2]);
    setTimeout(() => resolve("ignored"), 2000);
  });
</script></head><body>victim</body></html>`;

const ATTACKER_HTML = `<!doctype html><html><body>
  <iframe id="victim" src="${DAPP_ORIGIN}/victim"></iframe>
  <script>
    // offers a port to the framed dApp every 50ms and reports whether any was taken
    window.hijack = () => new Promise((resolve) => {
      const target = document.getElementById("victim").contentWindow;
      const timer = setInterval(() => {
        const ch = new MessageChannel();
        ch.port1.onmessage = (e) => {
          if (e.data !== "port-accepted") return;
          clearInterval(timer);
          resolve("accepted");
        };
        target.postMessage(
          { cmd: "webext-port-offer", scope: ${JSON.stringify(SCOPE)}, context: "window" },
          "*",
          [ch.port2]
        );
      }, 50);
      setTimeout(() => { clearInterval(timer); resolve("ignored"); }, 2000);
    });
  </script>
</body></html>`;

test.describe("content script messaging port", () => {
  test("ignores port offers from other windows", async ({ context }) => {
    await context.route(`${ATTACKER_ORIGIN}/**`, (route) =>
      route.fulfill({ contentType: "text/html", body: ATTACKER_HTML })
    );
    await context.route(`${DAPP_ORIGIN}/victim`, (route) =>
      route.fulfill({ contentType: "text/html", body: VICTIM_HTML })
    );

    const page = await context.newPage();
    await page.goto(ATTACKER_ORIGIN);
    const victim = page.frameLocator("#victim");
    await expect(victim.locator("body")).toHaveText("victim");
    const frame = page.frames().find((f) => f.url() === `${DAPP_ORIGIN}/victim`)!;
    await frame.waitForFunction(() => (window as unknown as { held?: unknown }).held !== undefined);

    expect(
      await page.evaluate(() => (window as unknown as { hijack(): Promise<string> }).hijack())
    ).toBe("ignored");

    // the content script was still waiting for a port: the dApp's own offer is taken
    expect(
      await frame.evaluate(() =>
        (window as unknown as { offerOwnPort(): Promise<string> }).offerOwnPort()
      )
    ).toBe("accepted");
  });
});
