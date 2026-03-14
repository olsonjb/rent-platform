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
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { USER_TYPE_LABELS, USER_TYPES, type UserType } from "@/lib/auth/user-types";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<UserType[]>(["landlord"]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const toggleRole = (role: UserType, isChecked: boolean) => {
    setSelectedRoles((currentRoles) => {
      if (isChecked) {
        if (currentRoles.includes(role)) {
          return currentRoles;
        }

        return [...currentRoles, role];
      }

      if (!currentRoles.includes(role)) {
        return currentRoles;
      }

      if (currentRoles.length === 1) {
        return currentRoles;
      }

      return currentRoles.filter((existingRole) => existingRole !== role);
    });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (selectedRoles.length === 0) {
      setError("Select at least one account type");
      setIsLoading(false);
      return;
    }

    const primaryRole = selectedRoles[0] ?? "landlord";

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/protected`,
          data: {
            // TODO: move role assignment to app_metadata via a server-side hook; user_metadata is user-controlled.
            userType: primaryRole,
            role: primaryRole,
            roles: selectedRoles,
          },
        },
      });
      if (error) throw error;
      router.push("/auth/sign-up-success");
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
          <CardTitle className="text-2xl tracking-tight text-zinc-950">Sign up</CardTitle>
          <CardDescription>Create your Auto PM account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
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
              <div className="grid gap-3">
                <Label className="text-zinc-900">I need access as</Label>
                <div className="grid gap-2 rounded-md border border-zinc-900/15 bg-zinc-50/50 p-3">
                  {USER_TYPES.map((type) => (
                    <label key={type} className="flex items-center gap-3 text-sm text-zinc-800">
                      <Checkbox
                        checked={selectedRoles.includes(type)}
                        onCheckedChange={(checked) => {
                          toggleRole(type, checked === true);
                        }}
                      />
                      <span>{USER_TYPE_LABELS[type]}</span>
                    </label>
                  ))}
                  <p className="text-xs text-zinc-500">
                    Choose one or both roles. You can sign in through either role login page.
                  </p>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                   <Label htmlFor="password" className="text-zinc-900">
                     Password
                   </Label>
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
              <div className="grid gap-2">
                <div className="flex items-center">
                   <Label htmlFor="repeat-password" className="text-zinc-900">
                     Repeat Password
                   </Label>
                 </div>
                 <Input
                   id="repeat-password"
                   type="password"
                   className="border-zinc-900/15 bg-white text-zinc-900 placeholder:text-zinc-500"
                   required
                   value={repeatPassword}
                   onChange={(e) => setRepeatPassword(e.target.value)}
                 />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-zinc-950 text-white hover:bg-zinc-800"
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : "Create account"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm text-zinc-600">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="font-medium text-zinc-900 underline underline-offset-4"
              >
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
