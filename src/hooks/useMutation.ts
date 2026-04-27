import { useState, useCallback, useRef, useEffect } from "react";
import { useVaifClient } from "../context/VaifContext";
import type { WhereFilter, UpsertOptions } from "@vaiftech/client";

// ============ TYPES ============

export type MutationStatus = "idle" | "loading" | "success" | "error";

export interface UseMutationOptions<TData, TVariables> {
  /** Callback on success */
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;

  /** Callback on error */
  onError?: (error: Error, variables: TVariables) => void | Promise<void>;

  /** Callback on mutation settled (success or error) */
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables
  ) => void | Promise<void>;

  /** Callback before mutation starts */
  onMutate?: (variables: TVariables) => void | Promise<void>;

  /** Retry count on failure (default: 0) */
  retry?: number;

  /** Retry delay in ms (default: 1000) */
  retryDelay?: number;
}

export interface UseMutationReturn<TData, TVariables> {
  /** Execute the mutation */
  mutate: (variables: TVariables) => void;

  /** Execute the mutation (async) */
  mutateAsync: (variables: TVariables) => Promise<TData>;

  /** Mutation result data */
  data: TData | undefined;

  /** Error state */
  error: Error | null;

  /** Loading state */
  isLoading: boolean;

  /** Success state */
  isSuccess: boolean;

  /** Error state (boolean) */
  isError: boolean;

  /** Idle state */
  isIdle: boolean;

  /** Mutation status */
  status: MutationStatus;

  /** Reset mutation state */
  reset: () => void;
}

export interface UseCreateOptions<T> extends UseMutationOptions<T, Partial<T>> {
  /** Invalidate query cache for this table after mutation */
  invalidateQueries?: boolean;
}

export interface UseUpdateOptions<T> extends UseMutationOptions<T, { id: string; data: Partial<T> }> {
  invalidateQueries?: boolean;
}

export interface UseDeleteOptions extends UseMutationOptions<void, string> {
  invalidateQueries?: boolean;
}

export interface UseUpsertOptions<T extends Record<string, unknown>>
  extends UseMutationOptions<T, { data: Partial<T>; conflictFields: (keyof T)[]; updateFields?: (keyof T)[] }> {
  invalidateQueries?: boolean;
}

// ============ HOOKS ============

/**
 * Generic mutation hook
 *
 * @example
 * ```tsx
 * function CreateUserForm() {
 *   const { mutate, isLoading, error, isSuccess } = useMutation(
 *     async (data: CreateUserInput) => {
 *       const response = await fetch('/api/users', {
 *         method: 'POST',
 *         body: JSON.stringify(data),
 *       });
 *       return response.json();
 *     },
 *     {
 *       onSuccess: (user) => {
 *         console.log('User created:', user);
 *       },
 *     }
 *   );
 *
 *   const handleSubmit = (data: CreateUserInput) => {
 *     mutate(data);
 *   };
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, TVariables>
): UseMutationReturn<TData, TVariables> {
  const [status, setStatus] = useState<MutationStatus>("idle");
  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const retryCountRef = useRef(0);

  const reset = useCallback(() => {
    setStatus("idle");
    setData(undefined);
    setError(null);
    retryCountRef.current = 0;
  }, []);

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setStatus("loading");
      setError(null);

      try {
        await options?.onMutate?.(variables);

        const result = await mutationFn(variables);

        setData(result);
        setStatus("success");
        retryCountRef.current = 0;

        await options?.onSuccess?.(result, variables);
        await options?.onSettled?.(result, null, variables);

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Mutation failed");

        // Retry logic
        const maxRetries = options?.retry ?? 0;
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          const delay = options?.retryDelay ?? 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return mutateAsync(variables);
        }

        setError(error);
        setStatus("error");

        await options?.onError?.(error, variables);
        await options?.onSettled?.(undefined, error, variables);

        throw error;
      }
    },
    [mutationFn, options]
  );

  const mutate = useCallback(
    (variables: TVariables) => {
      mutateAsync(variables).catch(() => {
        // Error already handled in mutateAsync
      });
    },
    [mutateAsync]
  );

  return {
    mutate,
    mutateAsync,
    data,
    error,
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError: status === "error",
    isIdle: status === "idle",
    status,
    reset,
  };
}

/**
 * Create mutation hook for a table
 *
 * @example
 * ```tsx
 * function CreatePost() {
 *   const { mutate, isLoading, isSuccess } = useCreate<Post>('posts', {
 *     onSuccess: (post) => {
 *       console.log('Post created:', post.id);
 *     },
 *   });
 *
 *   return (
 *     <button onClick={() => mutate({ title: 'New Post', content: '...' })}>
 *       {isLoading ? 'Creating...' : 'Create Post'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useCreate<T extends Record<string, unknown>>(
  table: string,
  options?: UseCreateOptions<T>
): UseMutationReturn<T, Partial<T>> {
  const client = useVaifClient();

  return useMutation<T, Partial<T>>(
    async (data) => {
      const result = await client.from<T>(table).create(data as Omit<T, "id" | "createdAt" | "updatedAt">);
      return result.data;
    },
    options
  );
}

/**
 * Update mutation hook for a table
 *
 * @example
 * ```tsx
 * function EditPost({ postId }: { postId: string }) {
 *   const { mutate, isLoading } = useUpdate<Post>('posts', {
 *     onSuccess: (post) => {
 *       toast.success('Post updated!');
 *     },
 *   });
 *
 *   return (
 *     <button onClick={() => mutate({ id: postId, data: { title: 'Updated Title' } })}>
 *       {isLoading ? 'Saving...' : 'Save'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useUpdate<T extends Record<string, unknown>>(
  table: string,
  options?: UseUpdateOptions<T>
): UseMutationReturn<T, { id: string; data: Partial<T> }> {
  const client = useVaifClient();

  return useMutation<T, { id: string; data: Partial<T> }>(
    async ({ id, data }) => {
      const result = await client.from<T>(table).update(id, data as Partial<Omit<T, "id" | "createdAt" | "updatedAt">>);
      return result.data;
    },
    options
  );
}

/**
 * Delete mutation hook for a table
 *
 * @example
 * ```tsx
 * function DeletePost({ postId }: { postId: string }) {
 *   const { mutate, isLoading } = useDelete('posts', {
 *     onSuccess: () => {
 *       toast.success('Post deleted');
 *       navigate('/posts');
 *     },
 *   });
 *
 *   return (
 *     <button onClick={() => mutate(postId)} disabled={isLoading}>
 *       {isLoading ? 'Deleting...' : 'Delete'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useDelete(
  table: string,
  options?: UseDeleteOptions
): UseMutationReturn<void, string> {
  const client = useVaifClient();

  return useMutation<void, string>(
    async (id) => {
      await client.from(table).delete(id);
    },
    options
  );
}

/**
 * Upsert mutation hook for a table
 *
 * @example
 * ```tsx
 * function SaveProfile({ userId }: { userId: string }) {
 *   const { mutate, isLoading } = useUpsert<Profile>('profiles', {
 *     onSuccess: (profile) => {
 *       toast.success('Profile saved');
 *     },
 *   });
 *
 *   return (
 *     <button onClick={() => mutate({
 *       data: { userId, bio: 'Hello world' },
 *       conflictFields: ['userId']
 *     })}>
 *       {isLoading ? 'Saving...' : 'Save Profile'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useUpsert<T extends Record<string, unknown>>(
  table: string,
  options?: UseUpsertOptions<T>
): UseMutationReturn<T, { data: Partial<T>; conflictFields: (keyof T)[]; updateFields?: (keyof T)[] }> {
  const client = useVaifClient();

  return useMutation<T, { data: Partial<T>; conflictFields: (keyof T)[]; updateFields?: (keyof T)[] }>(
    async ({ data, conflictFields, updateFields }) => {
      const upsertOptions: UpsertOptions<T> = {
        conflictFields,
        updateFields,
      };
      const result = await client.from<T>(table).upsert(
        data as Omit<T, "id" | "createdAt" | "updatedAt">,
        upsertOptions
      );
      return result.data;
    },
    options
  );
}

/**
 * Batch create mutation hook
 *
 * @example
 * ```tsx
 * function ImportUsers() {
 *   const { mutate, isLoading, data } = useBatchCreate<User>('users');
 *
 *   const handleImport = (users: Partial<User>[]) => {
 *     mutate(users);
 *   };
 *
 *   return (
 *     <>
 *       <input type="file" onChange={handleFileSelect} />
 *       <button onClick={handleImport} disabled={isLoading}>
 *         {isLoading ? `Importing... ${data?.count || 0}` : 'Import'}
 *       </button>
 *     </>
 *   );
 * }
 * ```
 */
export function useBatchCreate<T extends Record<string, unknown>>(
  table: string,
  options?: UseMutationOptions<{ count: number; records?: T[] }, Partial<T>[]>
): UseMutationReturn<{ count: number; records?: T[] }, Partial<T>[]> {
  const client = useVaifClient();

  return useMutation<{ count: number; records?: T[] }, Partial<T>[]>(
    async (items) => {
      const result = await client.from<T>(table).createMany(
        items as Omit<T, "id" | "createdAt" | "updatedAt">[]
      );
      return { count: result.count, records: result.records };
    },
    options
  );
}

/**
 * Batch update mutation hook - updates all records matching the where clause
 *
 * @example
 * ```tsx
 * function BulkUpdateStatus() {
 *   const { mutate, isLoading, data } = useBatchUpdate<Task>('tasks');
 *
 *   const markAllComplete = () => {
 *     mutate({
 *       data: { status: 'completed' },
 *       where: { assigneeId: currentUserId }
 *     });
 *   };
 *
 *   return (
 *     <button onClick={markAllComplete}>
 *       {isLoading ? `Updating... ${data?.count || 0}` : 'Mark All Complete'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useBatchUpdate<T extends Record<string, unknown>>(
  table: string,
  options?: UseMutationOptions<{ count: number; records?: T[] }, { data: Partial<T>; where: WhereFilter }>
): UseMutationReturn<{ count: number; records?: T[] }, { data: Partial<T>; where: WhereFilter }> {
  const client = useVaifClient();

  return useMutation<{ count: number; records?: T[] }, { data: Partial<T>; where: WhereFilter }>(
    async ({ data, where }) => {
      const result = await client
        .from<T>(table)
        .where(where)
        .updateMany(data as Partial<Omit<T, "id" | "createdAt" | "updatedAt">>);
      return { count: result.count, records: result.records };
    },
    options
  );
}

/**
 * Batch delete mutation hook - deletes all records matching the where clause
 *
 * @example
 * ```tsx
 * function BulkDelete() {
 *   const { mutate, isLoading, data } = useBatchDelete('items');
 *
 *   const deleteOldItems = () => {
 *     mutate({ olderThan: { lt: thirtyDaysAgo } });
 *   };
 *
 *   return (
 *     <button onClick={deleteOldItems}>
 *       {isLoading ? 'Deleting...' : `Delete old items (${data?.count || 0} deleted)`}
 *     </button>
 *   );
 * }
 * ```
 */
export function useBatchDelete(
  table: string,
  options?: UseMutationOptions<{ count: number }, WhereFilter>
): UseMutationReturn<{ count: number }, WhereFilter> {
  const client = useVaifClient();

  return useMutation<{ count: number }, WhereFilter>(
    async (where) => {
      const result = await client.from(table).where(where).deleteMany();
      return { count: result.count };
    },
    options
  );
}

/**
 * Optimistic update helper hook
 *
 * @example
 * ```tsx
 * function LikeButton({ postId, likes }: { postId: string; likes: number }) {
 *   const { mutate, optimisticData, rollback } = useOptimisticMutation(
 *     likes,
 *     async () => {
 *       await vaif.from('posts').update(postId, { likes: likes + 1 });
 *     },
 *     {
 *       optimisticUpdate: (current) => current + 1,
 *       onError: () => {
 *         toast.error('Failed to like post');
 *       },
 *     }
 *   );
 *
 *   return (
 *     <button onClick={() => mutate()}>
 *       {optimisticData} likes
 *     </button>
 *   );
 * }
 * ```
 */
export function useOptimisticMutation<TData, TVariables = void>(
  currentData: TData,
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    optimisticUpdate: (current: TData, variables: TVariables) => TData;
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
    onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
  }
): {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  optimisticData: TData;
  rollback: () => void;
  isLoading: boolean;
  error: Error | null;
} {
  const [optimisticData, setOptimisticData] = useState(currentData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const previousDataRef = useRef(currentData);

  // Sync optimistic data when the external currentData changes
  useEffect(() => {
    if (!isLoading) {
      setOptimisticData(currentData);
      previousDataRef.current = currentData;
    }
  }, [currentData, isLoading]);

  const rollback = useCallback(() => {
    setOptimisticData(previousDataRef.current);
  }, []);

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setIsLoading(true);
      setError(null);

      // Store previous data for rollback
      previousDataRef.current = optimisticData;

      // Apply optimistic update
      const newData = options.optimisticUpdate(optimisticData, variables);
      setOptimisticData(newData);

      try {
        const result = await mutationFn(variables);
        setOptimisticData(result);
        options.onSuccess?.(result, variables);
        options.onSettled?.(result, null, variables);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Mutation failed");
        setError(error);
        rollback();
        options.onError?.(error, variables);
        options.onSettled?.(undefined, error, variables);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [optimisticData, mutationFn, options, rollback]
  );

  const mutate = useCallback(
    (variables: TVariables) => {
      mutateAsync(variables).catch(() => {});
    },
    [mutateAsync]
  );

  return {
    mutate,
    mutateAsync,
    optimisticData,
    rollback,
    isLoading,
    error,
  };
}
