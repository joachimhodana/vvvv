//go:build cgo && !nocapture && windows

package main

// Windows capture privilege checks are environment-dependent (Npcap, service permissions).
// We rely on runtime capture errors to guide the user.
func requireCapturePrivileges() {}

