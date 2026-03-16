## vvvv web

Next.js + React + TypeScript frontend for the vvvv core.

### Behavior (stub)

- Attempts to connect to `ws://127.0.0.1:9194/events` from the browser.
- If connected, renders a virtualized list of incoming events.
- If the core is not running, shows a \"core not detected\" status.

### Development

```bash
cd apps/web
bun install
bun dev
```

