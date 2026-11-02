// Public configuration. The Google OAuth client ID is a public identifier,
// not a secret: Google only accepts it from the origins listed for it
// (https://p0champ.github.io). Created by Bastian on 28 Oct 2026 (project "Bradbury Cabin", Testing mode).
export const GOOGLE_CLIENT_ID =
  "379320678298-n7emu1el4qc84v3gepk0tn82rra4jglr.apps.googleusercontent.com";
// Build 058 keeps the existing tap-to-Sync connection. Cloudflare is
// reserved for Build 059 and cannot be enabled by saved browser settings.
export const MANAGED_CONNECTION_ENABLED = false;
// This dormant public address contains no credential.
export const CONNECTION_URL = 'https://bradbury-cabin-connection.bastianfarges40.workers.dev/';
