// Håndterer API-kall og administratorøkter for medlemsfunksjoner
import { useEffect, useState } from "react";

export const API = import.meta.env.VITE_API_BASE_URL || "/api";

export async function request(path, options = {}) {
  // Inkluder øktcookie for beskyttede medlems- og administratorruter; FormData setter sin egen grense
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Forespørselen kunne ikke fullføres.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function useAdminSession() {
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    let requestId = 0;
    function checkSession() {
      const currentRequestId = ++requestId;
      // Ignorer gamle svar etter logout eller raskt gjentatte øktkontroller
      request("/auth/me")
        .then(() => {
          if (active && currentRequestId === requestId) {
            setAuthenticated(true);
            setError("");
          }
        })
        .catch((sessionError) => {
          if (!active || currentRequestId !== requestId) return;
          setAuthenticated(false);
          setError(sessionError.status === 401 ? "" : sessionError.message);
        })
        .finally(() => {
          if (active && currentRequestId === requestId) setChecking(false);
        });
    }

    checkSession();
    window.addEventListener("set18-auth-change", checkSession);
    return () => {
      active = false;
      window.removeEventListener("set18-auth-change", checkSession);
    };
  }, []);

  return { authenticated, setAuthenticated, checking, error };
}
