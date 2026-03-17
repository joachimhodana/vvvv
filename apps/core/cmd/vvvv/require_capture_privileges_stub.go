//go:build !cgo || nocapture

package main

// When capture is not supported in this build, no privileges are required.
func requireCapturePrivileges() {}

