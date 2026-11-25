import { api, ApiError } from "@/shared/lib/api";
import type {
  DemoChatReply,
  DemoContext,
  DemoEnvelope,
  DemoReceipt,
  DemoRequest,
} from "./demo-data.types";

export const demoDataApi = {
  context: () =>
    api<DemoContext>("GET", "/demo-data/context", undefined, {
      silent: true,
      timeoutMs: 10_000,
    }),
  chat: (request: DemoRequest, timeoutMs: number) =>
    api<DemoChatReply>("POST", "/demo-data/chat", request, {
      silent: true,
      timeoutMs,
    }),
  create: (envelope: DemoEnvelope) =>
    api<DemoReceipt>("POST", "/demo-data/scenarios", envelope, {
      silent: true,
      timeoutMs: 25_000,
    }),
  receipt: async (id: string): Promise<DemoReceipt | null> => {
    try {
      return await api<DemoReceipt>(
        "GET",
        `/demo-data/generations/${encodeURIComponent(id)}`,
        undefined,
        { silent: true, timeoutMs: 10_000 },
      );
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 404 &&
        error.code === "DEMO_GENERATION_NOT_FOUND"
      )
        return null;
      throw error;
    }
  },
};
