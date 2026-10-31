import express from "express";
import { randomUUID } from "node:crypto";
import { updateStore, readStore } from "../lib/store.js";
import { isPublished, remainingTickets, ticketPrice } from "../lib/pricing.js";
import { rateLimit } from "../lib/rateLimit.js";
import { membershipExpired } from "../lib/members.js";
import { requireMember } from "./membership.js";

const router = express.Router();
const maxTicketsPerOrder = 10;
const today = () => new Date().toISOString().slice(0, 10);

function orderError(message, status = 400) {
  return { error: message, status };
}

function hasValidOrderDetails(details) {
  return Number.isSafeInteger(details.activityId) &&
    typeof details.ticketName === "string" &&
    Number.isSafeInteger(details.quantity) &&
    details.quantity >= 1 &&
    details.quantity <= maxTicketsPerOrder;
}

function createOrder(state, member, { activityId, ticketName, quantity }) {
  if (membershipExpired(member)) return orderError("Medlemskapet er utløpt. Forny det på Min side for å kjøpe billetter.", 403);
  const activity = state.activities.find((item) => item.id === activityId && isPublished(item));
  if (!activity) return orderError("Aktiviteten ble ikke funnet", 404);
  if (activity.date < today()) return orderError("Aktiviteten er allerede avholdt");
  const ticketType = (activity.ticketTypes ?? []).find((item) => item.name === ticketName);
  if (!ticketType || !ticketType.memberTypes.includes(member.type)) {
    return orderError("Billetten er ikke tilgjengelig for ditt medlemskap");
  }
  const remaining = remainingTickets(state, activity);
  if (quantity > remaining.byType[ticketType.name] || quantity > remaining.total) {
    return orderError("Det er ikke nok ledige billetter", 409);
  }
  const unitPrice = ticketPrice(activity, ticketType, member.type);
  const order = {
    id: randomUUID(),
    memberId: member.id,
    activityId: activity.id,
    activityTitle: activity.title,
    activityDate: activity.date,
    ticketName: ticketType.name,
    quantity,
    unitPrice,
    totalPrice: Math.round(unitPrice * quantity * 100) / 100,
    status: "confirmed",
    createdAt: new Date().toISOString()
  };
  state.orders.push(order);
  return { order };
}

router.use(requireMember);

router.get("/", (req, res) => {
  const orders = readStore().orders.filter((order) => order.memberId === req.member.id);
  res.json(orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

router.post("/", rateLimit({ max: 30, windowMs: 10 * 60 * 1000 }), async (req, res, next) => {
  try {
    const orderDetails = req.body || {};
    if (!hasValidOrderDetails(orderDetails)) {
      return res.status(400).json({ message: `Velg aktivitet, billett og mellom 1 og ${maxTicketsPerOrder} billetter` });
    }
    const result = await updateStore((state) => createOrder(state, req.member, orderDetails));
    if (result.error) return res.status(result.status).json({ message: result.error });
    res.status(201).json(result.order);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const result = await updateStore((state) => {
      const order = state.orders.find((item) => item.id === req.params.id && item.memberId === req.member.id);
      if (!order) return orderError("Bestillingen ble ikke funnet", 404);
      if (order.status !== "confirmed") return orderError("Bestillingen er allerede avbestilt", 409);
      if (order.activityDate < today()) return orderError("Aktiviteten er allerede avholdt", 409);
      order.status = "cancelled";
      order.cancelledAt = new Date().toISOString();
      return { order };
    });
    if (result.error) return res.status(result.status).json({ message: result.error });
    res.json(result.order);
  } catch (error) {
    next(error);
  }
});

export default router;
