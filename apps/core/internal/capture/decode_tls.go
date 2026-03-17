//go:build cgo && !nocapture

package capture

import (
	"fmt"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
)

func decodeTLS(ctx *decodeContext) {
	var tls *layers.TLS

	if l := ctx.pkt.Layer(layers.LayerTypeTLS); l != nil {
		tls = l.(*layers.TLS)
	} else if ctx.tcpRef != nil && len(ctx.payload) >= 5 && isTLSContentType(ctx.payload[0]) {
		var t layers.TLS
		if t.DecodeFromBytes(ctx.payload, gopacket.NilDecodeFeedback) == nil {
			tls = &t
		}
	}

	if tls == nil {
		return
	}

	ctx.proto = "TLS"
	switch {
	case len(tls.ChangeCipherSpec) > 0:
		ctx.info = "Change Cipher Spec"
	case len(tls.Handshake) > 0:
		ctx.info = "Handshake"
	case len(tls.AppData) > 0:
		ctx.info = fmt.Sprintf("Application Data [%d bytes]", len(tls.AppData))
	case len(tls.Alert) > 0:
		ctx.info = "Alert"
	}

	ctx.addLayer("TLS", map[string]string{
		"Handshake Records":        fmt.Sprint(len(tls.Handshake)),
		"ChangeCipherSpec Records": fmt.Sprint(len(tls.ChangeCipherSpec)),
		"AppData Records":          fmt.Sprint(len(tls.AppData)),
		"Alert Records":            fmt.Sprint(len(tls.Alert)),
	})
}

func isTLSContentType(b byte) bool {
	return b >= 0x14 && b <= 0x17
}
