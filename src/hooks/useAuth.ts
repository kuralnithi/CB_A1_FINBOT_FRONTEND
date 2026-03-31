'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PAGE_ROUTES } from '@/lib/routes';
import type { User } from '@/lib/types';

interface UseAuthOptions {
  /** If set, redirects to CHAT if user doesn't have this role. */
  requiredRole?: string;
}

interface UseAuthReturn {
  user: User | null;
  token: string;
  isLoading: boolean;
  logout: () => void;
}

/**
 * Custom hook for authentication state.
 *
 * Reads token + user from localStorage, handles redirect on missing auth,
 * and provides a logout function. Eliminates duplicated localStorage
 * logic across login, chat, and admin pages.
 */
export function useAuth(options: UseAuthOptions = {}): UseAuthReturn {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('finbot_token');
    const storedUser = localStorage.getItem('finbot_user');

    if (!storedToken || !storedUser) {
      router.push(PAGE_ROUTES.LOGIN);
      return;
    }

    const parsed: User = JSON.parse(storedUser);

    if (options.requiredRole && parsed.role !== options.requiredRole) {
      router.push(PAGE_ROUTES.CHAT);
      return;
    }

    setToken(storedToken);
    setUser(parsed);
    setIsLoading(false);
  }, [router, options.requiredRole]);

  const logout = () => {
    localStorage.removeItem('finbot_token');
    localStorage.removeItem('finbot_user');
    router.push(PAGE_ROUTES.LOGIN);
  };

  return { user, token, isLoading, logout };
}
