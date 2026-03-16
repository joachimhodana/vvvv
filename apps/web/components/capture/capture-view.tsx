"use client";

import { useEffect, useRef } from "react";
import { useCaptureStore } from "@/store/capture";
import type { Packet } from "@/store/capture";
import { FilterBar } from "./filter-bar";
import { PacketTable } from "./packet-table";
import { PacketDetail } from "./packet-detail";

const CORE_WS_URL = "ws://127.0.0.1:9194/events";

export function CaptureView() {
  const { addPacket, isCapturing, clearPackets } = useCaptureStore();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
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

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [addPacket]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <FilterBar />
      <PacketTable />
      <PacketDetail />
    </div>
  );
}
