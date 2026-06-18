'use client';

import React, { createContext, useContext, ReactNode, FC } from 'react';

interface SessionContextType {
  role?: string;
  organizationId?: string;
  isAdmin: boolean;
}

const SessionContext = createContext<SessionContextType>({ isAdmin: false });

export function useSession(): SessionContextType {
  return useContext(SessionContext);
}

interface SessionProviderProps {
  children: ReactNode;
  session?: SessionContextType;
}

export const SessionProvider: FC<SessionProviderProps> = ({ children, session }) => {
  const val = session || { isAdmin: false };
  return React.createElement(SessionContext.Provider, { value: val }, children);
};
