import { v4 as uuidv4 } from "uuid";

const COOKIE_NAME = "voterToken";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Get or create voter token from cookies
export function getVoterToken(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = parseCookies(cookieHeader);
  return cookies[COOKIE_NAME] || null;
}

// Create a new voter token
export function createVoterToken(): string {
  return uuidv4();
}

// Generate Set-Cookie header for voter token
export function setVoterTokenCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

// Parse cookie header string
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(";");

  for (const pair of pairs) {
    const [name, ...rest] = pair.trim().split("=");
    if (name && rest.length > 0) {
      cookies[name] = rest.join("=");
    }
  }

  return cookies;
}

// Helper to ensure voter token exists in request/response
export function ensureVoterToken(request: Request): {
  token: string;
  isNew: boolean;
  headers?: HeadersInit;
} {
  let token = getVoterToken(request);
  let isNew = false;

  if (!token) {
    token = createVoterToken();
    isNew = true;
  }

  return {
    token,
    isNew,
    headers: isNew
      ? { "Set-Cookie": setVoterTokenCookie(token) }
      : undefined,
  };
}
