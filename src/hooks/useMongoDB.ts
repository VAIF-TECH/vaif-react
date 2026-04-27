import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useVaifClient } from "../context/VaifContext";
import type {
  MongoFilter,
  MongoSort,
  MongoProjection,
  MongoFindOptions,
  MongoUpdateOperators,
  MongoPipelineStage,
  MongoAggregateOptions,
  MongoInsertOneResult,
  MongoInsertManyResult,
  MongoUpdateResult,
  MongoDeleteResult,
  MongoCollectionClient,
} from "@vaiftech/client";

// ============ TYPES ============

export type MongoQueryStatus = "idle" | "loading" | "success" | "error";

export interface UseMongoFindOptions<T extends Record<string, unknown>> {
  /** Filter to apply */
  filter?: MongoFilter<T>;

  /** Sort order */
  sort?: MongoSort<T>;

  /** Fields to include/exclude */
  projection?: MongoProjection<T>;

  /** Number of documents to skip */
  skip?: number;

  /** Maximum number of documents to return */
  limit?: number;

  /** Enable/disable the query */
  enabled?: boolean;

  /** Refetch on window focus */
  refetchOnWindowFocus?: boolean;

  /** Refetch interval in ms (0 = disabled) */
  refetchInterval?: number;

  /** Keep previous data while fetching new */
  keepPreviousData?: boolean;

  /** Callback on success */
  onSuccess?: (data: T[]) => void;

  /** Callback on error */
  onError?: (error: Error) => void;

  /** Stale time in ms (default: 0) */
  staleTime?: number;
}

export interface UseMongoFindReturn<T> {
  /** Query result data */
  data: T[];

  /** Loading state */
  isLoading: boolean;

  /** Fetching state (loading or refetching) */
  isFetching: boolean;

  /** Error state */
  error: Error | null;

  /** Query status */
  status: MongoQueryStatus;

  /** Refetch function */
  refetch: () => Promise<void>;

  /** Whether data is stale */
  isStale: boolean;

  /** Whether query is enabled */
  isEnabled: boolean;
}

export interface UseMongoFindOneOptions<T extends Record<string, unknown>> {
  /** Filter to apply */
  filter?: MongoFilter<T>;

  /** Fields to include/exclude */
  projection?: MongoProjection<T>;

  /** Enable/disable the query */
  enabled?: boolean;

  /** Callback on success */
  onSuccess?: (data: T | null) => void;

  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseMongoFindOneReturn<T> {
  /** Query result (single document) */
  data: T | null;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Not found state */
  isNotFound: boolean;

  /** Refetch function */
  refetch: () => Promise<void>;
}

export interface UseMongoAggregateOptions {
  /** Enable/disable the query */
  enabled?: boolean;

  /** Allow disk use for large aggregations */
  allowDiskUse?: boolean;

  /** Maximum time in ms for the aggregation */
  maxTimeMS?: number;

  /** Callback on success */
  onSuccess?: (data: unknown[]) => void;

  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseMongoAggregateReturn<T> {
  /** Aggregation result data */
  data: T[];

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Refetch function */
  refetch: () => Promise<void>;
}

export interface UseMongoMutationReturn<TData, TVariables> {
  /** Execute the mutation */
  mutate: (variables: TVariables) => Promise<TData>;

  /** Async execute the mutation */
  mutateAsync: (variables: TVariables) => Promise<TData>;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Success state */
  isSuccess: boolean;

  /** Last mutation result */
  data: TData | null;

  /** Reset the mutation state */
  reset: () => void;
}

export interface UseMongoInsertOneVariables<T> {
  document: Omit<T, "_id">;
}

export interface UseMongoInsertManyVariables<T> {
  documents: Omit<T, "_id">[];
}

export interface UseMongoUpdateOneVariables<T extends Record<string, unknown>> {
  filter: MongoFilter<T>;
  update: MongoUpdateOperators<T>;
  upsert?: boolean;
}

export interface UseMongoUpdateManyVariables<T extends Record<string, unknown>> {
  filter: MongoFilter<T>;
  update: MongoUpdateOperators<T>;
  upsert?: boolean;
}

export interface UseMongoDeleteOneVariables<T extends Record<string, unknown>> {
  filter: MongoFilter<T>;
}

export interface UseMongoDeleteManyVariables<T extends Record<string, unknown>> {
  filter: MongoFilter<T>;
}

export interface UseMongoInfiniteFindOptions<T extends Record<string, unknown>> {
  /** Filter to apply */
  filter?: MongoFilter<T>;

  /** Sort order */
  sort?: MongoSort<T>;

  /** Fields to include/exclude */
  projection?: MongoProjection<T>;

  /** Page size */
  pageSize?: number;

  /** Callback on success */
  onSuccess?: (data: T[], hasMore: boolean) => void;

  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseMongoInfiniteFindReturn<T> {
  /** All loaded data (flattened) */
  data: T[];

  /** Pages loaded */
  pages: T[][];

  /** Whether there's more data */
  hasMore: boolean;

  /** Loading state */
  isLoading: boolean;

  /** Fetching next page state */
  isFetchingNextPage: boolean;

  /** Error state */
  error: Error | null;

  /** Fetch next page */
  fetchNextPage: () => Promise<void>;

  /** Refetch all pages */
  refetch: () => Promise<void>;

  /** Reset to first page */
  reset: () => void;
}

export interface UseMongoCountOptions<T extends Record<string, unknown>> {
  /** Filter to apply */
  filter?: MongoFilter<T>;

  /** Enable/disable the query */
  enabled?: boolean;
}

// Simple in-memory cache for MongoDB queries
const mongoQueryCache = new Map<string, { data: unknown; timestamp: number }>();

function getMongoCacheKey(
  collection: string,
  operation: string,
  params?: unknown
): string {
  return `mongo:${collection}:${operation}:${JSON.stringify(params || {})}`;
}

// ============ HOOKS ============

/**
 * Get a MongoDB collection client
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const users = useMongoCollection<User>('users');
 *
 *   const handleCreate = async () => {
 *     await users.insertOne({ name: 'John', email: 'john@example.com' });
 *   };
 *
 *   return <button onClick={handleCreate}>Create User</button>;
 * }
 * ```
 */
export function useMongoCollection<T extends Record<string, unknown>>(
  collectionName: string
): MongoCollectionClient<T> {
  const client = useVaifClient();
  return useMemo(
    () => client.mongodb.collection<T>(collectionName),
    [client, collectionName]
  );
}

/**
 * Find documents in a MongoDB collection
 *
 * @example
 * ```tsx
 * function UserList() {
 *   const { data, isLoading, error } = useMongoFind<User>('users', {
 *     filter: { status: 'active' },
 *     sort: { createdAt: -1 },
 *     limit: 20,
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <ul>
 *       {data.map(user => (
 *         <li key={user._id}>{user.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useMongoFind<T extends Record<string, unknown>>(
  collection: string,
  options?: UseMongoFindOptions<T>
): UseMongoFindReturn<T> {
  const client = useVaifClient();
  const [data, setData] = useState<T[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<MongoQueryStatus>(
    options?.enabled === false ? "idle" : "loading"
  );
  const [isFetching, setIsFetching] = useState(false);
  const [isStale, setIsStale] = useState(true);
  const lastFetchRef = useRef<number>(0);

  const enabled = options?.enabled !== false;
  const staleTime = options?.staleTime ?? 0;
  const keepPreviousData = options?.keepPreviousData ?? false;

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    const findOptions: MongoFindOptions<T> = {
      sort: options?.sort,
      projection: options?.projection,
      skip: options?.skip,
      limit: options?.limit,
    };

    const cacheKey = getMongoCacheKey(collection, "find", {
      filter: options?.filter,
      options: findOptions,
    });
    const cached = mongoQueryCache.get(cacheKey);

    // Return cached data if not stale
    if (cached && Date.now() - cached.timestamp < staleTime) {
      setData(cached.data as T[]);
      setStatus("success");
      setIsStale(false);
      return;
    }

    setIsFetching(true);
    if (!keepPreviousData) {
      setStatus("loading");
    }
    setError(null);

    try {
      const collectionClient = client.mongodb.collection<T>(collection);
      const result = await collectionClient.find(options?.filter, findOptions);
      setData(result);
      setStatus("success");
      setIsStale(false);
      lastFetchRef.current = Date.now();
      mongoQueryCache.set(cacheKey, { data: result, timestamp: Date.now() });
      options?.onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("MongoDB find failed");
      setError(error);
      setStatus("error");
      options?.onError?.(error);
    } finally {
      setIsFetching(false);
    }
  }, [client, collection, options, enabled, staleTime, keepPreviousData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch on window focus
  useEffect(() => {
    if (!options?.refetchOnWindowFocus || !enabled) return;

    const handleFocus = () => {
      if (Date.now() - lastFetchRef.current > staleTime) {
        setIsStale(true);
        fetchData();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [options?.refetchOnWindowFocus, enabled, staleTime, fetchData]);

  // Refetch interval
  useEffect(() => {
    if (!options?.refetchInterval || options.refetchInterval <= 0 || !enabled) return;

    const interval = setInterval(() => {
      setIsStale(true);
      fetchData();
    }, options.refetchInterval);

    return () => clearInterval(interval);
  }, [options?.refetchInterval, enabled, fetchData]);

  return {
    data,
    isLoading: status === "loading",
    isFetching,
    error,
    status,
    refetch: fetchData,
    isStale,
    isEnabled: enabled,
  };
}

/**
 * Find a single document in a MongoDB collection
 *
 * @example
 * ```tsx
 * function UserProfile({ userId }: { userId: string }) {
 *   const { data: user, isLoading, isNotFound } = useMongoFindOne<User>('users', {
 *     filter: { _id: userId },
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *   if (isNotFound) return <NotFound />;
 *
 *   return <div>{user?.name}</div>;
 * }
 * ```
 */
export function useMongoFindOne<T extends Record<string, unknown>>(
  collection: string,
  options?: UseMongoFindOneOptions<T>
): UseMongoFindOneReturn<T> {
  const client = useVaifClient();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(options?.enabled !== false);
  const [isNotFound, setIsNotFound] = useState(false);

  const enabled = options?.enabled !== false;

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);
    setIsNotFound(false);

    try {
      const collectionClient = client.mongodb.collection<T>(collection);
      const result = await collectionClient.findOne(options?.filter);

      if (result === null) {
        setIsNotFound(true);
        setData(null);
      } else {
        setData(result);
      }
      options?.onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("MongoDB findOne failed");
      setError(error);
      options?.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [client, collection, options, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    isNotFound,
    refetch: fetchData,
  };
}

/**
 * Run an aggregation pipeline on a MongoDB collection
 *
 * @example
 * ```tsx
 * function UserStats() {
 *   const { data: stats, isLoading } = useMongoAggregate<{ _id: string; count: number }>('users', [
 *     { $match: { status: 'active' } },
 *     { $group: { _id: '$role', count: { $sum: 1 } } },
 *     { $sort: { count: -1 } },
 *   ]);
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       {stats.map(stat => (
 *         <div key={stat._id}>{stat._id}: {stat.count}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMongoAggregate<TResult = unknown>(
  collection: string,
  pipeline: MongoPipelineStage[],
  options?: UseMongoAggregateOptions
): UseMongoAggregateReturn<TResult> {
  const client = useVaifClient();
  const [data, setData] = useState<TResult[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(options?.enabled !== false);

  const enabled = options?.enabled !== false;

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const collectionClient = client.mongodb.collection(collection);
      const aggregateOptions: MongoAggregateOptions = {
        allowDiskUse: options?.allowDiskUse,
        maxTimeMS: options?.maxTimeMS,
      };
      const result = await collectionClient.aggregate<TResult>(pipeline, aggregateOptions);
      setData(result);
      options?.onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("MongoDB aggregate failed");
      setError(error);
      options?.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [client, collection, pipeline, options, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

/**
 * Insert a single document into a MongoDB collection
 *
 * @example
 * ```tsx
 * function CreateUser() {
 *   const { mutate, isLoading, error } = useMongoInsertOne<User>('users');
 *
 *   const handleSubmit = async (data: UserForm) => {
 *     await mutate({ document: { name: data.name, email: data.email } });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <button type="submit" disabled={isLoading}>Create</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useMongoInsertOne<T extends Record<string, unknown>>(
  collection: string,
  options?: {
    onSuccess?: (result: MongoInsertOneResult) => void;
    onError?: (error: Error) => void;
  }
): UseMongoMutationReturn<MongoInsertOneResult, UseMongoInsertOneVariables<T>> {
  const client = useVaifClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [data, setData] = useState<MongoInsertOneResult | null>(null);

  const mutateAsync = useCallback(
    async (variables: UseMongoInsertOneVariables<T>) => {
      setIsLoading(true);
      setError(null);
      setIsSuccess(false);

      try {
        const collectionClient = client.mongodb.collection<T>(collection);
        const result = await collectionClient.insertOne(variables.document);
        setData(result);
        setIsSuccess(true);
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("MongoDB insertOne failed");
        setError(error);
        options?.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [client, collection, options]
  );

  const mutate = useCallback(
    (variables: UseMongoInsertOneVariables<T>) => {
      mutateAsync(variables).catch(() => {});
      return Promise.resolve(data!);
    },
    [mutateAsync, data]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setIsSuccess(false);
    setData(null);
  }, []);

  return {
    mutate,
    mutateAsync,
    isLoading,
    error,
    isSuccess,
    data,
    reset,
  };
}

/**
 * Insert multiple documents into a MongoDB collection
 *
 * @example
 * ```tsx
 * function BulkCreateUsers() {
 *   const { mutate, isLoading } = useMongoInsertMany<User>('users');
 *
 *   const handleBulkCreate = async (users: UserForm[]) => {
 *     await mutate({ documents: users.map(u => ({ name: u.name, email: u.email })) });
 *   };
 *
 *   return <button onClick={() => handleBulkCreate(users)}>Create All</button>;
 * }
 * ```
 */
export function useMongoInsertMany<T extends Record<string, unknown>>(
  collection: string,
  options?: {
    onSuccess?: (result: MongoInsertManyResult) => void;
    onError?: (error: Error) => void;
  }
): UseMongoMutationReturn<MongoInsertManyResult, UseMongoInsertManyVariables<T>> {
  const client = useVaifClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [data, setData] = useState<MongoInsertManyResult | null>(null);

  const mutateAsync = useCallback(
    async (variables: UseMongoInsertManyVariables<T>) => {
      setIsLoading(true);
      setError(null);
      setIsSuccess(false);

      try {
        const collectionClient = client.mongodb.collection<T>(collection);
        const result = await collectionClient.insertMany(variables.documents);
        setData(result);
        setIsSuccess(true);
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("MongoDB insertMany failed");
        setError(error);
        options?.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [client, collection, options]
  );

  const mutate = useCallback(
    (variables: UseMongoInsertManyVariables<T>) => {
      mutateAsync(variables).catch(() => {});
      return Promise.resolve(data!);
    },
    [mutateAsync, data]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setIsSuccess(false);
    setData(null);
  }, []);

  return {
    mutate,
    mutateAsync,
    isLoading,
    error,
    isSuccess,
    data,
    reset,
  };
}

/**
 * Update a single document in a MongoDB collection
 *
 * @example
 * ```tsx
 * function UpdateUser({ userId }: { userId: string }) {
 *   const { mutate, isLoading } = useMongoUpdateOne<User>('users');
 *
 *   const handleUpdate = async (data: Partial<User>) => {
 *     await mutate({
 *       filter: { _id: userId },
 *       update: { $set: data },
 *     });
 *   };
 *
 *   return <button onClick={() => handleUpdate({ name: 'New Name' })}>Update</button>;
 * }
 * ```
 */
export function useMongoUpdateOne<T extends Record<string, unknown>>(
  collection: string,
  options?: {
    onSuccess?: (result: MongoUpdateResult) => void;
    onError?: (error: Error) => void;
  }
): UseMongoMutationReturn<MongoUpdateResult, UseMongoUpdateOneVariables<T>> {
  const client = useVaifClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [data, setData] = useState<MongoUpdateResult | null>(null);

  const mutateAsync = useCallback(
    async (variables: UseMongoUpdateOneVariables<T>) => {
      setIsLoading(true);
      setError(null);
      setIsSuccess(false);

      try {
        const collectionClient = client.mongodb.collection<T>(collection);
        const result = await collectionClient.updateOne(
          variables.filter,
          variables.update,
          { upsert: variables.upsert }
        );
        setData(result);
        setIsSuccess(true);
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("MongoDB updateOne failed");
        setError(error);
        options?.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [client, collection, options]
  );

  const mutate = useCallback(
    (variables: UseMongoUpdateOneVariables<T>) => {
      mutateAsync(variables).catch(() => {});
      return Promise.resolve(data!);
    },
    [mutateAsync, data]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setIsSuccess(false);
    setData(null);
  }, []);

  return {
    mutate,
    mutateAsync,
    isLoading,
    error,
    isSuccess,
    data,
    reset,
  };
}

/**
 * Update multiple documents in a MongoDB collection
 *
 * @example
 * ```tsx
 * function DeactivateInactiveUsers() {
 *   const { mutate, isLoading, data } = useMongoUpdateMany<User>('users');
 *
 *   const handleDeactivate = async () => {
 *     await mutate({
 *       filter: { lastLogin: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
 *       update: { $set: { status: 'inactive' } },
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleDeactivate} disabled={isLoading}>
 *         Deactivate Inactive Users
 *       </button>
 *       {data && <span>Updated {data.modifiedCount} users</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMongoUpdateMany<T extends Record<string, unknown>>(
  collection: string,
  options?: {
    onSuccess?: (result: MongoUpdateResult) => void;
    onError?: (error: Error) => void;
  }
): UseMongoMutationReturn<MongoUpdateResult, UseMongoUpdateManyVariables<T>> {
  const client = useVaifClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [data, setData] = useState<MongoUpdateResult | null>(null);

  const mutateAsync = useCallback(
    async (variables: UseMongoUpdateManyVariables<T>) => {
      setIsLoading(true);
      setError(null);
      setIsSuccess(false);

      try {
        const collectionClient = client.mongodb.collection<T>(collection);
        const result = await collectionClient.updateMany(
          variables.filter,
          variables.update,
          { upsert: variables.upsert }
        );
        setData(result);
        setIsSuccess(true);
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("MongoDB updateMany failed");
        setError(error);
        options?.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [client, collection, options]
  );

  const mutate = useCallback(
    (variables: UseMongoUpdateManyVariables<T>) => {
      mutateAsync(variables).catch(() => {});
      return Promise.resolve(data!);
    },
    [mutateAsync, data]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setIsSuccess(false);
    setData(null);
  }, []);

  return {
    mutate,
    mutateAsync,
    isLoading,
    error,
    isSuccess,
    data,
    reset,
  };
}

/**
 * Delete a single document from a MongoDB collection
 *
 * @example
 * ```tsx
 * function DeleteUser({ userId }: { userId: string }) {
 *   const { mutate, isLoading } = useMongoDeleteOne<User>('users');
 *
 *   const handleDelete = async () => {
 *     await mutate({ filter: { _id: userId } });
 *   };
 *
 *   return <button onClick={handleDelete} disabled={isLoading}>Delete</button>;
 * }
 * ```
 */
export function useMongoDeleteOne<T extends Record<string, unknown>>(
  collection: string,
  options?: {
    onSuccess?: (result: MongoDeleteResult) => void;
    onError?: (error: Error) => void;
  }
): UseMongoMutationReturn<MongoDeleteResult, UseMongoDeleteOneVariables<T>> {
  const client = useVaifClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [data, setData] = useState<MongoDeleteResult | null>(null);

  const mutateAsync = useCallback(
    async (variables: UseMongoDeleteOneVariables<T>) => {
      setIsLoading(true);
      setError(null);
      setIsSuccess(false);

      try {
        const collectionClient = client.mongodb.collection<T>(collection);
        const result = await collectionClient.deleteOne(variables.filter);
        setData(result);
        setIsSuccess(true);
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("MongoDB deleteOne failed");
        setError(error);
        options?.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [client, collection, options]
  );

  const mutate = useCallback(
    (variables: UseMongoDeleteOneVariables<T>) => {
      mutateAsync(variables).catch(() => {});
      return Promise.resolve(data!);
    },
    [mutateAsync, data]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setIsSuccess(false);
    setData(null);
  }, []);

  return {
    mutate,
    mutateAsync,
    isLoading,
    error,
    isSuccess,
    data,
    reset,
  };
}

/**
 * Delete multiple documents from a MongoDB collection
 *
 * @example
 * ```tsx
 * function CleanupOldLogs() {
 *   const { mutate, isLoading, data } = useMongoDeleteMany<Log>('logs');
 *
 *   const handleCleanup = async () => {
 *     await mutate({
 *       filter: { createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleCleanup} disabled={isLoading}>Clean Up Old Logs</button>
 *       {data && <span>Deleted {data.deletedCount} logs</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMongoDeleteMany<T extends Record<string, unknown>>(
  collection: string,
  options?: {
    onSuccess?: (result: MongoDeleteResult) => void;
    onError?: (error: Error) => void;
  }
): UseMongoMutationReturn<MongoDeleteResult, UseMongoDeleteManyVariables<T>> {
  const client = useVaifClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [data, setData] = useState<MongoDeleteResult | null>(null);

  const mutateAsync = useCallback(
    async (variables: UseMongoDeleteManyVariables<T>) => {
      setIsLoading(true);
      setError(null);
      setIsSuccess(false);

      try {
        const collectionClient = client.mongodb.collection<T>(collection);
        const result = await collectionClient.deleteMany(variables.filter);
        setData(result);
        setIsSuccess(true);
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("MongoDB deleteMany failed");
        setError(error);
        options?.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [client, collection, options]
  );

  const mutate = useCallback(
    (variables: UseMongoDeleteManyVariables<T>) => {
      mutateAsync(variables).catch(() => {});
      return Promise.resolve(data!);
    },
    [mutateAsync, data]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setIsSuccess(false);
    setData(null);
  }, []);

  return {
    mutate,
    mutateAsync,
    isLoading,
    error,
    isSuccess,
    data,
    reset,
  };
}

/**
 * Infinite scroll for MongoDB collections using cursor-based pagination
 *
 * @example
 * ```tsx
 * function InfinitePostList() {
 *   const {
 *     data,
 *     hasMore,
 *     fetchNextPage,
 *     isFetchingNextPage,
 *     isLoading,
 *   } = useMongoInfiniteFind<Post>('posts', {
 *     filter: { published: true },
 *     sort: { createdAt: -1 },
 *     pageSize: 20,
 *   });
 *
 *   const loadMoreRef = useRef<HTMLDivElement>(null);
 *
 *   useEffect(() => {
 *     const observer = new IntersectionObserver(([entry]) => {
 *       if (entry.isIntersecting && hasMore && !isFetchingNextPage) {
 *         fetchNextPage();
 *       }
 *     });
 *
 *     if (loadMoreRef.current) observer.observe(loadMoreRef.current);
 *     return () => observer.disconnect();
 *   }, [hasMore, isFetchingNextPage, fetchNextPage]);
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <>
 *       {data.map(post => <PostCard key={post._id} post={post} />)}
 *       <div ref={loadMoreRef}>{isFetchingNextPage && <Spinner />}</div>
 *     </>
 *   );
 * }
 * ```
 */
export function useMongoInfiniteFind<T extends Record<string, unknown>>(
  collection: string,
  options?: UseMongoInfiniteFindOptions<T>
): UseMongoInfiniteFindReturn<T> {
  const client = useVaifClient();
  const [pages, setPages] = useState<T[][]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const skipRef = useRef(0);

  const pageSize = options?.pageSize ?? 20;

  const fetchNextPageFn = useCallback(async () => {
    if (!hasMore) return;

    const isFirstPage = pages.length === 0;
    if (isFirstPage) {
      setIsLoading(true);
    } else {
      setIsFetchingNextPage(true);
    }
    setError(null);

    try {
      const collectionClient = client.mongodb.collection<T>(collection);
      const findOptions: MongoFindOptions<T> = {
        sort: options?.sort,
        projection: options?.projection,
        skip: skipRef.current,
        limit: pageSize,
      };
      const result = await collectionClient.find(options?.filter, findOptions);

      setPages((prev) => [...prev, result]);
      skipRef.current += result.length;
      const hasMoreData = result.length === pageSize;
      setHasMore(hasMoreData);
      options?.onSuccess?.(result, hasMoreData);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("MongoDB find failed");
      setError(error);
      options?.onError?.(error);
    } finally {
      setIsLoading(false);
      setIsFetchingNextPage(false);
    }
  }, [client, collection, options, hasMore, pages.length, pageSize]);

  // Fetch first page on mount
  useEffect(() => {
    fetchNextPageFn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetch = useCallback(async () => {
    setPages([]);
    skipRef.current = 0;
    setHasMore(true);
    setIsLoading(true);

    try {
      const collectionClient = client.mongodb.collection<T>(collection);
      const findOptions: MongoFindOptions<T> = {
        sort: options?.sort,
        projection: options?.projection,
        skip: 0,
        limit: pageSize,
      };
      const result = await collectionClient.find(options?.filter, findOptions);

      setPages([result]);
      skipRef.current = result.length;
      setHasMore(result.length === pageSize);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("MongoDB find failed"));
    } finally {
      setIsLoading(false);
    }
  }, [client, collection, options, pageSize]);

  const reset = useCallback(() => {
    setPages([]);
    skipRef.current = 0;
    setHasMore(true);
    setIsLoading(true);
    setError(null);
  }, []);

  const data = pages.flat();

  return {
    data,
    pages,
    hasMore,
    isLoading,
    isFetchingNextPage,
    error,
    fetchNextPage: fetchNextPageFn,
    refetch,
    reset,
  };
}

/**
 * Count documents in a MongoDB collection
 *
 * @example
 * ```tsx
 * function UserStats() {
 *   const { count, isLoading } = useMongoCount<User>('users', {
 *     filter: { status: 'active' },
 *   });
 *
 *   return <div>Active users: {isLoading ? '...' : count}</div>;
 * }
 * ```
 */
export function useMongoCount<T extends Record<string, unknown>>(
  collection: string,
  options?: UseMongoCountOptions<T>
): { count: number; isLoading: boolean; error: Error | null; refetch: () => Promise<void> } {
  const client = useVaifClient();
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(options?.enabled !== false);
  const [error, setError] = useState<Error | null>(null);

  const enabled = options?.enabled !== false;

  const fetchCount = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const collectionClient = client.mongodb.collection<T>(collection);
      const result = await collectionClient.countDocuments(options?.filter);
      setCount(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("MongoDB count failed"));
    } finally {
      setIsLoading(false);
    }
  }, [client, collection, options?.filter, enabled]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return { count, isLoading, error, refetch: fetchCount };
}

/**
 * Get distinct values for a field in a MongoDB collection
 *
 * @example
 * ```tsx
 * function RoleFilter() {
 *   const { values, isLoading } = useMongoDistinct<User, string>('users', 'role');
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <select>
 *       {values.map(role => (
 *         <option key={role} value={role}>{role}</option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 */
export function useMongoDistinct<T extends Record<string, unknown>, TValue = unknown>(
  collection: string,
  field: keyof T & string,
  options?: {
    filter?: MongoFilter<T>;
    enabled?: boolean;
  }
): { values: TValue[]; isLoading: boolean; error: Error | null; refetch: () => Promise<void> } {
  const client = useVaifClient();
  const [values, setValues] = useState<TValue[]>([]);
  const [isLoading, setIsLoading] = useState(options?.enabled !== false);
  const [error, setError] = useState<Error | null>(null);

  const enabled = options?.enabled !== false;

  const fetchDistinct = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const collectionClient = client.mongodb.collection<T>(collection);
      const result = await collectionClient.distinct(field, {
        filter: options?.filter as MongoFilter | undefined,
      });
      setValues(result as TValue[]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("MongoDB distinct failed"));
    } finally {
      setIsLoading(false);
    }
  }, [client, collection, field, options?.filter, enabled]);

  useEffect(() => {
    fetchDistinct();
  }, [fetchDistinct]);

  return { values, isLoading, error, refetch: fetchDistinct };
}
