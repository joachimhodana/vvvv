"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCaptureStore, matchesFilter } from "@/store/capture";
import type { Packet } from "@/store/capture";
import { cn } from "@/lib/utils";
import { ArrowDown } from "@phosphor-icons/react";

const PROTOCOL_COLORS: Record<string, string> = {
  TCP: "text-violet-400",
  UDP: "text-cyan-400",
  HTTP: "text-emerald-400",
  DNS: "text-amber-400",
  TLS: "text-rose-400",
  ICMP: "text-sky-400",
  ICMPv6: "text-sky-300",
  SSH: "text-orange-400",
  SMTP: "text-lime-400",
  ARP: "text-pink-400",
  DHCP: "text-teal-400",
  NTP: "text-indigo-400",
  MDNS: "text-yellow-400",
  SSDP: "text-fuchsia-400",
  FTP: "text-red-400",
  IMAP: "text-blue-400",
  POP3: "text-purple-400",
};

const PROTOCOL_ROW_BG: Record<string, string> = {
  TCP: "hover:bg-violet-500/5",
  UDP: "hover:bg-cyan-500/5",
  HTTP: "hover:bg-emerald-500/5",
  DNS: "hover:bg-amber-500/5",
  TLS: "hover:bg-rose-500/5",
  ICMP: "hover:bg-sky-500/5",
  ICMPv6: "hover:bg-sky-400/5",
  SSH: "hover:bg-orange-500/5",
  SMTP: "hover:bg-lime-500/5",
  ARP: "hover:bg-pink-500/5",
  DHCP: "hover:bg-teal-500/5",
  NTP: "hover:bg-indigo-500/5",
  MDNS: "hover:bg-yellow-500/5",
  SSDP: "hover:bg-fuchsia-500/5",
  FTP: "hover:bg-red-500/5",
  IMAP: "hover:bg-blue-500/5",
  POP3: "hover:bg-purple-500/5",
};

const COLUMNS = [
  { key: "no", label: "No.", width: "w-[60px]" },
  { key: "time", label: "Time", width: "w-[90px]" },
  { key: "source", label: "Source", width: "w-[140px]" },
  { key: "dir", label: "", width: "w-[24px]" },
  { key: "dest", label: "Destination", width: "w-[140px]" },
  { key: "protocol", label: "Protocol", width: "w-[70px]" },
  { key: "length", label: "Length", width: "w-[60px]" },
  { key: "info", label: "Info", width: "flex-1" },
] as const;

const DIR_ARROW: Record<string, { symbol: string; color: string; title: string }> = {
  in:    { symbol: "→", color: "text-blue-400", title: "Incoming" },
  out:   { symbol: "←", color: "text-orange-400", title: "Outgoing" },
  local: { symbol: "⇄", color: "text-emerald-400", title: "Local" },
};

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

export function PacketTable() {
  const { packets, displayFilter, selectedId, selectPacket } = useCaptureStore();
  const parentRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const prevCountRef = useRef(0);

  const filtered = useMemo(() => {
    if (!displayFilter.trim()) return packets;
    return packets.filter((p) => matchesFilter(p, displayFilter));
  }, [packets, displayFilter]);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 26,
    overscan: 30,
  });

  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShouldAutoScroll(distanceFromBottom < 50);
  }, []);

  useEffect(() => {
    if (shouldAutoScroll && filtered.length > prevCountRef.current) {
      rowVirtualizer.scrollToIndex(filtered.length - 1, { align: "end" });
    }
    prevCountRef.current = filtered.length;
  }, [filtered.length, shouldAutoScroll, rowVirtualizer]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Column headers */}
      <div className="flex items-center border-b border-border bg-card px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {COLUMNS.map((col) => (
          <span key={col.key} className={col.width}>
            {col.label}
          </span>
        ))}
      </div>

      {/* Virtualized rows */}
      <div ref={parentRef} className="flex-1 overflow-auto" onScroll={handleScroll}>
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const pkt = filtered[virtualRow.index];
            if (!pkt) return null;

            const isSelected = pkt.id === selectedId;

            return (
              <button
                type="button"
                key={pkt.id}
                aria-pressed={isSelected}
                className={cn(
                  "absolute left-0 top-0 flex w-full cursor-pointer items-center border-b border-border/50 px-3 py-0.5 font-mono text-[11px] transition-colors text-left",
                  PROTOCOL_ROW_BG[pkt.protocol] ?? "hover:bg-muted/50",
                  isSelected && "bg-primary/10",
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => selectPacket(isSelected ? null : pkt.id)}
              >
                <PacketRow packet={pkt} />
              </button>
            );
          })}
        </div>

        {!shouldAutoScroll && filtered.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setShouldAutoScroll(true);
              rowVirtualizer.scrollToIndex(filtered.length - 1, { align: "end" });
            }}
            className="fixed bottom-12 right-4 z-10 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-[11px] text-muted-foreground shadow-lg transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowDown className="size-3.5" weight="bold" />
            Jump to realtime
          </button>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between border-t border-border bg-card px-3 py-1 text-[10px] text-muted-foreground">
        <span>
          Packets: {filtered.length.toLocaleString()}
          {displayFilter.trim() && ` (filtered from ${packets.length.toLocaleString()})`}
        </span>
        <span>
          Display: {packets.length.toLocaleString()} · Profile: Default
        </span>
      </div>
    </div>
  );
}

function PacketRow({ packet }: { packet: Packet }) {
  const dir = packet.direction ? DIR_ARROW[packet.direction] : null;

  return (
    <>
      <span className="w-[60px] text-muted-foreground">{packet.no}</span>
      <span className="w-[90px] text-muted-foreground">
        {formatTime(packet.timestamp)}
      </span>
      <span className="w-[140px] truncate">{packet.source}</span>
      <span className={cn("w-[24px] text-center", dir?.color ?? "text-muted-foreground/30")} title={dir?.title}>
        {dir?.symbol ?? "·"}
      </span>
      <span className="w-[140px] truncate">{packet.dest}</span>
      <span
        className={cn(
          "w-[70px] font-semibold",
          PROTOCOL_COLORS[packet.protocol] ?? "text-foreground",
        )}
      >
        {packet.protocol}
      </span>
      <span className="w-[60px] text-muted-foreground">{packet.length}</span>
      <span className="flex-1 truncate text-foreground/80">{packet.info}</span>
    </>
  );
}
