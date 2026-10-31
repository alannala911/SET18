const maxEntries = 5000;

export function recordAudit(state, req, action, details = {}) {
  state.auditLog ??= [];
  state.auditLog.push({ at: new Date().toISOString(), admin: req.admin?.email || "", action, ...details });
  if (state.auditLog.length > maxEntries) state.auditLog.splice(0, state.auditLog.length - maxEntries);
}
