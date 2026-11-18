// Laster, oppdaterer og lagrer handlekurven i nettleseren
import { useEffect, useState } from "react";
import { CartContext } from "./cartContext.js";
import { addCartItem, readCart } from "./cartState.js";

const storageKey = "set18-cart-v1";

function initialCart() {
  try {
    return { items: readCart(localStorage.getItem(storageKey)), error: "" };
  } catch {
    return { items: [], error: "Handlekurven kunne ikke leses fra nettleseren. Endringer kan ikke lagres før problemet er løst." };
  }
}

export function CartProvider({ children }) {
  const [state, setState] = useState(initialCart);
  useEffect(() => {
    function sync(event) {
      if (event.key !== storageKey) return;
      try {
        setState({ items: readCart(event.newValue), error: "" });
      } catch {
        setState((current) => ({ ...current, error: "Handlekurven kunne ikke leses fra en annen fane." }));
      }
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function save(items) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
      setState({ items, error: "" });
      return true;
    } catch {
      setState((current) => ({ ...current, error: "Handlekurven kunne ikke lagres i nettleseren. Kontroller nettleserens lagringsinnstillinger." }));
      return false;
    }
  }

  function add(item) {
    try {
      return save(addCartItem(state.items, item));
    } catch (addError) {
      setState((current) => ({ ...current, error: addError.message }));
      return false;
    }
  }

  function remove(item) {
    return save(state.items.filter((entry) => !(entry.type === item.type && entry.id === item.id && entry.ticketName === item.ticketName)));
  }

  return <CartContext.Provider value={{ ...state, count: state.items.reduce((sum, item) => sum + item.quantity, 0), add, remove }}>{children}</CartContext.Provider>;
}
