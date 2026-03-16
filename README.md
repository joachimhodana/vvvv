<img src="static/images/banner.png" alt="Banner" width="100%">

## vvvv – modern network protocol analyzer

This repo is a Turborepo monorepo for **vvvv**, a modern replacement for Wireshark composed of:

- `apps/core` – Go service that listens on ports, decodes protocols, exposes a local HTTP API, and streams events over WebSocket.
- `apps/web` – Next.js + React + TypeScript web UI (served at `https://vvvv.joachimhodana.com`) that connects to the local core over WebSocket.
- `packages/*` – shared configuration and future CLI/bootstrap packages.

### Tech stack

- Bun (package manager and script runner)
- Turborepo (monorepo orchestration)
- Go (core)
- Next.js + React + TypeScript + TailwindCSS + Zustand + TanStack Virtual + TanStack Hotkeys (web)

### Getting started (conceptual)

1. Install **Go** and **Bun**.
2. Install JS dependencies:
   - `bun install`
3. Run dev servers (after apps are scaffolded):
   - Core: `bunx turbo dev --filter=core`
   - Web: `bunx turbo dev --filter=web`