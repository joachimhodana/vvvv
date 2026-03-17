//go:build cgo && !nocapture

package capture

// streamKey is a canonical 4-tuple identifying a TCP conversation,
// normalized so that the "lower" endpoint always comes first.
type streamKey struct {
	ipA, ipB     string
	portA, portB uint16
}

func makeStreamKey(srcIP, dstIP string, srcPort, dstPort uint16) streamKey {
	if srcIP < dstIP || (srcIP == dstIP && srcPort < dstPort) {
		return streamKey{srcIP, dstIP, srcPort, dstPort}
	}
	return streamKey{dstIP, srcIP, dstPort, srcPort}
}

type streamState struct {
	id             int
	index          int
	clientToServer []byte
	serverToClient []byte
	clientIP       string
	clientPort     uint16
	protocol       string
}

const streamMaxBuf = 64 * 1024

// trackStream assigns stream IDs, accumulates reassembly buffers,
// and detects application-layer protocols on the reassembled data.
func (m *Manager) trackStream(ctx *decodeContext) {
	if ctx.tcpRef == nil || ctx.srcIP == "" || ctx.dstIP == "" {
		return
	}

	tcp := ctx.tcpRef
	key := makeStreamKey(ctx.srcIP, ctx.dstIP, uint16(tcp.SrcPort), uint16(tcp.DstPort))

	m.streamMu.Lock()
	defer m.streamMu.Unlock()

	st, exists := m.streams[key]

	if !exists || tcp.SYN {
		if tcp.SYN && exists {
			delete(m.streams, key)
		}
		st = &streamState{
			id:         m.nextStream,
			clientIP:   ctx.srcIP,
			clientPort: uint16(tcp.SrcPort),
		}
		m.nextStream++
		m.streams[key] = st
	}

	ctx.streamID = st.id
	st.index++
	ctx.streamIndex = st.index

	isClient := ctx.srcIP == st.clientIP && uint16(tcp.SrcPort) == st.clientPort

	if len(ctx.payload) > 0 {
		if isClient && len(st.clientToServer) < streamMaxBuf {
			st.clientToServer = append(st.clientToServer, ctx.payload...)
		} else if !isClient && len(st.serverToClient) < streamMaxBuf {
			st.serverToClient = append(st.serverToClient, ctx.payload...)
		}
	}

	// Detect protocol on reassembled buffers
	if st.protocol == "" {
		if len(st.clientToServer) > 0 {
			buf := string(st.clientToServer)
			if isHTTPRequest(buf) {
				headers := parseHTTPHeaders(buf)
				if isWebSocketUpgrade(headers) {
					st.protocol = "WebSocket"
				} else {
					st.protocol = "HTTP"
				}
			}
		}
		if st.protocol == "" && len(st.serverToClient) > 0 {
			buf := string(st.serverToClient)
			if isHTTPResponse(buf) {
				headers := parseHTTPHeaders(buf)
				if isSSEResponse(headers) {
					st.protocol = "SSE"
				} else {
					st.protocol = "HTTP"
				}
			}
		}
	}

	ctx.streamProto = st.protocol

	if len(ctx.payload) > 0 {
		if isClient {
			ctx.reassembled = st.clientToServer
		} else {
			ctx.reassembled = st.serverToClient
		}
	}

	if tcp.FIN || tcp.RST {
		delete(m.streams, key)
	}
}
