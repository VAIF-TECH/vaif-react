import { useState, useEffect, useCallback, useRef } from "react";
import { useVaifClient } from "../context/VaifContext";
import type {
  QueryOptions,
  WhereFilter,
  OrderByClause,
  IncludeClause,
  PaginatedResult,
  PageInfo,
  ListResponse,
} from "@vaiftech/client";

// ============ TYPES ============

export type QueryStatus = "idle" | "loading" | "success" | "error";

export interface UseQueryOptions<T extends Record<string, unknown>> extends Partial<QueryOptions<T>> {
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

  /** Initial data */
  initialData?: T[];

  /** Stale time in ms (default: 0) */
  staleTime?: number;
}

export interface UseQueryReturn<T> {
  /** Query result data */
  data: T[];

  /** Loading state */
  isLoading: boolean;

  /** Fetching state (loading or refetching) */
  isFetching: boolean;

  /** Error state */
  error: Error | null;

  /** Query status */
  status: QueryStatus;

  /** Refetch function */
  refetch: () => Promise<void>;

  /** Whether data is stale */
  isStale: boolean;

  /** Whether query is enabled */
  isEnabled: boolean;
}

export interface UseQueryFirstReturn<T> {
  /** Query result (single item) */
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

export interface UsePaginatedQueryOptions<T extends Record<string, unknown>>
  extends Partial<QueryOptions<T>> {
  /** Page size */
  pageSize?: number;

  /** Initial page */
  initialPage?: number;

  /** Callback on success */
  onSuccess?: (result: PaginatedResult<T>) => void;

  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UsePaginatedQueryReturn<T> {
  /** Current page data */
  data: T[];

  /** Current page number (1-indexed) */
  page: number;

  /** Page size */
  pageSize: number;

  /** Total items count */
  totalCount: number;

  /** Total pages count */
  totalPages: number;

  /** Whether there's a next page */
  hasNextPage: boolean;

  /** Whether there's a previous page */
  hasPrevPage: boolean;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Go to next page */
  nextPage: () => void;

  /** Go to previous page */
  prevPage: () => void;

  /** Go to specific page */
  goToPage: (page: number) => void;

  /** Refetch current page */
  refetch: () => Promise<void>;
}

export interface UseInfiniteQueryOptions<T extends Record<string, unknown>>
  extends Partial<QueryOptions<T>> {
  /** Page size */
  pageSize?: number;

  /** Callback on success */
  onSuccess?: (data: T[], hasMore: boolean) => void;

  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseInfiniteQueryReturn<T> {
  /** All loaded data (flattened) */
  data: T[];

  /** Pages loaded */
  pages: T[][];

  /** Whether there's a next page */
  hasNextPage: boolean;

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

// Simple in-memory cache
const queryCache = new Map<string, { data: unknown; timestamp: number }>();

function getCacheKey<T extends Record<string, unknown>>(
  table: string,
  options?: QueryOptions<T>
): string {
  return `${table}:${JSON.stringify(options || {})}`;
}

// ============ HOOKS ============

/**
 * Query hook for fetching multiple records
 *
 * @example
 * ```tsx
 * function UserList() {
 *   const { data, isLoading, error, refetch } = useQuery<User>('users', {
 *     where: { status: 'active' },
 *     orderBy: { field: 'createdAt', direction: 'desc' },
 *     limit: 20,
 *     onSuccess: (users) => console.log('Loaded', users.length, 'users'),
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <ul>
 *       {data.map(user => (
 *         <li key={user.id}>{user.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useQuery<T extends Record<string, unknown>>(
  table: string,
  options?: UseQueryOptions<T>
): UseQueryReturn<T> {
  const client = useVaifClient();
  const [data, setData] = useState<T[]>(options?.initialData || []);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<QueryStatus>(options?.enabled === false ? "idle" : "loading");
  const [isFetching, setIsFetching] = useState(false);
  const [isStale, setIsStale] = useState(true);
  const lastFetchRef = useRef<number>(0);

  const enabled = options?.enabled !== false;
  const staleTime = options?.staleTime ?? 0;
  const keepPreviousData = options?.keepPreviousData ?? false;

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    const queryOptions: QueryOptions<T> = {
      where: options?.where,
      orderBy: options?.orderBy,
      limit: options?.limit,
      offset: options?.offset,
      select: options?.select,
      include: options?.include,
      distinct: options?.distinct,
    };

    const cacheKey = getCacheKey(table, queryOptions);
    const cached = queryCache.get(cacheKey);

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
      const result: ListResponse<T> = await client.from<T>(table).list(queryOptions);
      setData(result.data);
      setStatus("success");
      setIsStale(false);
      lastFetchRef.current = Date.now();
      queryCache.set(cacheKey, { data: result.data, timestamp: Date.now() });
      options?.onSuccess?.(result.data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Query failed");
      setError(error);
      setStatus("error");
      options?.onError?.(error);
    } finally {
      setIsFetching(false);
    }
  }, [client, table, options, enabled, staleTime, keepPreviousData]);

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
 * Query hook for fetching a single record by ID
 *
 * @example
 * ```tsx
 * function UserProfile({ userId }: { userId: string }) {
 *   const { data: user, isLoading, error } = useQueryById<User>('users', userId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *   if (!user) return <NotFound />;
 *
 *   return <div>{user.name}</div>;
 * }
 * ```
 */
export function useQueryById<T extends Record<string, unknown>>(
  table: string,
  id: string | null,
  options?: { enabled?: boolean }
): UseQueryFirstReturn<T> {
  const client = useVaifClient();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(!!id && options?.enabled !== false);
  const [isNotFound, setIsNotFound] = useState(false);

  const enabled = !!id && options?.enabled !== false;

  const fetchData = useCallback(async () => {
    if (!enabled || !id) return;

    setIsLoading(true);
    setError(null);
    setIsNotFound(false);

    try {
      const result = await client.from<T>(table).get(id);
      setData(result.data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Query failed");
      if (error.message.includes("not found") || error.message.includes("404")) {
        setIsNotFound(true);
      } else {
        setError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [client, table, id, enabled]);

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
 * Build a table client with fluent query options applied
 */
function buildTableClient<T extends Record<string, unknown>>(
  client: ReturnType<typeof useVaifClient>,
  table: string,
  options?: {
    where?: WhereFilter | WhereFilter[];
    orderBy?: OrderByClause<T> | OrderByClause<T>[];
    select?: (keyof T)[];
    include?: IncludeClause[];
  }
) {
  let tableClient = client.from<T>(table);

  if (options?.where) {
    // Handle both single filter and array of filters
    const whereFilter = Array.isArray(options.where)
      ? { AND: options.where }
      : options.where;
    tableClient = tableClient.where(whereFilter as WhereFilter);
  }

  if (options?.orderBy) {
    const orderBys = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy];
    for (const ob of orderBys) {
      tableClient = tableClient.orderBy(ob.field, ob.direction);
    }
  }

  if (options?.select) {
    tableClient = tableClient.select(...options.select);
  }

  if (options?.include) {
    for (const inc of options.include) {
      tableClient = tableClient.include(inc);
    }
  }

  return tableClient;
}

/**
 * Query hook for fetching the first matching record
 *
 * @example
 * ```tsx
 * function LatestPost() {
 *   const { data: post, isLoading } = useQueryFirst<Post>('posts', {
 *     where: { published: true },
 *     orderBy: { field: 'createdAt', direction: 'desc' },
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *   if (!post) return <Empty message="No posts yet" />;
 *
 *   return <PostCard post={post} />;
 * }
 * ```
 */
export function useQueryFirst<T extends Record<string, unknown>>(
  table: string,
  options?: UseQueryOptions<T>
): UseQueryFirstReturn<T> {
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
      const tableClient = buildTableClient<T>(client, table, {
        where: options?.where,
        orderBy: options?.orderBy,
        select: options?.select,
        include: options?.include,
      });

      const result = await tableClient.first();
      if (result) {
        setData(result);
      } else {
        setIsNotFound(true);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Query failed");
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, [client, table, options, enabled]);

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
 * Paginated query hook with page navigation
 *
 * @example
 * ```tsx
 * function UserTable() {
 *   const {
 *     data,
 *     page,
 *     totalPages,
 *     hasNextPage,
 *     hasPrevPage,
 *     nextPage,
 *     prevPage,
 *     isLoading,
 *   } = usePaginatedQuery<User>('users', {
 *     pageSize: 10,
 *     orderBy: { field: 'createdAt', direction: 'desc' },
 *   });
 *
 *   return (
 *     <>
 *       <table>
 *         {data.map(user => <UserRow key={user.id} user={user} />)}
 *       </table>
 *       <div>
 *         <button onClick={prevPage} disabled={!hasPrevPage}>Previous</button>
 *         <span>Page {page} of {totalPages}</span>
 *         <button onClick={nextPage} disabled={!hasNextPage}>Next</button>
 *       </div>
 *     </>
 *   );
 * }
 * ```
 */
export function usePaginatedQuery<T extends Record<string, unknown>>(
  table: string,
  options?: UsePaginatedQueryOptions<T>
): UsePaginatedQueryReturn<T> {
  const client = useVaifClient();
  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(options?.initialPage ?? 1);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const pageSize = options?.pageSize ?? 10;

  const fetchPage = useCallback(
    async (pageNumber: number) => {
      setIsLoading(true);
      setError(null);

      try {
        const tableClient = buildTableClient<T>(client, table, {
          where: options?.where,
          orderBy: options?.orderBy,
          select: options?.select,
          include: options?.include,
        });

        const result = await tableClient.paginate({
          page: pageNumber,
          pageSize,
        });

        setData(result.data);
        setPageInfo(result.pageInfo);
        setPage(result.pageInfo.page);
        options?.onSuccess?.(result);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Query failed");
        setError(error);
        options?.onError?.(error);
      } finally {
        setIsLoading(false);
      }
    },
    [client, table, options, pageSize]
  );

  useEffect(() => {
    fetchPage(page);
  }, [fetchPage, page]);

  const totalCount = pageInfo?.total ?? 0;
  const totalPages = pageInfo?.pageCount ?? 0;
  const hasNextPage = pageInfo?.hasNextPage ?? false;
  const hasPrevPage = pageInfo?.hasPrevPage ?? false;

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setPage((p) => p + 1);
    }
  }, [hasNextPage]);

  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      setPage((p) => p - 1);
    }
  }, [hasPrevPage]);

  const goToPage = useCallback(
    (pageNumber: number) => {
      const validPage = Math.max(1, Math.min(pageNumber, totalPages || 1));
      setPage(validPage);
    },
    [totalPages]
  );

  const refetch = useCallback(() => fetchPage(page), [fetchPage, page]);

  return {
    data,
    page,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage,
    hasPrevPage,
    isLoading,
    error,
    nextPage,
    prevPage,
    goToPage,
    refetch,
  };
}

/**
 * Infinite scroll query hook
 *
 * @example
 * ```tsx
 * function InfiniteUserList() {
 *   const {
 *     data,
 *     hasNextPage,
 *     fetchNextPage,
 *     isFetchingNextPage,
 *     isLoading,
 *   } = useInfiniteQuery<User>('users', {
 *     pageSize: 20,
 *     orderBy: { field: 'createdAt', direction: 'desc' },
 *   });
 *
 *   const loadMoreRef = useRef<HTMLDivElement>(null);
 *
 *   // Intersection observer for infinite scroll
 *   useEffect(() => {
 *     const observer = new IntersectionObserver(([entry]) => {
 *       if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
 *         fetchNextPage();
 *       }
 *     });
 *
 *     if (loadMoreRef.current) {
 *       observer.observe(loadMoreRef.current);
 *     }
 *
 *     return () => observer.disconnect();
 *   }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <>
 *       {data.map(user => <UserCard key={user.id} user={user} />)}
 *       <div ref={loadMoreRef}>
 *         {isFetchingNextPage && <Spinner />}
 *       </div>
 *     </>
 *   );
 * }
 * ```
 */
export function useInfiniteQuery<T extends Record<string, unknown>>(
  table: string,
  options?: UseInfiniteQueryOptions<T>
): UseInfiniteQueryReturn<T> {
  const client = useVaifClient();
  const [pages, setPages] = useState<T[][]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pageSize = options?.pageSize ?? 20;

  const fetchNextPageFn = useCallback(async () => {
    if (!hasNextPage) return;

    const isFirstPage = pages.length === 0;
    if (isFirstPage) {
      setIsLoading(true);
    } else {
      setIsFetchingNextPage(true);
    }
    setError(null);

    try {
      const tableClient = buildTableClient<T>(client, table, {
        where: options?.where,
        orderBy: options?.orderBy,
        select: options?.select,
        include: options?.include,
      });

      const result = await tableClient.cursorPaginate({
        cursor: cursor ?? undefined,
        limit: pageSize,
      });

      setPages((prev) => [...prev, result.data]);
      setCursor(result.nextCursor ?? null);
      setHasNextPage(result.hasMore);
      options?.onSuccess?.(result.data, result.hasMore);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Query failed");
      setError(error);
      options?.onError?.(error);
    } finally {
      setIsLoading(false);
      setIsFetchingNextPage(false);
    }
  }, [client, table, options, cursor, hasNextPage, pages.length, pageSize]);

  // Fetch first page on mount
  useEffect(() => {
    fetchNextPageFn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetch = useCallback(async () => {
    setPages([]);
    setCursor(null);
    setHasNextPage(true);
    setIsLoading(true);

    try {
      const tableClient = buildTableClient<T>(client, table, {
        where: options?.where,
        orderBy: options?.orderBy,
        select: options?.select,
        include: options?.include,
      });

      const result = await tableClient.cursorPaginate({
        limit: pageSize,
      });

      setPages([result.data]);
      setCursor(result.nextCursor ?? null);
      setHasNextPage(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Query failed"));
    } finally {
      setIsLoading(false);
    }
  }, [client, table, options, pageSize]);

  const reset = useCallback(() => {
    setPages([]);
    setCursor(null);
    setHasNextPage(true);
    setIsLoading(true);
    setError(null);
  }, []);

  const data = pages.flat();

  return {
    data,
    pages,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    error,
    fetchNextPage: fetchNextPageFn,
    refetch,
    reset,
  };
}

/**
 * Count query hook
 *
 * @example
 * ```tsx
 * function UserStats() {
 *   const { count, isLoading } = useCount('users', {
 *     where: { status: 'active' }
 *   });
 *
 *   return <div>Active users: {isLoading ? '...' : count}</div>;
 * }
 * ```
 */
export function useCount(
  table: string,
  options?: { where?: WhereFilter; enabled?: boolean }
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
      let tableClient = client.from(table);
      if (options?.where) {
        tableClient = tableClient.where(options.where);
      }
      const result = await tableClient.count();
      setCount(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Count failed"));
    } finally {
      setIsLoading(false);
    }
  }, [client, table, options?.where, enabled]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return { count, isLoading, error, refetch: fetchCount };
}
