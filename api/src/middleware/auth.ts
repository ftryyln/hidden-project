import type { Request, Response, NextFunction } from "express";
import type { User } from "@supabase/supabase-js";
import { ApiError } from "../errors.js";
import { config } from "../env.js";
import { getUserFromToken } from "../supabase.js";

export interface AuthenticatedRequest extends Request {
  user?: User;
  accessToken?: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization ?? "";
    let token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

    if (!token) {
      const rawCookie = req.headers.cookie ?? "";
      const cookieParts = rawCookie.split(";").map((part) => part.trim());
      for (const part of cookieParts) {
        if (part.startsWith(`${config.jwtCookieName}=`)) {
          token = decodeURIComponent(part.slice(config.jwtCookieName.length + 1));
          break;
        }
      }
    }

    if (!token) {
      throw new ApiError(401, "Missing or invalid access token");
    }

    const user = await getUserFromToken(token);
    if (!user) {
      throw new ApiError(401, "Unauthorized");
    }
    req.user = user;
    req.accessToken = token;
    next();
  } catch (error) {
    next(error);
  }
}
