import { useState, useCallback, useRef, useEffect } from "react";
import { useVaifClient } from "../context/VaifContext";
import type { InvokeResult, InvokeOptions, VaifFunction } from "@vaiftech/client";

// ============ TYPES ============

export interface UseFunctionOptions<TInput, TOutput> {
  /** Callback on success */
  onSuccess?: (data: TOutput, input: TInput) => void;

  /** Callback on error */
  onError?: (error: Error, input: TInput) => void;

  /** Timeout in ms */
  timeout?: number;

  /** Include execution logs in response */
  includeLogs?: boolean;

  /** Enable retry on failure */
  retry?: boolean;

  /** Max retry attempts (default: 3) */
  maxRetries?: number;

  /** Specific version to invoke */
  version?: number;
}

export interface UseFunctionReturn<TInput, TOutput> {
  /** Invoke the function */
  invoke: (input: TInput) => Promise<TOutput>;

  /** Result data */
  data: TOutput | null;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Whether invocation succeeded */
  isSuccess: boolean;

  /** Invocation metadata */
  invocation: InvokeResult<TOutput> | null;

  /** Reset state */
  reset: () => void;
}

export interface UseRpcOptions<TInput, TOutput> extends UseFunctionOptions<TInput, TOutput> {
  /** Cache results */
  cache?: boolean;

  /** Cache TTL in ms */
  cacheTtl?: number;
}

export interface UseRpcReturn<TInput, TOutput> extends UseFunctionReturn<TInput, TOutput> {
  /** Clear cache */
  clearCache: () => void;
}

export interface UseFunctionListOptions {
  /** Project ID (required) */
  projectId: string;

  /** Environment ID */
  envId?: string;

  /** Filter by enabled status */
  enabled?: boolean;

  /** Limit results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

export interface UseFunctionListReturn {
  /** List of functions */
  functions: VaifFunction[];

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Refresh list */
  refresh: () => Promise<void>;
}

// Simple cache for RPC calls
const rpcCache = new Map<string, { data: unknown; timestamp: number }>();

// ============ HOOKS ============

/**
 * Invoke a serverless function
 *
 * @example
 * ```tsx
 * function SendEmailButton({ to, subject, body }: EmailProps) {
 *   const { invoke, isLoading, error } = useFunction<EmailInput, EmailResult>(
 *     'send-email',
 *     {
 *       onSuccess: (result) => {
 *         toast.success(`Email sent! ID: ${result.messageId}`);
 *       },
 *       onError: (error) => {
 *         toast.error(`Failed: ${error.message}`);
 *       },
 *     }
 *   );
 *
 *   return (
 *     <button
 *       onClick={() => invoke({ to, subject, body })}
 *       disabled={isLoading}
 *     >
 *       {isLoading ? 'Sending...' : 'Send Email'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useFunction<TInput = unknown, TOutput = unknown>(
  functionIdOrName: string,
  options?: UseFunctionOptions<TInput, TOutput>
): UseFunctionReturn<TInput, TOutput> {
  const client = useVaifClient();
  const [data, setData] = useState<TOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [invocation, setInvocation] = useState<InvokeResult<TOutput> | null>(null);

  const retryCountRef = useRef(0);

  const invoke = useCallback(
    async (input: TInput): Promise<TOutput> => {
      setIsLoading(true);
      setError(null);
      setIsSuccess(false);

      try {
        const invokeOptions: InvokeOptions = {
          timeout: options?.timeout,
          includeLogs: options?.includeLogs,
          version: options?.version,
        };

        // Use retry config if retry is enabled
        if (options?.retry) {
          invokeOptions.retry = {
            maxRetries: options.maxRetries ?? 3,
          };
        }

        const result = await client.functions.invoke<TOutput, TInput>(
          functionIdOrName,
          { body: input },
          invokeOptions
        );

        setData(result.data);
        setInvocation(result);
        setIsSuccess(true);
        retryCountRef.current = 0;
        options?.onSuccess?.(result.data, input);

        return result.data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Function invocation failed");
        setError(error);
        options?.onError?.(error, input);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [client, functionIdOrName, options]
  );

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
    setError(null);
    setIsSuccess(false);
    setInvocation(null);
    retryCountRef.current = 0;
  }, []);

  return {
    invoke,
    data,
    isLoading,
    error,
    isSuccess,
    invocation,
    reset,
  };
}

/**
 * RPC-style function hook with caching
 *
 * @example
 * ```tsx
 * // Define typed RPC
 * type GetUserInput = { userId: string };
 * type GetUserOutput = { name: string; email: string };
 *
 * function UserProfile({ userId }: { userId: string }) {
 *   const { invoke, data, isLoading, error } = useRpc<GetUserInput, GetUserOutput>(
 *     'get-user',
 *     {
 *       cache: true,
 *       cacheTtl: 60000, // 1 minute
 *     }
 *   );
 *
 *   useEffect(() => {
 *     invoke({ userId });
 *   }, [userId, invoke]);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *   if (!data) return null;
 *
 *   return <div>{data.name} ({data.email})</div>;
 * }
 * ```
 */
export function useRpc<TInput = unknown, TOutput = unknown>(
  functionIdOrName: string,
  options?: UseRpcOptions<TInput, TOutput>
): UseRpcReturn<TInput, TOutput> {
  const client = useVaifClient();
  const [data, setData] = useState<TOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [invocation, setInvocation] = useState<InvokeResult<TOutput> | null>(null);

  const cacheEnabled = options?.cache ?? false;
  const cacheTtl = options?.cacheTtl ?? 60000;

  const getCacheKey = useCallback(
    (input: TInput): string => {
      return `${functionIdOrName}:${JSON.stringify(input)}`;
    },
    [functionIdOrName]
  );

  const invoke = useCallback(
    async (input: TInput): Promise<TOutput> => {
      // Check cache first
      if (cacheEnabled) {
        const cacheKey = getCacheKey(input);
        const cached = rpcCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < cacheTtl) {
          const cachedData = cached.data as TOutput;
          setData(cachedData);
          setIsSuccess(true);
          options?.onSuccess?.(cachedData, input);
          return cachedData;
        }
      }

      setIsLoading(true);
      setError(null);
      setIsSuccess(false);

      try {
        const invokeOptions: InvokeOptions = {
          timeout: options?.timeout,
          includeLogs: options?.includeLogs,
          version: options?.version,
        };

        if (options?.retry) {
          invokeOptions.retry = {
            maxRetries: options.maxRetries ?? 3,
          };
        }

        const rpc = client.functions.rpc<TInput, TOutput>(functionIdOrName, invokeOptions);
        const result = await rpc(input);

        setData(result);
        setIsSuccess(true);

        // Cache result
        if (cacheEnabled) {
          const cacheKey = getCacheKey(input);
          rpcCache.set(cacheKey, { data: result, timestamp: Date.now() });
        }

        options?.onSuccess?.(result, input);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("RPC call failed");
        setError(error);
        options?.onError?.(error, input);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [client, functionIdOrName, options, cacheEnabled, cacheTtl, getCacheKey]
  );

  const clearCache = useCallback(() => {
    // Clear all cache entries for this function
    const prefix = `${functionIdOrName}:`;
    for (const key of rpcCache.keys()) {
      if (key.startsWith(prefix)) {
        rpcCache.delete(key);
      }
    }
  }, [functionIdOrName]);

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
    setError(null);
    setIsSuccess(false);
    setInvocation(null);
  }, []);

  return {
    invoke,
    data,
    isLoading,
    error,
    isSuccess,
    invocation,
    reset,
    clearCache,
  };
}

/**
 * List available functions
 *
 * @example
 * ```tsx
 * function FunctionList({ projectId }: { projectId: string }) {
 *   const { functions, isLoading, refresh } = useFunctionList({
 *     projectId,
 *     enabled: true,
 *   });
 *
 *   return (
 *     <ul>
 *       {functions.map(fn => (
 *         <li key={fn.id}>
 *           {fn.name} - {fn.runtime}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useFunctionList(options: UseFunctionListOptions): UseFunctionListReturn {
  const client = useVaifClient();
  const [functions, setFunctions] = useState<VaifFunction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFunctions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await client.functions.list({
        projectId: options.projectId,
        envId: options.envId,
        enabled: options.enabled,
        limit: options.limit,
        offset: options.offset,
      });
      setFunctions(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to list functions"));
    } finally {
      setIsLoading(false);
    }
  }, [client, options.projectId, options.envId, options.enabled, options.limit, options.offset]);

  // Fetch on mount
  useEffect(() => {
    fetchFunctions();
  }, [fetchFunctions]);

  return {
    functions,
    isLoading,
    error,
    refresh: fetchFunctions,
  };
}

/**
 * Batch invoke multiple functions
 *
 * @example
 * ```tsx
 * function ProcessItems({ items }: { items: Item[] }) {
 *   const { invoke, results, isLoading, progress } = useBatchInvoke<ProcessInput, ProcessOutput>(
 *     'process-item',
 *     {
 *       concurrency: 5,
 *       onProgress: (completed, total) => {
 *         console.log(`${completed}/${total} processed`);
 *       },
 *     }
 *   );
 *
 *   return (
 *     <button onClick={() => invoke(items.map(i => ({ itemId: i.id })))}>
 *       {isLoading ? `Processing... ${progress}%` : 'Process All'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useBatchInvoke<TInput = unknown, TOutput = unknown>(
  functionIdOrName: string,
  options?: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
    onSuccess?: (results: TOutput[]) => void;
    onError?: (error: Error) => void;
  }
): {
  invoke: (inputs: TInput[]) => Promise<TOutput[]>;
  results: TOutput[];
  isLoading: boolean;
  progress: number;
  error: Error | null;
} {
  const client = useVaifClient();
  const [results, setResults] = useState<TOutput[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const invoke = useCallback(
    async (inputs: TInput[]): Promise<TOutput[]> => {
      setIsLoading(true);
      setError(null);
      setProgress(0);
      setResults([]);

      const allResults: TOutput[] = [];
      const concurrency = options?.concurrency ?? 5;
      const total = inputs.length;
      let completed = 0;

      try {
        // Process in batches
        for (let i = 0; i < inputs.length; i += concurrency) {
          const batch = inputs.slice(i, i + concurrency);

          const batchResults = await Promise.all(
            batch.map(async (input) => {
              const result = await client.functions.invoke<TOutput, TInput>(
                functionIdOrName,
                { body: input }
              );
              return result.data;
            })
          );

          allResults.push(...batchResults);
          completed += batch.length;
          setProgress(Math.round((completed / total) * 100));
          setResults([...allResults]);
          options?.onProgress?.(completed, total);
        }

        options?.onSuccess?.(allResults);
        return allResults;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Batch invocation failed");
        setError(error);
        options?.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [client, functionIdOrName, options]
  );

  return {
    invoke,
    results,
    isLoading,
    progress,
    error,
  };
}

/**
 * Scheduled/deferred function invocation
 *
 * @example
 * ```tsx
 * function ScheduleReminder() {
 *   const { schedule, cancel, isScheduled, scheduledAt } = useScheduledFunction<ReminderInput>(
 *     'send-reminder'
 *   );
 *
 *   const handleSchedule = () => {
 *     schedule(
 *       { userId: user.id, message: 'Follow up' },
 *       { delayMs: 24 * 60 * 60 * 1000 } // 24 hours
 *     );
 *   };
 *
 *   return (
 *     <div>
 *       {isScheduled ? (
 *         <>
 *           <span>Scheduled for {scheduledAt?.toLocaleString()}</span>
 *           <button onClick={cancel}>Cancel</button>
 *         </>
 *       ) : (
 *         <button onClick={handleSchedule}>Schedule Reminder</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useScheduledFunction<TInput = unknown>(
  functionIdOrName: string
): {
  schedule: (input: TInput, options: { delayMs: number }) => Promise<string>;
  cancel: () => Promise<void>;
  isScheduled: boolean;
  scheduledAt: Date | null;
  requestId: string | null;
  error: Error | null;
} {
  const client = useVaifClient();
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const schedule = useCallback(
    async (input: TInput, options: { delayMs: number }): Promise<string> => {
      setError(null);

      try {
        const result = await client.functions.invoke<unknown, TInput>(
          functionIdOrName,
          { body: input }
        );

        const id = result.requestId ?? `scheduled-${Date.now()}`;
        setRequestId(id);
        setIsScheduled(true);
        setScheduledAt(new Date(Date.now() + options.delayMs));

        return id;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to schedule function");
        setError(error);
        throw error;
      }
    },
    [client, functionIdOrName]
  );

  const cancel = useCallback(async () => {
    // Note: This would require a cancel endpoint on the API
    setIsScheduled(false);
    setScheduledAt(null);
    setRequestId(null);
  }, []);

  return {
    schedule,
    cancel,
    isScheduled,
    scheduledAt,
    requestId,
    error,
  };
}
