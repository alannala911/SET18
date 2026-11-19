// Registrerer og begrenser historikken over administratorhandlinger
const maxEntries = 5000;

export function recordAudit(state, req, action, details = {}) {
  // Behold bare et begrenset antall siste hendelser, slik at loggen ikke vokser uendelig
  state.auditLog ??= [];
  state.auditLog.push({
    at: new Date().toISOString(),
    admin: req.admin?.email || "",
    action,
    ...details,
  });
  if (state.auditLog.length > maxEntries)
    state.auditLog.splice(0, state.auditLog.length - maxEntries);
}
