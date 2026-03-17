"use client";

import { useMemo, useState } from "react";
import { useCaptureStore } from "@/store/capture";
import type { Packet, LayerInfo } from "@/store/capture";
import { CaretRight, X, ArrowsDownUp } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PacketDetail() {
  const { packets, selectedId, selectPacket, setDisplayFilter } = useCaptureStore();

  const packet = useMemo(
    () => (selectedId ? packets.find((p) => p.id === selectedId) : null),
    [packets, selectedId],
  );

  const streamPackets = useMemo(() => {
    if (!packet?.streamId) return [];
    return packets.filter((p) => p.streamId === packet.streamId);
  }, [packets, packet]);

  if (!packet) return null;

  const layers = packet.layers ?? buildFallbackLayers(packet);

  return (
    <div className="flex flex-col border-t border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          Packet #{packet.no} · {packet.protocol} · {packet.source} → {packet.dest}
          {packet.streamId ? ` · Stream #${packet.streamId}` : ""}
        </span>
        <div className="flex items-center gap-1">
          {packet.streamId && (
            <Button
              variant="ghost"
              size="icon-sm"
              title={`Follow TCP Stream #${packet.streamId}`}
              onClick={() => setDisplayFilter(`tcp.stream == ${packet.streamId}`)}
            >
              <ArrowsDownUp className="size-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={() => selectPacket(null)}>
            <X className="size-3" />
          </Button>
        </div>
      </div>
      <div className="max-h-[320px] overflow-auto px-1 py-1 font-mono text-[11px]">
        <DetailSection
          title={`Frame ${packet.no}: ${packet.length} bytes`}
          fields={{
            "Arrival Time": new Date(packet.timestamp).toISOString(),
            "Frame Length": `${packet.length} bytes`,
            Protocol: packet.protocol,
            Direction: packet.direction || "unknown",
            ...(packet.streamId ? {
              "TCP Stream": `#${packet.streamId}`,
              "Stream Index": `${packet.streamIndex}`,
              ...(packet.streamProto ? { "Stream Protocol": packet.streamProto } : {}),
            } : {}),
          }}
        />

        {layers.map((layer) => (
          <DetailSection
            key={`${packet.id}-${layer.name}`}
            title={layer.name}
            fields={layer.fields}
          />
        ))}

        {(packet.payload || packet.payloadHex) && (
          <PayloadSection payload={packet.payload} payloadHex={packet.payloadHex} />
        )}

        {packet.streamId !== undefined && streamPackets.length > 1 && (
          <StreamSection streamId={packet.streamId} packets={streamPackets} />
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
            <span className="shrink-0 text-muted-foreground">{label}:</span>
            <span className="break-all text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function PayloadSection({
  payload,
  payloadHex,
}: {
  payload?: string;
  payloadHex?: string;
}) {
  const [view, setView] = useState<"text" | "hex">("text");

  return (
    <details className="group" open>
      <summary className="flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 hover:bg-muted/50">
        <CaretRight className="size-3 text-muted-foreground transition-transform group-open:rotate-90" />
        <span className="font-semibold text-foreground">Payload</span>
      </summary>
      <div className="ml-5 py-1">
        <div className="mb-1 flex gap-1 px-2">
          <button
            type="button"
            onClick={() => setView("text")}
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
              view === "text"
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Text
          </button>
          {payloadHex && (
            <button
              type="button"
              onClick={() => setView("hex")}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                view === "hex"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Hex
            </button>
          )}
        </div>
        <pre
          className={cn(
            "max-h-[180px] overflow-auto whitespace-pre-wrap break-all rounded bg-muted/30 px-2 py-1.5 text-[10px]",
            view === "hex" ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {view === "hex" ? payloadHex : payload || "(empty)"}
        </pre>
      </div>
    </details>
  );
}

function StreamSection({ streamId, packets }: { streamId: number; packets: Packet[] }) {
  const reassembledPayload = useMemo(() => {
    return packets
      .map((p) => p.payload)
      .filter((p): p is string => Boolean(p && p.length > 0))
      .join("");
  }, [packets]);

  const totalBytes = packets.reduce((sum, p) => sum + p.length, 0);

  return (
    <details className="group">
      <summary className="flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 hover:bg-muted/50">
        <CaretRight className="size-3 text-muted-foreground transition-transform group-open:rotate-90" />
        <span className="font-semibold text-foreground">
          TCP Stream #{streamId} ({packets.length} packets, {totalBytes.toLocaleString()} bytes)
        </span>
      </summary>
      <div className="ml-5 py-1">
        {reassembledPayload.length > 0 && (
          <>
            <div className="mb-1 px-2 text-[10px] font-medium text-muted-foreground">
              Reassembled payload ({reassembledPayload.length.toLocaleString()} chars)
            </div>
            <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap break-all rounded bg-muted/30 px-2 py-1.5 text-[10px] text-foreground">
              {reassembledPayload}
            </pre>
          </>
        )}
        {reassembledPayload.length === 0 && (
          <div className="px-2 text-[10px] text-muted-foreground">
            No payload data in this stream (handshake/control only)
          </div>
        )}
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
