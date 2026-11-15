import test from "node:test";
import assert from "node:assert/strict";
import { addCartItem, readCart } from "../src/Pages/cartState.js";

test("kurs og billetter summeres uten å lagre tilgjengelighetsdata", () => {
  const course = { type: "course", id: 1, quantity: 1 };
  const ticket = { type: "activity", id: 2, ticketName: "Deltaker", quantity: 2, available: 5, totalAvailable: 5 };
  let items = addCartItem([], course);
  items = addCartItem(items, ticket);
  items = addCartItem(items, { ...ticket, quantity: 1 });
  assert.deepEqual(items, [course, { type: "activity", id: 2, ticketName: "Deltaker", quantity: 3 }]);
  assert.deepEqual(readCart(JSON.stringify(items)), items);
  assert.throws(() => addCartItem(items, { ...ticket, ticketName: "Annen", quantity: 3 }), /tilgjengelige/);
  assert.throws(() => addCartItem(items, { ...course, quantity: 10 }), /grensen/);
});

test("ugyldig eller duplisert lagret handlekurv avvises", () => {
  assert.deepEqual(readCart(null), []);
  assert.throws(() => readCart("ikke json"));
  const item = { type: "course", id: 1, quantity: 1 };
  assert.throws(() => readCart(JSON.stringify([item, item])), /dupliserte/);
  assert.throws(() => readCart(JSON.stringify([{ ...item, quantity: 0 }])), /ugyldige/);
});

test("aktiviteter uten billettype kan legges i og leses fra handlekurven", () => {
  const activity = { type: "activity", id: 3, quantity: 1 };
  const items = addCartItem(addCartItem([], activity), activity);
  assert.deepEqual(items, [{ ...activity, quantity: 2 }]);
  assert.deepEqual(readCart(JSON.stringify(items)), items);
  assert.throws(() => readCart(JSON.stringify([{ ...activity, ticketName: "" }])), /ugyldige/);
});
