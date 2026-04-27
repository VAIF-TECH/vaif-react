/**
 * @vaiftech/react - React hooks for VAIF
 *
 * A comprehensive set of React hooks for building applications with VAIF.
 * Includes authentication, data fetching, real-time subscriptions, storage,
 * and serverless functions.
 *
 * @example
 * ```tsx
 * import { VaifProvider, useAuth, useQuery, useRealtime } from '@vaiftech/react';
 *
 * function App() {
 *   return (
 *     <VaifProvider config={{ projectId: 'your-project-id', apiKey: 'your-api-key' }}>
 *       <MyApp />
 *     </VaifProvider>
 *   );
 * }
 *
 * function MyApp() {
 *   const { user, signIn, signOut } = useAuth();
 *   const { data: posts, isLoading } = useQuery<Post>('posts');
 *
 *   // Real-time updates
 *   useSubscription<Post>('posts', {
 *     onInsert: (post) => console.log('New post:', post),
 *   });
 *
 *   return (
 *     <div>
 *       {user ? (
 *         <>
 *           <p>Welcome, {user.email}</p>
 *           <PostList posts={posts} loading={isLoading} />
 *           <button onClick={signOut}>Sign Out</button>
 *         </>
 *       ) : (
 *         <LoginForm onSubmit={signIn} />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

// ============ CONTEXT ============

export {
  VaifProvider,
  useVaif,
  useVaifClient,
  type VaifContextValue,
  type VaifProviderProps,
} from "./context";

export { VaifErrorBoundary, type VaifErrorBoundaryProps } from "./context";

// ============ AUTH HOOKS ============

export {
  useAuth,
  useUser,
  useToken,
  usePasswordReset,
  useEmailVerification,
  useMagicLink,
  useOAuth,
  useMFA,
  type UseAuthReturn,
  type UsePasswordResetReturn,
  type UseEmailVerificationReturn,
  type UseMagicLinkReturn,
  type UseOAuthReturn,
  type UseMFAReturn,
} from "./hooks";

// ============ DATA HOOKS ============

export {
  // Query hooks
  useQuery,
  useQueryById,
  useQueryFirst,
  usePaginatedQuery,
  useInfiniteQuery,
  useCount,
  type QueryStatus,
  type UseQueryOptions,
  type UseQueryReturn,
  type UseQueryFirstReturn,
  type UsePaginatedQueryOptions,
  type UsePaginatedQueryReturn,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryReturn,

  // Mutation hooks
  useMutation,
  useCreate,
  useUpdate,
  useDelete,
  useUpsert,
  useBatchCreate,
  useBatchUpdate,
  useBatchDelete,
  useOptimisticMutation,
  type MutationStatus,
  type UseMutationOptions,
  type UseMutationReturn,
  type UseCreateOptions,
  type UseUpdateOptions,
  type UseDeleteOptions,
  type UseUpsertOptions,
} from "./hooks";

// ============ REALTIME HOOKS ============

export {
  useSubscription,
  useChannel,
  usePresence,
  useRealtimeConnection,
  useBroadcast,
  type UseRealtimeOptions,
  type UseSubscriptionOptions,
  type UseSubscriptionReturn,
  type UseChannelOptions,
  type UseChannelReturn,
  type UsePresenceOptions,
  type UsePresenceReturn,
} from "./hooks";

// ============ STORAGE HOOKS ============

export {
  useUpload,
  useDownload,
  useFile,
  useFiles,
  useDropzone,
  usePublicUrl,
  type UseUploadOptions,
  type UseUploadReturn,
  type UseDownloadOptions,
  type UseDownloadReturn,
  type UseFileOptions,
  type UseFileReturn,
  type UseFilesOptions,
  type UseFilesReturn,
  type DropzoneOptions,
  type DropzoneState,
  type UseDropzoneReturn,
} from "./hooks";

// ============ FUNCTIONS HOOKS ============

export {
  useFunction,
  useRpc,
  useFunctionList,
  useBatchInvoke,
  useScheduledFunction,
  type UseFunctionOptions,
  type UseFunctionReturn,
  type UseRpcOptions,
  type UseRpcReturn,
  type UseFunctionListOptions,
  type UseFunctionListReturn,
} from "./hooks";

// ============ OBSERVABILITY HOOKS ============

export {
  useMetrics,
  useAuditLogs,
  useIncidents,
  useSystemHealth,
  useRealtimeStats,
  useErrorTracking,
  type UseMetricsOptions,
  type UseMetricsReturn,
  type UseAuditLogsOptions,
  type UseAuditLogsReturn,
  type UseIncidentsOptions,
  type UseIncidentsReturn,
  type UseSystemHealthOptions,
  type UseSystemHealthReturn,
  type UseRealtimeStatsOptions,
  type UseRealtimeStatsReturn,
  type UseErrorTrackingOptions,
  type UseErrorTrackingReturn,
} from "./hooks";

// ============ MONGODB HOOKS ============

export {
  useMongoCollection,
  useMongoFind,
  useMongoFindOne,
  useMongoAggregate,
  useMongoInsertOne,
  useMongoInsertMany,
  useMongoUpdateOne,
  useMongoUpdateMany,
  useMongoDeleteOne,
  useMongoDeleteMany,
  useMongoInfiniteFind,
  useMongoCount,
  useMongoDistinct,
  type MongoQueryStatus,
  type UseMongoFindOptions,
  type UseMongoFindReturn,
  type UseMongoFindOneOptions,
  type UseMongoFindOneReturn,
  type UseMongoAggregateOptions,
  type UseMongoAggregateReturn,
  type UseMongoMutationReturn,
  type UseMongoInsertOneVariables,
  type UseMongoInsertManyVariables,
  type UseMongoUpdateOneVariables,
  type UseMongoUpdateManyVariables,
  type UseMongoDeleteOneVariables,
  type UseMongoDeleteManyVariables,
  type UseMongoInfiniteFindOptions,
  type UseMongoInfiniteFindReturn,
  type UseMongoCountOptions,
} from "./hooks";

// ============ RE-EXPORTS FROM CLIENT ============

// Re-export commonly used types from @vaiftech/client for convenience
export type {
  VaifClient,
  VaifClientConfig,
  User,
  AuthResponse,
  QueryOptions,
  WhereFilter,
  OrderByClause,
  ConnectionState,
  DbChangeEvent,
  DbOperation,
  PresenceState,
  FileMetadata,
  UploadResult,
  VaifFunction,
  InvokeResult,
} from "@vaiftech/client";

// ============ RE-EXPORTS FROM @vaiftech/auth ============

// Re-export standalone auth client and React hooks
export {
  // Standalone auth client
  createAuthClient,
  VaifAuthClient,
  // React hooks from @vaiftech/auth/react
  AuthProvider,
  useAuthClient,
  useAuth as useStandaloneAuth,
  useUser as useStandaloneUser,
  useSession,
  useIsAuthenticated,
  usePassword,
  useMFA as useStandaloneMFA,
  useIdentities,
  useSessions,
} from "@vaiftech/auth/react";

export type {
  // Auth provider props
  AuthProviderProps,
  // Auth client config
  AuthClientConfig,
  // Session & auth types
  Session as AuthSession,
  AuthChangeEvent,
  AuthEventType,
  AuthSubscription,
  // MFA types
  MFAFactor,
} from "@vaiftech/auth/react";
