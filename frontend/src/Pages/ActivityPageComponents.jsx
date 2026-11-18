// Inneholder aktivitetslistens resultater, administrasjon og dialoger
import { Link } from "react-router-dom";
import { ActivityCard } from "./ActivityCard.jsx";

export function ActivityHero() {
  return (
    <section className="activities-hero">
      <header>
        <p className="activities-label">Møt andre · skap noe sammen</p>
        <h1>Aktiviteter for alle</h1>
        <p className="activities-intro">
          Oppdag hyggelige møteplasser, håndarbeidstreff og
          kreative aktiviteter i Østfold.
        </p>
        <a className="activities-button" href="#kommende">Se kommende aktiviteter ↓</a>
      </header>
      <aside className="activities-symbols" aria-hidden="true">
        <span className="symbol-large">✣</span>
        <span className="symbol-small">✳</span>
        <span className="symbol-flower">✿</span>
      </aside>
    </section>
  );
}

export function ActivityResults({
  activityLoadError,
  activityActionError,
  isLoading,
  activityCount,
  filteredActivities,
  visibleActivities,
  totalPages,
  visiblePage,
  showEditControls,
  member,
  isAdmin,
  onRemove,
  onPageChange,
}) {
  const emptyMessage = isLoading
    ? "Laster aktiviteter …"
    : activityCount === 0
      ? "Det er ingen kommende aktiviteter å vise."
      : filteredActivities.length === 0
        ? "Ingen aktiviteter passer med valgt tidsperiode."
        : "";

  return (
    <>
      <ActivityErrors loadError={activityLoadError} actionError={activityActionError} />
      {emptyMessage ? (
        <p className="activities-empty">{emptyMessage}</p>
      ) : (
        <>
          <section className="activity-list" aria-label="Kommende aktiviteter">
            {visibleActivities.map((activityData, activityIndex) => (
              <ActivityListItem
                key={activityData.id}
                activity={activityData}
                index={activityIndex}
                showEditControls={showEditControls}
                member={member}
                isAdmin={isAdmin}
                onRemove={onRemove}
              />
            ))}
          </section>
          {totalPages > 1 && (
            <ActivityPagination
              currentPage={visiblePage}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          )}
        </>
      )}
    </>
  );
}

function ActivityErrors({ loadError, actionError }) {
  return (
    <>
      {loadError && <p className="activity-error" role="alert">{loadError}</p>}
      {actionError && <p className="activity-error" role="alert">{actionError}</p>}
    </>
  );
}

export function ActivityListItem({ activity, index, showEditControls, member, isAdmin, onRemove }) {
  return (
    <div className="activity-card-wrapper">
      {showEditControls && (
        <>
          <Link
            className="activity-edit-button"
            to={`/aktiviteter/${encodeURIComponent(activity.id)}/rediger`}
            aria-label={`Rediger ${activity.title}`}
            title={`Rediger ${activity.title}`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
            </svg>
          </Link>
          {onRemove && <button
            className="activity-remove-button"
            type="button"
            aria-label={`Fjern ${activity.title}`}
            onClick={() => onRemove(activity)}
          >
            ×
          </button>}
        </>
      )}
      <ActivityCard
        activityData={activity}
        activityIndex={index}
        ticketSales={{ member, isAdmin }}
      />
    </div>
  );
}

function ActivityPagination({ currentPage, totalPages, onPageChange }) {
  return (
    <nav className="activity-pagination" aria-label="Sidevalg for aktiviteter">
      <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
        Forrige
      </button>
      <span aria-current="page">Side {currentPage} av {totalPages}</span>
      <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
        Neste
      </button>
    </nav>
  );
}

export function ActivityInformation() {
  return (
    <aside className="activities-information">
      <span aria-hidden="true">♥</span>
      <section>
        <h2>Alle skal kunne finne noe som passer</h2>
        <p>
          Aktivitetssiden er laget for å gjøre det enkelt å se
          hva som skjer, hvor det skjer og når du kan delta.
        </p>
      </section>
    </aside>
  );
}

export function ActivityAdminActions({ isAdmin, isEditing, onToggleEditing }) {
  if (!isAdmin) return null;

  return (
    <div className="activity-admin-actions">
      <button className="activities-edit-button" type="button" onClick={onToggleEditing}>
        {isEditing ? "Avslutt redigering" : "Rediger aktiviteter"}
      </button>
      <Link className="activities-edit-button" to="/aktiviteter/ny">Legg til aktivitet</Link>
    </div>
  );
}

export function RemoveActivityDialog({
  activityToRemove,
  confirmationStage,
  isRemoving,
  onCancelRemoval,
  onConfirmRemoval,
}) {
  if (!activityToRemove) return null;

  const isFinalConfirmation = confirmationStage === 2;
  return (
    <div className="activity-dialog-backdrop">
      <section
        className="activity-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-dialog-title"
        aria-describedby="activity-dialog-description"
      >
        <h2 id="activity-dialog-title">
          {isFinalConfirmation
            ? "Er du sikker? Denne handlingen kan ikke angres"
            : "Ønsker du å fjerne denne aktiviteten?"}
        </h2>
        <p id="activity-dialog-description">
          {isFinalConfirmation
            ? `Aktiviteten «${activityToRemove.title}» arkiveres og påmeldte billetter avbestilles. Du kan gjenopprette den ved å endre status.`
            : `Vil du fjerne «${activityToRemove.title}» fra kommende aktiviteter?`}
        </p>
        <div className="activity-dialog-actions">
          <button
            type="button"
            className="activity-dialog-no"
            onClick={onCancelRemoval}
            disabled={isRemoving}
          >
            Nei
          </button>
          <button
            type="button"
            className="activity-dialog-yes"
            onClick={onConfirmRemoval}
            disabled={isRemoving}
          >
            {isRemoving ? "Fjerner …" : "Ja"}
          </button>
        </div>
      </section>
    </div>
  );
}
