package privileges

import "testing"

func TestRequireCapturePrivileges_NonRootReturnsError(t *testing.T) {
	orig := geteuid
	geteuid = func() int { return 1 }
	t.Cleanup(func() { geteuid = orig })

	if err := RequireCapturePrivileges(); err == nil {
		t.Fatalf("expected error, got nil")
	}
}

func TestRequireCapturePrivileges_RootReturnsNil(t *testing.T) {
	orig := geteuid
	geteuid = func() int { return 0 }
	t.Cleanup(func() { geteuid = orig })

	if err := RequireCapturePrivileges(); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}

