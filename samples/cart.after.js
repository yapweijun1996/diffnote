// Simple shopping cart total calculator
function calculateTotal(items = []) {
  // guard against bad input
  if (!Array.isArray(items)) return 0;
  return items.reduce((total, item) => {
    const price = Number(item.price) || 0;
    const qty = Number(item.qty) || 0;
    return total + price * qty;
  }, 0);
}

const DISCOUNTS = { SAVE10: 0.9, SAVE20: 0.8 };

function applyDiscount(total, code) {
  const rate = DISCOUNTS[code];
  return rate ? total * rate : total;
}

const cart = [
  { name: "Pen", price: 2, qty: 3 },
  { name: "Notebook", price: 5, qty: 2 },
  { name: "Eraser", price: 1, qty: 4 },
];

const subtotal = calculateTotal(cart);
console.log("Total:", applyDiscount(subtotal, "SAVE10"));
