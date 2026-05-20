import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import prisma from "../utils/prisma";

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: number;
    username: string;
  };
}

export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) => {
  console.log("[Auth] Handshake auth:", socket.handshake.auth);
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];


  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      user_id: number;
    };

    console.log("[Auth] Querying user:", decoded.user_id);
    const user = await prisma.users.findUnique({
      where: { id: decoded.user_id },
      select: { id: true, username: true },
    });
    console.log("[Auth] User result:", user);

    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    socket.user = user;
    next();
  } catch (error: any) {
    console.error("[Auth] Error:", error.message);
    next(new Error("Authentication error: Invalid token"));
  }

};
