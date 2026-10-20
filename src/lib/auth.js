
import jwt from "jsonwebtoken";

export function verifyJWT(request) {
  try {
    const header = request.headers.get("authorization");
    const bearer = header?.startsWith("Bearer ")
      ? header.slice(7)
      : null;

    const token = bearer || request.cookies.get("token")?.value;

    if (!token || !process.env.JWT_SECRET) return null;

    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}
