
"use strict";

/* ==========================================
   MA PETITE BOUTIQUE DE BONBONS
   Moteur de jeu - Version avec retenues
   et emprunts réellement contrôlés
========================================== */

const $ = id => document.getElementById(id);

const products = [
  { id: 1, name: "Sucre d'orge", price: 20, emoji: "🍭" },
  { id: 2, name: "Sucette grenadine", price: 65, emoji: "🍬" },
  { id: 3, name: "Caramel mou", price: 32, emoji: "🍮" },
  { id: 4, name: "Fraise Tagadouille", price: 105, emoji: "🍓" },
  { id: 5, name: "Carambar", price: 60, emoji: "🍫" },
  { id: 6, name: "Barbe à papa", price: 300, emoji: "🍥" },
  { id: 7, name: "Gâteau au chocolat", price: 325, emoji: "🍰" },
  { id: 8, name: "Tarte à la fraise", price: 442, emoji: "🥧" }
];

const moneyValues = [
  { value: 5000, label: "50 €" },
  { value: 2000, label: "20 €" },
  { value: 1000, label: "10 €" },
  { value: 500, label: "5 €" },
  { value: 200, label: "2 €" },
  { value: 100, label: "1 €" },
  { value: 50, label: "50 c" },
  { value: 20, label: "20 c" },
  { value: 10, label: "10 c" },
  { value: 5, label: "5 c" },
  { value: 2, label: "2 c" },
  { value: 1, label: "1 c" }
];

const state = {
  cart: {},
  lineResults: [],
  calculationIndex: 0,
  total: 0,
  customerPayment: 0,
  change: 0,
  stars: 0,
  report: {
    revenue: 0,
    received: 0,
    returned: 0,
    customers: 0,
    items: 0,
    challenges: 0
  }
};

let currentExercise = null;
let walletSelections = {};
let changeSelections = {};

/* ==========================================
   OUTILS
========================================== */

function euros(cents) {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + " €";
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(screen =>
    screen.classList.add("hidden")
  );

  const screen = $(name);
  if (screen) screen.classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function feedback(id, message, type = "") {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.className = "feedback " + type;
}

function selectedProducts() {
  return products.filter(p => (state.cart[p.id] || 0) > 0);
}

function selectedCount() {
  return Object.values(state.cart)
    .reduce((sum, quantity) => sum + quantity, 0);
}

function updateStars() {
  $("stars").textContent = state.stars;
}

function resetInputs(container) {
  container.querySelectorAll("input").forEach(input => {
    input.value = "";
    input.classList.remove("wrong");
  });
}

/* ==========================================
   MOTEUR DES OPÉRATIONS POSÉES
========================================== */

/*
  Tous les montants sont travaillés en centimes.
  Exemple : 3,25 € devient 325 centimes.

  Les chiffres sont affichés en colonnes.
  La virgule est placée entre les euros
  et les centimes.
*/

function digitsOf(number, length) {
  return String(number).padStart(length, "0")
    .split("").map(Number);
}

function makeAdditionPlan(values) {
  const maxLength = Math.max(
    ...values.map(v => String(v).length)
  );

  const rows = values.map(v => digitsOf(v, maxLength));
  const carries = [];
  let carry = 0;

  for (let col = maxLength - 1; col >= 0; col--) {
    let sum = carry;

    rows.forEach(row => {
      sum += row[col];
    });

    carry = Math.floor(sum / 10);
    carries[col] = carry;
  }

  const answer = values.reduce((a, b) => a + b, 0);

  return {
    rows,
    carries,
    answer,
    length: maxLength,
    operation: "addition"
  };
}

function makeMultiplicationPlan(value, multiplier) {
  const digits = String(value).split("").map(Number);
  const length = digits.length;
  const carries = Array(length).fill(0);

  let carry = 0;

  for (let col = length - 1; col >= 0; col--) {
    const product = digits[col] * multiplier + carry;
    carry = Math.floor(product / 10);
    carries[col] = carry;
  }

  return {
    rows: [digits],
    carries,
    answer: value * multiplier,
    length,
    multiplier,
    operation: "multiplication"
  };
}

function makeSubtractionPlan(minuend, subtrahend) {
  const length = Math.max(
    String(minuend).length,
    String(subtrahend).length
  );

  const top = digitsOf(minuend, length);
  const bottom = digitsOf(subtrahend, length);

  const borrows = Array(length).fill(0);
  let borrow = 0;

  for (let col = length - 1; col >= 0; col--) {
    const a = top[col] - borrow;
    const b = bottom[col];

    if (a < b) {
      borrows[col] = 1;
      borrow = 1;
    } else {
      borrow = 0;
    }
  }

  return {
    rows: [top, bottom],
    borrows,
    answer: minuend - subtrahend,
    length,
    operation: "subtraction"
  };
}

/* ==========================================
   AFFICHAGE DES COLONNES
========================================== */

function makeCell(value = "", className = "") {
  return `<div class="math-cell ${className}">${value}</div>`;
}

function makeInput(className, label) {
  return `
    <input
      class="${className}"
      type="number"
      inputmode="numeric"
      min="0"
      max="9"
      maxlength="1"
      aria-label="${label}"
      autocomplete="off"
    >
  `;
}

function formatCentsDigits(number) {
  const text = String(number).padStart(3, "0");
  return text.slice(0, -2) + "," + text.slice(-2);
}

function renderOperation(plan, containerId, answerInCents = false) {
  const container = $(containerId);
  const length = plan.length;

  let html = `
    <div class="math-sheet">
      <div class="math-caption">
        ${plan.operation === "multiplication"
          ? "Pose ta multiplication"
          : plan.operation === "addition"
          ? "Pose ton addition"
          : "Pose ta soustraction"}
      </div>
      <div class="math-grid" style="--cols:${length}">
  `;

  // Ligne des retenues ou des emprunts
  html += `<div class="math-row carry-row">`;

  for (let col = 0; col < length; col++) {
    const isNeeded = plan.operation === "subtraction"
      ? plan.borrows[col] === 1
      : plan.carries[col] > 0;

    html += makeCell(
      makeInput("carry-input", "Retenue ou emprunt colonne " + (col + 1)),
      isNeeded ? "carry-needed" : "carry-empty"
    );
  }

  html += `</div>`;

  // Chiffres des opérations
  plan.rows.forEach((row, rowIndex) => {
    html += `<div class="math-row number-row">`;

    row.forEach((digit, col) => {
      html += makeCell(digit);
    });

    html += `</div>`;

    if (rowIndex === 0 && plan.operation === "multiplication") {
      html += `<div class="math-row number-row multiplier-row">`;
      for (let col = 0; col < length - 1; col++) {
        html += makeCell("");
      }
      html += makeCell("× " + plan.multiplier);
      html += `</div>`;
    }
  });

  html += `<div class="math-rule"></div>`;

  // Résultat
  const answerDigits = digitsOf(plan.answer, length + 1);

  html += `<div class="math-row answer-row">`;

  answerDigits.forEach((digit, index) => {
    html += makeCell(
      makeInput("result-input", "Résultat colonne " + (index + 1))
    );
  });

  html += `</div>`;

  html += `</div>`;

  if (answerInCents) {
    html += `<p class="math-decimal-note">
      Les deux dernières colonnes représentent les centimes.
      La virgule se place avant ces deux colonnes.
    </p>`;
  }

  html += `</div>`;

  container.innerHTML = html;

  // Ajouter un affichage spécifique de la virgule
  if (answerInCents) {
    const rows = container.querySelectorAll(".number-row, .answer-row");
    rows.forEach(row => {
      const cells = row.querySelectorAll(".math-cell");
      if (cells.length >= 3) {
        cells[cells.length - 2].classList.add("decimal-before");
      }
    });
  }
}

/* ==========================================
   VALIDATION DES RETENUES ET DES RÉSULTATS
========================================== */

function checkOperation(plan, containerId) {
  const container = $(containerId);

  const carryInputs = [
    ...container.querySelectorAll(".carry-input")
  ];

  const resultInputs = [
    ...container.querySelectorAll(".result-input")
  ];

  let correct = true;

  const expectedCarries = plan.operation === "subtraction"
    ? plan.borrows
    : plan.carries;

  carryInputs.forEach((input, index) => {
    const expected = expectedCarries[index] || 0;
    const entered = input.value.trim();

    if (expected === 0) {
      if (entered !== "") {
        input.classList.add("wrong");
        correct = false;
      } else {
        input.classList.remove("wrong");
      }
    } else {
      if (Number(entered) !== expected) {
        input.classList.add("wrong");
        correct = false;
      } else {
        input.classList.remove("wrong");
      }
    }
  });

  const expectedDigits = digitsOf(
    plan.answer,
    resultInputs.length
  );

  resultInputs.forEach((input, index) => {
    if (input.value.trim() !== String(expectedDigits[index])) {
      input.classList.add("wrong");
      correct = false;
    } else {
      input.classList.remove("wrong");
    }
  });

  return correct;
}

/* ==========================================
   NAVIGATION
========================================== */

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => {
    showScreen(button.dataset.go);
  });
});

$("start-shop").addEventListener("click", () => {
  state.cart = {};
  renderCatalog();
  showScreen("catalog");
});

/* ==========================================
   CATALOGUE
========================================== */

function renderCatalog() {
  const container = $("product-list");
  container.innerHTML = "";

  products.forEach(product => {
    const quantity = state.cart[product.id] || 0;

    const card = document.createElement("article");
    card.className = "product-card";

    card.innerHTML = `
      <div class="product-image">${product.emoji}</div>
      <div class="product-name">${product.name}</div>
      <div class="product-price">${euros(product.price)}</div>
      <div class="quantity-controls">
        <button data-minus="${product.id}" ${quantity === 0 ? "disabled" : ""}>−</button>
        <span class="quantity-value">${quantity}</span>
        <button data-plus="${product.id}" ${quantity >= 5 ? "disabled" : ""}>+</button>
      </div>
    `;

    container.appendChild(card);
  });

  container.querySelectorAll("[data-plus]").forEach(button => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.plus);
      const quantity = state.cart[id] || 0;
      if (quantity < 5) state.cart[id] = quantity + 1;
      renderCatalog();
    });
  });

  container.querySelectorAll("[data-minus]").forEach(button => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.minus);
      const quantity = state.cart[id] || 0;

      if (quantity <= 1) delete state.cart[id];
      else state.cart[id] = quantity - 1;

      renderCatalog();
    });
  });

  $("cart-count").textContent = selectedCount();
  $("to-cart").disabled =
    selectedCount() === 0 || selectedProducts().length > 4;
}

$("to-cart").addEventListener("click", () => {
  if (!selectedProducts().length) return;
  renderCart();
  showScreen("cart");
});

/* ==========================================
   PANIER
========================================== */

function renderCart() {
  const container = $("cart-list");
  container.innerHTML = "";

  selectedProducts().forEach(product => {
    const line = document.createElement("div");
    line.className = "cart-line";

    line.innerHTML = `
      <div>
        <strong>${product.emoji} ${product.name}</strong>
        <div>${state.cart[product.id]} × ${euros(product.price)}</div>
      </div>
      <strong>À calculer</strong>
    `;

    container.appendChild(line);
  });
}

$("start-calculations").addEventListener("click", () => {
  state.lineResults = [];
  state.calculationIndex = 0;
  startLineCalculation();
});

/* ==========================================
   MULTIPLICATIONS POSÉES
========================================== */

function startLineCalculation() {
  const list = selectedProducts();

  if (state.calculationIndex >= list.length) {
    renderInvoice();
    showScreen("invoice");
    return;
  }

  const product = list[state.calculationIndex];
  const quantity = state.cart[product.id];

  currentExercise = {
    product,
    quantity,
    plan: makeMultiplicationPlan(product.price, quantity)
  };

  $("calculation-progress").textContent =
    `Calcul ${state.calculationIndex + 1} sur ${list.length}`;

  $("calculation-product").innerHTML = `
    <h3>${product.emoji} ${product.name}</h3>
    <p>${quantity} bonbon(s) à ${euros(product.price)} pièce.</p>
  `;

  $("calculation-instruction").textContent =
    "Complète les retenues au-dessus des colonnes, puis le résultat.";

  renderOperation(
    currentExercise.plan,
    "calculation-work",
    true
  );

  feedback("calculation-feedback", "");
  showScreen("calculations");
}

$("check-calculation").addEventListener("click", () => {
  if (!currentExercise) return;

  if (!checkOperation(
    currentExercise.plan,
    "calculation-work"
  )) {
    feedback(
      "calculation-feedback",
      "Pas encore ! Vérifie les retenues et chaque chiffre.",
      "error"
    );
    return;
  }

  feedback(
    "calculation-feedback",
    "Bravo ! Multiplication réussie ! ⭐",
    "success"
  );

  state.lineResults.push({
    product: currentExercise.product,
    total: currentExercise.plan.answer
  });

  state.stars++;
  state.report.challenges++;
  updateStars();

  $("check-calculation").disabled = true;

  setTimeout(() => {
    $("check-calculation").disabled = false;
    state.calculationIndex++;
    startLineCalculation();
  }, 900);
});

$("calculation-hint").addEventListener("click", () => {
  feedback(
    "calculation-feedback",
    "Indice : commence par la colonne des unités. Multiplie, puis place la retenue dans la colonne située à gauche."
  );
});

/* ==========================================
   ADDITION FINALE DE LA FACTURE
========================================== */

function renderInvoice() {
  const container = $("invoice-lines");
  container.innerHTML = "<h3>Les lignes de la facture</h3>";

  state.lineResults.forEach(line => {
    const row = document.createElement("div");
    row.className = "invoice-line";
    row.innerHTML = `
      <span>${line.product.emoji} ${line.product.name}</span>
      <strong>${euros(line.total)}</strong>
    `;
    container.appendChild(row);
  });

  state.total = state.lineResults.reduce(
    (sum, line) => sum + line.total,
    0
  );

  const plan = makeAdditionPlan(
    state.lineResults.map(line => line.total)
  );

  currentExercise = { plan };

  renderOperation(plan, "invoice-work", true);
  feedback("invoice-feedback", "");
}

$("check-invoice").addEventListener("click", () => {
  if (!currentExercise ||
      !checkOperation(currentExercise.plan, "invoice-work")) {
    feedback(
      "invoice-feedback",
      "Vérifie les retenues et les chiffres de ton addition.",
      "error"
    );
    return;
  }

  feedback(
    "invoice-feedback",
    "Facture validée ! Le client peut payer ! 🎉",
    "success"
  );

  $("amount-due").textContent = euros(state.total);
  renderCustomerWallet();
  showScreen("register");
});

$("invoice-hint").addEventListener("click", () => {
  feedback(
    "invoice-feedback",
    "Indice : commence par les centimes. Pense à reporter chaque retenue dans la colonne suivante."
  );
});

/* ==========================================
   PAIEMENT DU CLIENT
========================================== */

function renderCustomerWallet() {
  walletSelections = {};
  $("customer-wallet").innerHTML = "";

  moneyValues.forEach((money, index) => {
    const button = document.createElement("button");
    button.className = "money-item";
    button.type = "button";
    button.textContent = money.label;

    button.addEventListener("click", () => {
      walletSelections[index] = (walletSelections[index] || 0) + 1;
      button.classList.add("selected");
      button.textContent =
        `${money.label} × ${walletSelections[index]}`;
      updatePaymentTotal();
    });

    $("customer-wallet").appendChild(button);
  });

  updatePaymentTotal();
}

function updatePaymentTotal() {
  state.customerPayment = moneyValues.reduce(
    (sum, money, index) =>
      sum + money.value * (walletSelections[index] || 0),
    0
  );

  $("payment-total").textContent =
    `Le client donne : ${euros(state.customerPayment)}`;
}

$("check-payment").addEventListener("click", () => {
  if (state.customerPayment < state.total) {
    $("payment-total").textContent =
      "Il manque de l'argent. Le client doit compléter son paiement.";
    return;
  }

  state.change = state.customerPayment - state.total;

  if (state.change === 0) {
    finishSale();
    return;
  }

  renderChangeProblem();
  showScreen("change");
});

/* ==========================================
   SOUSTRACTION POSÉE : MONNAIE À RENDRE
========================================== */

function renderChangeProblem() {
  $("change-problem").innerHTML = `
    <p>Facture : <strong>${euros(state.total)}</strong></p>
    <p>Somme donnée : <strong>${euros(state.customerPayment)}</strong></p>
    <h3>Quelle monnaie dois-tu rendre ?</h3>
  `;

  const plan = makeSubtractionPlan(
    state.customerPayment,
    state.total
  );

  currentExercise = { plan };

  renderOperation(plan, "change-work", true);

  feedback("change-feedback", "");
  $("change-wallet").classList.add("hidden");
}

$("check-change-calculation").addEventListener("click", () => {
  if (!currentExercise ||
      !checkOperation(currentExercise.plan, "change-work")) {
    feedback(
      "change-feedback",
      "Réessaie ! Vérifie les emprunts et les chiffres.",
      "error"
    );
    return;
  }

  feedback(
    "change-feedback",
    "Bravo ! Tu as trouvé la monnaie à rendre ! ⭐",
    "success"
  );

  $("change-wallet").classList.remove("hidden");
  renderChangeWallet();
});

$("change-hint").addEventListener("click", () => {
  feedback(
    "change-feedback",
    "Indice : dans une colonne, si le chiffre du haut est trop petit, tu dois emprunter à la colonne de gauche."
  );
});

/* ==========================================
   COMPOSITION DE LA MONNAIE
========================================== */

function renderChangeWallet() {
  changeSelections = {};
  $("change-money-grid").innerHTML = "";

  moneyValues.forEach((money, index) => {
    const button = document.createElement("button");
    button.className = "money-item";
    button.type = "button";
    button.textContent = money.label;

    button.addEventListener("click", () => {
      changeSelections[index] = (changeSelections[index] || 0) + 1;
      button.classList.add("selected");
      button.textContent =
        `${money.label} × ${changeSelections[index]}`;
      updateChangeTotal();
    });

    $("change-money-grid").appendChild(button);
  });

  updateChangeTotal();
}

function updateChangeTotal() {
  const total = moneyValues.reduce(
    (sum, money, index) =>
      sum + money.value * (changeSelections[index] || 0),
    0
  );

  $("change-composition-total").textContent =
    `Monnaie préparée : ${euros(total)}`;

  state.changeComposition = total;
}

$("check-change-composition").addEventListener("click", () => {
  if (state.changeComposition !== state.change) {
    $("change-composition-total").textContent =
      "Ce n'est pas encore la bonne somme. Réessaie !";
    return;
  }

  finishSale();
});

/* ==========================================
   FIN DE VENTE
========================================== */

function finishSale() {
  state.report.revenue += state.total;
  state.report.received += state.customerPayment;
  state.report.returned += state.change;
  state.report.customers++;
  state.report.items += selectedCount();

  showScreen("result");
}

$("next-customer").addEventListener("click", () => {
  state.cart = {};
  state.lineResults = [];
  state.calculationIndex = 0;
  currentExercise = null;

  renderCatalog();
  showScreen("catalog");
});

$("finish-shop").addEventListener("click", () => {
  renderDailyReport();
  showScreen("daily-report");
});

/* ==========================================
   BILAN DE FIN DE JOURNÉE
========================================== */

function renderDailyReport() {
  const report = state.report;

  $("daily-report-content").innerHTML = `
    <div class="report-line">
      <span>💰 Chiffre d'affaires</span>
      <strong>${euros(report.revenue)}</strong>
    </div>
    <div class="report-line">
      <span>💶 Montant encaissé</span>
      <strong>${euros(report.received)}</strong>
    </div>
    <div class="report-line">
      <span>🪙 Monnaie rendue</span>
      <strong>${euros(report.returned)}</strong>
    </div>
    <div class="report-line">
      <span>👥 Clients servis</span>
      <strong>${report.customers}</strong>
    </div>
    <div class="report-line">
      <span>🍬 Bonbons vendus</span>
      <strong>${report.items}</strong>
    </div>
    <div class="report-line">
      <span>⭐ Défis réussis</span>
      <strong>${report.challenges}</strong>
    </div>
  `;
}

$("new-day").addEventListener("click", () => {
  state.report = {
    revenue: 0,
    received: 0,
    returned: 0,
    customers: 0,
    items: 0,
    challenges: 0
  };

  state.cart = {};
  state.lineResults = [];
  state.calculationIndex = 0;
  state.total = 0;
  state.customerPayment = 0;
  state.change = 0;
  state.stars = 0;

  updateStars();
  showScreen("home");
});

/* ==========================================
   INITIALISATION
========================================== */

updateStars();
showScreen("home");
