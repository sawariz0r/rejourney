import React, { createContext, useContext } from 'react';

const DashboardManualRefreshContext = createContext(0);

interface DashboardManualRefreshProviderProps {
  children: React.ReactNode;
  value: number;
}

export const DashboardManualRefreshProvider: React.FC<DashboardManualRefreshProviderProps> = ({ children, value }) => (
  <DashboardManualRefreshContext.Provider value={value}>
    {children}
  </DashboardManualRefreshContext.Provider>
);

export function useDashboardManualRefreshVersion(): number {
  return useContext(DashboardManualRefreshContext);
}
