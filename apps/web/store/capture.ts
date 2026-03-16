import { create } from "zustand";

export type LayerInfo = {
  name: string;
  fields: Record<string, string>;
};

export type Packet = {
  no: number;
  id: string;
  timestamp: string;
  protocol: string;
  source: string;
  dest: string;
  direction?: string;
  length: number;
  info: string;
  layers?: LayerInfo[];
  payload?: string;
};

const MAX_PACKETS = 50_000;

type State = {
  packets: Packet[];
  selectedId: string | null;
  displayFilter: string;
  isCapturing: boolean;
};

type Actions = {
  addPacket: (p: Packet) => void;
  addPackets: (ps: Packet[]) => void;
  selectPacket: (id: string | null) => void;
  setDisplayFilter: (filter: string) => void;
  setCapturing: (v: boolean) => void;
  clearPackets: () => void;
};

let pendingPackets: Packet[] = [];
let flushScheduled = false;

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  requestAnimationFrame(() => {
    flushScheduled = false;
    const batch = pendingPackets;
    pendingPackets = [];
    if (batch.length === 0) return;
    useCaptureStore.setState((s) => {
      const merged =
        s.packets.length + batch.length > MAX_PACKETS
          ? [...s.packets, ...batch].slice(-MAX_PACKETS)
          : [...s.packets, ...batch];
      return { packets: merged };
    });
  });
}

export const useCaptureStore = create<State & Actions>((set) => ({
  packets: [],
  selectedId: null,
  displayFilter: "",
  isCapturing: true,

  addPacket: (p) => {
    pendingPackets.push(p);
    scheduleFlush();
  },

  addPackets: (ps) => {
    pendingPackets.push(...ps);
    scheduleFlush();
  },

  selectPacket: (id) => set({ selectedId: id }),
  setDisplayFilter: (filter) => set({ displayFilter: filter }),
  setCapturing: (v) => set({ isCapturing: v }),
  clearPackets: () => {
    pendingPackets = [];
    set({ packets: [], selectedId: null });
  },
}));

/**
 * Evaluates a Wireshark-style display filter against a packet.
 * Supports: `ip.src == x`, `ip.dst == x`, `tcp`, `udp`, `http`, `dns`, etc.,
 * `&&`, `||`, `!`, and bare protocol names.
 */
export function matchesFilter(packet: Packet, filter: string): boolean {
  const raw = filter.trim();
  if (raw.length === 0) return true;

  const lower = raw.toLowerCase();

  if (lower.includes("||")) {
    return lower.split("||").some((part) => matchesFilter(packet, part));
  }

  if (lower.includes("&&")) {
    return lower.split("&&").every((part) => matchesFilter(packet, part));
  }

  const negated = lower.startsWith("!");
  const expr = negated ? lower.slice(1).trim() : lower;
  const result = evaluateExpression(packet, expr);
  return negated ? !result : result;
}

function evaluateExpression(p: Packet, expr: string): boolean {
  if (expr.startsWith("ip.src")) {
    const val = extractValue(expr);
    return val ? p.source.toLowerCase().includes(val) : false;
  }
  if (expr.startsWith("ip.dst")) {
    const val = extractValue(expr);
    return val ? p.dest.toLowerCase().includes(val) : false;
  }
  if (expr.startsWith("ip.addr")) {
    const val = extractValue(expr);
    return val ? p.source.toLowerCase().includes(val) || p.dest.toLowerCase().includes(val) : false;
  }
  if (expr.startsWith("frame.len")) {
    const match = expr.match(/(>=|<=|>|<|==|!=)\s*(\d+)/);
    if (!match) return false;
    const op = match[1];
    const num = parseInt(match[2], 10);
    switch (op) {
      case "==":
        return p.length === num;
      case "!=":
        return p.length !== num;
      case ">":
        return p.length > num;
      case "<":
        return p.length < num;
      case ">=":
        return p.length >= num;
      case "<=":
        return p.length <= num;
    }
    return false;
  }

  return (
    p.protocol.toLowerCase() === expr ||
    p.info.toLowerCase().includes(expr) ||
    p.source.toLowerCase().includes(expr) ||
    p.dest.toLowerCase().includes(expr)
  );
}

function extractValue(expr: string): string | null {
  const match = expr.match(/==\s*(.+)/);
  return match ? match[1].trim() : null;
}
