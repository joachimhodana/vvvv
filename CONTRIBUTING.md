# Contributing

Thanks for your interest in contributing to **vvvv**.

## Quick start

- **Requirements**: Go 1.22+, Bun, and libpcap (macOS preinstalled; Linux: `libpcap-dev`)
- **Install deps**:
  - `bun install`
- **Run (dev)**:
  - Core: `cd apps/core && sudo go run ./cmd/vvvv`
  - Web: `cd apps/web && bun dev`

## Development workflow

### Branches

- Create a feature branch from `main`.
- Keep changes focused and small when possible (one logical change per PR).

### Checks

Before opening a PR, please run:

- **Core**: `cd apps/core && go test ./...`
- **Web**:
  - `cd apps/web && bun format .`
  - `cd apps/web && bun lint`
  - `cd apps/web && bun test:types`
  - `cd apps/web && bun test`

## Coding guidelines

- **Prefer clarity over cleverness**.
- Keep public APIs stable (especially JSON payload shapes).
- Avoid committing build artifacts (e.g. `*.tsbuildinfo`, `.next/`).

## Reporting issues

Please include:

- OS + architecture
- how you ran core (root/admin or not)
- a short repro and any logs

## Security

If you believe you found a security issue, please do not open a public issue.
Contact the maintainer privately.

