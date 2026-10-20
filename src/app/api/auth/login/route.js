//src/app/api/auth/login/route.js

/**
 * Your login APIs go here
 */
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getDB } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/utils";

export async function POST(request) {
  try {
    const { username, email, password } = await request.json();

    const login = String(username || email || "").trim();

    if (!login || !password) {
      return errorResponse("Username and password are required", 400);
    }

    const db = await getDB();

    const user = await db.collection("users").findOne({
      $or: [
        { username: login },
        { email: login.toLowerCase() },
      ],
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return errorResponse("Invalid login credentials", 401);
    }

    const publicUser = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(
      publicUser,
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return successResponse(
      { message: "Login successful", user: publicUser, token },
      200
    );
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse("Login failed", 500);
  }
}
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:5173",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}