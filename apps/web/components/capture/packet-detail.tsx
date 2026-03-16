"use client";

import { useMemo } from "react";
import { useCaptureStore } from "@/store/capture";
import { cn } from "@/lib/utils";
import { CaretRight, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export function PacketDetail() {
  const { packets, selectedId, selectPacket } = useCaptureStore();

  const packet = useMemo(
    () => (selectedId ? packets.find((p) => p.id === selectedId) : null),
    [packets, selectedId],
  );

  if (!packet) return null;

  const layers = buildLayers(packet);

  return (
    <div className="flex flex-col border-t border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          Packet #{packet.no} Detail
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => selectPacket(null)}
        >
          <X className="size-3" />
        </Button>
      </div>
      <div className="max-h-[220px] overflow-auto px-1 py-1 text-[11px] font-mono">
        {layers.map((layer) => (
          <DetailLayer key={layer.title} layer={layer} />
        ))}
      </div>
    </div>
  );
}

type LayerField = { label: string; value: string };
type Layer = { title: string; fields: LayerField[] };

function DetailLayer({ layer }: { layer: Layer }) {
  return (
    <details className="group" open>
      <summary className="flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 hover:bg-muted/50">
        <CaretRight className="size-3 text-muted-foreground transition-transform group-open:rotate-90" />
        <span className="font-semibold text-foreground">{layer.title}</span>
      </summary>
      <div className="ml-5 space-y-0.5 py-0.5">
        {layer.fields.map((f) => (
          <div key={f.label} className="flex gap-2 px-2 py-0.5 rounded hover:bg-muted/30">
            <span className="text-muted-foreground">{f.label}:</span>
            <span className="text-foreground">{f.value}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function buildLayers(packet: {
  no: number;
  timestamp: string;
  protocol: string;
  source: string;
  dest: string;
  length: number;
  info: string;
}): Layer[] {
  const layers: Layer[] = [
    {
      title: `Frame ${packet.no}: ${packet.length} bytes on wire`,
      fields: [
        { label: "Arrival Time", value: new Date(packet.timestamp).toISOString() },
        { label: "Frame Length", value: `${packet.length} bytes` },
        { label: "Protocols in frame", value: `Ethernet:IPv4:${packet.protocol}` },
      ],
    },
    {
      title: "Internet Protocol Version 4",
      fields: [
        { label: "Source Address", value: packet.source },
        { label: "Destination Address", value: packet.dest },
        { label: "Protocol", value: packet.protocol },
      ],
    },
    {
      title: `${packet.protocol}`,
      fields: [
        { label: "Info", value: packet.info },
        { label: "Payload Length", value: `${packet.length} bytes` },
      ],
    },
  ];

  return layers;
}
