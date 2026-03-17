//go:build cgo && !nocapture

package capture

import (
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/pcap"
)

type LayerInfo struct {
	Name   string            `json:"name"`
	Fields map[string]string `json:"fields"`
}

type PacketEvent struct {
	No         int         `json:"no"`
	ID         string      `json:"id"`
	Timestamp  time.Time   `json:"timestamp"`
	Protocol   string      `json:"protocol"`
	Source     string      `json:"source"`
	Dest       string      `json:"dest"`
	Direction  string      `json:"direction"`
	Length     int         `json:"length"`
	Info       string      `json:"info"`
	Layers     []LayerInfo `json:"layers"`
	Payload    string      `json:"payload,omitempty"`
	PayloadHex string      `json:"payloadHex,omitempty"`

	StreamID    int    `json:"streamId,omitempty"`
	StreamIndex int    `json:"streamIndex,omitempty"`
	StreamProto string `json:"streamProto,omitempty"`
}

type Interface struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type StartOptions struct {
	Device string `json:"device"`
	Filter string `json:"filter"`
}

type Manager struct {
	mu       sync.RWMutex
	handle   *pcap.Handle
	running  bool
	seq      int
	outCh    chan PacketEvent
	localIPs map[string]bool

	streamMu   sync.Mutex
	streams    map[streamKey]*streamState
	nextStream int
}

func NewManager(outCh chan PacketEvent) *Manager {
	return &Manager{
		outCh:      outCh,
		seq:        1,
		localIPs:   collectLocalIPs(),
		streams:    make(map[streamKey]*streamState),
		nextStream: 1,
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

	m.streamMu.Lock()
	m.streams = make(map[streamKey]*streamState)
	m.streamMu.Unlock()
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
		}
	}
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
