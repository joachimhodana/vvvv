import { create } from "zustand";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

export type ConnectionFilters = {
  protocol: string;
  search: string;
};

type State = {
  status: ConnectionStatus;
  filters: ConnectionFilters;
};

type Actions = {
  setStatus: (status: ConnectionStatus) => void;
  setProtocol: (protocol: ConnectionFilters["protocol"]) => void;
  setSearch: (search: string) => void;
};

export const useConnectionStore = create<State & Actions>((set) => ({
  status: "idle",
  filters: {
    protocol: "all",
    search: "",
  },
  setStatus: (status) => set({ status }),
  setProtocol: (protocol) =>
    set((state) => ({
      filters: {
        ...state.filters,
        protocol,
      },
    })),
  setSearch: (search) =>
    set((state) => ({
      filters: {
        ...state.filters,
        search,
      },
    })),
}));
