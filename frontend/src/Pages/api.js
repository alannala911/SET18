import { useEffect, useState } from "react";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export async function apiRequest(path, options = {}) {
  const isFormBody =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const hasJsonBody =
    options.body != null && !isFormBody && typeof options.body !== "string";
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    ...(hasJsonBody ? { body: JSON.stringify(options.body) } : {}),
    headers: {
      ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
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

export function useCurrentMember() {
  const [member, setMember] = useState(null);
  useEffect(() => {
    const loadMember = () => apiRequest("/membership/me")
      .then((data) => setMember(data.member))
      .catch(() => setMember(null));

    loadMember();
    window.addEventListener("set18-auth-change", loadMember);
    return () => window.removeEventListener("set18-auth-change", loadMember);
  }, []);
  return member;
}
