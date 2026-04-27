import { useState, useEffect, useCallback, useRef } from "react";
import { useVaifClient } from "../context/VaifContext";
import type {
  ProjectMetrics,
  IncidentAlert,
  IncidentStatus,
  StatusComponent,
  SecurityAuditLog,
  RealtimeStats,
  RealtimeMonitoringEvent,
} from "@vaiftech/client";

// ============ TYPES ============

export interface UseMetricsOptions {
  /** Auto-refresh interval in ms (0 = disabled) */
  refetchInterval?: number;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Callback on success */
  onSuccess?: (metrics: ProjectMetrics) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseMetricsReturn {
  /** Project metrics data */
  metrics: ProjectMetrics | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch metrics */
  refetch: () => Promise<void>;
}

export interface UseAuditLogsOptions {
  /** Page size */
  limit?: number;
  /** Page offset */
  offset?: number;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Auto-refresh interval in ms (0 = disabled) */
  refetchInterval?: number;
  /** Callback on success */
  onSuccess?: (logs: SecurityAuditLog[], total: number) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseAuditLogsReturn {
  /** Audit log entries */
  logs: SecurityAuditLog[];
  /** Total count */
  total: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch logs */
  refetch: () => Promise<void>;
  /** Load next page */
  loadMore: () => void;
  /** Whether there are more pages */
  hasMore: boolean;
}

export interface UseIncidentsOptions {
  /** Filter by status */
  status?: IncidentStatus;
  /** Auto-refresh interval in ms (0 = disabled) */
  refetchInterval?: number;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Callback on success */
  onSuccess?: (incidents: IncidentAlert[]) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseIncidentsReturn {
  /** Incident alerts */
  incidents: IncidentAlert[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch incidents */
  refetch: () => Promise<void>;
  /** Acknowledge an incident */
  acknowledge: (incidentId: string) => Promise<void>;
  /** Resolve an incident */
  resolve: (incidentId: string) => Promise<void>;
  /** Count by severity */
  countBySeverity: Record<string, number>;
}

export interface UseSystemHealthOptions {
  /** Auto-refresh interval in ms (0 = disabled) */
  refetchInterval?: number;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Callback on status change */
  onStatusChange?: (components: StatusComponent[]) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseSystemHealthReturn {
  /** Health components */
  components: StatusComponent[];
  /** Overall status */
  overallStatus: "operational" | "degraded" | "partial_outage" | "major_outage";
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch health status */
  refetch: () => Promise<void>;
  /** Check if a specific component is healthy */
  isHealthy: (componentName: string) => boolean;
}

export interface UseRealtimeStatsOptions {
  /** Auto-refresh interval in ms (0 = disabled) */
  refetchInterval?: number;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Include recent events */
  includeEvents?: boolean;
  /** Max events to fetch */
  eventsLimit?: number;
  /** Callback on success */
  onSuccess?: (stats: RealtimeStats, events?: RealtimeMonitoringEvent[]) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseRealtimeStatsReturn {
  /** Realtime statistics */
  stats: RealtimeStats | null;
  /** Recent realtime events */
  events: RealtimeMonitoringEvent[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch stats */
  refetch: () => Promise<void>;
}

export interface UseErrorTrackingOptions {
  /** Time window in hours (default: 24) */
  timeWindowHours?: number;
  /** Auto-refresh interval in ms (0 = disabled) */
  refetchInterval?: number;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Callback on high error rate */
  onHighErrorRate?: (errorRate: number) => void;
  /** Error rate threshold (default: 0.05 = 5%) */
  errorRateThreshold?: number;
}

export interface UseErrorTrackingReturn {
  /** Total requests */
  requestCount: number;
  /** Total errors */
  errorCount: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Average latency in ms */
  avgLatencyMs: number;
  /** Whether error rate is above threshold */
  isHighErrorRate: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch stats */
  refetch: () => Promise<void>;
}

// ============ HOOKS ============

/**
 * Hook for fetching project metrics
 *
 * @example
 * ```tsx
 * function MetricsDashboard({ projectId }: { projectId: string }) {
 *   const { metrics, isLoading, error } = useMetrics(projectId, {
 *     refetchInterval: 30000, // Refresh every 30 seconds
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <div>
 *       <Stat label="Requests (24h)" value={metrics?.requestsLast24h} />
 *       <Stat label="Errors (24h)" value={metrics?.errorsLast24h} />
 *       <Stat label="Avg Latency" value={`${metrics?.avgLatencyMs}ms`} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useMetrics(
  projectId: string,
  options: UseMetricsOptions = {}
): UseMetricsReturn {
  const client = useVaifClient();
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(options.enabled !== false);
  const [error, setError] = useState<Error | null>(null);

  const enabled = options.enabled !== false && !!projectId;

  const fetchMetrics = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.admin.getProject(projectId);
      setMetrics(result.metrics);
      options.onSuccess?.(result.metrics);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch metrics");
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [client, projectId, enabled, options]);

  // Initial fetch
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Refetch interval
  useEffect(() => {
    if (!options.refetchInterval || options.refetchInterval <= 0 || !enabled) return;

    const interval = setInterval(fetchMetrics, options.refetchInterval);
    return () => clearInterval(interval);
  }, [options.refetchInterval, enabled, fetchMetrics]);

  return {
    metrics,
    isLoading,
    error,
    refetch: fetchMetrics,
  };
}

/**
 * Hook for fetching security audit logs
 *
 * @example
 * ```tsx
 * function AuditLogViewer({ projectId }: { projectId: string }) {
 *   const { logs, total, isLoading, loadMore, hasMore } = useAuditLogs(projectId, {
 *     limit: 50,
 *   });
 *
 *   return (
 *     <div>
 *       <h2>Audit Logs ({total})</h2>
 *       {logs.map(log => (
 *         <LogEntry key={log.id} log={log} />
 *       ))}
 *       {hasMore && (
 *         <button onClick={loadMore} disabled={isLoading}>
 *           Load More
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuditLogs(
  projectId: string,
  options: UseAuditLogsOptions = {}
): UseAuditLogsReturn {
  const client = useVaifClient();
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(options.enabled !== false);
  const [error, setError] = useState<Error | null>(null);
  const [offset, setOffset] = useState(options.offset ?? 0);

  const limit = options.limit ?? 50;
  const enabled = options.enabled !== false && !!projectId;

  const fetchLogs = useCallback(async (resetOffset = false) => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    const currentOffset = resetOffset ? 0 : offset;
    if (resetOffset) {
      setOffset(0);
    }

    try {
      const result = await client.security.getAuditLogs(projectId, {
        limit,
        offset: currentOffset,
      });

      if (resetOffset) {
        setLogs(result.logs);
      } else {
        setLogs((prev) => [...prev, ...result.logs]);
      }
      setTotal(result.total);
      options.onSuccess?.(result.logs, result.total);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch audit logs");
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [client, projectId, enabled, limit, offset, options]);

  // Initial fetch
  useEffect(() => {
    fetchLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, limit, enabled]);

  // Refetch interval
  useEffect(() => {
    if (!options.refetchInterval || options.refetchInterval <= 0 || !enabled) return;

    const interval = setInterval(() => fetchLogs(true), options.refetchInterval);
    return () => clearInterval(interval);
  }, [options.refetchInterval, enabled, fetchLogs]);

  const loadMore = useCallback(() => {
    if (logs.length < total && !isLoading) {
      setOffset(logs.length);
      fetchLogs(false);
    }
  }, [logs.length, total, isLoading, fetchLogs]);

  return {
    logs,
    total,
    isLoading,
    error,
    refetch: () => fetchLogs(true),
    loadMore,
    hasMore: logs.length < total,
  };
}

/**
 * Hook for monitoring incidents
 *
 * @example
 * ```tsx
 * function IncidentMonitor() {
 *   const {
 *     incidents,
 *     countBySeverity,
 *     acknowledge,
 *     resolve,
 *     isLoading,
 *   } = useIncidents({
 *     status: 'open',
 *     refetchInterval: 60000, // Check every minute
 *   });
 *
 *   return (
 *     <div>
 *       <SeverityBadges counts={countBySeverity} />
 *       {incidents.map(incident => (
 *         <IncidentCard
 *           key={incident.id}
 *           incident={incident}
 *           onAcknowledge={() => acknowledge(incident.id)}
 *           onResolve={() => resolve(incident.id)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useIncidents(
  options: UseIncidentsOptions = {}
): UseIncidentsReturn {
  const client = useVaifClient();
  const [incidents, setIncidents] = useState<IncidentAlert[]>([]);
  const [isLoading, setIsLoading] = useState(options.enabled !== false);
  const [error, setError] = useState<Error | null>(null);

  const enabled = options.enabled !== false;
  const status = options.status ?? "open";

  const fetchIncidents = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.admin.listIncidents(status);
      setIncidents(result);
      options.onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch incidents");
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [client, enabled, status, options]);

  // Initial fetch
  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Refetch interval
  useEffect(() => {
    if (!options.refetchInterval || options.refetchInterval <= 0 || !enabled) return;

    const interval = setInterval(fetchIncidents, options.refetchInterval);
    return () => clearInterval(interval);
  }, [options.refetchInterval, enabled, fetchIncidents]);

  const acknowledge = useCallback(async (incidentId: string) => {
    await client.admin.acknowledgeIncident(incidentId);
    // Update local state
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incidentId ? { ...inc, status: "acknowledged" } : inc
      )
    );
  }, [client]);

  const resolve = useCallback(async (incidentId: string) => {
    await client.admin.resolveIncident(incidentId);
    // Remove from list if filtering by open
    if (status === "open") {
      setIncidents((prev) => prev.filter((inc) => inc.id !== incidentId));
    } else {
      setIncidents((prev) =>
        prev.map((inc) =>
          inc.id === incidentId ? { ...inc, status: "resolved" } : inc
        )
      );
    }
  }, [client, status]);

  // Count by severity
  const countBySeverity = incidents.reduce((acc, inc) => {
    const severity = inc.severity || "unknown";
    acc[severity] = (acc[severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    incidents,
    isLoading,
    error,
    refetch: fetchIncidents,
    acknowledge,
    resolve,
    countBySeverity,
  };
}

/**
 * Hook for monitoring system health
 *
 * @example
 * ```tsx
 * function SystemStatus() {
 *   const {
 *     components,
 *     overallStatus,
 *     isHealthy,
 *     isLoading,
 *   } = useSystemHealth({
 *     refetchInterval: 30000,
 *     onStatusChange: (components) => {
 *       const degraded = components.filter(c => c.status !== 'operational');
 *       if (degraded.length > 0) {
 *         notify('System degradation detected');
 *       }
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       <StatusBadge status={overallStatus} />
 *       {components.map(component => (
 *         <ComponentStatus key={component.id} component={component} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSystemHealth(
  options: UseSystemHealthOptions = {}
): UseSystemHealthReturn {
  const client = useVaifClient();
  const [components, setComponents] = useState<StatusComponent[]>([]);
  const [isLoading, setIsLoading] = useState(options.enabled !== false);
  const [error, setError] = useState<Error | null>(null);
  const prevComponentsRef = useRef<StatusComponent[]>([]);

  const enabled = options.enabled !== false;

  const fetchHealth = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.admin.getHealthComponents();
      setComponents(result.components);

      // Check for status changes
      if (prevComponentsRef.current.length > 0) {
        const hasChanges = result.components.some((comp) => {
          const prev = prevComponentsRef.current.find((p) => p.id === comp.id);
          return prev && prev.status !== comp.status;
        });

        if (hasChanges) {
          options.onStatusChange?.(result.components);
        }
      }

      prevComponentsRef.current = result.components;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch health status");
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [client, enabled, options]);

  // Initial fetch
  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Refetch interval
  useEffect(() => {
    if (!options.refetchInterval || options.refetchInterval <= 0 || !enabled) return;

    const interval = setInterval(fetchHealth, options.refetchInterval);
    return () => clearInterval(interval);
  }, [options.refetchInterval, enabled, fetchHealth]);

  // Calculate overall status
  const overallStatus = components.reduce<"operational" | "degraded" | "partial_outage" | "major_outage">(
    (worst, comp) => {
      const statusOrder = ["operational", "degraded", "partial_outage", "major_outage"] as const;
      const compIndex = statusOrder.indexOf(comp.status as typeof statusOrder[number]);
      const worstIndex = statusOrder.indexOf(worst);
      return compIndex > worstIndex ? (comp.status as typeof worst) : worst;
    },
    "operational"
  );

  const isHealthy = useCallback(
    (componentName: string) => {
      const component = components.find((c) => c.name === componentName);
      return component?.status === "operational";
    },
    [components]
  );

  return {
    components,
    overallStatus,
    isLoading,
    error,
    refetch: fetchHealth,
    isHealthy,
  };
}

/**
 * Hook for monitoring realtime stats
 *
 * @example
 * ```tsx
 * function RealtimeMonitor({ projectId }: { projectId: string }) {
 *   const { stats, events, isLoading } = useRealtimeStats(projectId, {
 *     refetchInterval: 10000,
 *     includeEvents: true,
 *     eventsLimit: 20,
 *   });
 *
 *   return (
 *     <div>
 *       <StatCard label="Connections" value={stats?.connections} />
 *       <StatCard label="Subscriptions" value={stats?.subscriptions} />
 *       <StatCard label="Events (24h)" value={stats?.eventsDelivered24h} />
 *       <EventList events={events} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useRealtimeStats(
  projectId: string,
  options: UseRealtimeStatsOptions = {}
): UseRealtimeStatsReturn {
  const client = useVaifClient();
  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [events, setEvents] = useState<RealtimeMonitoringEvent[]>([]);
  const [isLoading, setIsLoading] = useState(options.enabled !== false);
  const [error, setError] = useState<Error | null>(null);

  const enabled = options.enabled !== false && !!projectId;
  const includeEvents = options.includeEvents ?? false;
  const eventsLimit = options.eventsLimit ?? 50;

  const fetchStats = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const statsResult = await client.realtimeMonitoring.getStats(projectId);
      setStats(statsResult);

      let eventsResult: RealtimeMonitoringEvent[] = [];
      if (includeEvents) {
        eventsResult = await client.realtimeMonitoring.getEvents(projectId, { limit: eventsLimit });
        setEvents(eventsResult);
      }

      options.onSuccess?.(statsResult, eventsResult);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch realtime stats");
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [client, projectId, enabled, includeEvents, eventsLimit, options]);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Refetch interval
  useEffect(() => {
    if (!options.refetchInterval || options.refetchInterval <= 0 || !enabled) return;

    const interval = setInterval(fetchStats, options.refetchInterval);
    return () => clearInterval(interval);
  }, [options.refetchInterval, enabled, fetchStats]);

  return {
    stats,
    events,
    isLoading,
    error,
    refetch: fetchStats,
  };
}

/**
 * Hook for error tracking and alerting
 *
 * @example
 * ```tsx
 * function ErrorRateMonitor({ projectId }: { projectId: string }) {
 *   const {
 *     requestCount,
 *     errorCount,
 *     errorRate,
 *     avgLatencyMs,
 *     isHighErrorRate,
 *   } = useErrorTracking(projectId, {
 *     refetchInterval: 60000,
 *     errorRateThreshold: 0.05, // 5%
 *     onHighErrorRate: (rate) => {
 *       alert(`High error rate detected: ${(rate * 100).toFixed(1)}%`);
 *     },
 *   });
 *
 *   return (
 *     <div className={isHighErrorRate ? 'alert' : ''}>
 *       <Stat label="Requests" value={requestCount} />
 *       <Stat label="Errors" value={errorCount} />
 *       <Stat label="Error Rate" value={`${(errorRate * 100).toFixed(2)}%`} />
 *       <Stat label="Avg Latency" value={`${avgLatencyMs}ms`} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useErrorTracking(
  projectId: string,
  options: UseErrorTrackingOptions = {}
): UseErrorTrackingReturn {
  const client = useVaifClient();
  const [requestCount, setRequestCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [avgLatencyMs, setAvgLatencyMs] = useState(0);
  const [isLoading, setIsLoading] = useState(options.enabled !== false);
  const [error, setError] = useState<Error | null>(null);

  const enabled = options.enabled !== false && !!projectId;
  const threshold = options.errorRateThreshold ?? 0.05;

  const fetchErrorStats = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.admin.getProject(projectId);
      const metrics = result.metrics;

      setRequestCount(metrics.requestsLast24h);
      setErrorCount(metrics.errorsLast24h);
      setAvgLatencyMs(metrics.avgLatencyMs);

      // Check error rate threshold
      const rate = metrics.requestsLast24h > 0
        ? metrics.errorsLast24h / metrics.requestsLast24h
        : 0;

      if (rate > threshold) {
        options.onHighErrorRate?.(rate);
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error("Failed to fetch error stats");
      setError(errorObj);
    } finally {
      setIsLoading(false);
    }
  }, [client, projectId, enabled, threshold, options]);

  // Initial fetch
  useEffect(() => {
    fetchErrorStats();
  }, [fetchErrorStats]);

  // Refetch interval
  useEffect(() => {
    if (!options.refetchInterval || options.refetchInterval <= 0 || !enabled) return;

    const interval = setInterval(fetchErrorStats, options.refetchInterval);
    return () => clearInterval(interval);
  }, [options.refetchInterval, enabled, fetchErrorStats]);

  const errorRate = requestCount > 0 ? errorCount / requestCount : 0;
  const isHighErrorRate = errorRate > threshold;

  return {
    requestCount,
    errorCount,
    errorRate,
    avgLatencyMs,
    isHighErrorRate,
    isLoading,
    error,
    refetch: fetchErrorStats,
  };
}
