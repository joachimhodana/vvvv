//go:build cgo && !nocapture

package capture

import "fmt"

func firstLine(s string) string {
	for i, c := range s {
		if c == '\r' || c == '\n' {
			return s[:i]
		}
		if i > 120 {
			return s[:i] + "…"
		}
	}
	if len(s) > 120 {
		return s[:120] + "…"
	}
	return s
}

func toReadableText(b []byte) string {
	out := make([]byte, 0, len(b))
	for _, c := range b {
		if c == '\n' || c == '\r' || c == '\t' || (c >= 32 && c < 127) {
			out = append(out, c)
		} else {
			out = append(out, '.')
		}
	}
	return string(out)
}

func toHexDump(b []byte) string {
	var sb []byte
	for i := 0; i < len(b); i += 16 {
		end := i + 16
		if end > len(b) {
			end = len(b)
		}
		chunk := b[i:end]
		sb = append(sb, []byte(fmt.Sprintf("%04x  ", i))...)
		for j, c := range chunk {
			sb = append(sb, []byte(fmt.Sprintf("%02x ", c))...)
			if j == 7 {
				sb = append(sb, ' ')
			}
		}
		for j := len(chunk); j < 16; j++ {
			sb = append(sb, []byte("   ")...)
			if j == 7 {
				sb = append(sb, ' ')
			}
		}
		sb = append(sb, ' ')
		for _, c := range chunk {
			if c >= 32 && c < 127 {
				sb = append(sb, c)
			} else {
				sb = append(sb, '.')
			}
		}
		sb = append(sb, '\n')
	}
	return string(sb)
}

func formatFlags(flags []string) string {
	if len(flags) == 0 {
		return "[]"
	}
	return "[" + joinStrings(flags, ", ") + "]"
}

func joinStrings(parts []string, sep string) string {
	if len(parts) == 0 {
		return ""
	}
	out := parts[0]
	for i := 1; i < len(parts); i++ {
		out += sep + parts[i]
	}
	return out
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			line := s[start:i]
			if len(line) > 0 && line[len(line)-1] == '\r' {
				line = line[:len(line)-1]
			}
			lines = append(lines, line)
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func toLowerASCII(s string) string {
	b := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		b[i] = c
	}
	return string(b)
}

func containsSubstring(s, sub string) bool {
	if len(sub) > len(s) {
		return false
	}
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
