"use client";
import { signIn, signOut } from "next-auth/react";
import { useState } from "react";

export function StaffAuthButton({ logout = false }: { logout?: boolean }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return <><button className={logout ? "hover:text-ink" : "btn-primary w-full"} disabled={pending} onClick={async () => {
    setPending(true); setFailed(false);
    try {
      if (logout) await signOut({ redirectTo: "/staff-login" });
      else await signIn("google", { redirectTo: "/admin/sales" });
    } catch { setFailed(true); setPending(false); }
  }}>{pending ? "Please wait…" : logout ? "Sign out" : "Sign in with Google"}</button>
    {failed && <p role="alert">Unable to sign in. Please try again.</p>}</>;
}
