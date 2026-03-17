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
  HTTPS: "text-emerald-300",
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
  MySQL: "text-blue-300",
  PostgreSQL: "text-sky-300",
  Redis: "text-red-300",
  MongoDB: "text-green-300",
  WebSocket: "text-yellow-300",
  SSE: "text-amber-300",
};

const PROTOCOL_ROW_BG: Record<string, string> = {
  TCP: "hover:bg-violet-500/5",
  UDP: "hover:bg-cyan-500/5",
  HTTP: "hover:bg-emerald-500/5",
  HTTPS: "hover:bg-emerald-400/5",
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
  MySQL: "hover:bg-blue-300/5",
  PostgreSQL: "hover:bg-sky-300/5",
  Redis: "hover:bg-red-300/5",
  MongoDB: "hover:bg-green-300/5",
  WebSocket: "hover:bg-yellow-300/5",
  SSE: "hover:bg-amber-300/5",
};

const STREAM_TEXT_COLORS = [
  "text-blue-400", "text-emerald-400", "text-amber-400", "text-rose-400",
  "text-violet-400", "text-cyan-400", "text-orange-400", "text-pink-400",
  "text-teal-400", "text-lime-400", "text-indigo-400", "text-fuchsia-400",
];

const STREAM_BG_COLORS = [
  "bg-blue-400", "bg-emerald-400", "bg-amber-400", "bg-rose-400",
  "bg-violet-400", "bg-cyan-400", "bg-orange-400", "bg-pink-400",
  "bg-teal-400", "bg-lime-400", "bg-indigo-400", "bg-fuchsia-400",
];

function streamTextColor(streamId: number): string {
  return STREAM_TEXT_COLORS[(streamId - 1) % STREAM_TEXT_COLORS.length];
}

function streamBgColor(streamId: number): string {
  return STREAM_BG_COLORS[(streamId - 1) % STREAM_BG_COLORS.length];
}

const COLUMNS = [
  { key: "stream", label: "", width: "w-[28px]" },
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
  in: { symbol: "→", color: "text-blue-400", title: "Incoming" },
  out: { symbol: "←", color: "text-orange-400", title: "Outgoing" },
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

  const virtualItems = rowVirtualizer.getVirtualItems();

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
          {virtualItems.map((virtualRow) => {
            const pkt = filtered[virtualRow.index];
            if (!pkt) return null;

            const isSelected = pkt.id === selectedId;

            const sid = pkt.streamId;
            const prev = virtualRow.index > 0 ? filtered[virtualRow.index - 1] : null;
            const next = virtualRow.index < filtered.length - 1 ? filtered[virtualRow.index + 1] : null;
            const lineUp = !!sid && prev?.streamId === sid;
            const lineDown = !!sid && next?.streamId === sid;

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
                <StreamIndicator
                  streamId={sid}
                  lineUp={lineUp}
                  lineDown={lineDown}
                />
                <PacketRow packet={pkt} highlight={displayFilter} />
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
        <span>Display: {packets.length.toLocaleString()} · Profile: Default</span>
      </div>
    </div>
  );
}

function highlightText(text: string, term: string) {
  if (!term) return text;
  // Extract simple string terms from the filter (strip operators)
  const cleaned = term
    .replace(/\b(ip\.src|ip\.dst|ip\.addr|frame\.len)\s*(==|!=|>=|<=|>|<)\s*/gi, "")
    .replace(/&&|\|\|/g, " ")
    .replace(/!/g, "")
    .trim();
  if (!cleaned) return text;

  const words = cleaned.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) return text;

  try {
    const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    const parts = text.split(re);
    if (parts.length <= 1) return text;
    const nodes: Array<string | JSX.Element> = [];
    let offset = 0;
    for (const part of parts) {
      const idx = text.toLowerCase().indexOf(part.toLowerCase(), offset);
      const key = idx >= 0 ? idx : offset;
      offset = (idx >= 0 ? idx : offset) + part.length;

      if (re.test(part)) {
        nodes.push(
          <mark key={`m-${key}`} className="rounded bg-amber-500/30 px-0.5 text-foreground">
            {part}
          </mark>,
        );
      } else {
        nodes.push(part);
      }
    }
    return nodes;
  } catch {
    return text;
  }
}

function StreamIndicator({
  streamId,
  lineUp,
  lineDown,
}: {
  streamId?: number;
  lineUp: boolean;
  lineDown: boolean;
}) {
  if (!streamId) {
    return <span className="w-[28px]" />;
  }
  const textColor = streamTextColor(streamId);
  const bgColor = streamBgColor(streamId);

  return (
    <span className="relative flex w-[28px] items-center justify-center" title={`Stream #${streamId}`}>
      {lineUp && (
        <span className={cn("absolute left-1/2 top-0 h-1/2 w-[2px] -translate-x-1/2 opacity-30", bgColor)} />
      )}
      {lineDown && (
        <span className={cn("absolute left-1/2 bottom-0 h-1/2 w-[2px] -translate-x-1/2 opacity-30", bgColor)} />
      )}
      <span className={cn("relative z-10 text-[9px] font-bold leading-none", textColor)}>
        {streamId}
      </span>
    </span>
  );
}

function PacketRow({ packet, highlight }: { packet: Packet; highlight: string }) {
  const dir = packet.direction ? DIR_ARROW[packet.direction] : null;

  return (
    <>
      <span className="w-[60px] text-muted-foreground">{packet.no}</span>
      <span className="w-[90px] text-muted-foreground">{formatTime(packet.timestamp)}</span>
      <span className="w-[140px] truncate">{highlightText(packet.source, highlight)}</span>
      <span
        className={cn("w-[24px] text-center", dir?.color ?? "text-muted-foreground/30")}
        title={dir?.title}
      >
        {dir?.symbol ?? "·"}
      </span>
      <span className="w-[140px] truncate">{highlightText(packet.dest, highlight)}</span>
      <span
        className={cn(
          "w-[70px] font-semibold",
          PROTOCOL_COLORS[packet.protocol] ?? "text-foreground",
        )}
      >
        {packet.protocol}
      </span>
      <span className="w-[60px] text-muted-foreground">{packet.length}</span>
      <span className="flex-1 truncate text-foreground/80">{highlightText(packet.info, highlight)}</span>
    </>
  );
}
