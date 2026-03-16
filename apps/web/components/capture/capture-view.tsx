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

async function coreGet<T>(path: string): Promise<T> {
  const res = await fetch(`${CORE_BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function corePost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${CORE_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function CaptureView() {
  const { addPacket, setCapturing } = useCaptureStore();
  const wsRef = useRef<WebSocket | null>(null);

  const [interfaces, setInterfaces] = useState<NetInterface[]>([]);
  const [activeDevice, setActiveDevice] = useState<string | null>(null);

  const startCapture = useCallback(
    async (device: string) => {
      try {
        await corePost("/api/capture/start", { device });
        setActiveDevice(device);
        setCapturing(true);
      } catch (err) {
        console.error("Failed to start capture:", err);
      }
    },
    [setCapturing],
  );

  useEffect(() => {
    coreGet<NetInterface[]>("/api/interfaces")
      .then((list) => {
        setInterfaces(list);
        const preferred =
          list.find(
            (i) =>
              !i.name.startsWith("lo") &&
              !i.name.startsWith("utun") &&
              !i.name.startsWith("awdl"),
          ) ?? list[0];
        if (preferred) {
          startCapture(preferred.name);
        }
      })
      .catch(() => {});
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
      <FilterBar
        interfaces={interfaces}
        activeDevice={activeDevice}
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
