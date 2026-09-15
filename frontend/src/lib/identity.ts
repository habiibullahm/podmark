import type { User } from "@supabase/supabase-js";

// Signed-out identity is deliberately generic rather than a hard-coded
// person — there is no account until one signs in.
export function getDisplayName(user: User | null): string {
  const email = user?.email;
  return email ? email.split("@")[0] : "Guest";
}

export function getAvatarLetter(user: User | null): string {
  return getDisplayName(user).charAt(0).toUpperCase() || "?";
}
