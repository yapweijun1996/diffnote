// Simple shopping cart total calculator
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total = total + items[i].price * items[i].qty;
  }
  return total;
}

function applyDiscount(total, code) {
  if (code === "SAVE10") {
    return total * 0.9;
  }
  return total;
}

const cart = [
  { name: "Pen", price: 2, qty: 3 },
  { name: "Notebook", price: 5, qty: 1 },
];

console.log("Total:", calculateTotal(cart));
