"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useCaptureStore } from "@/store/capture";
import type { Packet } from "@/store/capture";
import { FilterBar } from "./filter-bar";
import { PacketTable } from "./packet-table";
import { PacketDetail } from "./packet-detail";

const CORE_BASE = "http://127.0.0.1:9194";
const CORE_WS_URL = "ws://127.0.0.1:9194/events";

type NetInterface = { name: string; description: string };

type CoreApiError = {
  error: string;
  code?: string;
  hint?: string;
};

async function readError(res: Response): Promise<CoreApiError> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return (await res.json()) as CoreApiError;
    } catch {
      // fall through
    }
  }
  return { error: await res.text() };
}

async function coreGet<T>(path: string): Promise<T> {
  const res = await fetch(`${CORE_BASE}${path}`);
  if (!res.ok) {
    const e = await readError(res);
    throw Object.assign(new Error(e.error), e);
  }
  return res.json();
}

async function corePost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${CORE_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const e = await readError(res);
    throw Object.assign(new Error(e.error), e);
  }
  return res.json();
}

export function CaptureView() {
  const { addPacket, setCapturing } = useCaptureStore();
  const wsRef = useRef<WebSocket | null>(null);

  const [interfaces, setInterfaces] = useState<NetInterface[]>([]);
  const [activeDevice, setActiveDevice] = useState<string | null>(null);
  const [coreError, setCoreError] = useState<CoreApiError | null>(null);

  const startCapture = useCallback(
    async (device: string) => {
      try {
        await corePost("/api/capture/start", { device });
        setActiveDevice(device);
        setCapturing(true);
        setCoreError(null);
      } catch (err) {
        const e = err as CoreApiError;
        console.error("Failed to start capture:", err);
        setCoreError({
          error: e.error ?? "Failed to start capture",
          code: e.code,
          hint: e.hint,
        });
      }
    },
    [setCapturing],
  );

  useEffect(() => {
    coreGet<NetInterface[]>("/api/interfaces")
      .then((list) => {
        setInterfaces(list);
        setCoreError(null);
        const preferred =
          list.find(
            (i) =>
              !i.name.startsWith("lo") && !i.name.startsWith("utun") && !i.name.startsWith("awdl"),
          ) ?? list[0];
        if (preferred) {
          startCapture(preferred.name);
        }
      })
      .catch((err) => {
        const e = err as CoreApiError;
        setInterfaces([]);
        setCoreError({
          error: e.error ?? "Failed to list interfaces",
          code: e.code,
          hint: e.hint,
        });
      });
  }, [startCapture]);

  useEffect(() => {
    if (wsRef.current) return;

    const ws = new WebSocket(CORE_WS_URL);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      if (!useCaptureStore.getState().isCapturing) return;
      try {
        const pkt = JSON.parse(e.data as string) as Packet;
        addPacket(pkt);
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [addPacket]);

  const stopCapture = useCallback(async () => {
    try {
      await corePost("/api/capture/stop");
      setActiveDevice(null);
      setCapturing(false);
    } catch (err) {
      console.error("Failed to stop capture:", err);
    }
  }, [setCapturing]);

  const togglePause = useCallback(() => {
    const store = useCaptureStore.getState();
    setCapturing(!store.isCapturing);
  }, [setCapturing]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {coreError && (
        <div className="border-b border-border bg-amber-500/10 px-3 py-2 text-xs">
          <div className="font-medium text-foreground">
            {coreError.code === "NEEDS_ADMIN"
              ? "Capture requires administrator privileges."
              : coreError.code === "NPCAP_MISSING"
                ? "Npcap is not installed."
                : coreError.code === "CAPTURE_UNAVAILABLE"
                  ? "Capture not available in this build."
                  : "Core error."}
          </div>
          <div className="text-muted-foreground">
            {coreError.hint ?? coreError.error}
            {coreError.code === "NEEDS_ADMIN" && (
              <>
                {" "}
                Try: <code className="rounded bg-muted px-1 py-0.5 font-mono">sudo ./vvvv</code> (or
                run as Administrator).
              </>
            )}
            {coreError.code === "NPCAP_MISSING" && (
              <>
                {" "}
                <a
                  href="https://npcap.com/#download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4 hover:text-foreground"
                >
                  Download Npcap
                </a>{" "}
                and enable &quot;WinPcap API-compatible Mode&quot; during setup.
              </>
            )}
          </div>
        </div>
      )}
      <FilterBar
        interfaces={interfaces}
        activeDevice={activeDevice}
        disabled={
          coreError?.code === "NEEDS_ADMIN" ||
          coreError?.code === "NPCAP_MISSING" ||
          coreError?.code === "CAPTURE_UNAVAILABLE" ||
          interfaces.length === 0
        }
        onTogglePause={togglePause}
        onSelectDevice={(name) => {
          if (activeDevice) {
            stopCapture().then(() => startCapture(name));
          } else {
            startCapture(name);
          }
        }}
      />
      <PacketTable />
      <PacketDetail />
    </div>
  );
}
