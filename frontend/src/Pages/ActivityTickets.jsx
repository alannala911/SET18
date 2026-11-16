// Håndterer billettkjøp, deltakere og medlemsbestillinger
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "./api.js";
import { activityPriceFormatter, getDiscountedPrice } from "./activityUtils.js";
import { useCart } from "./cartContext.js";

const orderStatusLabels = { confirmed: "Bekreftet", cancelled: "Avbestilt" };
const maxTicketsPerOrder = 10;

export function TicketPurchase({ activity, ticketType, member }) {
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const { add, error } = useCart();
  const remaining = Math.min(
    activity.remainingTickets?.byType[ticketType.name] ?? ticketType.quantity,
    activity.remainingTickets?.total ?? ticketType.quantity,
  );

  if (member?.expired) return <small>Medlemskapet er utløpt. Forny det på <Link to="/min-side">Min side</Link>.</small>;
  if (member && !ticketType.memberTypes.includes(member.type)) return <small>Ikke tilgjengelig for ditt medlemskap.</small>;
  if (activity.date < new Date().toISOString().slice(0, 10)) return <small>Aktiviteten er allerede avholdt.</small>;
  if (remaining < 1) return <small><strong>Utsolgt</strong></small>;

  const price = member ? getDiscountedPrice(activity, ticketType, member.type) : ticketType.price;
  const maxQuantity = Math.min(remaining, maxTicketsPerOrder);

  function addTickets() {
    const added = add({ type: "activity", id: activity.id, ticketName: ticketType.name, quantity: Number(quantity), available: remaining, totalAvailable: activity.remainingTickets?.total ?? ticketType.quantity });
    setMessage(added ? "Billettene er lagt i handlekurven." : "");
  }

  return (
    <div className="ticket-purchase">
      <small>
        {member ? "Din pris" : "Pris"}: <strong>{activityPriceFormatter.format(price)}</strong> · {remaining} ledige
      </small>
      {!member && <small>Medlemsinnlogging kreves før bestilling. <Link to="/min-side">Logg inn</Link></small>}
      <label>
        Antall
        <select value={quantity} onChange={(event) => setQuantity(event.target.value)}>
          {Array.from({ length: maxQuantity }, (_, index) => index + 1).map((count) => (
            <option key={count} value={count}>{count}</option>
          ))}
        </select>
      </label>
      <button className="activity-cart-button" type="button" onClick={addTickets}>Legg i handlekurv</button>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function ActivityParticipants({ activityId }) {
  const [participants, setParticipants] = useState(null);
  const [error, setError] = useState("");

  async function toggleParticipants() {
    if (participants) {
      setParticipants(null);
      return;
    }

    try {
      const loadedParticipants = await apiRequest(`/activities/${activityId}/orders`);
      setParticipants(loadedParticipants);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  const confirmed = participants?.filter((order) => order.status === "confirmed") || [];
  return (
    <section className="activity-participants">
      <button type="button" onClick={toggleParticipants}>{participants ? "Skjul påmeldte" : "Se påmeldte"}</button>
      {error && <p role="alert">{error}</p>}
      {participants && (confirmed.length === 0 ? <p>Ingen påmeldte ennå.</p> : (
        <ul>
          {confirmed.map((order) => (
            <li key={order.id}>
              {order.memberName || "Ukjent"} ({order.memberEmail}) · {order.ticketName} × {order.quantity}
            </li>
          ))}
        </ul>
      ))}
    </section>
  );
}

export function MemberOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const load = useCallback(
    () => apiRequest("/membership/orders").then(setOrders).catch((loadError) => setError(loadError.message)),
    [],
  );
  useEffect(() => { load(); }, [load]);

  async function cancel(orderId) {
    setError("");
    try {
      await apiRequest(`/membership/orders/${orderId}`, { method: "DELETE" });
      await load();
    } catch (cancelError) {
      setError(cancelError.message);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  return (
    <section className="member-orders">
      <h3>Mine bestillinger</h3>
      {orders.length === 0 && <p>Du har ingen bestillinger ennå.</p>}
      <ul>
        {orders.map((order) => (
          <OrderListItem key={order.id} order={order} today={today} onCancel={cancel} />
        ))}
      </ul>
      {error && <p className="membership-alert membership-error" role="alert">{error}</p>}
    </section>
  );
}

function OrderListItem({ order, today, onCancel }) {
  const canCancel = order.status === "confirmed" && order.activityDate >= today;

  return (
    <li>
      <strong>{order.activityTitle}</strong> ({order.activityDate}) · {order.ticketName} × {order.quantity} ·{" "}
      {activityPriceFormatter.format(order.totalPrice)} · {orderStatusLabels[order.status]}
      {canCancel && (
        <button type="button" onClick={() => onCancel(order.id)}>Avbestill</button>
      )}
    </li>
  );
}
