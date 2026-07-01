import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/db.js";

export async function loginCommand({ email, password }: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return null;
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || "", { expiresIn: "8h" });

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  };
}

export async function changePasswordCommand({ userId, currentPassword, newPassword }: { userId: string; currentPassword: string; newPassword: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return false;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });

  return true;
}
