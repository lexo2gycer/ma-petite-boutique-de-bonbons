
"use strict";

/* ==========================================
   MA PETITE BOUTIQUE DE BONBONS
   Moteur de jeu - Emprunts corrigés
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
  changeComposition: 0,
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

function digitsOf(number, length) {
  return String(number).padStart(length, "0")
    .split("").map(Number);
}

/* ==========================================
   PLAN D'ADDITION
========================================== */

function makeAdditionPlan(values) {
  const answer = values.reduce((a, b) => a + b, 0);

  const length = Math.max(
    3,
    ...values.map(value => String(value).length),
    String(answer).length
  );

  const rows = values.map(value => digitsOf(value, length));
  const carries = Array(length).fill(0);

  let carry = 0;

  for (let col = length - 1; col >= 0; col--) {
    carries[col] = carry;

    let sum = carry;
    rows.forEach(row => sum += row[col]);

    carry = Math.floor(sum / 10);
  }

  return {
    rows,
    carries,
    answer,
    length,
    operation: "addition"
  };
}

/* ==========================================
   PLAN DE MULTIPLICATION
========================================== */

function makeMultiplicationPlan(value, multiplier) {
  const answer = value * multiplier;

  const length = Math.max(
    3,
    String(value).length,
    String(answer).length
  );

  const digits = digitsOf(value, length);
  const carries = Array(length).fill(0);
  const resultDigits = Array(length).fill(0);

  let carry = 0;

  for (let col = length - 1; col >= 0; col--) {
    carries[col] = carry;

    const product = digits[col] * multiplier + carry;

    resultDigits[col] = product % 10;
    carry = Math.floor(product / 10);
  }

  return {
    rows: [digits],
    carries,
    resultDigits,
    answer,
    length,
    multiplier,
    operation: "multiplication"
  };
}

/* ==========================================
   PLAN DE SOUSTRACTION
   CORRECTION DES EMPRUNTS EN CASCADE
========================================== */

/*
  Convention pédagogique :

  Une case d'emprunt est placée au-dessus
  de la colonne QUI PRÊTE à sa voisine droite.

  Exemple : 5,00 - 4,14

  Colonnes :      5 | 0 | 0
  Emprunts :      1 | 1 | vide
  Résultat :      0 | 8 | 6

  Si une colonne intermédiaire contient 0,
  l'emprunt remonte vers la colonne de gauche.

  Exemple : 1000 - 1

  Colonnes :      1 | 0 | 0 | 0
  Emprunts :      1 | 1 | 1 | vide
  Résultat :      0 | 9 | 9 | 9
*/

function makeSubtractionPlan(minuend, subtrahend) {
  const answer = minuend - subtrahend;

  const length = Math.max(
    3,
    String(minuend).length,
    String(subtrahend).length,
    String(answer).length
  );

  const top = digitsOf(minuend, length);
  const bottom = digitsOf(subtrahend, length);

  // Une case vaut 1 si cette colonne prête
  // à la colonne située immédiatement à droite.
  const borrows = Array(length).fill(0);

  let borrowIn = 0;

  // Calcul de droite à gauche.
  for (let col = length - 1; col >= 0; col--) {
    const topDigitAfterBorrow = top[col] - borrowIn;
    const bottomDigit = bottom[col];

    if (topDigitAfterBorrow < bottomDigit) {
      // La colonne de gauche doit prêter.
      if (col > 0) {
        borrows[col - 1] = 1;
      }

      borrowIn = 1;
    } else {
      borrowIn = 0;
    }
  }

  return {
    rows: [top, bottom],
    borrows,
    answer,
    length,
    operation: "subtraction"
  };
}

/* ==========================================
   AFFICHAGE DES OPÉRATIONS
========================================== */

function makeCell(content = "", className = "") {
  return `<div class="math-cell ${className}">${content}</div>`;
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

function renderOperation(plan, containerId, answerInCents = false) {
  const container = $(containerId);
  if (!container) return;

  const length = plan.length;
  const answerDigits = digitsOf(plan.answer, length);

  const operationName =
    plan.operation === "multiplication" ? "Pose ta multiplication" :
    plan.operation === "addition" ? "Pose ton addition" :
    "Pose ta soustraction";

  let html = `
    <div class="math-sheet">
      <div class="math-caption">${operationName}</div>

      <div class="math-grid" style="--cols:${length}">
        <div class="math-row carry-row">
  `;

  // Cases de retenue ou d'emprunt.
  for (let col = 0; col < length; col++) {
    const isSubtraction = plan.operation === "subtraction";

    const expected = isSubtraction
      ? plan.borrows[col]
      : plan.carries[col];

    const label = isSubtraction
      ? "Emprunt colonne " + (col + 1)
      : "Retenue colonne " + (col + 1);

    html += makeCell(
      makeInput("carry-input", label),
      expected ? "carry-needed" : "carry-empty"
    );
  }

  html += `</div>`;

  // Lignes des chiffres.
  plan.rows.forEach(row => {
    html += `<div class="math-row number-row">`;

    row.forEach(digit => {
      html += makeCell(String(digit));
    });

    html += `</div>`;

    if (plan.operation === "multiplication") {
      html += `<div class="math-row number-row multiplier-row">`;

      row.forEach((digit, col) => {
        const symbol = col === 0 ? "×" : "";
        const number = col === length - 1
          ? String(plan.multiplier)
          : "";

        html += makeCell(symbol + number);
      });

      html += `</div>`;
    }
  });

  html += `<div class="math-rule"></div>`;

  // Résultat.
  html += `<div class="math-row answer-row">`;

  answerDigits.forEach((digit, index) => {
    html += makeCell(
      makeInput("result-input", "Résultat colonne " + (index + 1))
    );
  });

  html += `</div></div>`;

  if (answerInCents) {
    html += `
      <p class="math-decimal-note">
        La virgule sépare les euros et les centimes.
      </p>
    `;
  }

  html += `</div>`;

  container.innerHTML = html;

  // Virgule avant les deux colonnes des centimes.
  if (answerInCents && length >= 3) {
    container.querySelectorAll(
      ".number-row:not(.multiplier-row), .answer-row"
    ).forEach(row => {
      const cells = row.querySelectorAll(".math-cell");

      if (cells.length >= 3) {
        cells[cells.length - 2].classList.add("decimal-before");
      }
    });
  }
}

/* ==========================================
   VALIDATION DES OPÉRATIONS
========================================== */

function checkOperation(plan, containerId) {
  const container = $(containerId);
  if (!container) return false;

  const carryInputs = [
    ...container.querySelectorAll(".carry-input")
  ];

  const resultInputs = [
    ...container.querySelectorAll(".result-input")
  ];

  let correct = true;

  // Vérification des retenues ou des emprunts.
  const expectedValues = plan.operation === "subtraction"
    ? plan.borrows
    : plan.carries;

  carryInputs.forEach((input, index) => {
    const expected = expectedValues[index] || 0;
    const entered = input.value.trim();

    const isCorrect = expected === 0
      ? entered === ""
      : Number(entered) === expected;

    input.classList.toggle("wrong", !isCorrect);

    if (!isCorrect) correct = false;
  });

  // Vérification du résultat.
  const expectedDigits = digitsOf(
    plan.answer,
    resultInputs.length
  );

  resultInputs.forEach((input, index) => {
    const isCorrect =
      input.value.trim() === String(expectedDigits[index]);

    input.classList.toggle("wrong", !isCorrect);

    if (!isCorrect) correct = false;
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
      walletSelections[index] =
        (walletSelections[index] || 0) + 1;

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
    "Indice : si le chiffre du haut est trop petit, la colonne située à sa gauche doit lui prêter une dizaine. Si cette colonne contient zéro, il faut remonter encore à gauche."
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
      changeSelections[index] =
        (changeSelections[index] || 0) + 1;

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
  state.changeComposition = 0;
  state.stars = 0;

  updateStars();
  showScreen("home");
});

/* ==========================================
   INITIALISATION
========================================== */

updateStars();
showScreen("home");
