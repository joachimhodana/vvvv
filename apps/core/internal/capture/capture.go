//go:build cgo && !nocapture

package capture

import (
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
)

type LayerInfo struct {
	Name   string            `json:"name"`
	Fields map[string]string `json:"fields"`
}

type PacketEvent struct {
	No        int         `json:"no"`
	ID        string      `json:"id"`
	Timestamp time.Time   `json:"timestamp"`
	Protocol  string      `json:"protocol"`
	Source    string      `json:"source"`
	Dest      string      `json:"dest"`
	Direction string      `json:"direction"`
	Length    int         `json:"length"`
	Info      string      `json:"info"`
	Layers    []LayerInfo `json:"layers"`
	Payload   string      `json:"payload,omitempty"`
}

type Interface struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type Manager struct {
	mu       sync.RWMutex
	handle   *pcap.Handle
	running  bool
	seq      int
	outCh    chan PacketEvent
	localIPs map[string]bool
}

func NewManager(outCh chan PacketEvent) *Manager {
	return &Manager{
		outCh:    outCh,
		seq:      1,
		localIPs: collectLocalIPs(),
	}
}

func collectLocalIPs() map[string]bool {
	ips := make(map[string]bool)
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ips
	}
	for _, addr := range addrs {
		if ipNet, ok := addr.(*net.IPNet); ok {
			ips[ipNet.IP.String()] = true
		}
	}
	return ips
}

func (m *Manager) ListInterfaces() ([]Interface, error) {
	devs, err := pcap.FindAllDevs()
	if err != nil {
		return nil, err
	}
	ifaces := make([]Interface, 0, len(devs))
	for _, d := range devs {
		ifaces = append(ifaces, Interface{
			Name:        d.Name,
			Description: d.Description,
		})
	}
	return ifaces, nil
}

type StartOptions struct {
	Device string `json:"device"`
	Filter string `json:"filter"`
}

func (m *Manager) Start(opts StartOptions) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.running {
		return nil
	}
	if opts.Device == "" {
		return fmt.Errorf("device is required")
	}

	handle, err := pcap.OpenLive(opts.Device, 65535, true, 10*time.Millisecond)
	if err != nil {
		return err
	}
	if opts.Filter != "" {
		if err := handle.SetBPFFilter(opts.Filter); err != nil {
			handle.Close()
			return err
		}
	}

	m.handle = handle
	m.running = true

	go m.loop()
	return nil
}

func (m *Manager) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.running {
		return
	}
	m.running = false
	if m.handle != nil {
		m.handle.Close()
		m.handle = nil
	}
}

func (m *Manager) Status() map[string]any {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return map[string]any{
		"running": m.running,
	}
}

func (m *Manager) loop() {
	m.mu.RLock()
	handle := m.handle
	m.mu.RUnlock()
	if handle == nil {
		return
	}

	source := gopacket.NewPacketSource(handle, handle.LinkType())
	for packet := range source.Packets() {
		m.mu.RLock()
		if !m.running {
			m.mu.RUnlock()
			return
		}
		m.mu.RUnlock()

		ev := m.buildEvent(packet)
		select {
		case m.outCh <- ev:
		default:
			// drop if slow consumer; this is just initial implementation
		}
	}
}

func (m *Manager) buildEvent(pkt gopacket.Packet) PacketEvent {
	m.mu.Lock()
	no := m.seq
	m.seq++
	m.mu.Unlock()

	network := pkt.NetworkLayer()
	transport := pkt.TransportLayer()

	var src, dst, srcIP, dstIP string
	var pktLayers []LayerInfo

	// --- Link layer ---
	if ethLayer := pkt.Layer(layers.LayerTypeEthernet); ethLayer != nil {
		eth := ethLayer.(*layers.Ethernet)
		pktLayers = append(pktLayers, LayerInfo{
			Name: "Ethernet",
			Fields: map[string]string{
				"Source":      eth.SrcMAC.String(),
				"Destination": eth.DstMAC.String(),
				"Type":        eth.EthernetType.String(),
			},
		})
	}

	if arpLayer := pkt.Layer(layers.LayerTypeARP); arpLayer != nil {
		arp := arpLayer.(*layers.ARP)
		srcIP := net.IP(arp.SourceProtAddress).String()
		dstIP := net.IP(arp.DstProtAddress).String()
		src = srcIP
		dst = dstIP
		pktLayers = append(pktLayers, LayerInfo{
			Name: "ARP",
			Fields: map[string]string{
				"Operation":  fmt.Sprint(arp.Operation),
				"Sender MAC": net.HardwareAddr(arp.SourceHwAddress).String(),
				"Sender IP":  srcIP,
				"Target MAC": net.HardwareAddr(arp.DstHwAddress).String(),
				"Target IP":  dstIP,
			},
		})
		opStr := "request"
		if arp.Operation == 2 {
			opStr = "reply"
		}
		return PacketEvent{
			No: no, ID: fmtID(no), Timestamp: pkt.Metadata().Timestamp,
			Protocol: "ARP", Source: srcIP, Dest: dstIP,
			Direction: m.direction(srcIP, dstIP),
			Length: len(pkt.Data()),
			Info:   fmt.Sprintf("Who has %s? Tell %s (%s)", dstIP, srcIP, opStr),
			Layers: pktLayers,
		}
	}

	// --- Network layer ---
	if network != nil {
		switch n := network.(type) {
		case *layers.IPv4:
			srcIP = n.SrcIP.String()
			dstIP = n.DstIP.String()
			src = srcIP
			dst = dstIP
			pktLayers = append(pktLayers, LayerInfo{
				Name: "IPv4",
				Fields: map[string]string{
					"Source":      n.SrcIP.String(),
					"Destination": n.DstIP.String(),
					"Version":     fmt.Sprint(n.Version),
					"TTL":         fmt.Sprint(n.TTL),
					"Protocol":    n.Protocol.String(),
					"Total Length": fmt.Sprint(n.Length),
					"ID":          fmt.Sprintf("0x%04x", n.Id),
				},
			})
		case *layers.IPv6:
			srcIP = n.SrcIP.String()
			dstIP = n.DstIP.String()
			src = srcIP
			dst = dstIP
			pktLayers = append(pktLayers, LayerInfo{
				Name: "IPv6",
				Fields: map[string]string{
					"Source":       n.SrcIP.String(),
					"Destination":  n.DstIP.String(),
					"Version":      fmt.Sprint(n.Version),
					"Hop Limit":    fmt.Sprint(n.HopLimit),
					"Next Header":  n.NextHeader.String(),
					"Flow Label":   fmt.Sprint(n.FlowLabel),
					"Payload Length": fmt.Sprint(n.Length),
				},
			})
		}
	}

	// --- ICMP ---
	if icmpLayer := pkt.Layer(layers.LayerTypeICMPv4); icmpLayer != nil {
		icmp := icmpLayer.(*layers.ICMPv4)
		pktLayers = append(pktLayers, LayerInfo{
			Name: "ICMPv4",
			Fields: map[string]string{
				"Type":     fmt.Sprint(icmp.TypeCode.Type()),
				"Code":     fmt.Sprint(icmp.TypeCode.Code()),
				"Checksum": fmt.Sprintf("0x%04x", icmp.Checksum),
				"ID":       fmt.Sprint(icmp.Id),
				"Seq":      fmt.Sprint(icmp.Seq),
			},
		})
		return PacketEvent{
			No: no, ID: fmtID(no), Timestamp: pkt.Metadata().Timestamp,
			Protocol: "ICMP", Source: src, Dest: dst,
			Direction: m.direction(src, dst),
			Length: len(pkt.Data()),
			Info:   fmt.Sprintf("Type=%d Code=%d id=0x%04x seq=%d", icmp.TypeCode.Type(), icmp.TypeCode.Code(), icmp.Id, icmp.Seq),
			Layers: pktLayers,
		}
	}
	if icmp6Layer := pkt.Layer(layers.LayerTypeICMPv6); icmp6Layer != nil {
		icmp6 := icmp6Layer.(*layers.ICMPv6)
		pktLayers = append(pktLayers, LayerInfo{
			Name: "ICMPv6",
			Fields: map[string]string{
				"Type":     fmt.Sprint(icmp6.TypeCode.Type()),
				"Code":     fmt.Sprint(icmp6.TypeCode.Code()),
				"Checksum": fmt.Sprintf("0x%04x", icmp6.Checksum),
			},
		})
		return PacketEvent{
			No: no, ID: fmtID(no), Timestamp: pkt.Metadata().Timestamp,
			Protocol: "ICMPv6", Source: src, Dest: dst,
			Direction: m.direction(src, dst),
			Length: len(pkt.Data()),
			Info:   fmt.Sprintf("Type=%d Code=%d", icmp6.TypeCode.Type(), icmp6.TypeCode.Code()),
			Layers: pktLayers,
		}
	}

	// --- Transport layer (sets default proto, may be overridden below) ---
	proto := "DATA"
	info := "Data"
	var tcpRef *layers.TCP
	var udpRef *layers.UDP
	var payloadBytes []byte

	if transport != nil {
		switch t := transport.(type) {
		case *layers.TCP:
			tcpRef = t
			src = net.JoinHostPort(src, fmt.Sprint(t.SrcPort))
			dst = net.JoinHostPort(dst, fmt.Sprint(t.DstPort))
			proto = "TCP"
			flags := tcpFlags(t)
			info = fmt.Sprintf("%s → %s %s Seq=%d Ack=%d Win=%d Len=%d",
				fmt.Sprint(t.SrcPort), fmt.Sprint(t.DstPort),
				formatFlags(flags), t.Seq, t.Ack, t.Window, len(t.Payload))
			payloadBytes = t.Payload
			pktLayers = append(pktLayers, LayerInfo{
				Name: "TCP",
				Fields: map[string]string{
					"Source Port":      fmt.Sprint(t.SrcPort),
					"Destination Port": fmt.Sprint(t.DstPort),
					"Sequence":         fmt.Sprint(t.Seq),
					"Acknowledgment":   fmt.Sprint(t.Ack),
					"Window":           fmt.Sprint(t.Window),
					"Flags":            formatFlags(flags),
					"Payload Length":   fmt.Sprint(len(t.Payload)),
					"Checksum":         fmt.Sprintf("0x%04x", t.Checksum),
				},
			})
		case *layers.UDP:
			udpRef = t
			src = net.JoinHostPort(src, fmt.Sprint(t.SrcPort))
			dst = net.JoinHostPort(dst, fmt.Sprint(t.DstPort))
			proto = "UDP"
			info = fmt.Sprintf("%s → %s Len=%d", fmt.Sprint(t.SrcPort), fmt.Sprint(t.DstPort), len(t.Payload))
			payloadBytes = t.Payload
			pktLayers = append(pktLayers, LayerInfo{
				Name: "UDP",
				Fields: map[string]string{
					"Source Port":      fmt.Sprint(t.SrcPort),
					"Destination Port": fmt.Sprint(t.DstPort),
					"Length":           fmt.Sprint(t.Length),
					"Checksum":         fmt.Sprintf("0x%04x", t.Checksum),
				},
			})
		}
	}

	// --- Application-layer protocol detection (overrides transport proto) ---

	// DNS
	if l := pkt.Layer(layers.LayerTypeDNS); l != nil {
		dns := l.(*layers.DNS)
		proto = "DNS"
		if len(dns.Questions) > 0 {
			q := dns.Questions[0]
			prefix := "Standard query"
			if dns.QR {
				prefix = "Standard query response"
			}
			info = fmt.Sprintf("%s 0x%04x %s %s", prefix, dns.ID, q.Type, string(q.Name))
		}
		fields := map[string]string{
			"ID":          fmt.Sprintf("0x%04x", dns.ID),
			"QR":          fmt.Sprint(dns.QR),
			"Questions":   fmt.Sprint(len(dns.Questions)),
			"Answers":     fmt.Sprint(len(dns.Answers)),
			"Authorities": fmt.Sprint(len(dns.Authorities)),
			"Additionals": fmt.Sprint(len(dns.Additionals)),
		}
		pktLayers = append(pktLayers, LayerInfo{Name: "DNS", Fields: fields})
	}

	// TLS / SSL
	if tlsLayer := pkt.Layer(layers.LayerTypeTLS); tlsLayer != nil {
		tls := tlsLayer.(*layers.TLS)
		proto = "TLS"
		if len(tls.ChangeCipherSpec) > 0 {
			info = "Change Cipher Spec"
		} else if len(tls.Handshake) > 0 {
			info = "Handshake"
		} else if len(tls.AppData) > 0 {
			info = fmt.Sprintf("Application Data [%d bytes]", len(tls.AppData))
		} else if len(tls.Alert) > 0 {
			info = "Alert"
		}
		pktLayers = append(pktLayers, LayerInfo{
			Name: "TLS",
			Fields: map[string]string{
				"Handshake Records":       fmt.Sprint(len(tls.Handshake)),
				"ChangeCipherSpec Records": fmt.Sprint(len(tls.ChangeCipherSpec)),
				"AppData Records":         fmt.Sprint(len(tls.AppData)),
				"Alert Records":           fmt.Sprint(len(tls.Alert)),
			},
		})
	}

	// HTTP (heuristic on payload)
	if proto == "TCP" && len(payloadBytes) > 0 {
		p := string(payloadBytes)
		if isHTTPRequest(p) || isHTTPResponse(p) {
			proto = "HTTP"
			line := firstLine(p)
			info = line
			pktLayers = append(pktLayers, LayerInfo{
				Name: "HTTP",
				Fields: map[string]string{
					"Request/Status Line": line,
					"Payload Length":      fmt.Sprint(len(payloadBytes)),
				},
			})
		}
	}

	// DHCP (ports 67/68 over UDP)
	if udpRef != nil && (udpRef.SrcPort == 67 || udpRef.SrcPort == 68 || udpRef.DstPort == 67 || udpRef.DstPort == 68) {
		if dhcpLayer := pkt.Layer(layers.LayerTypeDHCPv4); dhcpLayer != nil {
			dhcp := dhcpLayer.(*layers.DHCPv4)
			proto = "DHCP"
			info = fmt.Sprintf("DHCP %s XID=0x%08x", dhcp.Operation, dhcp.Xid)
			pktLayers = append(pktLayers, LayerInfo{
				Name: "DHCP",
				Fields: map[string]string{
					"Operation":  fmt.Sprint(dhcp.Operation),
					"Client MAC": dhcp.ClientHWAddr.String(),
					"Client IP":  dhcp.ClientIP.String(),
					"Your IP":    dhcp.YourClientIP.String(),
					"Server IP":  dhcp.NextServerIP.String(),
					"XID":        fmt.Sprintf("0x%08x", dhcp.Xid),
				},
			})
		}
	}

	// SSH heuristic (port 22, payload starts with "SSH-")
	if tcpRef != nil && len(payloadBytes) >= 4 && string(payloadBytes[:4]) == "SSH-" {
		proto = "SSH"
		info = firstLine(string(payloadBytes))
		pktLayers = append(pktLayers, LayerInfo{
			Name:   "SSH",
			Fields: map[string]string{"Banner": firstLine(string(payloadBytes))},
		})
	}

	// SMTP heuristic (ports 25/465/587)
	if tcpRef != nil && (tcpRef.DstPort == 25 || tcpRef.DstPort == 465 || tcpRef.DstPort == 587 ||
		tcpRef.SrcPort == 25 || tcpRef.SrcPort == 465 || tcpRef.SrcPort == 587) && len(payloadBytes) > 0 {
		if proto == "TCP" {
			proto = "SMTP"
			info = firstLine(string(payloadBytes))
			pktLayers = append(pktLayers, LayerInfo{
				Name:   "SMTP",
				Fields: map[string]string{"Command/Reply": firstLine(string(payloadBytes))},
			})
		}
	}

	// FTP heuristic (port 21)
	if tcpRef != nil && (tcpRef.DstPort == 21 || tcpRef.SrcPort == 21) && len(payloadBytes) > 0 {
		if proto == "TCP" {
			proto = "FTP"
			info = firstLine(string(payloadBytes))
			pktLayers = append(pktLayers, LayerInfo{
				Name:   "FTP",
				Fields: map[string]string{"Command/Reply": firstLine(string(payloadBytes))},
			})
		}
	}

	// IMAP (port 143/993)
	if tcpRef != nil && (tcpRef.DstPort == 143 || tcpRef.DstPort == 993 || tcpRef.SrcPort == 143 || tcpRef.SrcPort == 993) && len(payloadBytes) > 0 {
		if proto == "TCP" {
			proto = "IMAP"
			info = firstLine(string(payloadBytes))
		}
	}

	// POP3 (port 110/995)
	if tcpRef != nil && (tcpRef.DstPort == 110 || tcpRef.DstPort == 995 || tcpRef.SrcPort == 110 || tcpRef.SrcPort == 995) && len(payloadBytes) > 0 {
		if proto == "TCP" {
			proto = "POP3"
			info = firstLine(string(payloadBytes))
		}
	}

	// NTP (port 123)
	if udpRef != nil && (udpRef.SrcPort == 123 || udpRef.DstPort == 123) {
		if ntpLayer := pkt.Layer(layers.LayerTypeNTP); ntpLayer != nil {
			proto = "NTP"
			ntp := ntpLayer.(*layers.NTP)
			info = fmt.Sprintf("NTP Version %d Stratum %d", ntp.Version, ntp.Stratum)
			pktLayers = append(pktLayers, LayerInfo{
				Name: "NTP",
				Fields: map[string]string{
					"Version":  fmt.Sprint(ntp.Version),
					"Stratum":  fmt.Sprint(ntp.Stratum),
					"Poll":     fmt.Sprint(ntp.Poll),
					"Precision": fmt.Sprint(ntp.Precision),
				},
			})
		}
	}

	// MDNS (port 5353)
	if udpRef != nil && (udpRef.DstPort == 5353 || udpRef.SrcPort == 5353) && proto == "DNS" {
		proto = "MDNS"
	}

	// SSDP (port 1900)
	if udpRef != nil && (udpRef.DstPort == 1900 || udpRef.SrcPort == 1900) && len(payloadBytes) > 0 {
		proto = "SSDP"
		info = firstLine(string(payloadBytes))
	}

	// Build payload preview
	var payloadPreview string
	if len(payloadBytes) > 0 {
		preview := payloadBytes
		if len(preview) > 256 {
			preview = preview[:256]
		}
		payloadPreview = sanitizePayload(preview)
	}

	return PacketEvent{
		No: no, ID: fmtID(no), Timestamp: pkt.Metadata().Timestamp,
		Protocol: proto, Source: src, Dest: dst,
		Direction: m.direction(srcIP, dstIP),
		Length:    len(pkt.Data()),
		Info:      info,
		Layers:    pktLayers,
		Payload:   payloadPreview,
	}
}

func fmtID(no int) string {
	return fmt.Sprintf("%d-%d", time.Now().UnixNano(), no)
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

func isHTTPRequest(p string) bool {
	methods := []string{"GET ", "POST ", "PUT ", "DELETE ", "PATCH ", "HEAD ", "OPTIONS ", "CONNECT ", "TRACE "}
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

func (m *Manager) direction(srcIP, dstIP string) string {
	srcLocal := m.localIPs[srcIP]
	dstLocal := m.localIPs[dstIP]
	if srcLocal && dstLocal {
		return "local"
	}
	if srcLocal {
		return "out"
	}
	if dstLocal {
		return "in"
	}
	return ""
}

func sanitizePayload(b []byte) string {
	out := make([]byte, 0, len(b))
	for _, c := range b {
		if c >= 32 && c < 127 {
			out = append(out, c)
		} else {
			out = append(out, '.')
		}
	}
	return string(out)
}

func formatFlags(flags []string) string {
	if len(flags) == 0 {
		return "[]"
	}
	return "[" + join(flags, ", ") + "]"
}

func join(parts []string, sep string) string {
	if len(parts) == 0 {
		return ""
	}
	out := parts[0]
	for i := 1; i < len(parts); i++ {
		out += sep + parts[i]
	}
	return out
}
