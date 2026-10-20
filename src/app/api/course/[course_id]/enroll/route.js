
import { ObjectId } from "mongodb";
import { getDB } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/utils";

// POST - Student enrolls in a course
export async function POST(request, { params }) {
  try {
    const user = verifyJWT(request);

    if (!user) return errorResponse("Unauthorized", 401);

    if (user.role !== "Student") {
      return errorResponse("Only Students can enroll", 403);
    }

    const { course_id } = await params;

    if (!ObjectId.isValid(course_id)) {
      return errorResponse("Invalid course ID", 400);
    }

    const db = await getDB();
    const courses = db.collection("courses");

    // Atomic update prevents duplicate enrollment and overbooking
    const result = await courses.updateOne(
      {
        _id: new ObjectId(course_id),
        status: "Open",
        enrolledStudents: { $ne: user.id },
        $expr: {
          $lt: [
            {
              $size: {
                $ifNull: ["$enrolledStudents", []],
              },
            },
            "$maxStudents",
          ],
        },
      },
      {
        $addToSet: { enrolledStudents: user.id },
        $set: { updatedAt: new Date() },
      }
    );

    if (result.modifiedCount === 1) {
      return successResponse(
        { message: "Enrollment successful" },
        201
      );
    }

    const course = await courses.findOne({
      _id: new ObjectId(course_id),
    });

    if (!course) {
      return errorResponse("Course not found", 404);
    }

    if (course.status !== "Open") {
      return errorResponse("Course is not open", 400);
    }

    if ((course.enrolledStudents || []).includes(user.id)) {
      return errorResponse("Already enrolled", 409);
    }

    if (
      (course.enrolledStudents || []).length >=
      course.maxStudents
    ) {
      return errorResponse("Course is full", 409);
    }

    return errorResponse("Enrollment unavailable", 409);
  } catch (error) {
    console.error("Enrollment error:", error);
    return errorResponse("Enrollment failed", 500);
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

