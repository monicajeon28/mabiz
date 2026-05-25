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

import React from 'react';

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
export const AuthContext = React.createContext<AuthContextType | undefined>(
  undefined
);

/**
 * Hook to use auth context
 * @throws Error if used outside AuthProvider
 */
export const useAuthContext = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};

/**
 * Auth Provider Component (Stub)
 * TODO: Integrate with Clerk or your auth solution
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    // TODO: Initialize auth from Clerk or session
    setLoading(false);
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default {
  AuthContext,
  useAuthContext,
  AuthProvider,
};
