// Which account the data on this device belongs to — the guard that keeps
// one person's library from leaking into the next account signed in here.
//
// owner: the user id whose data the persisted stores hold, saved in
// localStorage so it survives reloads. useAuthStore wipes local data when a
// session ends or a *different* user signs in. Guest data (no owner) is
// still merged into the first account that signs in, as before.
//
// epoch: bumped on every wipe. Async work that writes into a store (an AI
// summary, a transcript, a sync pull) captures it before the request and
// drops the result if it changed meanwhile, so a late response for the
// previous account never lands in the next one's library.
const OWNER_KEY = "podmark-account-owner";

let epoch = 0;

export function accountEpoch(): number {
  return epoch;
}

export function bumpAccountEpoch(): void {
  epoch += 1;
}

export function getDataOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

export function setDataOwner(userId: string | null): void {
  try {
    if (userId) localStorage.setItem(OWNER_KEY, userId);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    // storage unavailable (private mode limits) — nothing persisted to guard
  }
}
