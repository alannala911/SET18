// Beregner billettpriser, rabatter, tilgjengelighet og aktivitetsstatus
export function activeDiscount(
  activity,
  memberType,
  today = new Date().toISOString().slice(0, 10),
) {
  // Rabattregler brukes bare for valgte medlemstyper og innenfor oppgitt datoperiode
  const { discount } = activity;
  if (!discount || !discount.memberTypes.includes(memberType)) return null;
  if (
    (discount.startDate && today < discount.startDate) ||
    (discount.endDate && today > discount.endDate)
  )
    return null;
  return discount;
}

export function ticketPrice(activity, ticketType, memberType, today) {
  const discount = activeDiscount(activity, memberType, today);
  if (!discount) return ticketType.price;
  const reduction =
    discount.type === "percent"
      ? (ticketType.price * discount.value) / 100
      : discount.value;
  return Math.max(0, Math.round((ticketType.price - reduction) * 100) / 100);
}

export function confirmedOrders(state, activityId) {
  return state.orders.filter(
    (order) => order.activityId === activityId && order.status === "confirmed",
  );
}

export function remainingTickets(state, activity) {
  const { ticketTypes = [], ticketCapacity = 0 } = activity;
  const orders = confirmedOrders(state, activity.id);
  const totalSold = orders.reduce((total, order) => total + order.quantity, 0);
  // Beregn både total kapasitet og beholdning per type; begge grensene må overholdes
  const byType = Object.fromEntries(
    ticketTypes.map((ticketType) => {
      const sold = orders
        .filter((order) => order.ticketName === ticketType.name)
        .reduce((total, order) => total + order.quantity, 0);
      return [ticketType.name, Math.max(0, ticketType.quantity - sold)];
    }),
  );
  return { total: Math.max(0, ticketCapacity - totalSold), byType };
}

export const activityStatuses = ["published", "draft", "archived"];

export const isPublished = (activity) =>
  (activity.status ?? "published") === "published";
