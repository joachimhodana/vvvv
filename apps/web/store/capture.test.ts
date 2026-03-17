import { describe, expect, it } from "vitest";
import { matchesFilter, type Packet } from "./capture";

function pkt(overrides: Partial<Packet> = {}): Packet {
  return {
    no: 1,
    id: "test-1",
    timestamp: "2025-01-01T00:00:00Z",
    protocol: "TCP",
    source: "10.0.0.1:12345",
    dest: "10.0.0.2:443",
    length: 100,
    info: "SYN",
    ...overrides,
  };
}

const ALL_PROTOCOLS = [
  "TCP",
  "UDP",
  "HTTP",
  "DNS",
  "TLS",
  "ICMP",
  "ICMPv6",
  "SSH",
  "SMTP",
  "ARP",
  "DHCP",
  "NTP",
  "MDNS",
  "SSDP",
  "FTP",
  "IMAP",
  "POP3",
];

describe("matchesFilter", () => {
  it("returns true when filter is empty", () => {
    expect(matchesFilter(pkt(), "")).toBe(true);
    expect(matchesFilter(pkt(), "   ")).toBe(true);
  });

  it("matches bare protocol name (case-insensitive)", () => {
    for (const proto of ALL_PROTOCOLS) {
      const p = pkt({ protocol: proto });
      expect(matchesFilter(p, proto.toLowerCase())).toBe(true);
      expect(matchesFilter(p, proto)).toBe(true);
    }
  });

  it("does not cross-match protocols", () => {
    const p = pkt({ protocol: "TCP" });
    expect(matchesFilter(p, "udp")).toBe(false);
  });

  it("matches ip.src filter", () => {
    const p = pkt({ source: "192.168.1.10:80" });
    expect(matchesFilter(p, "ip.src == 192.168.1.10")).toBe(true);
    expect(matchesFilter(p, "ip.src == 10.0.0.1")).toBe(false);
  });

  it("matches ip.dst filter", () => {
    const p = pkt({ dest: "8.8.8.8:53" });
    expect(matchesFilter(p, "ip.dst == 8.8.8.8")).toBe(true);
  });

  it("matches ip.addr filter on src or dst", () => {
    const p = pkt({ source: "10.0.0.1:80", dest: "10.0.0.2:443" });
    expect(matchesFilter(p, "ip.addr == 10.0.0.1")).toBe(true);
    expect(matchesFilter(p, "ip.addr == 10.0.0.2")).toBe(true);
    expect(matchesFilter(p, "ip.addr == 10.0.0.9")).toBe(false);
  });

  it("supports frame.len comparisons", () => {
    const p = pkt({ length: 150 });
    expect(matchesFilter(p, "frame.len == 150")).toBe(true);
    expect(matchesFilter(p, "frame.len > 100")).toBe(true);
    expect(matchesFilter(p, "frame.len < 100")).toBe(false);
    expect(matchesFilter(p, "frame.len >= 150")).toBe(true);
    expect(matchesFilter(p, "frame.len <= 150")).toBe(true);
    expect(matchesFilter(p, "frame.len != 150")).toBe(false);
  });

  it("supports && (AND)", () => {
    const p = pkt({ protocol: "TCP", source: "10.0.0.1:80" });
    expect(matchesFilter(p, "tcp && ip.src == 10.0.0.1")).toBe(true);
    expect(matchesFilter(p, "udp && ip.src == 10.0.0.1")).toBe(false);
  });

  it("supports || (OR)", () => {
    const p = pkt({ protocol: "DNS" });
    expect(matchesFilter(p, "tcp || dns")).toBe(true);
    // DNS runs over UDP, so this should match via protocol aliasing.
    expect(matchesFilter(p, "tcp || udp")).toBe(true);
  });

  it("supports ! (NOT)", () => {
    const p = pkt({ protocol: "TCP" });
    expect(matchesFilter(p, "!udp")).toBe(true);
    expect(matchesFilter(p, "!tcp")).toBe(false);
  });

  it("filters every supported protocol by name", () => {
    for (const proto of ALL_PROTOCOLS) {
      const p = pkt({ protocol: proto, source: "1.2.3.4", dest: "5.6.7.8", info: "" });
      const matches = matchesFilter(p, proto.toLowerCase());
      expect(matches).toBe(true);

      const nonMatch = matchesFilter(p, "zzz_nonexistent");
      expect(nonMatch).toBe(false);
    }
  });
});
