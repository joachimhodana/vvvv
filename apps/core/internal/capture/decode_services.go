//go:build cgo && !nocapture

package capture

import (
	"fmt"

	"github.com/google/gopacket/layers"
)

// decodeServices handles DHCP, SSH, SMTP, FTP, IMAP, POP3, NTP, SSDP,
// and falls back to port-based protocol hinting for unidentified TCP/UDP.
func decodeServices(ctx *decodeContext) {
	decodeDHCP(ctx)
	decodeSSH(ctx)
	decodeSMTP(ctx)
	decodeFTP(ctx)
	decodeIMAP(ctx)
	decodePOP3(ctx)
	decodeNTP(ctx)
	decodeSSD(ctx)
	hintProtocolByPort(ctx)
}

func decodeDHCP(ctx *decodeContext) {
	if ctx.udpRef == nil {
		return
	}
	p := ctx.udpRef
	if p.SrcPort != 67 && p.SrcPort != 68 && p.DstPort != 67 && p.DstPort != 68 {
		return
	}
	if dhcpLayer := ctx.pkt.Layer(layers.LayerTypeDHCPv4); dhcpLayer != nil {
		dhcp := dhcpLayer.(*layers.DHCPv4)
		ctx.proto = "DHCP"
		ctx.info = fmt.Sprintf("DHCP %s XID=0x%08x", dhcp.Operation, dhcp.Xid)
		ctx.addLayer("DHCP", map[string]string{
			"Operation":  fmt.Sprint(dhcp.Operation),
			"Client MAC": dhcp.ClientHWAddr.String(),
			"Client IP":  dhcp.ClientIP.String(),
			"Your IP":    dhcp.YourClientIP.String(),
			"Server IP":  dhcp.NextServerIP.String(),
			"XID":        fmt.Sprintf("0x%08x", dhcp.Xid),
		})
	}
}

func decodeSSH(ctx *decodeContext) {
	if ctx.tcpRef == nil || len(ctx.payload) < 4 {
		return
	}
	if string(ctx.payload[:4]) == "SSH-" {
		ctx.proto = "SSH"
		ctx.info = firstLine(string(ctx.payload))
		ctx.addLayer("SSH", map[string]string{
			"Banner": firstLine(string(ctx.payload)),
		})
	}
}

func decodeSMTP(ctx *decodeContext) {
	if ctx.tcpRef == nil || ctx.proto != "TCP" || len(ctx.payload) == 0 {
		return
	}
	p := ctx.tcpRef
	if p.DstPort == 25 || p.DstPort == 465 || p.DstPort == 587 ||
		p.SrcPort == 25 || p.SrcPort == 465 || p.SrcPort == 587 {
		ctx.proto = "SMTP"
		ctx.info = firstLine(string(ctx.payload))
		ctx.addLayer("SMTP", map[string]string{
			"Command/Reply": firstLine(string(ctx.payload)),
		})
	}
}

func decodeFTP(ctx *decodeContext) {
	if ctx.tcpRef == nil || ctx.proto != "TCP" || len(ctx.payload) == 0 {
		return
	}
	if ctx.tcpRef.DstPort == 21 || ctx.tcpRef.SrcPort == 21 {
		ctx.proto = "FTP"
		ctx.info = firstLine(string(ctx.payload))
		ctx.addLayer("FTP", map[string]string{
			"Command/Reply": firstLine(string(ctx.payload)),
		})
	}
}

func decodeIMAP(ctx *decodeContext) {
	if ctx.tcpRef == nil || ctx.proto != "TCP" || len(ctx.payload) == 0 {
		return
	}
	p := ctx.tcpRef
	if p.DstPort == 143 || p.DstPort == 993 || p.SrcPort == 143 || p.SrcPort == 993 {
		ctx.proto = "IMAP"
		ctx.info = firstLine(string(ctx.payload))
	}
}

func decodePOP3(ctx *decodeContext) {
	if ctx.tcpRef == nil || ctx.proto != "TCP" || len(ctx.payload) == 0 {
		return
	}
	p := ctx.tcpRef
	if p.DstPort == 110 || p.DstPort == 995 || p.SrcPort == 110 || p.SrcPort == 995 {
		ctx.proto = "POP3"
		ctx.info = firstLine(string(ctx.payload))
	}
}

func decodeNTP(ctx *decodeContext) {
	if ctx.udpRef == nil {
		return
	}
	if ctx.udpRef.SrcPort != 123 && ctx.udpRef.DstPort != 123 {
		return
	}
	if ntpLayer := ctx.pkt.Layer(layers.LayerTypeNTP); ntpLayer != nil {
		ntp := ntpLayer.(*layers.NTP)
		ctx.proto = "NTP"
		ctx.info = fmt.Sprintf("NTP Version %d Stratum %d", ntp.Version, ntp.Stratum)
		ctx.addLayer("NTP", map[string]string{
			"Version":   fmt.Sprint(ntp.Version),
			"Stratum":   fmt.Sprint(ntp.Stratum),
			"Poll":      fmt.Sprint(ntp.Poll),
			"Precision": fmt.Sprint(ntp.Precision),
		})
	}
}

func decodeSSD(ctx *decodeContext) {
	if ctx.udpRef == nil || len(ctx.payload) == 0 {
		return
	}
	if ctx.udpRef.DstPort == 1900 || ctx.udpRef.SrcPort == 1900 {
		ctx.proto = "SSDP"
		ctx.info = firstLine(string(ctx.payload))
	}
}

// hintProtocolByPort assigns protocol names based on well-known ports
// when no higher-level decoder has identified the application protocol.
func hintProtocolByPort(ctx *decodeContext) {
	// Only hint application protocols when there is payload data.
	// Without payload (e.g. SYN/SYN-ACK/ACK), port-based guesses are misleading.
	if ctx.tcpRef != nil && ctx.proto == "TCP" && (len(ctx.payload) > 0 || len(ctx.reassembled) > 0) {
		srcP := uint16(ctx.tcpRef.SrcPort)
		dstP := uint16(ctx.tcpRef.DstPort)
		switch {
		case srcP == 80 || dstP == 80:
			ctx.proto = "HTTP"
		case srcP == 443 || dstP == 443:
			ctx.proto = "HTTPS"
		case srcP == 8080 || dstP == 8080 || srcP == 8443 || dstP == 8443:
			ctx.proto = "HTTP"
		case srcP == 22 || dstP == 22:
			ctx.proto = "SSH"
		case srcP == 25 || dstP == 25 || srcP == 465 || dstP == 465 || srcP == 587 || dstP == 587:
			ctx.proto = "SMTP"
		case srcP == 21 || dstP == 21:
			ctx.proto = "FTP"
		case srcP == 143 || dstP == 143 || srcP == 993 || dstP == 993:
			ctx.proto = "IMAP"
		case srcP == 110 || dstP == 110 || srcP == 995 || dstP == 995:
			ctx.proto = "POP3"
		case srcP == 3306 || dstP == 3306:
			ctx.proto = "MySQL"
		case srcP == 5432 || dstP == 5432:
			ctx.proto = "PostgreSQL"
		case srcP == 6379 || dstP == 6379:
			ctx.proto = "Redis"
		case srcP == 27017 || dstP == 27017:
			ctx.proto = "MongoDB"
		}
	}
}
