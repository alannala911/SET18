import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "./api.js";

const memberTypeLabels = {
  regular: "Vanlig",
  minor: "Mindreårig",
  gift: "Gave",
  craft: "Husflidshåndverker",
};
const memberStatusLabels = { active: "Aktiv", suspended: "Suspendert", pending: "Venter" };
const emptyFilters = { search: "", type: "", status: "", expired: "" };

function FilterSelect({ label, value, options, onChange }) {
  return (
    <label className="membership-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Alle</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function MemberFilters({ filters, onFilterChange }) {
  return (
    <div className="membership-grid">
      <label className="membership-field">
        <span>Søk (navn, e-post, telefon)</span>
        <input
          value={filters.search}
          onChange={(event) => onFilterChange("search", event.target.value)}
        />
      </label>
      <FilterSelect
        label="Type"
        value={filters.type}
        options={Object.entries(memberTypeLabels)}
        onChange={(value) => onFilterChange("type", value)}
      />
      <FilterSelect
        label="Status"
        value={filters.status}
        options={Object.entries(memberStatusLabels)}
        onChange={(value) => onFilterChange("status", value)}
      />
      <FilterSelect
        label="Gyldighet"
        value={filters.expired}
        options={[["false", "Gyldig"], ["true", "Utløpt"]]}
        onChange={(value) => onFilterChange("expired", value)}
      />
    </div>
  );
}

function oneYearLater(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function MemberListItem({ member, onUpdate }) {
  const canToggleStatus = ["active", "suspended"].includes(member.status);
  const nextStatus = member.status === "active" ? "suspended" : "active";
  const statusButtonLabel = member.status === "active" ? "Suspender" : "Aktiver";
  const localGroup = member.localGroup
    ? `${member.localGroup.region}/${member.localGroup.chapter}`
    : "Uten lokallag";

  return (
    <li>
      <strong>{member.name || member.email}</strong> · {member.email} · {memberTypeLabels[member.type] || member.type} ·{" "}
      {memberStatusLabels[member.status] || member.status} · {localGroup} · gyldig til {member.validUntil}
      {member.expired && " (utløpt)"}
      {canToggleStatus && (
        <button type="button" onClick={() => onUpdate(member, { status: nextStatus })}>
          {statusButtonLabel}
        </button>
      )}
      <button
        type="button"
        onClick={() => onUpdate(member, { validUntil: oneYearLater(member.validUntil) })}
      >
        Forleng ett år
      </button>
    </li>
  );
}

export default function AdminMembers() {
  const [filters, setFilters] = useState(emptyFilters);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  const queryString = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  ).toString();

  const loadMembers = useCallback(() => {
    return apiRequest(`/admin/members?${queryString}`)
      .then((data) => setMembers(data.members))
      .catch((loadError) => setError(loadError.message));
  }, [queryString]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function updateMember(member, changes) {
    setError("");
    try {
      await apiRequest(`/admin/members/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      await loadMembers();
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  function updateFilter(field, value) {
    setFilters((currentFilters) => ({ ...currentFilters, [field]: value }));
  }

  return (
    <section className="membership-section admin-members">
      <h2>Medlemsliste</h2>
      <MemberFilters filters={filters} onFilterChange={updateFilter} />
      {error && <p className="membership-alert membership-error" role="alert">{error}</p>}
      <p>{members.length} medlem(mer)</p>
      <ul>
        {members.map((member) => (
          <MemberListItem key={member.id} member={member} onUpdate={updateMember} />
        ))}
      </ul>
    </section>
  );
}
