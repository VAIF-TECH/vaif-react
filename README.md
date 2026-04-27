# @vaiftech/react

React hooks for VAIF Studio - a Backend-as-a-Service platform.

## Installation

```bash
npm install @vaiftech/react @vaiftech/client
# or
pnpm add @vaiftech/react @vaiftech/client
# or
yarn add @vaiftech/react @vaiftech/client
```

## Quick Start

```tsx
import { VaifProvider } from '@vaiftech/react';
import { createVaifClient } from '@vaiftech/client';

const client = createVaifClient({
  baseUrl: 'https://api.vaif.studio',
  projectId: 'your-project-id',
  apiKey: 'vaif_pk_xxx',
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
import { useAuth, useUser, useOAuth, useMFA } from '@vaiftech/react';

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

// Just the user
function Profile() {
  const { user, isLoading } = useUser();
  return user ? <p>{user.email}</p> : null;
}

// OAuth login
function OAuthLogin() {
  const { signInWithOAuth, isLoading } = useOAuth();

  return (
    <div>
      <button onClick={() => signInWithOAuth('google')}>
        Sign in with Google
      </button>
      <button onClick={() => signInWithOAuth('github')}>
        Sign in with GitHub
      </button>
    </div>
  );
}

// MFA setup
function MFASetup() {
  const { enroll, verify, isEnrolling, qrCode } = useMFA();

  const handleSetup = async () => {
    await enroll('totp');
  };

  return (
    <div>
      {qrCode && <img src={qrCode} alt="Scan with authenticator" />}
      <button onClick={handleSetup}>Enable MFA</button>
    </div>
  );
}
```

### VaifProvider Options

`VaifProvider` accepts either a pre-created `client` or a `config` object:

```tsx
// Option 1: Pass a pre-created client (recommended)
const client = createVaifClient({ baseUrl, projectId, apiKey });
<VaifProvider client={client}>...</VaifProvider>

// Option 2: Pass config directly
<VaifProvider config={{ baseUrl, projectId, apiKey }}>...</VaifProvider>
```

## Data Fetching

```tsx
import { useQuery, useQueryById, usePaginatedQuery, useInfiniteQuery } from '@vaiftech/react';

interface Post {
  id: string;
  title: string;
  content: string;
}

// Basic query
function PostList() {
  const { data: posts, isLoading, error, refetch } = useQuery<Post>('posts', {
    filters: [{ field: 'published', operator: 'eq', value: true }],
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
    limit: 10,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {posts?.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}

// Query by ID
function PostDetail({ postId }: { postId: string }) {
  const { data: post, isLoading } = useQueryById<Post>('posts', postId);

  if (isLoading) return <div>Loading...</div>;
  return <h1>{post?.title}</h1>;
}

// Paginated query
function PaginatedPosts() {
  const {
    data,
    page,
    totalPages,
    nextPage,
    prevPage,
    isLoading
  } = usePaginatedQuery<Post>('posts', {
    pageSize: 20,
  });

  return (
    <div>
      {data?.map(post => <div key={post.id}>{post.title}</div>)}
      <button onClick={prevPage} disabled={page === 1}>Prev</button>
      <span>{page} / {totalPages}</span>
      <button onClick={nextPage} disabled={page === totalPages}>Next</button>
    </div>
  );
}

// Infinite scroll
function InfinitePosts() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery<Post>('posts', { limit: 20 });

  return (
    <div>
      {data?.map(post => <div key={post.id}>{post.title}</div>)}
      {hasNextPage && (
        <button onClick={fetchNextPage} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

## Mutations

```tsx
import { useCreate, useUpdate, useDelete, useMutation, useOptimisticMutation } from '@vaiftech/react';

// Create
function CreatePost() {
  const { create, isCreating, error } = useCreate<Post>('posts');

  const handleSubmit = async (data: Omit<Post, 'id'>) => {
    const newPost = await create(data);
    console.log('Created:', newPost);
  };

  return (
    <button onClick={() => handleSubmit({ title: 'New', content: '...' })} disabled={isCreating}>
      {isCreating ? 'Creating...' : 'Create Post'}
    </button>
  );
}

// Update
function UpdatePost({ postId }: { postId: string }) {
  const { update, isUpdating } = useUpdate<Post>('posts');

  return (
    <button
      onClick={() => update(postId, { title: 'Updated Title' })}
      disabled={isUpdating}
    >
      Update
    </button>
  );
}

// Delete
function DeletePost({ postId }: { postId: string }) {
  const { remove, isDeleting } = useDelete('posts');

  return (
    <button onClick={() => remove(postId)} disabled={isDeleting}>
      Delete
    </button>
  );
}

// Full mutation hook
function PostActions() {
  const { create, update, remove, isLoading } = useMutation<Post>('posts');

  // Use create, update, remove as needed
}

// Optimistic updates
function OptimisticLike({ postId }: { postId: string }) {
  const { mutate } = useOptimisticMutation<Post>('posts', {
    optimisticUpdate: (cache, postId) => {
      return { ...cache[postId], likes: cache[postId].likes + 1 };
    },
    rollbackOnError: true,
  });

  return <button onClick={() => mutate(postId, { likes: '+1' })}>Like</button>;
}
```

## Realtime

```tsx
import { useSubscription, useChannel, usePresence, useBroadcast } from '@vaiftech/react';

// Subscribe to table changes
function MessageListener() {
  useSubscription<Message>('messages', {
    event: 'INSERT',
    onInsert: (message) => console.log('New message:', message),
    onUpdate: (message) => console.log('Updated:', message),
    onDelete: (message) => console.log('Deleted:', message.id),
  });

  return null;
}

// Channel communication
function ChatRoom({ roomId }: { roomId: string }) {
  const channel = useChannel(`room-${roomId}`);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    channel.on('message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });
    return () => channel.off('message');
  }, [channel]);

  const sendMessage = (text: string) => {
    channel.send('message', { text, timestamp: Date.now() });
  };

  return <div>{/* Chat UI */}</div>;
}

// Presence tracking
function OnlineUsers({ roomId }: { roomId: string }) {
  const { users, track, leave } = usePresence(`room-${roomId}`);

  useEffect(() => {
    track({ status: 'online', name: currentUser.name });
    return () => leave();
  }, []);

  return (
    <div>
      <h4>Online ({users.length})</h4>
      {users.map(u => <span key={u.id}>{u.name}</span>)}
    </div>
  );
}

// Broadcast events
function TypingIndicator({ roomId }: { roomId: string }) {
  const { send, subscribe } = useBroadcast(`room-${roomId}`);
  const [typing, setTyping] = useState<string[]>([]);

  useEffect(() => {
    subscribe('typing', (event) => {
      setTyping(prev => [...prev, event.userId]);
      setTimeout(() => {
        setTyping(prev => prev.filter(id => id !== event.userId));
      }, 3000);
    });
  }, []);

  const onType = () => send('typing', { userId: currentUser.id });

  return <div>{typing.length > 0 && `${typing.join(', ')} typing...`}</div>;
}
```

## Storage

```tsx
import { useUpload, useDownload, useFile, useFiles, useDropzone, usePublicUrl } from '@vaiftech/react';

// File upload with progress
function FileUpload() {
  const { upload, progress, isUploading, error } = useUpload();

  const handleUpload = async (file: File) => {
    const result = await upload(file, `uploads/${file.name}`);
    console.log('Uploaded:', result?.url);
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files![0])} />
      {isUploading && <progress value={progress} max={100} />}
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}

// Drag and drop zone
function DropzoneUpload() {
  const { getRootProps, getInputProps, isDragActive, files } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.gif'] },
    maxFiles: 5,
    onDrop: async (files) => {
      // Handle uploaded files
    },
  });

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {isDragActive ? 'Drop files here' : 'Drag files or click to upload'}
    </div>
  );
}

// Display files
function FileDisplay({ path }: { path: string }) {
  const url = usePublicUrl(path);
  return url ? <img src={url} alt="" /> : null;
}

// List files
function FileList({ prefix }: { prefix: string }) {
  const { files, isLoading, refetch } = useFiles({ prefix });

  return (
    <ul>
      {files?.map(file => (
        <li key={file.path}>{file.name} ({file.size} bytes)</li>
      ))}
    </ul>
  );
}
```

## Edge Functions

```tsx
import { useFunction, useRpc, useBatchInvoke } from '@vaiftech/react';

// Invoke function
function SendEmail() {
  const { invoke, isInvoking, error, result } = useFunction('send-email');

  const handleSend = async () => {
    await invoke({
      to: 'user@example.com',
      subject: 'Hello',
    });
  };

  return (
    <button onClick={handleSend} disabled={isInvoking}>
      {isInvoking ? 'Sending...' : 'Send Email'}
    </button>
  );
}

// RPC-style calls
function DataProcessor() {
  const { call, isLoading, data } = useRpc<ProcessResult>('process-data');

  return (
    <button onClick={() => call({ input: rawData })}>
      Process
    </button>
  );
}

// Batch invocations
function BatchProcessor() {
  const { invoke, isInvoking, results } = useBatchInvoke();

  const processAll = async () => {
    await invoke([
      { name: 'resize-image', payload: { url: 'img1.jpg' } },
      { name: 'resize-image', payload: { url: 'img2.jpg' } },
      { name: 'resize-image', payload: { url: 'img3.jpg' } },
    ]);
  };

  return <button onClick={processAll}>Process All</button>;
}
```

## MongoDB Hooks

```tsx
import {
  useMongoFind,
  useMongoFindOne,
  useMongoInsertOne,
  useMongoUpdateOne,
  useMongoDeleteOne,
  useMongoAggregate,
  useMongoCollection,
  useMongoInfiniteFind,
} from '@vaiftech/react';

// Find documents
function UserList() {
  const { data: users, isLoading, error, refetch } = useMongoFind<User>('users', {
    filter: { status: 'active' },
    sort: { createdAt: -1 },
    limit: 20,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {users?.map(user => <li key={user._id}>{user.name}</li>)}
    </ul>
  );
}

// Find single document
function UserProfile({ id }: { id: string }) {
  const { data: user, isLoading } = useMongoFindOne<User>('users', { _id: id });
  return user ? <div>{user.name}</div> : null;
}

// Insert document
function CreateUser() {
  const { insertOne, isInserting } = useMongoInsertOne<User>('users');

  const handleCreate = async () => {
    const result = await insertOne({
      name: 'New User',
      email: 'new@example.com',
      createdAt: new Date(),
    });
    console.log('Created:', result.insertedId);
  };

  return (
    <button onClick={handleCreate} disabled={isInserting}>
      Create User
    </button>
  );
}

// Update document
function UpdateUser({ id }: { id: string }) {
  const { updateOne, isUpdating } = useMongoUpdateOne('users');

  return (
    <button
      onClick={() => updateOne({ _id: id }, { $set: { updatedAt: new Date() } })}
      disabled={isUpdating}
    >
      Update
    </button>
  );
}

// Delete document
function DeleteUser({ id }: { id: string }) {
  const { deleteOne, isDeleting } = useMongoDeleteOne('users');
  return (
    <button onClick={() => deleteOne({ _id: id })} disabled={isDeleting}>
      Delete
    </button>
  );
}

// Aggregation pipeline
function UserStats() {
  const { data: stats } = useMongoAggregate<{ _id: string; count: number }>('users', [
    { $match: { status: 'active' } },
    { $group: { _id: '$country', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return (
    <ul>
      {stats?.map(stat => (
        <li key={stat._id}>{stat._id}: {stat.count}</li>
      ))}
    </ul>
  );
}

// Infinite scroll with MongoDB
function InfiniteUserList() {
  const { data, fetchNextPage, hasNextPage } = useMongoInfiniteFind<User>('users', {
    filter: { status: 'active' },
    sort: { createdAt: -1 },
    limit: 20,
  });

  return (
    <div>
      {data?.map(user => <div key={user._id}>{user.name}</div>)}
      {hasNextPage && <button onClick={fetchNextPage}>Load More</button>}
    </div>
  );
}

// Full collection access
function AdvancedOps() {
  const collection = useMongoCollection<User>('users');

  const handleBulk = async () => {
    const count = await collection.count({ status: 'active' });
    const countries = await collection.distinct('country');
    await collection.bulkWrite([
      { insertOne: { document: { name: 'Bulk User' } } },
    ]);
  };

  return <button onClick={handleBulk}>Run Operations</button>;
}
```

## Observability Hooks

```tsx
import {
  useMetrics,
  useAuditLogs,
  useIncidents,
  useSystemHealth,
  useRealtimeStats,
  useErrorTracking,
} from '@vaiftech/react';

// Metrics dashboard
function MetricsDashboard() {
  const { metrics, isLoading, timeRange, setTimeRange, refresh } = useMetrics({
    sources: ['api', 'database', 'storage'],
    interval: '1h',
  });

  return (
    <div>
      <select onChange={(e) => setTimeRange(e.target.value)} value={timeRange}>
        <option value="1h">Last Hour</option>
        <option value="24h">Last 24 Hours</option>
        <option value="7d">Last 7 Days</option>
      </select>
      {metrics?.map(m => (
        <div key={m.name}>{m.name}: {m.value}</div>
      ))}
    </div>
  );
}

// Audit logs
function AuditLogViewer() {
  const { logs, hasMore, loadMore, setFilters } = useAuditLogs({ limit: 50 });

  return (
    <div>
      <select onChange={(e) => setFilters({ action: e.target.value })}>
        <option value="">All Actions</option>
        <option value="create">Create</option>
        <option value="update">Update</option>
        <option value="delete">Delete</option>
      </select>
      <ul>
        {logs?.map(log => (
          <li key={log.id}>{log.timestamp}: {log.action} by {log.userId}</li>
        ))}
      </ul>
      {hasMore && <button onClick={loadMore}>Load More</button>}
    </div>
  );
}

// Incident management
function IncidentList() {
  const { incidents, activeCount, acknowledge, resolve } = useIncidents();

  return (
    <div>
      <h3>Active Incidents: {activeCount}</h3>
      {incidents?.map(incident => (
        <div key={incident.id}>
          <span>{incident.title} - {incident.severity}</span>
          {incident.status === 'open' && (
            <button onClick={() => acknowledge(incident.id)}>Ack</button>
          )}
          {incident.status === 'acknowledged' && (
            <button onClick={() => resolve(incident.id)}>Resolve</button>
          )}
        </div>
      ))}
    </div>
  );
}

// System health
function SystemHealth() {
  const { isHealthy, services, lastCheck } = useSystemHealth({ pollInterval: 30000 });

  return (
    <div>
      <div>Status: {isHealthy ? 'Healthy' : 'Degraded'}</div>
      <div>Last Check: {lastCheck?.toLocaleString()}</div>
      {services?.map(svc => (
        <div key={svc.name}>{svc.name}: {svc.status} ({svc.latency}ms)</div>
      ))}
    </div>
  );
}

// Realtime stats
function RealtimeStats() {
  const { connections, requestsPerSecond, activeUsers } = useRealtimeStats();

  return (
    <div>
      <div>Connections: {connections}</div>
      <div>Requests/sec: {requestsPerSecond}</div>
      <div>Active Users: {activeUsers}</div>
    </div>
  );
}

// Error tracking
function ErrorTracker() {
  const { errorRate, topErrors, trackError } = useErrorTracking({ timeRange: '24h' });

  return (
    <div>
      <div>Error Rate: {errorRate}%</div>
      {topErrors?.map(err => (
        <div key={err.message}>{err.message} ({err.count})</div>
      ))}
    </div>
  );
}
```

## TypeScript Support

All hooks support TypeScript generics for full type safety:

```tsx
interface User {
  id: string;
  email: string;
  name: string;
}

const { data } = useQuery<User>('users');
// data is User[] | undefined

const { data: user } = useMongoFindOne<User>('users', { email: 'test@example.com' });
// user is User | null | undefined
```

## Related Packages

- [@vaiftech/client](https://www.npmjs.com/package/@vaiftech/client) - Core client SDK
- [@vaiftech/auth](https://www.npmjs.com/package/@vaiftech/auth) - Standalone auth client
- [@vaiftech/sdk-expo](https://www.npmjs.com/package/@vaiftech/sdk-expo) - React Native/Expo SDK
- [@vaiftech/cli](https://www.npmjs.com/package/@vaiftech/cli) - CLI tools

## License

MIT
