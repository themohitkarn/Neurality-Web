import jwt from "jsonwebtoken";

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJpYXQiOjE3Nzg4NDE4OTYsImV4cCI6MTc3OTQ0NjY5Nn0.EFAhtXr6HfkvAbd-LpPQLT19gxlcscbmzgePd0RZ4N0";
const secret = process.env.JWT_SECRET || "neurality-jwt-secret";

try {
  const decoded = jwt.verify(token, secret);
  console.log("Decoded:", decoded);
} catch (e: any) {
  console.error("Failed to verify token:", e.message);
}
