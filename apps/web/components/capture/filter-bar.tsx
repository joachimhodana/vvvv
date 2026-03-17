"use client";

import { useCallback, useState } from "react";
import { useCaptureStore } from "@/store/capture";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Pause, Trash, FunnelSimple } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type NetInterface = { name: string; description: string };

type FilterBarProps = {
  interfaces: NetInterface[];
  activeDevice: string | null;
  disabled?: boolean;
  onTogglePause: () => void;
  onSelectDevice: (name: string) => void;
};

export function FilterBar({
  interfaces,
  activeDevice,
  disabled = false,
  onTogglePause,
  onSelectDevice,
}: FilterBarProps) {
  const { displayFilter, setDisplayFilter, isCapturing, clearPackets } = useCaptureStore();
  const [localFilter, setLocalFilter] = useState(displayFilter);

  const applyFilter = useCallback(() => {
    setDisplayFilter(localFilter);
  }, [localFilter, setDisplayFilter]);

  return (
    <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onTogglePause}
          title={isCapturing ? "Pause capture" : "Resume capture"}
        >
          {isCapturing ? (
            <Pause className="size-3.5" weight="bold" />
          ) : (
            <Play className="size-3.5" weight="bold" />
          )}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={clearPackets} title="Clear packets">
          <Trash className="size-3.5" weight="bold" />
        </Button>
      </div>

      {interfaces.length > 0 && (
        <>
          <div className="h-4 w-px bg-border" />
          <Select
            value={activeDevice ?? ""}
            onValueChange={(val) => {
              if (val) onSelectDevice(val);
            }}
            disabled={disabled}
          >
            <SelectTrigger size="sm" disabled={disabled}>
              <SelectValue placeholder="Interface…" />
            </SelectTrigger>
            <SelectContent>
              {interfaces.map((iface) => (
                <SelectItem key={iface.name} value={iface.name}>
                  <span className="font-mono text-[11px]">
                    {iface.name}
                    {iface.description ? ` (${iface.description})` : ""}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      <div className="h-4 w-px bg-border" />

      <div className="relative flex flex-1 items-center">
        <FunnelSimple className="absolute left-2.5 size-3.5 text-muted-foreground" />
        <input
          type="text"
          className={cn(
            "h-7 w-full rounded-md border bg-background pl-8 pr-3 font-mono text-xs outline-none transition-colors placeholder:text-muted-foreground",
            localFilter.length > 0 && localFilter !== displayFilter
              ? "border-amber-500/50"
              : "border-border",
          )}
          placeholder="Apply a display filter… e.g. tcp && ip.src == 192.168.0.1"
          value={localFilter}
          onChange={(e) => setLocalFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyFilter();
            if (e.key === "Escape") {
              setLocalFilter(displayFilter);
            }
          }}
        />
      </div>

      <Button variant="outline" size="sm" onClick={applyFilter}>
        Apply
      </Button>
    </div>
  );
}
