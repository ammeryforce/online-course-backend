
import { MongoClient } from "mongodb";
import bcrypt from "bcrypt";

const client = new MongoClient(process.env.MONGODB_URI);

const users = [
  { username: "student1", email: "student1@example.com", role: "Student" },
  { username: "student2", email: "student2@example.com", role: "Student" },
  { username: "student3", email: "student3@example.com", role: "Student" },
  { username: "teacher1", email: "teacher1@example.com", role: "Teacher" },
  { username: "teacher2", email: "teacher2@example.com", role: "Teacher" },
  { username: "teacher3", email: "teacher3@example.com", role: "Teacher" },
];

try {
  await client.connect();
  const db = client.db();
  const password = await bcrypt.hash("ExamTest!2026", 10);

  for (const user of users) {
    await db.collection("users").updateOne(
      { username: user.username },
      { $set: { ...user, password } },
      { upsert: true }
    );
    console.log(`Created: ${user.username}`);
  }

  console.log("All 6 test users are ready!");
} catch (error) {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
} finally {
  await client.close();
}
