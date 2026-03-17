//go:build cgo && !nocapture

package capture

import "fmt"

// decodeHTTP detects HTTP, WebSocket upgrades, and SSE responses
// from TCP payload. Uses both the current segment and reassembled buffer.
func decodeHTTP(ctx *decodeContext) {
	if ctx.proto != "TCP" {
		return
	}
	if len(ctx.payload) == 0 && len(ctx.reassembled) == 0 {
		return
	}

	httpBuf := string(ctx.payload)
	isReassembled := false
	if !isHTTPRequest(httpBuf) && !isHTTPResponse(httpBuf) && len(ctx.reassembled) > 0 {
		httpBuf = string(ctx.reassembled)
		isReassembled = true
	}

	if !isHTTPRequest(httpBuf) && !isHTTPResponse(httpBuf) {
		return
	}

	ctx.proto = "HTTP"
	line := firstLine(httpBuf)
	fields := map[string]string{
		"Request/Status Line": line,
		"Payload Length":      fmt.Sprint(len(ctx.payload)),
	}
	if isReassembled {
		fields["Reassembled Length"] = fmt.Sprint(len(ctx.reassembled))
		fields["Reassembled"] = "true"
	}

	headers := parseHTTPHeaders(httpBuf)
	for k, v := range headers {
		fields[k] = v
	}

	if isWebSocketUpgrade(headers) {
		ctx.proto = "WebSocket"
		fields["Upgrade"] = "websocket"
	}
	if isSSEResponse(headers) {
		ctx.proto = "SSE"
		fields["Content-Type"] = "text/event-stream"
	}

	if host, ok := headers["Host"]; ok {
		ctx.info = line + " [" + host + "]"
	} else {
		ctx.info = line
	}

	ctx.addLayer(ctx.proto, fields)
}

func isHTTPRequest(p string) bool {
	methods := []string{
		"GET ", "POST ", "PUT ", "DELETE ", "PATCH ",
		"HEAD ", "OPTIONS ", "CONNECT ", "TRACE ",
	}
	for _, m := range methods {
		if len(p) >= len(m) && p[:len(m)] == m {
			return true
		}
	}
	return false
}

func isHTTPResponse(p string) bool {
	return len(p) >= 5 && p[:5] == "HTTP/"
}

func isWebSocketUpgrade(headers map[string]string) bool {
	for k, v := range headers {
		kl := toLowerASCII(k)
		vl := toLowerASCII(v)
		if kl == "upgrade" && vl == "websocket" {
			return true
		}
		if kl == "connection" && containsSubstring(vl, "upgrade") {
			if up, ok := headers["Upgrade"]; ok && toLowerASCII(up) == "websocket" {
				return true
			}
		}
	}
	return false
}

func isSSEResponse(headers map[string]string) bool {
	for k, v := range headers {
		if toLowerASCII(k) == "content-type" && containsSubstring(toLowerASCII(v), "text/event-stream") {
			return true
		}
	}
	return false
}

func parseHTTPHeaders(payload string) map[string]string {
	headers := make(map[string]string)
	lines := splitLines(payload)
	for i := 1; i < len(lines); i++ {
		line := lines[i]
		if line == "" {
			break
		}
		idx := 0
		for idx < len(line) && line[idx] != ':' {
			idx++
		}
		if idx < len(line) {
			key := line[:idx]
			val := line[idx+1:]
			if len(val) > 0 && val[0] == ' ' {
				val = val[1:]
			}
			if len(val) > 200 {
				val = val[:200] + "…"
			}
			headers[key] = val
		}
	}
	return headers
}
