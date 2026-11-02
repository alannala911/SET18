import { ActivityParticipants, TicketPurchase } from "./ActivityTickets.jsx";
import {
  activityPriceFormatter,
  activityStatusOptions,
  fallbackActivityColors,
  formatActivityDate,
  formatActivityDuration,
  getActivityImageSource,
  getActivityPriceRange,
  getDiscountAmountText,
  getDiscountPeriodText,
  getMemberTypeLabel,
  isDiscountExpired,
  knownActivityDecorations,
} from "./activityUtils.js";

export function ActivityCard({ activityData, activityIndex = 0, ticketSales }) {
  const decoration = knownActivityDecorations[activityData.id] || {
    emoji: "min side.png",
    color: fallbackActivityColors[activityIndex % fallbackActivityColors.length],
    tagline: activityData.category || "Aktivitet",
  };
  const priceRange = getActivityPriceRange(activityData.ticketTypes);
  const discount = activityData.discount && !isDiscountExpired(activityData.discount) ? activityData.discount : null;
  return (
    <article className="activity-card">
      <header className={`activity-image activity-image-${decoration.color}`}>
        {activityData.imageUrl
          ? <img className="activity-card-photo" src={getActivityImageSource(activityData.imageUrl)} alt="" />
          : <span aria-hidden="true">{decoration.emoji}</span>}
        <small>{decoration.tagline}</small>
      </header>
      <section className="activity-content">
        <p className="activity-category">{activityData.category || "Aktivitet"}</p>
        {activityData.status && activityData.status !== "published" && (
          <p className="activity-status">{activityStatusOptions.find(([status]) => status === activityData.status)?.[1]}</p>
        )}
        <h3>{activityData.title}</h3>
        {activityData.description?.includes("<")
          ? <div className="activity-description" dangerouslySetInnerHTML={{ __html: activityData.description }} />
          : <p>{activityData.description}</p>}
        {discount && (
          <p className="activity-discount">
            <strong>Rabatt: {getDiscountAmountText(discount)}</strong>
            {" "}for {discount.memberTypes.map(getMemberTypeLabel).join(", ").toLowerCase()}
            {getDiscountPeriodText(discount) && <> ({getDiscountPeriodText(discount)})</>}
          </p>
        )}
        <dl>
          <section>
            <dt>Dato</dt>
            <dd>{formatActivityDate(activityData.date)}</dd>
          </section>
          <section>
            <dt>Tid</dt>
            <dd>{activityData.time}</dd>
          </section>
          <section>
            <dt>Sted</dt>
            <dd>{activityData.location}</dd>
          </section>
          <section>
            <dt>Pris</dt>
            <dd>{priceRange || "Ikke oppgitt"}</dd>
          </section>
          {activityData.durationMinutes && (
            <section>
              <dt>Varighet</dt>
              <dd>{formatActivityDuration(activityData.durationMinutes)}</dd>
            </section>
          )}
        </dl>
        {activityData.ticketTypes?.length > 0 && (
          <section className="activity-ticket-list" aria-label="Billettyper">
            <h4>Billetter</h4>
            {activityData.ticketTypes.map((ticketType) => (
              <article key={ticketType.name}>
                <strong>
                  {ticketType.name} · {activityPriceFormatter.format(ticketType.price)}
                </strong>
                {ticketType.description && <p>{ticketType.description}</p>}
                <small>
                  {activityData.remainingTickets?.byType[ticketType.name] ?? ticketType.quantity} tilgjengelige · {ticketType.memberTypes.map(getMemberTypeLabel).join(", ")}
                </small>
                {ticketSales && (activityData.status ?? "published") === "published" && (
                  <TicketPurchase
                    activity={activityData}
                    ticketType={ticketType}
                    member={ticketSales.member}
                    onPurchased={ticketSales.onPurchased}
                  />
                )}
              </article>
            ))}
          </section>
        )}
        {ticketSales?.isAdmin && <ActivityParticipants activityId={activityData.id} />}
        <button type="button">Les mer om aktiviteten +</button>
      </section>
    </article>
  );
}

