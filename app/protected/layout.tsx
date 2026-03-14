import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={"/"}>Auto PM</Link>
              <Link
                href={"/protected/chat"}
                className="text-muted-foreground hover:text-foreground transition-colors font-normal"
              >
                Chat
              </Link>
              <Link href="/protected/properties" className="text-muted-foreground hover:text-foreground transition-colors font-normal">
                Properties
              </Link>
              <Link href="/protected/tenants" className="text-muted-foreground hover:text-foreground transition-colors font-normal">
                Tenants
              </Link>
              <Link href="/protected/leases" className="text-muted-foreground hover:text-foreground transition-colors font-normal">
                Leases
              </Link>
            </div>
            {hasEnvVars && (
              <Suspense>
                <AuthButton />
              </Suspense>
            )}
          </div>
        </nav>
        <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5 w-full">
          {children}
        </div>

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-8">
          <p>Auto PM</p>
          <ThemeSwitcher />
        </footer>
      </div>
    </main>
  );
}
