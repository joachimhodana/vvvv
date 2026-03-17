//go:build cgo && !nocapture && !windows

package main

import (
	"log"
	"os"
)

func requireCapturePrivileges() {
	// Capture requires elevated privileges on most systems (libpcap/BPF access).
	// Fail fast so the UI doesn't appear "broken" when run unprivileged.
	if os.Geteuid() != 0 {
		log.Fatalf("vvvv core requires root privileges for packet capture. Re-run with sudo.")
	}
}

