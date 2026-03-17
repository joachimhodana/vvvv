//go:build cgo && !nocapture && !windows

package privileges

import (
	"errors"
	"os"
)

var ErrNeedsRoot = errors.New("vvvv core requires root privileges for packet capture. Re-run with sudo")

var geteuid = os.Geteuid

func RequireCapturePrivileges() error {
	if geteuid() != 0 {
		return ErrNeedsRoot
	}
	return nil
}

