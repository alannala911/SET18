// Håndterer handlekurv, kurs og aktivitetsbestillinger
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "./api.js";
import { activityPriceFormatter, getDiscountedPrice } from "./activityUtils.js";
import { useCart } from "./cartContext.js";
import "./Shop.css";

export default function Shop({ payment = false }) {
  const { items, remove, error: cartError } = useCart();
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest("/courses", { credentials: "omit" }),
      apiRequest("/activities", { credentials: "omit" }),
      apiRequest("/membership/me").catch((sessionError) => {
        if (sessionError.status === 401) return null;
        throw sessionError;
      }),
    ]).then(([courses, activities, session]) => {
      if (!Array.isArray(courses) || !Array.isArray(activities)) throw new Error("Kurs eller aktiviteter har et ugyldig format.");
      if (active) setCatalog({ courses, activities, member: session?.member || null });
    }).catch((loadError) => {
      if (active) setError(`Kunne ikke kontrollere handlekurven: ${loadError.message}`);
    });
    return () => { active = false; };
  }, []);

  const lines = catalog ? items.map((item) => {
    if (item.type === "course") {
      const course = catalog.courses.find((entry) => entry.id === item.id && entry.status === "published");
      if (!course) return { item, problem: "Kurset er ikke lenger tilgjengelig." };
      return { item, title: course.title, detail: `${course.date} · ${course.place}`, price: course.price };
    }
    const activity = catalog.activities.find((entry) => entry.id === item.id && (entry.status ?? "published") === "published");
    if (activity && !item.ticketName) {
      return {
        item,
        title: activity.title,
        detail: `${activity.date} · ${activity.location}`,
        problem: activity.ticketTypes?.length
          ? "Velg en billettype på aktivitetssiden og legg den i handlekurven i stedet."
          : "Pris og billettype mangler. Aktiviteten kan ikke bestilles ennå.",
      };
    }
    const ticket = activity?.ticketTypes?.find((entry) => entry.name === item.ticketName);
    if (!activity || !ticket) return { item, title: activity?.title, problem: "Aktiviteten eller billetten er ikke lenger tilgjengelig." };
    let problem = "";
    const activityQuantity = items.filter((entry) => entry.type === "activity" && entry.id === item.id && entry.ticketName).reduce((sum, entry) => sum + entry.quantity, 0);
    if (!catalog.member) problem = "Logg inn som medlem for å bestille aktivitetsbilletter.";
    else if (catalog.member.expired) problem = "Medlemskapet er utløpt. Forny det på Min side.";
    else if (!ticket.memberTypes.includes(catalog.member.type)) problem = "Billetten er ikke tilgjengelig for ditt medlemskap.";
    else if (activity.date < new Date().toISOString().slice(0, 10)) problem = "Aktiviteten er allerede avholdt.";
    else if (item.quantity > activity.remainingTickets.byType[ticket.name] || activityQuantity > activity.remainingTickets.total) problem = "Det er ikke nok ledige billetter.";
    return {
      item, title: activity.title, detail: `${ticket.name} · ${activity.date} · ${activity.location}`,
      price: catalog.member ? getDiscountedPrice(activity, ticket, catalog.member.type) : ticket.price,
      problem,
    };
  }) : items.map((item) => ({
    item,
    title: item.type === "course" ? `Kurs ${item.id}` : item.ticketName,
    problem: "Informasjonen kunne ikke kontrolleres.",
  }));
  const total = lines.reduce((sum, line) => sum + (line.price || 0) * line.item.quantity, 0);
  const canProceed = items.length > 0 && catalog && !error && lines.every((line) => !line.problem);

  return (
    <main className="cart-page">
      <h1>{payment ? "Betaling" : "Handlekurv"}</h1>
      {payment && <p className="cart-notice" role="status"><strong>Betaling er ikke tilgjengelig ennå.</strong> Ingen betaling er gjennomført, og ingen bestilling eller påmelding er bekreftet.</p>}
      {!payment && <p>Kurs og aktivitetsbilletter du har lagt til, vises her. Plasser og billetter reserveres ikke i handlekurven.</p>}
      {cartError && <p className="cart-error" role="alert">{cartError}</p>}
      {error && <p className="cart-error" role="alert">{error} Last inn siden på nytt for å prøve igjen.</p>}
      {!catalog && !error && <p>Laster handlekurven …</p>}
      {(catalog || error) && items.length === 0 && <p>Handlekurven er tom.</p>}
      {(catalog || error) && items.length > 0 && <>
        <ul className="cart-items">
          {lines.map(({ item, title, detail, price, problem }) => (
            <li key={`${item.type}-${item.id}-${item.ticketName || ""}`}>
              <div>
                <p className="cart-kind">{item.type === "course" ? "Kurs" : "Aktivitet"}</p>
                <h2>{title || item.ticketName || "Utilgjengelig kurs"}</h2>
                {detail && <p>{detail}</p>}
                <p>Antall: {item.quantity}{price != null && <> · {activityPriceFormatter.format(price)} per stk.</>}</p>
                {problem && <p className="cart-error">{problem} {catalog && !catalog.member && item.type === "activity" && <Link to="/min-side">Logg inn</Link>}</p>}
              </div>
              {!payment && <button type="button" onClick={() => remove(item)} aria-label={`Fjern ${title || item.ticketName || "kurs"} fra handlekurven`}>Fjern</button>}
            </li>
          ))}
        </ul>
        {catalog && <p className="cart-total">Sum for tilgjengelige varer: {activityPriceFormatter.format(total)}</p>}
        {!payment && (canProceed
          ? <Link className="cart-primary" to="/betaling">Bestill</Link>
          : <p>Rett opp problemene i handlekurven før du går videre.</p>)}
      </>}
      {payment && <Link className="cart-primary" to="/handlekurv">Tilbake til handlekurven</Link>}
      {!payment && <nav className="cart-links" aria-label="Finn flere tilbud"><Link className="cart-primary" to="/kurs">Finn kurs</Link><Link className="cart-primary" to="/aktiviteter">Finn aktiviteter</Link></nav>}
    </main>
  );
}
