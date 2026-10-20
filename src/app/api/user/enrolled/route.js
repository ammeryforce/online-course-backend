
import { getDB } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/utils";

export async function GET(request) {
  try {
    const user = verifyJWT(request);

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    if (user.role !== "Student") {
      return errorResponse("Only Students can access this", 403);
    }

    const db = await getDB();

    const courses = await db.collection("courses")
      .find({ enrolledStudents: user.id })
      .toArray();

    return successResponse(courses, 200);
  } catch (error) {
    console.error(error);
    return errorResponse("Failed to load enrolled courses", 500);
  }
}
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:5173",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}