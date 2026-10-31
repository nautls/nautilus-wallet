# Chrome Web Store listing

Images and copy for the [Chrome Web Store listing](https://chromewebstore.google.com/detail/nautilus-wallet/gjlmehlldlphhljhpnlddaodbjjcchai).

## Images

The images are generated from the real extension, driven by the e2e mocks (`tests/e2e/mocks`), so
they can be regenerated after UI changes.

```sh
pnpm build:store-images
```

- `capture.spec.ts` drives the popup and connector windows in light and dark mode at 2x and saves
  raw captures to `out/raw/`.
- `compose.spec.ts` places them into branded frames and writes the upload-ready files to
  `out/store/`. All files are JPEG because the store rejects PNGs with an alpha channel.

| File                         | Store slot         | Size     |
| ---------------------------- | ------------------ | -------- |
| `screenshot-1-assets.jpg`    | Screenshot 1       | 1280x800 |
| `screenshot-2-send.jpg`      | Screenshot 2       | 1280x800 |
| `screenshot-3-connect.jpg`   | Screenshot 3       | 1280x800 |
| `screenshot-4-sign.jpg`      | Screenshot 4       | 1280x800 |
| `screenshot-5-wallets.jpg`   | Screenshot 5       | 1280x800 |
| `promo-small-440x280.jpg`    | Small promo tile   | 440x280  |
| `promo-marquee-1400x560.jpg` | Marquee promo tile | 1400x560 |

Token balances and prices are made up. The dApp (`tidepool.example`) is fictional.
