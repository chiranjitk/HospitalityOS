import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "StaySuite HospitalityOS API",
    version: "1.0.0",
    status: "operational",
    timestamp: new Date().toISOString(),
    endpoints: {
      v1: "/api/v1",
      auth: "/api/auth",
      docs: "/api/docs",
    },
  });
}
