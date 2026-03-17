//go:build cgo && !nocapture

package capture

import (
	"fmt"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
)

// decodeContext accumulates state as each decoder layer processes the packet.
type decodeContext struct {
	pkt   gopacket.Packet
	no    int
	srcIP string
	dstIP string
	src   string
	dst   string
	proto string
	info  string

	layers  []LayerInfo
	tcpRef  *layers.TCP
	udpRef  *layers.UDP
	payload []byte

	done bool // set true by decoders that produce a final result (ARP, ICMP)

	streamID    int
	streamIndex int
	streamProto string
	reassembled []byte
}

func (c *decodeContext) addLayer(name string, fields map[string]string) {
	c.layers = append(c.layers, LayerInfo{Name: name, Fields: fields})
}

func (c *decodeContext) toEvent(m *Manager) PacketEvent {
	var payloadText, payloadHex string
	if len(c.payload) > 0 {
		limit := 2048
		preview := c.payload
		if len(preview) > limit {
			preview = preview[:limit]
		}
		payloadText = toReadableText(preview)
		payloadHex = toHexDump(preview)
	}

	return PacketEvent{
		No:          c.no,
		ID:          fmtID(c.no),
		Timestamp:   c.pkt.Metadata().Timestamp,
		Protocol:    c.proto,
		Source:      c.src,
		Dest:        c.dst,
		Direction:   m.direction(c.srcIP, c.dstIP),
		Length:      len(c.pkt.Data()),
		Info:        c.info,
		Layers:      c.layers,
		Payload:     payloadText,
		PayloadHex:  payloadHex,
		StreamID:    c.streamID,
		StreamIndex: c.streamIndex,
		StreamProto: c.streamProto,
	}
}

func (m *Manager) buildEvent(pkt gopacket.Packet) PacketEvent {
	m.mu.Lock()
	no := m.seq
	m.seq++
	m.mu.Unlock()

	ctx := &decodeContext{
		pkt:   pkt,
		no:    no,
		proto: "DATA",
		info:  "Data",
	}

	decodeLinkLayer(ctx)
	if ctx.done {
		return ctx.toEvent(m)
	}

	decodeNetworkLayer(ctx)
	if ctx.done {
		return ctx.toEvent(m)
	}

	decodeTransportLayer(ctx)
	m.trackStream(ctx)

	decodeDNS(ctx)
	decodeTLS(ctx)
	decodeHTTP(ctx)

	// Inherit stream-detected protocol for continuation segments
	if ctx.proto == "TCP" && ctx.streamProto != "" {
		ctx.proto = ctx.streamProto
		if len(ctx.payload) > 0 {
			ctx.info = fmt.Sprintf("[%s continuation] %s", ctx.streamProto, ctx.info)
		}
	}

	decodeServices(ctx)

	return ctx.toEvent(m)
}

func fmtID(no int) string {
	return fmt.Sprintf("%d-%d", time.Now().UnixNano(), no)
}
