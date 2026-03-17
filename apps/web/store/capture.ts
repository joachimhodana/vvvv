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
  payloadHex?: string;
  streamId?: number;
  streamIndex?: number;
  streamProto?: string;
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

// ---------------------------------------------------------------------------
// Wireshark-style display filter engine
// ---------------------------------------------------------------------------
//
// Supported syntax:
//   Bare protocol:  http, tcp, udp, dns, arp, icmp, tls, ssh, ...
//   Fields:         ip.addr, ip.src, ip.dst, tcp.port, tcp.srcport,
//                   tcp.dstport, udp.port, udp.srcport, udp.dstport,
//                   tcp.flags.syn, tcp.flags.ack, tcp.flags.fin, tcp.flags.rst,
//                   http.request.method, frame.len, tcp.len
//   Operators:      ==  !=  >  <  >=  <=
//   Contains:       tcp contains "GET"
//   Logical:        &&  ||  and  or  !  not
//   Grouping:       ( ... )
//   Negated group:  !(arp or dns)
// ---------------------------------------------------------------------------

export function validateFilter(filter: string): boolean {
  const raw = filter.trim();
  if (raw.length === 0) return true;
  try {
    const tokens = tokenize(raw);
    const ast = parseOr(tokens, { pos: 0 });
    return ast.kind !== "true" || tokens.length === 0;
  } catch {
    return false;
  }
}

export function matchesFilter(packet: Packet, filter: string): boolean {
  const raw = filter.trim();
  if (raw.length === 0) return true;
  try {
    const tokens = tokenize(raw);
    const ast = parseOr(tokens, { pos: 0 });
    return evalNode(ast, packet);
  } catch {
    return true;
  }
}

// --- Tokenizer ---

type Token =
  | { type: "LPAREN" }
  | { type: "RPAREN" }
  | { type: "NOT" }
  | { type: "AND" }
  | { type: "OR" }
  | { type: "OP"; value: string }
  | { type: "CONTAINS" }
  | { type: "STRING"; value: string }
  | { type: "WORD"; value: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    if (input[i] === " " || input[i] === "\t") { i++; continue; }
    if (input[i] === "(") { tokens.push({ type: "LPAREN" }); i++; continue; }
    if (input[i] === ")") { tokens.push({ type: "RPAREN" }); i++; continue; }
    if (input[i] === "!" && input[i + 1] !== "=") { tokens.push({ type: "NOT" }); i++; continue; }
    if (input[i] === "&" && input[i + 1] === "&") { tokens.push({ type: "AND" }); i += 2; continue; }
    if (input[i] === "|" && input[i + 1] === "|") { tokens.push({ type: "OR" }); i += 2; continue; }
    // Multi-char comparison ops
    if ((input[i] === ">" || input[i] === "<" || input[i] === "!" || input[i] === "=") && input[i + 1] === "=") {
      tokens.push({ type: "OP", value: `${input[i]}=` }); i += 2; continue;
    }
    if (input[i] === ">" || input[i] === "<") {
      tokens.push({ type: "OP", value: input[i] }); i++; continue;
    }
    if (input[i] === "=" && input[i + 1] === "=") {
      tokens.push({ type: "OP", value: "==" }); i += 2; continue;
    }
    // Quoted string
    if (input[i] === '"' || input[i] === "'") {
      const quote = input[i];
      let j = i + 1;
      while (j < input.length && input[j] !== quote) j++;
      tokens.push({ type: "STRING", value: input.slice(i + 1, j) });
      i = j + 1; continue;
    }
    // Word (field, protocol, number, keyword)
    let j = i;
    while (j < input.length && !/[\s()&|!=<>"']/.test(input[j])) j++;
    const word = input.slice(i, j);
    const wl = word.toLowerCase();
    if (wl === "and") tokens.push({ type: "AND" });
    else if (wl === "or") tokens.push({ type: "OR" });
    else if (wl === "not") tokens.push({ type: "NOT" });
    else if (wl === "contains") tokens.push({ type: "CONTAINS" });
    else if (wl === "eq") tokens.push({ type: "OP", value: "==" });
    else if (wl === "ne") tokens.push({ type: "OP", value: "!=" });
    else if (wl === "gt") tokens.push({ type: "OP", value: ">" });
    else if (wl === "lt") tokens.push({ type: "OP", value: "<" });
    else if (wl === "ge") tokens.push({ type: "OP", value: ">=" });
    else if (wl === "le") tokens.push({ type: "OP", value: "<=" });
    else tokens.push({ type: "WORD", value: word });
    i = j;
  }
  return tokens;
}

// --- AST ---

type ASTNode =
  | { kind: "or"; left: ASTNode; right: ASTNode }
  | { kind: "and"; left: ASTNode; right: ASTNode }
  | { kind: "not"; child: ASTNode }
  | { kind: "compare"; field: string; op: string; value: string }
  | { kind: "contains"; field: string; value: string }
  | { kind: "protocol"; name: string }
  | { kind: "true" };

type Cursor = { pos: number };

function peek(tokens: Token[], c: Cursor): Token | undefined {
  return tokens[c.pos];
}

function consume(tokens: Token[], c: Cursor): Token {
  return tokens[c.pos++];
}

// or-expr = and-expr ( ("||" | "or") and-expr )*
function parseOr(tokens: Token[], c: Cursor): ASTNode {
  let left = parseAnd(tokens, c);
  while (peek(tokens, c)?.type === "OR") {
    consume(tokens, c);
    const right = parseAnd(tokens, c);
    left = { kind: "or", left, right };
  }
  return left;
}

// and-expr = unary-expr ( ("&&" | "and") unary-expr )*
function parseAnd(tokens: Token[], c: Cursor): ASTNode {
  let left = parseUnary(tokens, c);
  while (peek(tokens, c)?.type === "AND") {
    consume(tokens, c);
    const right = parseUnary(tokens, c);
    left = { kind: "and", left, right };
  }
  return left;
}

// unary-expr = ("!" | "not") unary-expr | primary
function parseUnary(tokens: Token[], c: Cursor): ASTNode {
  if (peek(tokens, c)?.type === "NOT") {
    consume(tokens, c);
    return { kind: "not", child: parseUnary(tokens, c) };
  }
  return parsePrimary(tokens, c);
}

// primary = "(" or-expr ")" | field-expr | protocol
function parsePrimary(tokens: Token[], c: Cursor): ASTNode {
  const t = peek(tokens, c);
  if (!t) return { kind: "true" };

  if (t.type === "LPAREN") {
    consume(tokens, c);
    const node = parseOr(tokens, c);
    if (peek(tokens, c)?.type === "RPAREN") consume(tokens, c);
    return node;
  }

  if (t.type === "WORD") {
    const field = consume(tokens, c) as Token & { value: string };
    const next = peek(tokens, c);

    // field OP value
    if (next?.type === "OP") {
      const op = (consume(tokens, c) as Token & { value: string }).value;
      const val = peek(tokens, c);
      const value = val && (val.type === "WORD" || val.type === "STRING")
        ? (consume(tokens, c) as Token & { value: string }).value
        : "";
      return { kind: "compare", field: field.value, op, value };
    }

    // field contains "value"
    if (next?.type === "CONTAINS") {
      consume(tokens, c);
      const val = peek(tokens, c);
      const value = val && (val.type === "WORD" || val.type === "STRING")
        ? (consume(tokens, c) as Token & { value: string }).value
        : "";
      return { kind: "contains", field: field.value, value };
    }

    // bare protocol name
    return { kind: "protocol", name: field.value };
  }

  // skip unknown token
  consume(tokens, c);
  return { kind: "true" };
}

// --- Evaluator ---

const PROTOCOL_ALIASES: Record<string, string[]> = {
  http:      ["http", "https", "websocket", "sse"],
  tls:       ["tls", "https"],
  icmp:      ["icmp", "icmpv6"],
  tcp:       ["tcp", "http", "https", "tls", "ssh", "smtp", "ftp", "imap", "pop3", "mysql", "postgresql", "redis", "mongodb", "websocket", "sse"],
  udp:       ["udp", "dns", "mdns", "dhcp", "ntp", "ssdp"],
  websocket: ["websocket"],
  ws:        ["websocket"],
  sse:       ["sse"],
};

function extractPort(addr: string): number {
  const i = addr.lastIndexOf(":");
  if (i === -1) return 0;
  // Handle IPv6 [::1]:port
  const portStr = addr.slice(i + 1);
  return parseInt(portStr, 10) || 0;
}

function extractIP(addr: string): string {
  // [::1]:port  or  1.2.3.4:80
  if (addr.startsWith("[")) {
    const i = addr.indexOf("]");
    return i > 0 ? addr.slice(1, i) : addr;
  }
  const i = addr.lastIndexOf(":");
  return i > 0 ? addr.slice(0, i) : addr;
}

function getField(p: Packet, field: string): string | number | boolean | undefined {
  const f = field.toLowerCase();
  switch (f) {
    case "ip.addr": return undefined; // handled specially
    case "ip.src": return extractIP(p.source);
    case "ip.dst": return extractIP(p.dest);
    case "tcp.port": return undefined; // handled specially
    case "tcp.srcport": return extractPort(p.source);
    case "tcp.dstport": return extractPort(p.dest);
    case "udp.port": return undefined; // handled specially
    case "udp.srcport": return extractPort(p.source);
    case "udp.dstport": return extractPort(p.dest);
    case "tcp.stream": return p.streamId ?? 0;
    case "frame.len": return p.length;
    case "tcp.len": {
      const layer = p.layers?.find((l) => l.name === "TCP");
      return layer ? parseInt(layer.fields["Payload Length"] ?? "0", 10) : 0;
    }
    case "tcp.flags.syn": return flagSet(p, "SYN");
    case "tcp.flags.ack": return flagSet(p, "ACK");
    case "tcp.flags.fin": return flagSet(p, "FIN");
    case "tcp.flags.rst": return flagSet(p, "RST");
    case "tcp.flags.psh": return flagSet(p, "PSH");
    case "tcp.flags.urg": return flagSet(p, "URG");
    case "http.request.method":
    case "http.method":
    case "req.http.method": {
      const layer = p.layers?.find((l) =>
        l.name === "HTTP" || l.name === "WebSocket" || l.name === "SSE"
      );
      if (!layer) return undefined;
      const line = layer.fields["Request/Status Line"] ?? "";
      const m = line.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s/);
      return m ? m[1] : undefined;
    }
    case "http.host": {
      const layer = p.layers?.find((l) =>
        l.name === "HTTP" || l.name === "WebSocket" || l.name === "SSE"
      );
      return layer?.fields.Host;
    }
    case "http.response.code":
    case "http.status": {
      const layer = p.layers?.find((l) =>
        l.name === "HTTP" || l.name === "WebSocket" || l.name === "SSE"
      );
      if (!layer) return undefined;
      const line = layer.fields["Request/Status Line"] ?? "";
      const m = line.match(/^HTTP\/\S+\s+(\d+)/);
      return m ? parseInt(m[1], 10) : undefined;
    }
    case "dns.qry.name": {
      const layer = p.layers?.find((l) => l.name === "DNS");
      if (!layer) return undefined;
      const m = p.info.match(/\s(\S+)$/);
      return m ? m[1] : undefined;
    }
    default: return undefined;
  }
}

function flagSet(p: Packet, flag: string): boolean {
  const layer = p.layers?.find((l) => l.name === "TCP");
  if (!layer) return false;
  const flags = layer.fields.Flags ?? "";
  return flags.includes(flag);
}

function compare(a: string | number | boolean | undefined, op: string, b: string): boolean {
  if (a === undefined) return false;
  // Numeric comparison (only when both sides are strictly numeric).
  const aStr = typeof a === "number" ? String(a) : String(a);
  const isStrictNumber = (s: string) => /^-?\d+(\.\d+)?$/.test(s.trim());
  if (isStrictNumber(aStr) && isStrictNumber(b)) {
    const numA = parseFloat(aStr);
    const numB = parseFloat(b);
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      switch (op) {
        case "==": return numA === numB;
        case "!=": return numA !== numB;
        case ">":  return numA > numB;
        case "<":  return numA < numB;
        case ">=": return numA >= numB;
        case "<=": return numA <= numB;
      }
    }
  }
  // Boolean comparison
  if (typeof a === "boolean") {
    const boolB = b === "1" || b === "true";
    switch (op) {
      case "==": return a === boolB;
      case "!=": return a !== boolB;
    }
    return false;
  }
  // String comparison
  const strA = String(a).toLowerCase();
  const strB = b.toLowerCase();
  switch (op) {
    case "==": return strA === strB;
    case "!=": return strA !== strB;
    default: return false;
  }
}

function evalNode(node: ASTNode, p: Packet): boolean {
  switch (node.kind) {
    case "true": return true;
    case "or":  return evalNode(node.left, p) || evalNode(node.right, p);
    case "and": return evalNode(node.left, p) && evalNode(node.right, p);
    case "not": return !evalNode(node.child, p);

    case "protocol": {
      const name = node.name.toLowerCase();
      const proto = p.protocol.toLowerCase();
      const aliases = PROTOCOL_ALIASES[name];
      if (aliases) return aliases.includes(proto);
      return proto === name;
    }

    case "compare": {
      const f = node.field.toLowerCase();
      // ip.addr == x  →  source or dest matches
      if (f === "ip.addr") {
        const srcIP = extractIP(p.source);
        const dstIP = extractIP(p.dest);
        return compare(srcIP, node.op, node.value) || compare(dstIP, node.op, node.value);
      }
      // tcp.port == x  →  srcport or dstport matches
      if (f === "tcp.port" || f === "udp.port") {
        const srcP = extractPort(p.source);
        const dstP = extractPort(p.dest);
        return compare(srcP, node.op, node.value) || compare(dstP, node.op, node.value);
      }
      const val = getField(p, node.field);
      return compare(val, node.op, node.value);
    }

    case "contains": {
      const f = node.field.toLowerCase();
      const needle = node.value.toLowerCase();
      if (f === "tcp" || f === "udp" || f === "frame") {
        return (p.payload?.toLowerCase().includes(needle) ?? false) ||
               p.info.toLowerCase().includes(needle);
      }
      const val = getField(p, f);
      if (val !== undefined) return String(val).toLowerCase().includes(needle);
      return p.info.toLowerCase().includes(needle) ||
             (p.payload?.toLowerCase().includes(needle) ?? false);
    }
  }
}
