//go:build cgo && !nocapture && windows

package privileges

// Windows capture privilege checks are environment-dependent (Npcap driver/service setup).
// We rely on runtime capture errors to guide the user.
func RequireCapturePrivileges() error { return nil }

