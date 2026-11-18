// Håndterer redigering av aktivitetstyper, billetter og rabatter
import { activityMemberTypeOptions, discountMemberTypeOptions } from "./activityUtils.js";

export function TicketTypesEditor({
  activityDraft,
  ticketTypes,
  onActivityDraftChange,
  onAddTicketType,
  onRemoveTicketType,
  onUpdateTicketType,
  onToggleTicketMemberType,
}) {
  return (
    <section className="activity-editor-section">
      <h2>Billetter</h2>
      <label className="activity-editor-field activity-capacity-field">
        <span>Antall billetter tilgjengelig totalt *</span>
        <input
          type="number"
          min="1"
          max="100000"
          step="1"
          name="ticketCapacity"
          value={activityDraft.ticketCapacity}
          onChange={onActivityDraftChange}
          required
        />
      </label>
      {ticketTypes.map((ticketType, ticketIndex) => (
        <section className="activity-ticket-editor" key={ticketIndex}>
          <header>
            <h3>Billettype {ticketIndex + 1}</h3>
            {ticketTypes.length > 1 && (
              <button
                type="button"
                className="activity-ticket-remove"
                onClick={() => onRemoveTicketType(ticketIndex)}
              >
                Fjern billettype
              </button>
            )}
          </header>
          <div className="activity-editor-grid">
            <label className="activity-editor-field">
              <span>Navn *</span>
              <input
                value={ticketType.name}
                onChange={(event) => onUpdateTicketType(ticketIndex, "name", event.target.value)}
                maxLength={100}
                required
              />
            </label>
            <label className="activity-editor-field">
              <span>Pris (kr) *</span>
              <input
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                value={ticketType.price}
                onChange={(event) => onUpdateTicketType(ticketIndex, "price", event.target.value)}
                required
              />
            </label>
            <label className="activity-editor-field">
              <span>Antall av denne billettypen *</span>
              <input
                type="number"
                min="1"
                max={activityDraft.ticketCapacity || 100000}
                step="1"
                value={ticketType.quantity}
                onChange={(event) => onUpdateTicketType(ticketIndex, "quantity", event.target.value)}
                required
              />
            </label>
          </div>
          <label className="activity-editor-field">
            <span>Beskrivelse under billettypen</span>
            <textarea
              rows="3"
              maxLength={1000}
              value={ticketType.description}
              onChange={(event) => onUpdateTicketType(ticketIndex, "description", event.target.value)}
            />
          </label>
          <fieldset className="activity-member-types">
            <legend>Hvilke medlemmer kan kjøpe denne billetten? *</legend>
            {activityMemberTypeOptions.map(([memberType, memberLabel]) => (
              <label key={memberType}>
                <input
                  type="checkbox"
                  checked={ticketType.memberTypes.includes(memberType)}
                  onChange={() => onToggleTicketMemberType(ticketIndex, memberType)}
                />
                {memberLabel}
              </label>
            ))}
          </fieldset>
        </section>
      ))}
      {ticketTypes.length < 20 && (
        <button type="button" className="activity-add-ticket" onClick={onAddTicketType}>
          Legg til billettype
        </button>
      )}
    </section>
  );
}

export function DiscountEditor({ discountDraft, onUpdateDiscount }) {
  function toggleMemberType(memberType) {
    const selectedMemberTypes = discountDraft.memberTypes.includes(memberType)
      ? discountDraft.memberTypes.filter((currentType) => currentType !== memberType)
      : [...discountDraft.memberTypes, memberType];
    onUpdateDiscount("memberTypes", selectedMemberTypes);
  }

  return (
    <section className="activity-editor-section">
      <h2>Rabatt</h2>
      <label className="activity-check">
        <input
          type="checkbox"
          checked={discountDraft.enabled}
          onChange={(event) => onUpdateDiscount("enabled", event.target.checked)}
        />
        Gi rabatt på denne aktiviteten
      </label>
      {discountDraft.enabled && (
        <>
          <div className="activity-editor-grid">
            <label className="activity-editor-field">
              <span>Rabattype</span>
              <select
                value={discountDraft.type}
                onChange={(event) => onUpdateDiscount("type", event.target.value)}
              >
                <option value="percent">Prosent (%)</option>
                <option value="amount">Kroner (kr)</option>
              </select>
            </label>
            <label className="activity-editor-field">
              <span>{discountDraft.type === "percent" ? "Rabatt (%) *" : "Rabatt (kr) *"}</span>
              <input
                type="number"
                min="0"
                max={discountDraft.type === "percent" ? 100 : 1000000}
                step="any"
                value={discountDraft.value}
                onChange={(event) => onUpdateDiscount("value", event.target.value)}
              />
            </label>
          </div>
          <fieldset className="activity-member-types">
            <legend>Hvem får rabatt? *</legend>
            {discountMemberTypeOptions.map(([memberType, memberLabel]) => (
              <label key={memberType}>
                <input
                  type="checkbox"
                  checked={discountDraft.memberTypes.includes(memberType)}
                  onChange={() => toggleMemberType(memberType)}
                />
                {memberLabel}
              </label>
            ))}
          </fieldset>
          <label className="activity-check">
            <input
              type="checkbox"
              checked={discountDraft.hasPeriod}
              onChange={(event) => onUpdateDiscount("hasPeriod", event.target.checked)}
            />
            Rabatten gjelder bare i en bestemt periode
          </label>
          {discountDraft.hasPeriod && (
            <div className="activity-editor-grid">
              <label className="activity-editor-field">
                <span>Fra dato</span>
                <input
                  type="date"
                  value={discountDraft.startDate}
                  onChange={(event) => onUpdateDiscount("startDate", event.target.value)}
                />
              </label>
              <label className="activity-editor-field">
                <span>Til dato</span>
                <input
                  type="date"
                  value={discountDraft.endDate}
                  onChange={(event) => onUpdateDiscount("endDate", event.target.value)}
                />
              </label>
            </div>
          )}
        </>
      )}
    </section>
  );
}
