'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from './api-client';
import type { Session } from './types';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Phase4 13.3節「ログイン成功後の遷移先は、ロールに応じて既定ダッシュボードを自動判定する」。
 * サーバー側のセッション(Cookie)が正であり、このコンテキストはGET /auth/sessionの結果を
 * クライアント側でキャッシュするだけの薄いラッパー。フロントエンドの表示制御は利便性のためのみで
 * あり(Phase3 16.10節)、実際の認可は各APIコールに対して常にサーバー側で行われる。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refresh = async () => {
    try {
      const s = await api.get<Session>('/auth/session');
      setSession(s);
    } catch (e) {
      if (e instanceof ApiError) {
        setSession(null);
      } else {
        throw e;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const logout = async () => {
    await api.post('/auth/logout');
    setSession(null);
    router.push('/login');
  };

  return <AuthContext.Provider value={{ session, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used within <AuthProvider>');
  return ctx;
}

/** ロールに応じた既定ダッシュボードのパス（Phase4 13.3節）。 */
export function defaultDashboardPath(role: Session['role']): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'UL') return '/ul';
  return '/';
}
