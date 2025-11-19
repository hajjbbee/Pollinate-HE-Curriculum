import WebSocket, { WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import type { Server } from "http";
import { parse } from "url";
import type { IStorage } from "./storage";
import type { RequestHandler } from "express";

interface CollaborationMessage {
  type: "presence" | "curriculum_update" | "week_update";
  familyId?: string;
  weekNumber?: number;
  userId?: string;
  userName?: string;
  data?: any;
}

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  familyId?: string;
  currentWeek?: number;
  userName?: string;
  userFamilyId?: string; // The actual family this user belongs to
}

type AuthValidator = (req: any) => Promise<{ userId: string; userName: string; familyId: string } | null>;

export class CollaborationService {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private storage: IStorage;
  private authValidator: AuthValidator;
  private sessionMiddleware: RequestHandler;

  constructor(server: Server, storage: IStorage, authValidator: AuthValidator, sessionMiddleware: RequestHandler) {
    this.storage = storage;
    this.authValidator = authValidator;
    this.sessionMiddleware = sessionMiddleware;
    this.wss = new WebSocketServer({ 
      server, 
      path: "/ws",
      verifyClient: (info, callback) => {
        // Parse session before accepting WebSocket connection
        const req: any = info.req;
        const res: any = {};
        this.sessionMiddleware(req, res, async () => {
          const authData = await this.authValidator(req);
          if (!authData) {
            callback(false, 401, "Unauthorized");
          } else {
            // Store auth data on request for later use
            req.wsAuthData = authData;
            callback(true);
          }
        });
      }
    });

    this.wss.on("connection", (ws: WebSocket, req: any) => {
      this.handleConnection(ws, req);
    });
  }

  private async handleConnection(ws: WebSocket, req: any) {
    // Get pre-validated auth data from verifyClient
    const authData = req.wsAuthData;
    
    if (!authData) {
      ws.close(1008, "Authentication failed");
      return;
    }

    const { userId, userName, familyId } = authData;

    const clientId = `${userId}-${Date.now()}`;
    const client: ClientConnection = {
      ws,
      userId,
      userName,
      userFamilyId: familyId,
      familyId, // Set family immediately
    };

    this.clients.set(clientId, client);

    // Setup ping/pong heartbeat
    let isAlive = true;
    const heartbeatInterval = setInterval(() => {
      if (!isAlive) {
        console.log(`Client ${clientId} heartbeat timeout, terminating`);
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, 30000); // 30 second heartbeat

    ws.on("pong", () => {
      isAlive = true;
    });

    ws.on("message", (data: WebSocket.Data) => {
      try {
        const message: CollaborationMessage = JSON.parse(data.toString());
        this.handleMessage(clientId, message);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      clearInterval(heartbeatInterval);
      const client = this.clients.get(clientId);
      if (client?.familyId) {
        this.broadcastPresenceUpdate(client.familyId, clientId, "left");
      }
      this.clients.delete(clientId);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });

    // Send connection confirmation with active users and broadcast join
    const activeUsers = this.getActiveUsers(familyId);
    ws.send(JSON.stringify({
      type: "connected",
      clientId,
      familyId,
      activeUsers,
      message: "Connected to collaboration server",
    }));

    // Immediately broadcast presence join to family
    this.broadcastPresenceUpdate(familyId, clientId, "joined");
  }

  private handleMessage(clientId: string, message: CollaborationMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Verify family membership for all operations
    if (message.familyId && message.familyId !== client.userFamilyId) {
      console.warn(`User ${client.userId} attempted to access family ${message.familyId} but belongs to ${client.userFamilyId}`);
      return;
    }

    switch (message.type) {
      case "presence":
        if (message.familyId !== undefined) {
          client.familyId = message.familyId;
          client.currentWeek = message.weekNumber;
          this.broadcastPresenceUpdate(message.familyId, clientId, "joined");
        }
        break;

      case "curriculum_update":
        if (client.familyId) {
          this.broadcastToFamily(client.familyId, {
            type: "curriculum_update",
            userId: client.userId,
            userName: client.userName,
            data: message.data,
          }, clientId);
        }
        break;

      case "week_update":
        if (client.familyId && message.weekNumber !== undefined) {
          client.currentWeek = message.weekNumber;
          this.broadcastToFamily(client.familyId, {
            type: "week_update",
            userId: client.userId,
            userName: client.userName,
            weekNumber: message.weekNumber,
            data: message.data,
          }, clientId);
        }
        break;
    }
  }

  private broadcastPresenceUpdate(familyId: string, clientId: string, action: "joined" | "left") {
    const client = this.clients.get(clientId);
    if (!client) return;

    const activeUsers = this.getActiveUsers(familyId);

    this.broadcastToFamily(familyId, {
      type: "presence_update",
      action,
      userId: client.userId,
      userName: client.userName,
      weekNumber: client.currentWeek,
      activeUsers,
    });
  }

  private getActiveUsers(familyId: string) {
    const users: Array<{ userId: string; userName: string; weekNumber?: number }> = [];
    
    for (const client of Array.from(this.clients.values())) {
      if (client.familyId === familyId && client.ws.readyState === WebSocket.OPEN) {
        users.push({
          userId: client.userId,
          userName: client.userName,
          weekNumber: client.currentWeek,
        });
      }
    }

    return users;
  }

  private broadcastToFamily(familyId: string, message: any, excludeClientId?: string) {
    const payload = JSON.stringify(message);

    for (const [clientId, client] of Array.from(this.clients.entries())) {
      if (
        client.familyId === familyId &&
        client.ws.readyState === WebSocket.OPEN &&
        clientId !== excludeClientId
      ) {
        client.ws.send(payload);
      }
    }
  }

  public broadcastCurriculumGenerated(familyId: string) {
    this.broadcastToFamily(familyId, {
      type: "curriculum_generated",
      message: "New curriculum has been generated",
    });
  }
}
