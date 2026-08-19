import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import GardenApp from "@/components/GardenApp";

export default async function GardenPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return <GardenApp userEmail={user.email ?? ""} />;
}
