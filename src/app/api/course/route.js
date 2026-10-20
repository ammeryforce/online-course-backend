
import { getDB } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/utils";

export async function GET(request) {
  try {
    const user = verifyJWT(request);
    if (!user) return errorResponse("Unauthorized", 401);

    const db = await getDB();
    const courses = db.collection("courses");

    if (user.role === "Teacher") {
      const data = await courses.find({
        teacherId: user.id
      }).toArray();

      return successResponse(data, 200);
    }

    if (user.role === "Student") {
      const search = new URL(request.url)
        .searchParams.get("search") || "";

      const query = { status: { $ne: "Cancel" } };

      if (search) {
        const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.$or = [
          { name: { $regex: safe, $options: "i" } },
          { teacherName: { $regex: safe, $options: "i" } }
        ];
      }

      return successResponse(
        await courses.find(query).toArray(),
        200
      );
    }

    return errorResponse("Forbidden", 403);
  } catch (error) {
    console.error(error);
    return errorResponse("Failed to load courses", 500);
  }
}

export async function POST(request) {
  try {
    const user = verifyJWT(request);
    if (!user) return errorResponse("Unauthorized", 401);
    if (user.role !== "Teacher")
      return errorResponse("Forbidden", 403);

    const body = await request.json();

    const name = String(body.name || "").trim();
    const duration = Number(body.duration);
    const topics = Array.isArray(body.topics)
      ? body.topics.map(String).map(t => t.trim()).filter(Boolean)
      : String(body.topics || "").split(",").map(t => t.trim()).filter(Boolean);
    const price = Number(body.price);
    const maxStudents = Number(body.maxStudents);
    const status = body.status || "Open";

    if (!name || !Number.isInteger(duration) || duration <= 0 ||
        !topics.length || !Number.isFinite(price) || price < 0 ||
        !Number.isInteger(maxStudents) || maxStudents <= 0 ||
        !["Open", "Close", "Cancel"].includes(status)) {
      return errorResponse("Invalid course information", 400);
    }

    const db = await getDB();

    const course = {
      name, duration, topics, price, maxStudents, status,
      teacherId: user.id,
      teacherName: user.username,
      enrolledStudents: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection("courses").insertOne(course);

    return successResponse(
      { ...course, _id: result.insertedId },
      201
    );
  } catch (error) {
    console.error(error);
    return errorResponse("Failed to create course", 500);
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