import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  createVaifClient,
  type VaifClient,
  type VaifClientConfig,
  type User,
  type AuthResponse,
} from "@vaiftech/client";

// ============ TYPES ============

/**
 * Stored auth state for persistence
 */
interface StoredAuthState {
  token: string;
  refreshToken?: string;
  expiresAt?: string;
}

export interface VaifContextValue {
  /** The VAIF client instance */
  client: VaifClient;

  /** Current authenticated user (null if not authenticated) */
  user: User | null;

  /** Current access token */
  token: string | null;

  /** Whether authentication is being checked */
  isLoading: boolean;

  /** Whether user is authenticated */
  isAuthenticated: boolean;

  /** Sign in with email/password */
  signIn: (email: string, password: string) => Promise<AuthResponse>;

  /** Sign up with email/password */
  signUp: (
    email: string,
    password: string,
    metadata?: Record<string, unknown>
  ) => Promise<AuthResponse>;

  /** Sign out the current user */
  signOut: () => Promise<void>;

  /** Refresh the session */
  refreshSession: () => Promise<void>;

  /** Update the current user in state */
  updateUser: (updates: Partial<User>) => void;
}

export interface VaifProviderProps {
  /** Pre-created VAIF client instance (preferred) */
  client?: VaifClient;

  /** VAIF client configuration (creates client internally) */
  config?: VaifClientConfig;

  /** Child components */
  children: ReactNode;

  /** Callback when auth state changes */
  onAuthStateChange?: (user: User | null) => void;

  /** Auto refresh session before expiry (default: true) */
  autoRefreshSession?: boolean;

  /** Storage key for session persistence (default: 'vaif-auth') */
  storageKey?: string;
}

// ============ CONTEXT ============

const VaifContext = createContext<VaifContextValue | null>(null);

// ============ PROVIDER ============

export function VaifProvider({
  client: externalClient,
  config,
  children,
  onAuthStateChange,
  autoRefreshSession = true,
  storageKey = "vaif-auth",
}: VaifProviderProps) {
  const [client] = useState(() => {
    if (externalClient) return externalClient;
    if (config) return createVaifClient(config);
    throw new Error("VaifProvider requires either a 'client' or 'config' prop");
  });
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save auth state to storage
  const saveAuthState = useCallback(
    (authToken: string, authRefreshToken?: string, authExpiresAt?: string) => {
      if (typeof window === 'undefined') return;
      try {
        const state: StoredAuthState = {
          token: authToken,
          refreshToken: authRefreshToken,
          expiresAt: authExpiresAt,
        };
        window.localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        // localStorage may not be available
      }
    },
    [storageKey]
  );

  // Clear auth state from storage
  const clearAuthState = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // localStorage may not be available
      }
    }
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    setExpiresAt(null);
  }, [storageKey]);

  // Load session from storage on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        if (typeof window === 'undefined') {
          setIsLoading(false);
          return;
        }
        const storedData = window.localStorage.getItem(storageKey);
        if (!storedData) {
          setIsLoading(false);
          return;
        }

        const stored: StoredAuthState = JSON.parse(storedData);

        // Check if token is expired
        if (stored.expiresAt && new Date(stored.expiresAt) <= new Date()) {
          // Token expired, try to refresh
          if (stored.refreshToken) {
            try {
              const refreshed = await client.auth.refreshToken(stored.refreshToken);
              setToken(refreshed.token);
              setRefreshToken(refreshed.refreshToken ?? null);
              setExpiresAt(refreshed.expiresAt);
              saveAuthState(refreshed.token, refreshed.refreshToken, refreshed.expiresAt);

              // Get current user
              const currentUser = await client.auth.getUser();
              setUser(currentUser);
            } catch {
              // Refresh failed, clear auth
              clearAuthState();
            }
          } else {
            // No refresh token, clear auth
            clearAuthState();
          }
        } else {
          // Token still valid, restore state
          setToken(stored.token);
          setRefreshToken(stored.refreshToken ?? null);
          setExpiresAt(stored.expiresAt ?? null);

          // Verify token by getting user
          try {
            const currentUser = await client.auth.getUser();
            setUser(currentUser);
          } catch {
            // Token invalid, try refresh
            if (stored.refreshToken) {
              try {
                const refreshed = await client.auth.refreshToken(stored.refreshToken);
                setToken(refreshed.token);
                setRefreshToken(refreshed.refreshToken ?? null);
                setExpiresAt(refreshed.expiresAt);
                saveAuthState(refreshed.token, refreshed.refreshToken, refreshed.expiresAt);

                const currentUser = await client.auth.getUser();
                setUser(currentUser);
              } catch {
                clearAuthState();
              }
            } else {
              clearAuthState();
            }
          }
        }
      } catch {
        clearAuthState();
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [client, storageKey, saveAuthState, clearAuthState]);

  // Auto refresh session before expiry
  useEffect(() => {
    if (!autoRefreshSession || !expiresAt || !refreshToken) {
      return;
    }

    const expiresAtTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const refreshTime = expiresAtTime - now - 60000; // Refresh 1 minute before expiry

    if (refreshTime > 0) {
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const refreshed = await client.auth.refreshToken(refreshToken);
          setToken(refreshed.token);
          setRefreshToken(refreshed.refreshToken ?? null);
          setExpiresAt(refreshed.expiresAt);
          saveAuthState(refreshed.token, refreshed.refreshToken, refreshed.expiresAt);
        } catch {
          clearAuthState();
        }
      }, refreshTime);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [autoRefreshSession, client, expiresAt, refreshToken, saveAuthState, clearAuthState]);

  // Notify on auth state change
  useEffect(() => {
    if (!isLoading) {
      onAuthStateChange?.(user);
    }
  }, [user, isLoading, onAuthStateChange]);

  // Sign in handler
  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResponse> => {
      const response = await client.auth.login(email, password);

      // Handle MFA challenge
      if ("mfaRequired" in response) {
        throw new Error("MFA required - use verifyMFA to complete login");
      }

      const authResponse = response as AuthResponse;
      setUser(authResponse.user);
      setToken(authResponse.token);
      setRefreshToken(authResponse.refreshToken ?? null);
      setExpiresAt(authResponse.expiresAt ?? null);
      saveAuthState(authResponse.token, authResponse.refreshToken, authResponse.expiresAt);

      return authResponse;
    },
    [client, saveAuthState]
  );

  // Sign up handler
  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata?: Record<string, unknown>
    ): Promise<AuthResponse> => {
      const response = await client.auth.signUp(email, password, { metadata });
      setUser(response.user);
      setToken(response.token);
      setRefreshToken(response.refreshToken ?? null);
      setExpiresAt(response.expiresAt ?? null);
      saveAuthState(response.token, response.refreshToken, response.expiresAt);
      return response;
    },
    [client, saveAuthState]
  );

  // Sign out handler
  const signOut = useCallback(async (): Promise<void> => {
    try {
      await client.auth.logout();
    } finally {
      clearAuthState();
    }
  }, [client, clearAuthState]);

  // Refresh session handler
  const refreshSession = useCallback(async (): Promise<void> => {
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    const refreshed = await client.auth.refreshToken(refreshToken);
    setToken(refreshed.token);
    setRefreshToken(refreshed.refreshToken ?? null);
    setExpiresAt(refreshed.expiresAt);
    saveAuthState(refreshed.token, refreshed.refreshToken, refreshed.expiresAt);
  }, [client, refreshToken, saveAuthState]);

  // Update user in state
  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const value: VaifContextValue = {
    client,
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    refreshSession,
    updateUser,
  };

  return <VaifContext.Provider value={value}>{children}</VaifContext.Provider>;
}

// ============ HOOKS ============

/**
 * Access the VAIF context
 *
 * @throws Error if used outside VaifProvider
 */
export function useVaif(): VaifContextValue {
  const context = useContext(VaifContext);
  if (!context) {
    throw new Error("useVaif must be used within a VaifProvider");
  }
  return context;
}

/**
 * Access only the VAIF client (lightweight alternative to useVaif)
 */
export function useVaifClient(): VaifClient {
  const { client } = useVaif();
  return client;
}
