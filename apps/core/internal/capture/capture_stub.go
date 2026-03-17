//go:build !cgo || nocapture

package capture

import (
	"fmt"
	"time"
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
	Layers     []LayerInfo `json:"layers"`
	Payload    string      `json:"payload,omitempty"`
	PayloadHex string     `json:"payloadHex,omitempty"`

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

type Manager struct{}

func NewManager(outCh chan PacketEvent) *Manager {
	_ = outCh
	return &Manager{}
}

func (m *Manager) ListInterfaces() ([]Interface, error) {
	_ = m
	return nil, fmt.Errorf("capture not supported in this build")
}

func (m *Manager) Start(opts StartOptions) error {
	_ = m
	_ = opts
	return fmt.Errorf("capture not supported in this build")
}

func (m *Manager) Stop() {
	_ = m
}

func (m *Manager) Status() map[string]any {
	_ = m
	return map[string]any{
		"running": false,
		"error":   "capture not supported in this build",
	}
}

