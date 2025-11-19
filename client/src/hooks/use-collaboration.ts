import { useState, useEffect, useCallback, useRef } from "react";
import type { User } from "@shared/schema";

interface ActiveUser {
  userId: string;
  userName: string;
  weekNumber?: number;
}

interface CollaborationMessage {
  type: string;
  userId?: string;
  userName?: string;
  weekNumber?: number;
  activeUsers?: ActiveUser[];
  data?: any;
}

interface UseCollaborationOptions {
  user: User | null;
  familyId: string | null;
  enabled?: boolean;
}

export function useCollaboration({ user, familyId, enabled = true }: UseCollaborationOptions) {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (!user || !familyId || !enabled) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Safely construct user name
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    const userName = `${firstName} ${lastName}`.trim() || "User";

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?userId=${encodeURIComponent(user.id)}&userName=${encodeURIComponent(userName)}&familyId=${encodeURIComponent(familyId)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log("Collaboration WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const message: CollaborationMessage = JSON.parse(event.data);

          switch (message.type) {
            case "connected":
              setActiveUsers(message.activeUsers || []);
              console.log("Collaboration connected, active users:", message.activeUsers?.length || 0);
              break;

            case "presence_update":
              setActiveUsers(message.activeUsers || []);
              break;

            case "curriculum_generated":
              // Trigger curriculum refetch
              window.dispatchEvent(new CustomEvent("curriculum_updated"));
              break;

            case "week_update":
              // Trigger week refetch
              window.dispatchEvent(new CustomEvent("week_updated", {
                detail: { weekNumber: message.weekNumber }
              }));
              break;
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("Collaboration WebSocket error:", error);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setActiveUsers([]);
        console.log("Collaboration WebSocket closed");
        
        // Clear existing reconnect timeout before scheduling new one
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        // Attempt reconnection after 3 seconds with exponential backoff
        if (enabled && wsRef.current === ws) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("Attempting collaboration WebSocket reconnection...");
            connect();
          }, 3000);
        }
      };
    } catch (error) {
      console.error("Failed to create collaboration WebSocket:", error);
    }
  }, [user, familyId, enabled]);

  const sendPresence = useCallback((weekNumber?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && familyId) {
      wsRef.current.send(JSON.stringify({
        type: "presence",
        familyId,
        weekNumber,
      }));
    }
  }, [familyId]);

  const broadcastWeekUpdate = useCallback((weekNumber: number, data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "week_update",
        weekNumber,
        data,
      }));
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      // Clear reconnect timeout on cleanup
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, enabled]);

  return {
    isConnected,
    activeUsers,
    sendPresence,
    broadcastWeekUpdate,
  };
}
