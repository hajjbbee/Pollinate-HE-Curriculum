import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Fetch current user
  const { data, isLoading } = useQuery({
    queryKey: ['/api/user'],
    retry: false,
  });

  const user = data?.user || null;

  // Signup mutation
  const signupMutation = useMutation({
    mutationFn: async ({ email, password, firstName, lastName }: { 
      email: string; 
      password: string; 
      firstName: string; 
      lastName: string; 
    }) => {
      return await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, firstName, lastName }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/auth/logout', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      return await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const signup = async (email: string, password: string, firstName: string, lastName: string) => {
    await signupMutation.mutateAsync({ email, password, firstName, lastName });
  };

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const resetPassword = async (email: string) => {
    await resetPasswordMutation.mutateAsync(email);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signup, login, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
