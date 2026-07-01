import { ActivityType } from "@prisma/client";
import { prisma } from "../../config/db.js";

interface LogActivityInput {
  userId: string;
  type: ActivityType;
  leadId?: string | null;
  metadata?: unknown;
}

export async function logActivity({ userId, type, leadId = null, metadata }: LogActivityInput) {
  return prisma.activityLog.create({
    data: {
      userId,
      leadId,
      type,
      metadata: metadata == null ? undefined : JSON.stringify(metadata)
    }
  });
}
