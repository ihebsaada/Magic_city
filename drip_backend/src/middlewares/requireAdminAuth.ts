import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import prisma from "../prisma";

const JWT_SECRET = process.env.JWT_SECRET || "";
type AdminRequest = Request & { admin?: { id: string; email: string } };

export async function requireAdminAuth(req: AdminRequest, res: Response, next: NextFunction) {
  // Several mounted routers guard /admin; reuse only this request's verified identity.
  if (req.admin) return next();
  const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? "");
  if (!match) return res.status(401).json({ error: "Unauthorized" });
  if (!JWT_SECRET) return res.status(500).json({ error: "JWT_SECRET missing" });
  let decoded: jwt.JwtPayload;
  try {
    const value = jwt.verify(match[1], JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof value === "string" || typeof value.sub !== "string" || !value.sub.trim() ||
        typeof value.email !== "string" || !value.email.trim() || typeof value.exp !== "number") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    decoded = value;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  try {
    // User is the existing admin-account table; there is no role column in this schema.
    const user = await prisma.user.findUnique({ where: { id: decoded.sub }, select: { id: true, email: true } });
    if (!user || user.email !== decoded.email) return res.status(401).json({ error: "Invalid or expired token" });
    req.admin = { id: user.id, email: user.email };
    return next();
  } catch {
    return res.status(503).json({ error: "Authorization temporarily unavailable" });
  }
}
