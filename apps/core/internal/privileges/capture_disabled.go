//go:build !cgo || nocapture

package privileges

// When capture is not supported in this build, no privileges are required.
func RequireCapturePrivileges() error { return nil }

// For tests and other packages, provide a consistent symbol even when this file is active.
var geteuid = func() int { return 0 }

