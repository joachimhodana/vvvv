package server

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"

	"github.com/joachimhodana/vvvv/core/internal/capture"
)

type Server struct {
	addr     string
	capture  *capture.Manager
	eventsCh chan capture.PacketEvent
	bcast    *broadcaster
}

func New(addr string) *Server {
	eventsCh := make(chan capture.PacketEvent, 1024)
	mgr := capture.NewManager(eventsCh)
	b := newBroadcaster()
	go b.run(eventsCh)
	return &Server{
		addr:     addr,
		capture:  mgr,
		eventsCh: eventsCh,
		bcast:    b,
	}
}

func (s *Server) ListenAndServe() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/events", s.handleEvents)
	mux.HandleFunc("/api/interfaces", s.handleInterfaces)
	mux.HandleFunc("/api/capture/start", s.handleCaptureStart)
	mux.HandleFunc("/api/capture/stop", s.handleCaptureStop)
	mux.HandleFunc("/api/capture/status", s.handleCaptureStatus)

	server := &http.Server{
		Addr:    s.addr,
		Handler: withCORS(mux),
	}

	return server.ListenAndServe()
}

func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			return
		}
		h.ServeHTTP(w, r)
	})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	WriteBufferSize: 4096,
	ReadBufferSize:  1024,
}

type wsClient struct {
	conn *websocket.Conn
	send chan capture.PacketEvent
}

type broadcaster struct {
	mu      sync.Mutex
	clients map[*wsClient]struct{}
}

func newBroadcaster() *broadcaster {
	return &broadcaster{clients: make(map[*wsClient]struct{})}
}

func (b *broadcaster) add(c *wsClient) {
	b.mu.Lock()
	b.clients[c] = struct{}{}
	b.mu.Unlock()
}

func (b *broadcaster) remove(c *wsClient) {
	b.mu.Lock()
	delete(b.clients, c)
	b.mu.Unlock()
}

func (b *broadcaster) run(events <-chan capture.PacketEvent) {
	for ev := range events {
		b.mu.Lock()
		for c := range b.clients {
			select {
			case c.send <- ev:
			default:
				// drop if slow client
			}
		}
		b.mu.Unlock()
	}
}

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade error: %v", err)
		return
	}
	client := &wsClient{
		conn: conn,
		send: make(chan capture.PacketEvent, 256),
	}
	s.bcast.add(client)
	defer func() {
		s.bcast.remove(client)
		close(client.send)
		_ = conn.Close()
	}()

	go func() {
		for ev := range client.send {
			if err := conn.WriteJSON(ev); err != nil {
				return
			}
		}
	}()

	// Block until the client disconnects.
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			return
		}
	}
}

func (s *Server) handleInterfaces(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ifaces, err := s.capture.ListInterfaces()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(ifaces)
}

func (s *Server) handleCaptureStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var opts capture.StartOptions
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}
	if err := s.capture.Start(opts); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "started"})
}

func (s *Server) handleCaptureStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	s.capture.Stop()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "stopped"})
}

func (s *Server) handleCaptureStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	st := s.capture.Status()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(st)
}
