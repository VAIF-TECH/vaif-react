# @vaif/react

[![npm version](https://img.shields.io/npm/v/@vaif/react)](https://www.npmjs.com/package/@vaif/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

React hooks for VAIF Studio — authentication, queries, mutations, realtime, storage, functions, MongoDB, and observability.

> **Compatibility note (0.1.x):** This release of `@vaif/react` is backed by the legacy hand-written SDK (`@vaiftech/client@^1.5.7` and `@vaiftech/auth@^1.5.7`) — the same SDK that has been in production. The forthcoming `@vaif/react@1.x` will swap the underlying client to the official, Stainless-generated [`@vaif/client@^0.3`](https://www.npmjs.com/package/@vaif/client) and use its `@vaif/client/realtime` and `@vaif/client/storage` subpath imports. Track the rewrite on the public roadmap at [vaif.studio/roadmap](https://vaif.studio/roadmap).
>
> If you are starting a brand-new project today and want a single import surface, install [`@vaif/client`](https://www.npmjs.com/package/@vaif/client) directly and wire React state yourself; otherwise this package is the recommended hooks layer.

## Installation

```bash
npm install @vaif/react @vaiftech/client @vaiftech/auth
# or
pnpm add @vaif/react @vaiftech/client @vaiftech/auth
# or
yarn add @vaif/react @vaiftech/client @vaiftech/auth
```

`@vaiftech/client` and `@vaiftech/auth` are peer-equivalents (declared as direct dependencies in 0.1.x for ergonomics) and will be removed in 1.0.

## Quick Start

```tsx
import { VaifProvider } from '@vaif/react';
import { createVaifClient } from '@vaiftech/client';

const client = createVaifClient({
  baseUrl: 'https://api.vaif.studio',
  projectId: 'your-project-id',
  apiKey: 'vaif_xxxxxxxxxxxx',
});

function App() {
  return (
    <VaifProvider client={client}>
      <MyComponent />
    </VaifProvider>
  );
}
```

## Hooks Overview

| Category | Hooks |
|----------|-------|
| **Auth** | `useAuth`, `useUser`, `useToken`, `usePasswordReset`, `useEmailVerification`, `useMagicLink`, `useOAuth`, `useMFA` |
| **Query** | `useQuery`, `useQueryById`, `useQueryFirst`, `usePaginatedQuery`, `useInfiniteQuery`, `useCount` |
| **Mutation** | `useMutation`, `useCreate`, `useUpdate`, `useDelete`, `useUpsert`, `useBatchCreate`, `useBatchUpdate`, `useBatchDelete`, `useOptimisticMutation` |
| **Realtime** | `useSubscription`, `useChannel`, `usePresence`, `useRealtimeConnection`, `useBroadcast` |
| **Storage** | `useUpload`, `useDownload`, `useFile`, `useFiles`, `useDropzone`, `usePublicUrl` |
| **Functions** | `useFunction`, `useRpc`, `useFunctionList`, `useBatchInvoke`, `useScheduledFunction` |
| **MongoDB** | `useMongoFind`, `useMongoFindOne`, `useMongoAggregate`, `useMongoInsertOne`, `useMongoInsertMany`, `useMongoUpdateOne`, `useMongoUpdateMany`, `useMongoDeleteOne`, `useMongoDeleteMany`, `useMongoInfiniteFind`, `useMongoCount`, `useMongoDistinct`, `useMongoCollection` |
| **Observability** | `useMetrics`, `useAuditLogs`, `useIncidents`, `useSystemHealth`, `useRealtimeStats`, `useErrorTracking` |

## Authentication

```tsx
import { useAuth, useUser, useOAuth, useMFA } from '@vaif/react';

function AuthComponent() {
  const { user, isLoading, signIn, signUp, signOut } = useAuth();

  if (isLoading) return <div>Loading...</div>;

  if (!user) {
    return (
      <button onClick={() => signIn(email, password)}>
        Sign In
      </button>
    );
  }

  return (
    <div>
      <p>Welcome, {user.email}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}

function OAuthLogin() {
  const { signInWithOAuth } = useOAuth();
  return (
    <>
      <button onClick={() => signInWithOAuth('google')}>Google</button>
      <button onClick={() => signInWithOAuth('github')}>GitHub</button>
    </>
  );
}

function MFASetup() {
  const { enroll, qrCode } = useMFA();
  return (
    <div>
      {qrCode && <img src={qrCode} alt="Scan with authenticator" />}
      <button onClick={() => enroll('totp')}>Enable MFA</button>
    </div>
  );
}
```

### VaifProvider Options

```tsx
// Option 1: Pass a pre-created client (recommended)
const client = createVaifClient({ baseUrl, projectId, apiKey });
<VaifProvider client={client}>...</VaifProvider>

// Option 2: Pass config directly
<VaifProvider config={{ baseUrl, projectId, apiKey }}>...</VaifProvider>
```

## Data Fetching

```tsx
import { useQuery, usePaginatedQuery, useInfiniteQuery } from '@vaif/react';

const { data: posts, isLoading, refetch } = useQuery<Post>('posts', {
  filters: [{ field: 'published', operator: 'eq', value: true }],
  orderBy: [{ field: 'createdAt', direction: 'desc' }],
  limit: 10,
});

const { data, page, totalPages, nextPage, prevPage } =
  usePaginatedQuery<Post>('posts', { pageSize: 20 });

const { data, fetchNextPage, hasNextPage } =
  useInfiniteQuery<Post>('posts', { limit: 20 });
```

## Mutations

```tsx
import { useCreate, useUpdate, useDelete, useOptimisticMutation } from '@vaif/react';

const { create, isCreating } = useCreate<Post>('posts');
const { update, isUpdating } = useUpdate<Post>('posts');
const { remove, isDeleting } = useDelete('posts');

const { mutate } = useOptimisticMutation<Post>('posts', {
  optimisticUpdate: (cache, postId) => ({ ...cache[postId], likes: cache[postId].likes + 1 }),
  rollbackOnError: true,
});
```

## Realtime

```tsx
import { useSubscription, useChannel, usePresence, useBroadcast } from '@vaif/react';

useSubscription<Message>('messages', {
  event: 'INSERT',
  onInsert: (msg) => console.log('New message:', msg),
});

const channel = useChannel(`room-${roomId}`);
const { users, track, leave } = usePresence(`room-${roomId}`);
const { send, subscribe } = useBroadcast(`room-${roomId}`);
```

## Storage

```tsx
import { useUpload, useDropzone, useFiles, usePublicUrl } from '@vaif/react';

const { upload, progress, isUploading } = useUpload();
const { getRootProps, getInputProps, isDragActive } = useDropzone({
  accept: { 'image/*': ['.png', '.jpg', '.gif'] },
  maxFiles: 5,
});
const url = usePublicUrl(path);
const { files } = useFiles({ prefix });
```

## Edge Functions

```tsx
import { useFunction, useRpc, useBatchInvoke } from '@vaif/react';

const { invoke, isInvoking, error, result } = useFunction('send-email');
const { call, data } = useRpc<ProcessResult>('process-data');
const { invoke: batch, results } = useBatchInvoke();
```

## MongoDB Hooks

```tsx
import { useMongoFind, useMongoInsertOne, useMongoAggregate } from '@vaif/react';

const { data: users } = useMongoFind<User>('users', {
  filter: { status: 'active' },
  sort: { createdAt: -1 },
  limit: 20,
});

const { insertOne } = useMongoInsertOne<User>('users');

const { data: stats } = useMongoAggregate('users', [
  { $match: { status: 'active' } },
  { $group: { _id: '$country', count: { $sum: 1 } } },
]);
```

## Observability

```tsx
import { useMetrics, useAuditLogs, useIncidents, useSystemHealth } from '@vaif/react';

const { metrics, timeRange, setTimeRange } = useMetrics({
  sources: ['api', 'database', 'storage'],
  interval: '1h',
});
const { logs, hasMore, loadMore, setFilters } = useAuditLogs({ limit: 50 });
const { incidents, activeCount, acknowledge, resolve } = useIncidents();
const { isHealthy, services } = useSystemHealth({ pollInterval: 30000 });
```

## TypeScript Support

All hooks support TypeScript generics for full type safety:

```tsx
interface User { id: string; email: string; name: string; }

const { data } = useQuery<User>('users');                // User[] | undefined
const { data: user } = useMongoFindOne<User>('users', {  // User | null | undefined
  email: 'test@example.com',
});
```

## Related Packages

| Package | Description |
|---------|-------------|
| [@vaif/client](https://www.npmjs.com/package/@vaif/client) | Modern Stainless-generated TypeScript SDK (target for `@vaif/react@1.x`) |
| [@vaif/cli](https://www.npmjs.com/package/@vaif/cli) | CLI: scaffold projects, generate types, deploy functions |
| [@vaif/mcp](https://www.npmjs.com/package/@vaif/mcp) | MCP server for Claude Code integration |
| [@vaif/migrate](https://www.npmjs.com/package/@vaif/migrate) | Codemod from `@vaiftech/*` to `@vaif/*` |

## License

MIT
