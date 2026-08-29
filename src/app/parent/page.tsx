import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/analytics-data";
import { ViewerDashboard } from "./viewer-dashboard";

export const dynamic = "force-dynamic";

export default async function ParentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // A viewer sees the data of the student who granted access. Resolve that
  // student id from the viewer_access allowlist (RLS lets the viewer read it).
  const { data: link } = await supabase
    .from("viewer_access")
    .select("student_id")
    .eq("viewer_id", user.id)
    .maybeSingle();

  const studentId = link?.student_id ?? null;

  const { data: studentProfile } = studentId
    ? await supabase
        .from("profile")
        .select("display_name")
        .eq("id", studentId)
        .maybeSingle()
    : { data: null };

  const data = await getDashboardData(
    supabase,
    studentId ?? "00000000-0000-0000-0000-000000000000",
  );

  return (
    <ViewerDashboard
      data={{ ...data, studentName: studentProfile?.display_name ?? null }}
    />
  );
}
