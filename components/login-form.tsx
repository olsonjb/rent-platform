"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getHomeRouteForUserType } from "@/lib/auth/authorization";
import {
  USER_TYPE_LABELS,
  getUserRolesFromClaims,
  type UserType,
} from "@/lib/auth/user-types";

export function LoginForm({
  className,
  userType,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { userType: UserType }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      const { data, error: claimsError } = await supabase.auth.getClaims();

      if (claimsError || !data?.claims) {
        throw claimsError ?? new Error("Unable to verify account permissions");
      }

      const accountRoles = getUserRolesFromClaims(data.claims);

      if (!accountRoles.includes(userType)) {
        await supabase.auth.signOut();
        setError(`This account is not registered for ${USER_TYPE_LABELS[userType]} access.`);
        return;
      }

      router.push(getHomeRouteForUserType(userType));
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="rounded-2xl border-zinc-900/10 bg-white text-zinc-900 shadow-[0_24px_64px_-36px_rgba(0,0,0,0.4)]">
        <CardHeader>
          <CardTitle className="text-2xl tracking-tight text-zinc-950">Sign in</CardTitle>
          <CardDescription>
            Enter your email and password to access Auto PM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-zinc-900">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  className="border-zinc-900/15 bg-white text-zinc-900 placeholder:text-zinc-500"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <p className="rounded-md bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-900">
                  Signing in as {USER_TYPE_LABELS[userType]}
                </p>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password" className="text-zinc-900">
                    Password
                  </Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  className="border-zinc-900/15 bg-white text-zinc-900 placeholder:text-zinc-500"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-zinc-950 text-white hover:bg-zinc-800"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm text-zinc-600">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/sign-up"
                className="font-medium text-zinc-900 underline underline-offset-4"
              >
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
