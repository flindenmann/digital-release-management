import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppSidebar } from "@/components/shared/AppSidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.mustChangePassword) redirect("/set-password");

  return (
    <div className="flex min-h-screen">
      <AppSidebar user={session.user} />
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
