//go:build cgo && !nocapture

package capture

import (
	"fmt"

	"github.com/google/gopacket/layers"
)

func decodeNetworkLayer(ctx *decodeContext) {
	network := ctx.pkt.NetworkLayer()
	if network != nil {
		switch n := network.(type) {
		case *layers.IPv4:
			ctx.srcIP = n.SrcIP.String()
			ctx.dstIP = n.DstIP.String()
			ctx.src = ctx.srcIP
			ctx.dst = ctx.dstIP
			ctx.addLayer("IPv4", map[string]string{
				"Source":       n.SrcIP.String(),
				"Destination":  n.DstIP.String(),
				"Version":      fmt.Sprint(n.Version),
				"TTL":          fmt.Sprint(n.TTL),
				"Protocol":     n.Protocol.String(),
				"Total Length": fmt.Sprint(n.Length),
				"ID":           fmt.Sprintf("0x%04x", n.Id),
			})
		case *layers.IPv6:
			ctx.srcIP = n.SrcIP.String()
			ctx.dstIP = n.DstIP.String()
			ctx.src = ctx.srcIP
			ctx.dst = ctx.dstIP
			ctx.addLayer("IPv6", map[string]string{
				"Source":         n.SrcIP.String(),
				"Destination":   n.DstIP.String(),
				"Version":       fmt.Sprint(n.Version),
				"Hop Limit":     fmt.Sprint(n.HopLimit),
				"Next Header":   n.NextHeader.String(),
				"Flow Label":    fmt.Sprint(n.FlowLabel),
				"Payload Length": fmt.Sprint(n.Length),
			})
		}
	}

	decodeICMP(ctx)
}

func decodeICMP(ctx *decodeContext) {
	if icmpLayer := ctx.pkt.Layer(layers.LayerTypeICMPv4); icmpLayer != nil {
		icmp := icmpLayer.(*layers.ICMPv4)
		ctx.addLayer("ICMPv4", map[string]string{
			"Type":     fmt.Sprint(icmp.TypeCode.Type()),
			"Code":     fmt.Sprint(icmp.TypeCode.Code()),
			"Checksum": fmt.Sprintf("0x%04x", icmp.Checksum),
			"ID":       fmt.Sprint(icmp.Id),
			"Seq":      fmt.Sprint(icmp.Seq),
		})
		ctx.proto = "ICMP"
		ctx.info = fmt.Sprintf("Type=%d Code=%d id=0x%04x seq=%d",
			icmp.TypeCode.Type(), icmp.TypeCode.Code(), icmp.Id, icmp.Seq)
		ctx.done = true
		return
	}

	if icmp6Layer := ctx.pkt.Layer(layers.LayerTypeICMPv6); icmp6Layer != nil {
		icmp6 := icmp6Layer.(*layers.ICMPv6)
		ctx.addLayer("ICMPv6", map[string]string{
			"Type":     fmt.Sprint(icmp6.TypeCode.Type()),
			"Code":     fmt.Sprint(icmp6.TypeCode.Code()),
			"Checksum": fmt.Sprintf("0x%04x", icmp6.Checksum),
		})
		ctx.proto = "ICMPv6"
		ctx.info = fmt.Sprintf("Type=%d Code=%d", icmp6.TypeCode.Type(), icmp6.TypeCode.Code())
		ctx.done = true
	}
}
