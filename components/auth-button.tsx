import Link from "next/link";
import { getHomeRouteForUserRoles } from "@/lib/auth/authorization";
import { Button } from "./ui/button";
import { getUserRolesFromClaims } from "@/lib/auth/user-types";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createClient();

  // You can also use getUser() which will be slower.
  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;
  const roles = getUserRolesFromClaims(user);
  const dashboardPath = roles.length > 1 ? "/protected" : getHomeRouteForUserRoles(roles);

  return user ? (
    <div className="flex items-center gap-4">
      <Link href={dashboardPath} className="text-sm font-medium text-zinc-700 hover:text-zinc-950">
        Dashboard
      </Link>
      Hey, {user.email}!
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
