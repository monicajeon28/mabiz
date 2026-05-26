/**
 * Authentication Context (Stub)
 *
 * TODO: Full implementation pending
 * - Connect with Clerk auth system
 * - Implement user context provider
 * - Add role-based access control
 *
 * Current usage: Referenced in campaigns/sending-history pages
 * Last updated: 2026-05-26
 */

import React, { createContext, ReactNode, FC, useState, useContext, useEffect } from 'react';

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  role?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
}

/**
 * Auth Context - Use this in Provider component
 */
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

/**
 * Hook to use auth context
 * @throws Error if used outside AuthProvider
 */
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};

/**
 * Auth Provider Component (Stub)
 * TODO: Integrate with Clerk or your auth solution
 */
export const AuthProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // TODO: Initialize auth from Clerk or session
    setLoading(false);
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
};

export default {
  AuthContext,
  useAuthContext,
  AuthProvider,
};
