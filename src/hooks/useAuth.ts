import { useCallback, useState } from "react";
import { useVaif } from "../context/VaifContext";
import type {
  User,
  AuthResponse,
  OAuthProviderType,
  MFAMethod,
  MFASetupResponse,
} from "@vaiftech/client";

// ============ TYPES ============

export interface UseAuthReturn {
  /** Current user */
  user: User | null;

  /** Current access token */
  token: string | null;

  /** Whether auth is loading */
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

  /** Sign out */
  signOut: () => Promise<void>;

  /** Refresh session */
  refreshSession: () => Promise<void>;
}

export interface UsePasswordResetReturn {
  /** Request password reset email */
  requestReset: (email: string) => Promise<void>;

  /** Confirm password reset with token */
  confirmReset: (token: string, newPassword: string) => Promise<void>;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Whether reset was requested */
  isRequested: boolean;

  /** Whether reset was confirmed */
  isConfirmed: boolean;
}

export interface UseEmailVerificationReturn {
  /** Request verification email */
  requestVerification: (email: string) => Promise<void>;

  /** Confirm email with token */
  confirmVerification: (token: string) => Promise<void>;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Whether verification was sent */
  isSent: boolean;

  /** Whether email was verified */
  isVerified: boolean;
}

export interface UseMagicLinkReturn {
  /** Send magic link */
  sendMagicLink: (email: string) => Promise<void>;

  /** Verify magic link token */
  verifyMagicLink: (token: string) => Promise<AuthResponse>;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Whether link was sent */
  isSent: boolean;
}

export interface UseOAuthReturn {
  /** Start OAuth flow */
  signInWithOAuth: (provider: OAuthProviderType, redirectTo?: string) => Promise<void>;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;
}

export interface UseMFAReturn {
  /** Set up MFA */
  setup: (method: MFAMethod) => Promise<MFASetupResponse>;

  /** Verify MFA with token and code */
  verify: (mfaToken: string, code: string) => Promise<AuthResponse>;

  /** Disable MFA */
  disable: (code: string) => Promise<void>;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;
}

// ============ HOOKS ============

/**
 * Main authentication hook
 *
 * @example
 * ```tsx
 * function LoginForm() {
 *   const { signIn, isLoading, user } = useAuth();
 *
 *   const handleSubmit = async (e: FormEvent) => {
 *     e.preventDefault();
 *     await signIn(email, password);
 *   };
 *
 *   if (user) {
 *     return <div>Welcome, {user.email}!</div>;
 *   }
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const {
    user,
    token,
    isLoading,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    refreshSession,
  } = useVaif();

  return {
    user,
    token,
    isLoading,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    refreshSession,
  };
}

/**
 * Hook for getting the current user only
 *
 * @example
 * ```tsx
 * function UserAvatar() {
 *   const user = useUser();
 *   if (!user) return null;
 *   return <img src={user.avatarUrl} alt={user.name} />;
 * }
 * ```
 */
export function useUser(): User | null {
  const { user } = useVaif();
  return user;
}

/**
 * Hook for getting the current access token
 */
export function useToken(): string | null {
  const { token } = useVaif();
  return token;
}

/**
 * Password reset hook
 *
 * @example
 * ```tsx
 * function ForgotPassword() {
 *   const { requestReset, confirmReset, isLoading, isRequested } = usePasswordReset();
 *
 *   if (!isRequested) {
 *     return <button onClick={() => requestReset(email)}>Send Reset Link</button>;
 *   }
 *
 *   return (
 *     <form onSubmit={() => confirmReset(email, code, newPassword)}>
 *       <input placeholder="Enter code" />
 *       <input type="password" placeholder="New password" />
 *       <button type="submit">Reset Password</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function usePasswordReset(): UsePasswordResetReturn {
  const { client } = useVaif();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isRequested, setIsRequested] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const requestReset = useCallback(
    async (email: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await client.auth.requestPasswordReset({ email });
        setIsRequested(true);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to request reset"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  const confirmReset = useCallback(
    async (token: string, newPassword: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await client.auth.confirmPasswordReset({ token, password: newPassword });
        setIsConfirmed(true);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to reset password"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  return {
    requestReset,
    confirmReset,
    isLoading,
    error,
    isRequested,
    isConfirmed,
  };
}

/**
 * Email verification hook
 *
 * @example
 * ```tsx
 * function VerifyEmail() {
 *   const { requestVerification, confirmVerification, isSent, isVerified } = useEmailVerification();
 *
 *   if (isVerified) {
 *     return <div>Email verified successfully!</div>;
 *   }
 *
 *   if (isSent) {
 *     return (
 *       <form onSubmit={() => confirmVerification(email, code)}>
 *         <input placeholder="Enter verification code" />
 *         <button type="submit">Verify</button>
 *       </form>
 *     );
 *   }
 *
 *   return <button onClick={() => requestVerification(email)}>Send Verification</button>;
 * }
 * ```
 */
export function useEmailVerification(): UseEmailVerificationReturn {
  const { client } = useVaif();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSent, setIsSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const requestVerification = useCallback(
    async (email: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await client.auth.requestEmailVerification({ email });
        setIsSent(true);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to send verification"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  const confirmVerification = useCallback(
    async (token: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await client.auth.confirmEmailVerification({ token });
        setIsVerified(true);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to verify email"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  return {
    requestVerification,
    confirmVerification,
    isLoading,
    error,
    isSent,
    isVerified,
  };
}

/**
 * Magic link authentication hook
 *
 * @example
 * ```tsx
 * function MagicLinkLogin() {
 *   const { sendMagicLink, isSent, isLoading } = useMagicLink();
 *
 *   if (isSent) {
 *     return <div>Check your email for the login link!</div>;
 *   }
 *
 *   return (
 *     <button onClick={() => sendMagicLink(email)} disabled={isLoading}>
 *       {isLoading ? 'Sending...' : 'Send Magic Link'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useMagicLink(): UseMagicLinkReturn {
  const { client } = useVaif();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSent, setIsSent] = useState(false);

  const sendMagicLink = useCallback(
    async (email: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await client.auth.requestMagicLink({ email });
        setIsSent(true);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to send magic link"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  const verifyMagicLink = useCallback(
    async (token: string): Promise<AuthResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        return await client.auth.verifyMagicLink({ token });
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to verify magic link"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  return {
    sendMagicLink,
    verifyMagicLink,
    isLoading,
    error,
    isSent,
  };
}

/**
 * OAuth authentication hook
 *
 * @example
 * ```tsx
 * function OAuthButtons() {
 *   const { signInWithOAuth, isLoading } = useOAuth();
 *
 *   return (
 *     <div>
 *       <button onClick={() => signInWithOAuth('google')} disabled={isLoading}>
 *         Sign in with Google
 *       </button>
 *       <button onClick={() => signInWithOAuth('github')} disabled={isLoading}>
 *         Sign in with GitHub
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOAuth(): UseOAuthReturn {
  const { client } = useVaif();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signInWithOAuth = useCallback(
    async (provider: OAuthProviderType, redirectUrl?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await client.auth.getOAuthSignInUrl({
          provider,
          redirectUrl,
        });

        // Redirect to OAuth provider
        if (result.url) {
          window.location.href = result.url;
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to start OAuth flow"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  return {
    signInWithOAuth,
    isLoading,
    error,
  };
}

/**
 * Multi-factor authentication hook
 *
 * @example
 * ```tsx
 * function MFASetup() {
 *   const { setup, verify, isLoading } = useMFA();
 *   const [qrCode, setQrCode] = useState<string | null>(null);
 *   const [mfaToken, setMfaToken] = useState<string | null>(null);
 *
 *   const handleSetup = async () => {
 *     const result = await setup('totp');
 *     setQrCode(result.qrCode);
 *   };
 *
 *   const handleVerify = async (code: string) => {
 *     if (mfaToken) {
 *       await verify(mfaToken, code);
 *       alert('MFA verified!');
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {qrCode ? (
 *         <>
 *           <img src={qrCode} alt="Scan with authenticator app" />
 *           <input placeholder="Enter code" />
 *           <button onClick={() => handleVerify(code)}>Verify</button>
 *         </>
 *       ) : (
 *         <button onClick={handleSetup}>Enable 2FA</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMFA(): UseMFAReturn {
  const { client } = useVaif();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const setup = useCallback(
    async (method: MFAMethod): Promise<MFASetupResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        return await client.auth.setupMFA(method);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to setup MFA"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  const verify = useCallback(
    async (mfaToken: string, code: string): Promise<AuthResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        return await client.auth.verifyMFA(mfaToken, code);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to verify MFA"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  const disable = useCallback(async (code: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await client.auth.disableMFA(code);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to disable MFA"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  return {
    setup,
    verify,
    disable,
    isLoading,
    error,
  };
}
