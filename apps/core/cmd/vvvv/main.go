package main

import (
	"log"
	"net/http"
	"os"

	"github.com/joachimhodana/vvvv/core/internal/privileges"
	"github.com/joachimhodana/vvvv/core/internal/server"
)

func main() {
	if err := privileges.RequireCapturePrivileges(); err != nil {
		log.Fatal(err)
	}

	addr := ":9194"
	if fromEnv := os.Getenv("VVVV_CORE_ADDR"); fromEnv != "" {
		addr = fromEnv
	}

	srv := server.New(addr)

	log.Printf("vvvv core listening on %s", addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}

