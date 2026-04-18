/**
 * Pure types for api-auth. Split from api-auth.ts so test helpers and other
 * pure modules can import these without dragging in next/headers.
 */
export type AuthMethod = "session" | "token";

export interface AuthenticatedUser {
  email: string;
  authMethod: AuthMethod;
}
