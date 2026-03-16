"use client";

import { useMemo } from "react";
import { useCaptureStore } from "@/store/capture";
import type { Packet, LayerInfo } from "@/store/capture";
import { CaretRight, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export function PacketDetail() {
  const { packets, selectedId, selectPacket } = useCaptureStore();

  const packet = useMemo(
    () => (selectedId ? packets.find((p) => p.id === selectedId) : null),
    [packets, selectedId],
  );

  if (!packet) return null;

  const layers = packet.layers ?? buildFallbackLayers(packet);

  return (
    <div className="flex flex-col border-t border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          Packet #{packet.no} Detail
        </span>
        <Button variant="ghost" size="icon-sm" onClick={() => selectPacket(null)}>
          <X className="size-3" />
        </Button>
      </div>
      <div className="max-h-[260px] overflow-auto px-1 py-1 font-mono text-[11px]">
        {/* Frame summary */}
        <DetailSection
          title={`Frame ${packet.no}: ${packet.length} bytes on wire`}
          fields={{
            "Arrival Time": new Date(packet.timestamp).toISOString(),
            "Frame Length": `${packet.length} bytes`,
            Protocol: packet.protocol,
          }}
        />

        {/* Decoded layers from core */}
        {layers.map((layer) => (
          <DetailSection
            key={`${packet.id}-${layer.name}`}
            title={layer.name}
            fields={layer.fields}
          />
        ))}

        {/* Payload */}
        {packet.payload && (
          <details className="group" open>
            <summary className="flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 hover:bg-muted/50">
              <CaretRight className="size-3 text-muted-foreground transition-transform group-open:rotate-90" />
              <span className="font-semibold text-foreground">
                Payload ({packet.payload.length} bytes)
              </span>
            </summary>
            <pre className="ml-5 whitespace-pre-wrap break-all px-2 py-1 text-[10px] text-muted-foreground">
              {packet.payload}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

function DetailSection({ title, fields }: { title: string; fields: Record<string, string> }) {
  return (
    <details className="group" open>
      <summary className="flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 hover:bg-muted/50">
        <CaretRight className="size-3 text-muted-foreground transition-transform group-open:rotate-90" />
        <span className="font-semibold text-foreground">{title}</span>
      </summary>
      <div className="ml-5 space-y-0.5 py-0.5">
        {Object.entries(fields).map(([label, value]) => (
          <div key={label} className="flex gap-2 rounded px-2 py-0.5 hover:bg-muted/30">
            <span className="text-muted-foreground">{label}:</span>
            <span className="text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function buildFallbackLayers(packet: Packet): LayerInfo[] {
  return [
    {
      name: "IPv4",
      fields: {
        Source: packet.source,
        Destination: packet.dest,
        Protocol: packet.protocol,
      },
    },
    {
      name: packet.protocol,
      fields: {
        Info: packet.info,
        "Payload Length": `${packet.length} bytes`,
      },
    },
  ];
}
