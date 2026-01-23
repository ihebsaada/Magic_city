import { Request, Response } from "express";
import prisma from "../prisma";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "";
const EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

export async function adminLogin(req: Request, res: Response) {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password)
      return res.status(400).json({ error: "Missing data" });
    if (!JWT_SECRET)
      return res.status(500).json({ error: "JWT_SECRET missing" });

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: EXPIRES as jwt.SignOptions["expiresIn"],
    });

    return res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur (adminLogin)" });
  }
}
