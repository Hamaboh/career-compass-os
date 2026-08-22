"use server";

export async function verifyFoundation(): Promise<void> {
  // Compatibility-only Server Action: no business data or external side effect.
  return Promise.resolve();
}
