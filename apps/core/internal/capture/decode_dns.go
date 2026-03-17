//go:build cgo && !nocapture

package capture

import (
	"fmt"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
)

func decodeDNS(ctx *decodeContext) {
	var dns *layers.DNS

	if l := ctx.pkt.Layer(layers.LayerTypeDNS); l != nil {
		dns = l.(*layers.DNS)
	} else if ctx.udpRef != nil && len(ctx.payload) > 12 {
		isDNSPort := ctx.udpRef.DstPort == 53 || ctx.udpRef.SrcPort == 53 ||
			ctx.udpRef.DstPort == 5353 || ctx.udpRef.SrcPort == 5353
		if isDNSPort {
			var d layers.DNS
			if d.DecodeFromBytes(ctx.payload, gopacket.NilDecodeFeedback) == nil {
				dns = &d
			}
		}
	}

	if dns == nil {
		return
	}

	ctx.proto = "DNS"
	if len(dns.Questions) > 0 {
		q := dns.Questions[0]
		prefix := "Standard query"
		if dns.QR {
			prefix = "Standard query response"
		}
		ctx.info = fmt.Sprintf("%s 0x%04x %s %s", prefix, dns.ID, q.Type, string(q.Name))
	}

	ctx.addLayer("DNS", map[string]string{
		"ID":          fmt.Sprintf("0x%04x", dns.ID),
		"QR":          fmt.Sprint(dns.QR),
		"Questions":   fmt.Sprint(len(dns.Questions)),
		"Answers":     fmt.Sprint(len(dns.Answers)),
		"Authorities": fmt.Sprint(len(dns.Authorities)),
		"Additionals": fmt.Sprint(len(dns.Additionals)),
	})

	// MDNS is DNS on port 5353
	if ctx.udpRef != nil && (ctx.udpRef.DstPort == 5353 || ctx.udpRef.SrcPort == 5353) {
		ctx.proto = "MDNS"
	}
}
