import { useState, useEffect, useCallback, useRef } from "react";
import { useVaifClient } from "../context/VaifContext";
import type {
  DbChangeEvent,
  DbOperation,
  ConnectionState,
  RealtimeClient,
  RealtimeChannel,
  PresenceState,
  PresenceEntry,
} from "@vaiftech/client";

// ============ TYPES ============

export interface UseRealtimeOptions {
  /** Enable/disable the subscription */
  enabled?: boolean;
}

export interface UseSubscriptionOptions<T = Record<string, unknown>> extends UseRealtimeOptions {
  /** Filter by operations */
  operations?: DbOperation[];

  /** Filter expression */
  filter?: string;

  /** Callback on insert */
  onInsert?: (record: T) => void;

  /** Callback on update */
  onUpdate?: (record: T, old: T | null) => void;

  /** Callback on delete */
  onDelete?: (record: T) => void;

  /** Callback on any change */
  onChange?: (event: DbChangeEvent<T>) => void;
}

export interface UseSubscriptionReturn<T> {
  /** Latest received record */
  data: T | null;

  /** All changes received */
  changes: DbChangeEvent<T>[];

  /** Whether subscribed */
  isSubscribed: boolean;

  /** Clear changes history */
  clearChanges: () => void;
}

export interface UseChannelOptions extends UseRealtimeOptions {
  /** Channel type */
  type?: "public" | "private" | "presence";
}

export interface BroadcastMessage<T = unknown> {
  event: string;
  payload: T;
  senderId?: string;
}

export interface UseChannelReturn<TMessage = unknown> {
  /** Send a broadcast message */
  broadcast: (event: string, payload: TMessage) => void;

  /** Last received broadcast */
  lastMessage: BroadcastMessage<TMessage> | null;

  /** All broadcast messages received */
  messages: BroadcastMessage<TMessage>[];

  /** Whether channel is joined */
  isJoined: boolean;

  /** Leave channel */
  leave: () => void;
}

export interface UsePresenceOptions {
  /** Enable/disable */
  enabled?: boolean;
}

export interface UsePresenceReturn<T extends PresenceState> {
  /** Current presence state (all users) */
  presence: Record<string, PresenceEntry<T>[]>;

  /** Number of online users */
  count: number;

  /** List of online user keys */
  onlineUsers: string[];

  /** Update own presence state */
  update: (state: Partial<T>) => void;

  /** Leave presence (go offline) */
  leave: () => void;

  /** Whether currently tracked */
  isTracking: boolean;
}

// ============ HOOKS ============

/**
 * Subscribe to database table changes in real-time
 *
 * @example
 * ```tsx
 * function MessageList() {
 *   const { data, changes } = useSubscription<Message>('messages', {
 *     operations: ['INSERT'],
 *     onInsert: (message) => {
 *       playNotificationSound();
 *     },
 *   });
 *
 *   return (
 *     <ul>
 *       {changes.map((change, i) => (
 *         <li key={i}>{change.new?.text}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useSubscription<T = Record<string, unknown>>(
  table: string,
  options?: UseSubscriptionOptions<T>
): UseSubscriptionReturn<T> {
  const client = useVaifClient();
  const [data, setData] = useState<T | null>(null);
  const [changes, setChanges] = useState<DbChangeEvent<T>[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const realtimeRef = useRef<RealtimeClient | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled) return;

    // Create realtime client
    const realtime = client.realtime();
    realtimeRef.current = realtime;

    // Create channel for table
    const channel = realtime.channel(`table:${table}`);
    channelRef.current = channel;

    // Subscribe to database changes
    channel.onDbChange<T>(
      {
        table,
        event: options?.operations || "*",
      },
      (event) => {
        // Only set data if new record exists
        if (event.new !== undefined) {
          setData(event.new);
        }
        setChanges((prev) => [...prev, event]);

        // Call specific callbacks
        switch (event.operation) {
          case "INSERT":
            if (event.new) {
              options?.onInsert?.(event.new);
            }
            break;
          case "UPDATE":
            if (event.new) {
              options?.onUpdate?.(event.new, event.old ?? null);
            }
            break;
          case "DELETE":
            if (event.old) {
              options?.onDelete?.(event.old);
            }
            break;
        }

        options?.onChange?.(event);
      }
    );

    channel.subscribe();
    setIsSubscribed(true);

    return () => {
      channel.unsubscribe();
      realtime.disconnect();
      setIsSubscribed(false);
    };
  }, [client, table, enabled, options]);

  const clearChanges = useCallback(() => {
    setChanges([]);
  }, []);

  return {
    data,
    changes,
    isSubscribed,
    clearChanges,
  };
}

/**
 * Join a realtime channel for broadcast
 *
 * @example
 * ```tsx
 * function ChatRoom({ roomId }: { roomId: string }) {
 *   const { broadcast, messages } = useChannel<ChatMessage>(`room:${roomId}`);
 *
 *   const sendMessage = (text: string) => {
 *     broadcast('message', { text, userId: user.id });
 *   };
 *
 *   return (
 *     <div>
 *       <MessageList messages={messages} />
 *       <MessageInput onSend={sendMessage} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useChannel<TMessage = unknown>(
  channelName: string,
  options?: UseChannelOptions
): UseChannelReturn<TMessage> {
  const client = useVaifClient();
  const [lastMessage, setLastMessage] = useState<BroadcastMessage<TMessage> | null>(null);
  const [messages, setMessages] = useState<BroadcastMessage<TMessage>[]>([]);
  const [isJoined, setIsJoined] = useState(false);

  const realtimeRef = useRef<RealtimeClient | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled) return;

    const realtime = client.realtime();
    realtimeRef.current = realtime;

    const channel = realtime.channel(channelName, {
      type: options?.type || "public",
    });
    channelRef.current = channel;

    // Handle broadcast messages - listen on wildcard or specific event
    channel.on<TMessage>("*", (payload) => {
      const msg: BroadcastMessage<TMessage> = {
        event: "*",
        payload,
      };
      setLastMessage(msg);
      setMessages((prev) => [...prev, msg]);
    });

    channel.subscribe();
    setIsJoined(true);

    return () => {
      channel.unsubscribe();
      realtime.disconnect();
      setIsJoined(false);
    };
  }, [client, channelName, enabled, options?.type]);

  const broadcast = useCallback((event: string, payload: TMessage) => {
    channelRef.current?.broadcast({
      event,
      payload,
    });
  }, []);

  const leave = useCallback(() => {
    channelRef.current?.unsubscribe();
    setIsJoined(false);
  }, []);

  return {
    broadcast,
    lastMessage,
    messages,
    isJoined,
    leave,
  };
}

/**
 * Track and observe presence in a channel
 *
 * @example
 * ```tsx
 * function OnlineIndicator({ documentId }: { documentId: string }) {
 *   const { count, presence, update } = usePresence<CursorState>(
 *     `doc:${documentId}`,
 *     { x: 0, y: 0, color: randomColor() }
 *   );
 *
 *   const handleMouseMove = (e: MouseEvent) => {
 *     update({ x: e.clientX, y: e.clientY });
 *   };
 *
 *   return (
 *     <div onMouseMove={handleMouseMove}>
 *       <span>{count} online</span>
 *       {Object.entries(presence).map(([key, entries]) => (
 *         entries.map((entry, i) => (
 *           <Cursor key={`${key}-${i}`} {...entry.state} />
 *         ))
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePresence<T extends PresenceState = PresenceState>(
  channelName: string,
  initialState?: T,
  options?: UsePresenceOptions
): UsePresenceReturn<T> {
  const client = useVaifClient();
  const [presence, setPresence] = useState<Record<string, PresenceEntry<T>[]>>({});
  const [isTracking, setIsTracking] = useState(false);

  const realtimeRef = useRef<RealtimeClient | null>(null);
  const channelRef = useRef<RealtimeChannel<T> | null>(null);
  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled) return;

    const realtime = client.realtime();
    realtimeRef.current = realtime;

    const channel = realtime.channel<T>(channelName, {
      type: "presence",
    });
    channelRef.current = channel;

    // Handle presence sync
    channel.presence.onSync((state) => {
      setPresence(state);
    });

    channel.subscribe();

    // Auto-track if initial state provided
    if (initialState) {
      channel.presence.track({ state: initialState });
      setIsTracking(true);
    }

    return () => {
      channel.unsubscribe();
      realtime.disconnect();
      setIsTracking(false);
    };
  }, [client, channelName, enabled, initialState]);

  const update = useCallback((state: Partial<T>) => {
    channelRef.current?.presence.update(state);
  }, []);

  const leave = useCallback(() => {
    channelRef.current?.presence.untrack();
    setIsTracking(false);
  }, []);

  const count = Object.keys(presence).length;
  const onlineUsers = Object.keys(presence);

  return {
    presence,
    count,
    onlineUsers,
    update,
    leave,
    isTracking,
  };
}

/**
 * Hook for realtime connection state
 *
 * @example
 * ```tsx
 * function ConnectionStatus() {
 *   const { state, isConnected, reconnect } = useRealtimeConnection();
 *
 *   if (!isConnected) {
 *     return (
 *       <div className="offline-banner">
 *         Disconnected. <button onClick={reconnect}>Reconnect</button>
 *       </div>
 *     );
 *   }
 *
 *   return null;
 * }
 * ```
 */
export function useRealtimeConnection(): {
  state: ConnectionState;
  isConnected: boolean;
  connectionId: string | null;
  reconnect: () => void;
  disconnect: () => void;
} {
  const client = useVaifClient();
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [connectionId, setConnectionId] = useState<string | null>(null);

  const realtimeRef = useRef<RealtimeClient | null>(null);

  useEffect(() => {
    const realtime = client.realtime();
    realtimeRef.current = realtime;

    // Get initial state
    setState(realtime.connectionState);
    setConnectionId(realtime.connectionId);

    // Listen for connection events
    realtime.on("connect", () => {
      setState("connected");
      setConnectionId(realtime.connectionId);
    });

    realtime.on("disconnect", () => {
      setState("disconnected");
      setConnectionId(null);
    });

    realtime.on("reconnect", () => {
      setState("connected");
      setConnectionId(realtime.connectionId);
    });

    realtime.on("error", () => {
      setState("disconnected");
    });

    return () => {
      realtime.disconnect();
    };
  }, [client]);

  const reconnect = useCallback(() => {
    realtimeRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    realtimeRef.current?.disconnect();
  }, []);

  return {
    state,
    isConnected: state === "connected",
    connectionId,
    reconnect,
    disconnect,
  };
}

/**
 * Broadcast-only channel hook (simpler than useChannel)
 *
 * @example
 * ```tsx
 * function Notifications() {
 *   const { send, messages } = useBroadcast<NotificationPayload>('notifications');
 *
 *   return (
 *     <>
 *       {messages.map((msg, i) => (
 *         <Toast key={i} {...msg.payload} />
 *       ))}
 *     </>
 *   );
 * }
 * ```
 */
export function useBroadcast<T = unknown>(
  channelName: string,
  options?: { enabled?: boolean }
): {
  send: (event: string, payload: T) => void;
  messages: BroadcastMessage<T>[];
  lastMessage: BroadcastMessage<T> | null;
  isConnected: boolean;
} {
  const channel = useChannel<T>(channelName, options);

  return {
    send: channel.broadcast,
    messages: channel.messages,
    lastMessage: channel.lastMessage,
    isConnected: channel.isJoined,
  };
}
