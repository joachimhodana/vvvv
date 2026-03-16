## vvvv core

Go service that will eventually listen on network interfaces, decode protocols, expose a local HTTP API, and stream events via WebSocket.

### Endpoints (stub)

- `GET /health` – returns `{ "status": "ok" }`.
- `GET /events` – upgrades to a WebSocket and streams dummy packet-like events in JSON.

### Development

```bash
cd apps/core
go run ./cmd/vvvv
```

