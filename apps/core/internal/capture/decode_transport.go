//go:build cgo && !nocapture

package capture

import (
	"fmt"
	"net"

	"github.com/google/gopacket/layers"
)

func decodeTransportLayer(ctx *decodeContext) {
	transport := ctx.pkt.TransportLayer()
	if transport == nil {
		return
	}

	switch t := transport.(type) {
	case *layers.TCP:
		ctx.tcpRef = t
		ctx.src = net.JoinHostPort(ctx.src, fmt.Sprint(t.SrcPort))
		ctx.dst = net.JoinHostPort(ctx.dst, fmt.Sprint(t.DstPort))
		ctx.proto = "TCP"
		flags := tcpFlags(t)
		ctx.info = fmt.Sprintf("%s → %s %s Seq=%d Ack=%d Win=%d Len=%d",
			fmt.Sprint(t.SrcPort), fmt.Sprint(t.DstPort),
			formatFlags(flags), t.Seq, t.Ack, t.Window, len(t.Payload))
		ctx.payload = t.Payload
		ctx.addLayer("TCP", map[string]string{
			"Source Port":      fmt.Sprint(t.SrcPort),
			"Destination Port": fmt.Sprint(t.DstPort),
			"Sequence":         fmt.Sprint(t.Seq),
			"Acknowledgment":   fmt.Sprint(t.Ack),
			"Window":           fmt.Sprint(t.Window),
			"Flags":            formatFlags(flags),
			"Payload Length":   fmt.Sprint(len(t.Payload)),
			"Checksum":         fmt.Sprintf("0x%04x", t.Checksum),
		})

	case *layers.UDP:
		ctx.udpRef = t
		ctx.src = net.JoinHostPort(ctx.src, fmt.Sprint(t.SrcPort))
		ctx.dst = net.JoinHostPort(ctx.dst, fmt.Sprint(t.DstPort))
		ctx.proto = "UDP"
		ctx.info = fmt.Sprintf("%s → %s Len=%d",
			fmt.Sprint(t.SrcPort), fmt.Sprint(t.DstPort), len(t.Payload))
		ctx.payload = t.Payload
		ctx.addLayer("UDP", map[string]string{
			"Source Port":      fmt.Sprint(t.SrcPort),
			"Destination Port": fmt.Sprint(t.DstPort),
			"Length":           fmt.Sprint(t.Length),
			"Checksum":         fmt.Sprintf("0x%04x", t.Checksum),
		})
	}
}

func tcpFlags(t *layers.TCP) []string {
	var flags []string
	if t.SYN {
		flags = append(flags, "SYN")
	}
	if t.ACK {
		flags = append(flags, "ACK")
	}
	if t.FIN {
		flags = append(flags, "FIN")
	}
	if t.RST {
		flags = append(flags, "RST")
	}
	if t.PSH {
		flags = append(flags, "PSH")
	}
	if t.URG {
		flags = append(flags, "URG")
	}
	return flags
}
