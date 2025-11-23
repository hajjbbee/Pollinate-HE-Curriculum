import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Fetch current user with proper error handling
  const { data, isLoading, error } = useQuery<{ user: User | null }>({
    queryKey: ['/api/user'],
    retry: (failureCount, error: any) => {
      // Don't retry on 401 (unauthorized) - user is not logged in
      if (error?.status === 401 || error?.response?.status === 401) {
        return false;
      }
      // Retry other errors up to 2 times
      return failureCount < 2;
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
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
      const res = await apiRequest('POST', '/api/auth/signup', { email, password, firstName, lastName });
      return await res.json();
    },
    onSuccess: async () => {
      // Wait for the user query to refetch after signup
      await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      await queryClient.refetchQueries({ queryKey: ['/api/user'] });
    },
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiRequest('POST', '/api/auth/login', { email, password });
      return await res.json();
    },
    onSuccess: async () => {
      // Wait for the user query to refetch after login
      await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      await queryClient.refetchQueries({ queryKey: ['/api/user'] });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/auth/logout');
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest('POST', '/api/auth/reset-password', { email });
      return await res.json();
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
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, signup, login, logout, resetPassword }}>
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
