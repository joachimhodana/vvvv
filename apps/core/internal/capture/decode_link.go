//go:build cgo && !nocapture

package capture

import (
	"fmt"
	"net"

	"github.com/google/gopacket/layers"
)

func decodeLinkLayer(ctx *decodeContext) {
	if ethLayer := ctx.pkt.Layer(layers.LayerTypeEthernet); ethLayer != nil {
		eth := ethLayer.(*layers.Ethernet)
		ctx.addLayer("Ethernet", map[string]string{
			"Source":      eth.SrcMAC.String(),
			"Destination": eth.DstMAC.String(),
			"Type":        eth.EthernetType.String(),
		})
	}

	if arpLayer := ctx.pkt.Layer(layers.LayerTypeARP); arpLayer != nil {
		decodeARP(ctx, arpLayer.(*layers.ARP))
	}
}

func decodeARP(ctx *decodeContext, arp *layers.ARP) {
	srcIP := net.IP(arp.SourceProtAddress).String()
	dstIP := net.IP(arp.DstProtAddress).String()

	ctx.src = srcIP
	ctx.dst = dstIP
	ctx.srcIP = srcIP
	ctx.dstIP = dstIP
	ctx.proto = "ARP"

	ctx.addLayer("ARP", map[string]string{
		"Operation":  fmt.Sprint(arp.Operation),
		"Sender MAC": net.HardwareAddr(arp.SourceHwAddress).String(),
		"Sender IP":  srcIP,
		"Target MAC": net.HardwareAddr(arp.DstHwAddress).String(),
		"Target IP":  dstIP,
	})

	opStr := "request"
	if arp.Operation == 2 {
		opStr = "reply"
	}
	ctx.info = fmt.Sprintf("Who has %s? Tell %s (%s)", dstIP, srcIP, opStr)
	ctx.done = true
}
