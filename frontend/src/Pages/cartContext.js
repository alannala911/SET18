// Deler handlekurvfunksjoner mellom kurs- og aktivitetssidene
import { createContext, useContext } from "react";

export const CartContext = createContext(null);

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("Handlekurven er ikke tilgjengelig.");
  return cart;
}
