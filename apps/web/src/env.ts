// Vite exposes anything prefixed with VITE_ at build time.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
