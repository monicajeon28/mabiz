'use client';

import { createContext, useContext } from 'react';

interface SessionContextType {
  role?: string;
  organizationId?: string;
  isAdmin: boolean;
}

const SessionContext = createContext<SessionContextType>({ isAdmin: false });

export function useSession() {
  return useContext(SessionContext);
}

export function SessionProvider({ children, session }: { children: React.ReactNode; session?: SessionContextType }) {
  return (
    <SessionContext.Provider value={session || { isAdmin: false }}>
      {children}
    </SessionContext.Provider>
  );
}
