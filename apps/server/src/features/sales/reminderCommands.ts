import { prisma } from "../../config/db.js";

export function createReminder(input: { userId: string; label: string; note?: string; dueAt: string }) {
  return prisma.reminder.create({ data: { userId: input.userId, label: input.label.trim(), note: input.note?.trim() || null, dueAt: new Date(input.dueAt) } });
}

export async function completeReminder(input: { userId: string; reminderId: string; complete: boolean }) {
  const result = await prisma.reminder.updateMany({ where: { id: input.reminderId, userId: input.userId }, data: { completedAt: input.complete ? new Date() : null } });
  return result.count > 0;
}
