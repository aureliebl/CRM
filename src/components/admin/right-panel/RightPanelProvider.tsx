"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { RightPanelHost } from "./RightPanelHost";

type RightPanelEntity = unknown;

type OpenRightPanelInput = {
  panelId: string;
  entity: unknown;
  contextKey: string;
};

type RightPanelState = {
  panelId: string | null;
  contextKey: string | null;
  entity: RightPanelEntity | null;
  collapsed: boolean;
};

type RightPanelContextValue = {
  state: RightPanelState;
  openPanel: (input: OpenRightPanelInput) => void;
  closePanel: () => void;
  toggleCollapse: () => void;
};

const RightPanelContext = createContext<RightPanelContextValue | null>(null);

export function RightPanelProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RightPanelState>({
    panelId: null,
    contextKey: null,
    entity: null,
    collapsed: false,
  });

  const value = useMemo<RightPanelContextValue>(() => {
    return {
      state,
      openPanel: (input) => {
        setState({
          panelId: input.panelId,
          contextKey: input.contextKey,
          entity: input.entity,
          collapsed: false,
        });
      },
      closePanel: () => {
        setState({
          panelId: null,
          contextKey: null,
          entity: null,
          collapsed: false,
        });
      },
      toggleCollapse: () => {
        setState((current) => ({
          ...current,
          collapsed: !current.collapsed,
        }));
      },
    };
  }, [state]);

  return (
    <RightPanelContext.Provider value={value}>
      {children}
      <RightPanelHost />
    </RightPanelContext.Provider>
  );
}

export function useRightPanel() {
  const ctx = useContext(RightPanelContext);
  if (!ctx) {
    throw new Error("useRightPanel must be used inside RightPanelProvider");
  }
  return ctx;
}
