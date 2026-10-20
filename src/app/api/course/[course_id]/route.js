
import { ObjectId } from "mongodb";
import { getDB } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/utils";

export async function GET(request, { params }) {
  try {
    const user = verifyJWT(request);
    if (!user) return errorResponse("Unauthorized", 401);

    const { course_id } = await params;
    if (!ObjectId.isValid(course_id))
      return errorResponse("Invalid course ID", 400);

    const db = await getDB();
    const course = await db.collection("courses").findOne({
      _id: new ObjectId(course_id),
    });

    if (!course) return errorResponse("Course not found", 404);

    if (user.role === "Teacher" && course.teacherId !== user.id)
      return errorResponse("Forbidden", 403);

    if (user.role === "Student" && course.status === "Cancel")
      return errorResponse("Course unavailable", 404);

    if (!["Teacher", "Student"].includes(user.role))
      return errorResponse("Forbidden", 403);

    return successResponse(course, 200);
  } catch (error) {
    console.error(error);
    return errorResponse("Failed to load course", 500);
  }
}

export async function PUT(request, { params }) {
  try {
    const user = verifyJWT(request);
    if (!user) return errorResponse("Unauthorized", 401);
    if (user.role !== "Teacher")
      return errorResponse("Forbidden", 403);

    const { course_id } = await params;
    if (!ObjectId.isValid(course_id))
      return errorResponse("Invalid course ID", 400);

    const db = await getDB();
    const courses = db.collection("courses");

    const filter = {
      _id: new ObjectId(course_id),
      teacherId: user.id,
    };

    const existing = await courses.findOne(filter);
    if (!existing) return errorResponse("Course not found", 404);

    const body = await request.json();
    const updates = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim())
        return errorResponse("Invalid course name", 400);
      updates.name = body.name.trim();
    }

    if (body.duration !== undefined) {
      const n = Number(body.duration);
      if (!Number.isInteger(n) || n <= 0)
        return errorResponse("Invalid duration", 400);
      updates.duration = n;
    }

    if (body.topics !== undefined) {
      if (!Array.isArray(body.topics) || !body.topics.length ||
          body.topics.some(t => typeof t !== "string" || !t.trim()))
        return errorResponse("Invalid topics", 400);
      updates.topics = body.topics.map(t => t.trim());
    }

    if (body.price !== undefined) {
      const n = Number(body.price);
      if (!Number.isFinite(n) || n < 0)
        return errorResponse("Invalid price", 400);
      updates.price = n;
    }

    if (body.maxStudents !== undefined) {
      const n = Number(body.maxStudents);
      if (!Number.isInteger(n) || n <= 0)
        return errorResponse("Invalid max students", 400);
      updates.maxStudents = n;
    }

    if (body.status !== undefined) {
      if (!["Open", "Close", "Cancel"].includes(body.status))
        return errorResponse("Invalid status", 400);
      updates.status = body.status;
    }

    const capacity = updates.maxStudents ?? existing.maxStudents;

    const result = await courses.findOneAndUpdate(
      {
        ...filter,
        $expr: {
          $lte: [
            { $size: { $ifNull: ["$enrolledStudents", []] } },
            capacity,
          ],
        },
      },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!result)
      return errorResponse("Capacity is below enrollment", 409);

    return successResponse(result, 200);
  } catch (error) {
    console.error(error);
    return errorResponse("Failed to update course", 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = verifyJWT(request);
    if (!user) return errorResponse("Unauthorized", 401);
    if (user.role !== "Teacher")
      return errorResponse("Forbidden", 403);

    const { course_id } = await params;
    if (!ObjectId.isValid(course_id))
      return errorResponse("Invalid course ID", 400);

    const db = await getDB();
    const result = await db.collection("courses").deleteOne({
      _id: new ObjectId(course_id),
      teacherId: user.id,
      $or: [
        { enrolledStudents: { $size: 0 } },
        { enrolledStudents: { $exists: false } },
      ],
    });

    if (!result.deletedCount)
      return errorResponse(
        "Course not found, not owned, or has enrolled students",
        409
      );

    return successResponse({ message: "Course deleted" }, 200);
  } catch (error) {
    console.error(error);
    return errorResponse("Failed to delete course", 500);
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
