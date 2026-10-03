import type { LiveblocksFlow } from "@liveblocks/react-flow";
import type { LiveList, LiveObject } from "@liveblocks/client";
import type { CanvasNode, CanvasEdge, CanvasAction } from "@/types/canvas";
import type { ChatMessage } from "@/types/tasks";

declare global {
  interface Liveblocks {
    Presence: {
      cursor: { x: number; y: number } | null;
      thinking: boolean;
    };

    Storage: {
      flow: LiveblocksFlow<CanvasNode, CanvasEdge>;
      // `drawing` is optional because rooms created before it existed have no
      // such key in their stored object.
      aiStatus: LiveObject<{ thinking: boolean; message: string; drawing?: boolean }>;
      chatMessages: LiveList<ChatMessage>;
    };

    UserMeta: {
      id: string;
      info: {
        displayName: string;
        avatarUrl: string;
        cursorColor: string;
      };
    };

    RoomEvent:
      | {
          type: "ai:status";
          message: string;
          thinking: boolean;
          drawing?: boolean;
          suggestions?: string[];
          // Stable per-run id for the final reply, so every client that
          // receives this broadcast writes the same chat message rather than
          // each adding its own copy. Absent on older task versions.
          messageId?: string;
        }
      | { type: "ai:action"; action: CanvasAction };

    ThreadMetadata: {};

    RoomInfo: {};
  }
}

export {};
