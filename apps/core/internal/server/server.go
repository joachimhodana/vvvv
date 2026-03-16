package server

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

type Server struct {
	addr string
}

func New(addr string) *Server {
	return &Server{addr: addr}
}

func (s *Server) ListenAndServe() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/events", s.handleEvents)

	server := &http.Server{
		Addr:    s.addr,
		Handler: withCORS(mux),
	}

	return server.ListenAndServe()
}

func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
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
}

type Event struct {
	No        int       `json:"no"`
	ID        string    `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Protocol  string    `json:"protocol"`
	Source    string    `json:"source"`
	Dest      string    `json:"dest"`
	Length    int       `json:"length"`
	Info      string    `json:"info"`
}

var protocols = []string{"TCP", "UDP", "HTTP", "DNS", "TLS", "ICMP", "SSH", "SMTP", "ARP"}

var hosts = []string{
	"192.168.0.1", "192.168.0.21", "10.0.0.1", "10.0.0.55",
	"172.16.0.10", "174.129.249.228", "63.80.242.48",
	"8.8.8.8", "1.1.1.1", "142.250.80.46", "151.101.1.140",
}

func randomEvent(seq int) Event {
	proto := protocols[rand.Intn(len(protocols))]
	src := hosts[rand.Intn(len(hosts))]
	dst := hosts[rand.Intn(len(hosts))]
	srcPort := 1024 + rand.Intn(64000)
	dstPort := []int{80, 443, 53, 22, 25, 8080, 3306, 5432}[rand.Intn(8)]
	length := 40 + rand.Intn(1500)

	var info string
	switch proto {
	case "TCP":
		flags := []string{"[SYN]", "[SYN, ACK]", "[ACK]", "[PSH, ACK]", "[FIN, ACK]", "[RST]"}
		info = fmt.Sprintf("%d → %d %s Seq=%d Ack=%d Win=%d Len=%d",
			srcPort, dstPort, flags[rand.Intn(len(flags))],
			rand.Intn(999999), rand.Intn(999999), 5840+rand.Intn(2000), length)
	case "UDP":
		info = fmt.Sprintf("%d → %d Len=%d", srcPort, dstPort, length)
	case "HTTP":
		methods := []string{"GET", "POST", "PUT", "DELETE", "HEAD"}
		paths := []string{"/", "/api/v1/users", "/index.html", "/favicon.ico", "/api/health"}
		codes := []string{"200 OK", "301 Moved", "302 Found", "404 Not Found", "500 Internal Server Error"}
		if rand.Intn(2) == 0 {
			info = fmt.Sprintf("%s %s HTTP/1.1", methods[rand.Intn(len(methods))], paths[rand.Intn(len(paths))])
		} else {
			info = fmt.Sprintf("HTTP/1.1 %s", codes[rand.Intn(len(codes))])
		}
	case "DNS":
		domains := []string{"cdn-0.nflximg.com", "api.github.com", "fonts.googleapis.com", "vvvv.joachimhodana.com"}
		types := []string{"A", "AAAA", "CNAME", "MX"}
		if rand.Intn(2) == 0 {
			info = fmt.Sprintf("Standard query 0x%04x %s %s", rand.Intn(0xffff), types[rand.Intn(len(types))], domains[rand.Intn(len(domains))])
		} else {
			info = fmt.Sprintf("Standard query response 0x%04x %s %s", rand.Intn(0xffff), types[rand.Intn(len(types))], domains[rand.Intn(len(domains))])
		}
	case "TLS":
		versions := []string{"TLSv1.2", "TLSv1.3"}
		records := []string{"Client Hello", "Server Hello", "Certificate", "Change Cipher Spec", "Application Data"}
		info = fmt.Sprintf("%s %s", versions[rand.Intn(len(versions))], records[rand.Intn(len(records))])
	case "ICMP":
		info = fmt.Sprintf("Echo (ping) request id=0x%04x, seq=%d/%d, ttl=%d",
			rand.Intn(0xffff), rand.Intn(100), rand.Intn(100), 48+rand.Intn(80))
	case "SSH":
		info = fmt.Sprintf("Client: Key Exchange Init (kex=%s)", []string{"curve25519-sha256", "ecdh-sha2-nistp256"}[rand.Intn(2)])
	case "SMTP":
		cmds := []string{"EHLO mail.example.com", "MAIL FROM:<user@example.com>", "RCPT TO:<dest@example.com>", "DATA", "250 OK"}
		info = cmds[rand.Intn(len(cmds))]
	case "ARP":
		info = fmt.Sprintf("Who has %s? Tell %s", dst, src)
	default:
		info = "Data"
	}

	return Event{
		No:        seq,
		ID:        randomID(),
		Timestamp: time.Now().UTC(),
		Protocol:  proto,
		Source:    src,
		Dest:      dst,
		Length:    length,
		Info:      info,
	}
}

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	seq := 1
	for {
		ev := randomEvent(seq)
		seq++

		if err := conn.WriteJSON(ev); err != nil {
			log.Printf("websocket write error: %v", err)
			return
		}

		time.Sleep(time.Duration(50+rand.Intn(200)) * time.Millisecond)
	}
}

func randomID() string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 8)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}
