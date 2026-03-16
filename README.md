<img src="static/images/banner.png" alt="vvvv" width="100%">

# vvvv

A modern, web-based network protocol analyzer. Think Wireshark - but in your browser.

## Architecture

| App | Description |
|---|---|
| **`apps/core`** | Go service - captures packets via libpcap, decodes protocols, and streams events over WebSocket. |
| **`apps/web`** | Next.js dashboard at [vvvv.joachimhodana.com](https://vvvv.joachimhodana.com) - real-time packet table, filtering, and deep inspection. |
| **`packages/*`** | Shared configuration and tooling. |

## Supported Protocols

ARP · ICMP · ICMPv6 · TCP · UDP · DNS · MDNS · TLS · HTTP · DHCP · SSH · SMTP · FTP · IMAP · POP3 · NTP · SSDP

## Tech Stack

- **Core** - Go, gopacket / libpcap
- **Web** - Next.js, React, TypeScript, Tailwind CSS, Zustand, TanStack Virtual
- **Tooling** - Bun, Turborepo

## Getting Started

### Prerequisites

- [Go](https://go.dev) 1.22+
- [Bun](https://bun.sh)
- libpcap (pre-installed on macOS; `apt install libpcap-dev` on Linux)

### Install & Run

```bash
# install JS dependencies
bun install

# start the Go capture core
cd apps/core && sudo go run ./cmd/vvvv # you need to run as root to capture packets

# start the web UI (separate terminal)
bun dev
```

### Running Tests

```bash
# Go tests (requires cgo + libpcap)
cd apps/core && go test ./...
```

## License

Proprietary - all rights reserved.
