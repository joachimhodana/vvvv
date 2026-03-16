//go:build cgo && !nocapture

package capture

import (
	"net"
	"testing"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
)

func testManager() *Manager {
	ch := make(chan PacketEvent, 16)
	m := NewManager(ch)
	m.localIPs["10.0.0.1"] = true
	return m
}

func serialize(t *testing.T, ls ...gopacket.SerializableLayer) gopacket.Packet {
	t.Helper()
	buf := gopacket.NewSerializeBuffer()
	opts := gopacket.SerializeOptions{FixLengths: true, ComputeChecksums: true}
	if err := gopacket.SerializeLayers(buf, opts, ls...); err != nil {
		t.Fatalf("serialize: %v", err)
	}
	return gopacket.NewPacket(buf.Bytes(), layers.LayerTypeEthernet, gopacket.Default)
}

func ethLayer() *layers.Ethernet {
	return &layers.Ethernet{
		SrcMAC:       net.HardwareAddr{0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0x01},
		DstMAC:       net.HardwareAddr{0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0x02},
		EthernetType: layers.EthernetTypeIPv4,
	}
}

func ipv4Layer(src, dst string) *layers.IPv4 {
	return &layers.IPv4{
		Version:  4,
		TTL:      64,
		Protocol: layers.IPProtocolTCP,
		SrcIP:    net.ParseIP(src),
		DstIP:    net.ParseIP(dst),
	}
}

func ipv4UDP(src, dst string) *layers.IPv4 {
	l := ipv4Layer(src, dst)
	l.Protocol = layers.IPProtocolUDP
	return l
}

func ipv4ICMP(src, dst string) *layers.IPv4 {
	l := ipv4Layer(src, dst)
	l.Protocol = layers.IPProtocolICMPv4
	return l
}

func tcpLayer(src, dst uint16) *layers.TCP {
	t := &layers.TCP{
		SrcPort: layers.TCPPort(src),
		DstPort: layers.TCPPort(dst),
		SYN:     true,
	}
	t.SetNetworkLayerForChecksum(ipv4Layer("10.0.0.1", "10.0.0.2"))
	return t
}

func udpLayer(src, dst uint16) *layers.UDP {
	u := &layers.UDP{
		SrcPort: layers.UDPPort(src),
		DstPort: layers.UDPPort(dst),
	}
	u.SetNetworkLayerForChecksum(ipv4UDP("10.0.0.1", "10.0.0.2"))
	return u
}

func TestProtocolDetection(t *testing.T) {
	tests := []struct {
		name     string
		wantProto string
		build    func(t *testing.T) gopacket.Packet
	}{
		{
			name:      "TCP",
			wantProto: "TCP",
			build: func(t *testing.T) gopacket.Packet {
				return serialize(t, ethLayer(), ipv4Layer("10.0.0.1", "10.0.0.2"), tcpLayer(12345, 80), gopacket.Payload([]byte{}))
			},
		},
		{
			name:      "UDP",
			wantProto: "UDP",
			build: func(t *testing.T) gopacket.Packet {
				return serialize(t, ethLayer(), ipv4UDP("10.0.0.1", "10.0.0.2"), udpLayer(12345, 9999), gopacket.Payload([]byte("hello")))
			},
		},
		{
			name:      "DNS",
			wantProto: "DNS",
			build: func(t *testing.T) gopacket.Packet {
				dns := &layers.DNS{
					ID:     0x1234,
					QR:     false,
					OpCode: layers.DNSOpCodeQuery,
					Questions: []layers.DNSQuestion{
						{Name: []byte("example.com"), Type: layers.DNSTypeA, Class: layers.DNSClassIN},
					},
				}
				return serialize(t, ethLayer(), ipv4UDP("10.0.0.1", "10.0.0.2"), udpLayer(12345, 53), dns)
			},
		},
		{
			name:      "MDNS",
			wantProto: "MDNS",
			build: func(t *testing.T) gopacket.Packet {
				dns := &layers.DNS{
					ID: 0x0000,
					QR: false,
					Questions: []layers.DNSQuestion{
						{Name: []byte("_http._tcp.local"), Type: layers.DNSTypePTR, Class: layers.DNSClassIN},
					},
				}
				return serialize(t, ethLayer(), ipv4UDP("10.0.0.1", "224.0.0.251"), udpLayer(5353, 5353), dns)
			},
		},
		{
			name:      "ICMP",
			wantProto: "ICMP",
			build: func(t *testing.T) gopacket.Packet {
				icmp := &layers.ICMPv4{
					TypeCode: layers.CreateICMPv4TypeCode(8, 0),
					Id:       1,
					Seq:      1,
				}
				return serialize(t, ethLayer(), ipv4ICMP("10.0.0.1", "10.0.0.2"), icmp)
			},
		},
		{
			name:      "ARP",
			wantProto: "ARP",
			build: func(t *testing.T) gopacket.Packet {
				eth := &layers.Ethernet{
					SrcMAC:       net.HardwareAddr{0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0x01},
					DstMAC:       net.HardwareAddr{0xff, 0xff, 0xff, 0xff, 0xff, 0xff},
					EthernetType: layers.EthernetTypeARP,
				}
				arp := &layers.ARP{
					AddrType:          layers.LinkTypeEthernet,
					Protocol:          layers.EthernetTypeIPv4,
					HwAddressSize:     6,
					ProtAddressSize:   4,
					Operation:         1,
					SourceHwAddress:   []byte{0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0x01},
					SourceProtAddress: net.ParseIP("10.0.0.1").To4(),
					DstHwAddress:      []byte{0x00, 0x00, 0x00, 0x00, 0x00, 0x00},
					DstProtAddress:    net.ParseIP("10.0.0.2").To4(),
				}
				return serialize(t, eth, arp)
			},
		},
		{
			name:      "HTTP",
			wantProto: "HTTP",
			build: func(t *testing.T) gopacket.Packet {
				tcp := tcpLayer(12345, 80)
				tcp.SYN = false
				tcp.PSH = true
				tcp.ACK = true
				return serialize(t, ethLayer(), ipv4Layer("10.0.0.1", "10.0.0.2"), tcp, gopacket.Payload([]byte("GET / HTTP/1.1\r\nHost: example.com\r\n\r\n")))
			},
		},
		{
			name:      "TLS",
			wantProto: "TLS",
			build: func(t *testing.T) gopacket.Packet {
				// Raw TLS ClientHello record (content type 0x16, version 0x0301)
				tlsRecord := []byte{
					0x16, 0x03, 0x01, 0x00, 0x05,
					0x01, 0x00, 0x00, 0x01, 0x00,
				}
				tcp := tcpLayer(12345, 443)
				tcp.SYN = false
				tcp.PSH = true
				tcp.ACK = true
				return serialize(t, ethLayer(), ipv4Layer("10.0.0.1", "10.0.0.2"), tcp, gopacket.Payload(tlsRecord))
			},
		},
		{
			name:      "SSH",
			wantProto: "SSH",
			build: func(t *testing.T) gopacket.Packet {
				tcp := tcpLayer(22, 54321)
				tcp.SYN = false
				tcp.PSH = true
				tcp.ACK = true
				return serialize(t, ethLayer(), ipv4Layer("10.0.0.1", "10.0.0.2"), tcp, gopacket.Payload([]byte("SSH-2.0-OpenSSH_9.6\r\n")))
			},
		},
		{
			name:      "SMTP",
			wantProto: "SMTP",
			build: func(t *testing.T) gopacket.Packet {
				tcp := tcpLayer(25, 54321)
				tcp.SYN = false
				tcp.PSH = true
				tcp.ACK = true
				return serialize(t, ethLayer(), ipv4Layer("10.0.0.1", "10.0.0.2"), tcp, gopacket.Payload([]byte("220 mail.example.com ESMTP\r\n")))
			},
		},
		{
			name:      "FTP",
			wantProto: "FTP",
			build: func(t *testing.T) gopacket.Packet {
				tcp := tcpLayer(21, 54321)
				tcp.SYN = false
				tcp.PSH = true
				tcp.ACK = true
				return serialize(t, ethLayer(), ipv4Layer("10.0.0.1", "10.0.0.2"), tcp, gopacket.Payload([]byte("220 FTP server ready\r\n")))
			},
		},
		{
			name:      "IMAP",
			wantProto: "IMAP",
			build: func(t *testing.T) gopacket.Packet {
				tcp := tcpLayer(143, 54321)
				tcp.SYN = false
				tcp.PSH = true
				tcp.ACK = true
				return serialize(t, ethLayer(), ipv4Layer("10.0.0.1", "10.0.0.2"), tcp, gopacket.Payload([]byte("* OK IMAP4rev1 ready\r\n")))
			},
		},
		{
			name:      "POP3",
			wantProto: "POP3",
			build: func(t *testing.T) gopacket.Packet {
				tcp := tcpLayer(110, 54321)
				tcp.SYN = false
				tcp.PSH = true
				tcp.ACK = true
				return serialize(t, ethLayer(), ipv4Layer("10.0.0.1", "10.0.0.2"), tcp, gopacket.Payload([]byte("+OK POP3 server ready\r\n")))
			},
		},
		{
			name:      "NTP",
			wantProto: "NTP",
			build: func(t *testing.T) gopacket.Packet {
				ntp := &layers.NTP{
					Version:       4,
					Stratum:       2,
					LeapIndicator: 0,
					Mode:          4,
					Poll:          6,
					Precision:     -20,
				}
				return serialize(t, ethLayer(), ipv4UDP("10.0.0.1", "10.0.0.2"), udpLayer(123, 123), ntp)
			},
		},
		{
			name:      "SSDP",
			wantProto: "SSDP",
			build: func(t *testing.T) gopacket.Packet {
				return serialize(t, ethLayer(), ipv4UDP("10.0.0.1", "239.255.255.250"), udpLayer(54321, 1900), gopacket.Payload([]byte("M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\n\r\n")))
			},
		},
	}

	m := testManager()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pkt := tt.build(t)
			ev := m.buildEvent(pkt)
			if ev.Protocol != tt.wantProto {
				t.Errorf("protocol = %q, want %q (info: %s)", ev.Protocol, tt.wantProto, ev.Info)
			}
		})
	}
}

func TestProtocolDetection_AllProtocolsCovered(t *testing.T) {
	expected := []string{
		"TCP", "UDP", "DNS", "MDNS", "ICMP", "ARP",
		"HTTP", "TLS", "SSH", "SMTP", "FTP", "IMAP", "POP3", "NTP", "SSDP",
	}
	covered := make(map[string]bool)
	for _, p := range expected {
		covered[p] = true
	}

	uiProtocols := []string{
		"TCP", "UDP", "HTTP", "DNS", "TLS", "ICMP", "ICMPv6",
		"SSH", "SMTP", "ARP", "DHCP", "NTP", "MDNS", "SSDP",
		"FTP", "IMAP", "POP3",
	}

	for _, p := range uiProtocols {
		if p == "ICMPv6" || p == "DHCP" {
			continue // ICMPv6 needs IPv6 stack; DHCP needs full BOOTP — skipped in unit tests
		}
		if !covered[p] {
			t.Errorf("UI protocol %q has no test coverage", p)
		}
	}
}
