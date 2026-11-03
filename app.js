
"use strict";

/* =========================================
   MA PETITE BOUTIQUE DE BONBONS
   Première version du moteur de jeu
========================================= */

const $ = (id) => document.getElementById(id);

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
  { value: 5000, label: "50 €", type: "billet" },
  { value: 2000, label: "20 €", type: "billet" },
  { value: 1000, label: "10 €", type: "billet" },
  { value: 500, label: "5 €", type: "billet" },
  { value: 200, label: "2 €", type: "pièce" },
  { value: 100, label: "1 €", type: "pièce" },
  { value: 50, label: "50 c", type: "pièce" },
  { value: 20, label: "20 c", type: "pièce" },
  { value: 10, label: "10 c", type: "pièce" },
  { value: 5, label: "5 c", type: "pièce" },
  { value: 2, label: "2 c", type: "pièce" },
  { value: 1, label: "1 c", type: "pièce" }
];

const state = {
  screen: "home",
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

/* =========================================
   OUTILS
========================================= */

function euros(cents) {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + " €";
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.add("hidden");
  });

  const target = $(name);
  if (target) target.classList.remove("hidden");

  state.screen = name;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setFeedback(id, message, type = "") {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.className = "feedback " + type;
}

function selectedProducts() {
  return products.filter(product => (state.cart[product.id] || 0) > 0);
}

function selectedCount() {
  return Object.values(state.cart).reduce((sum, quantity) => sum + quantity, 0);
}

function expectedLineTotal(product) {
  return product.price * state.cart[product.id];
}

function updateStars() {
  if ($("stars")) $("stars").textContent = state.stars;
}

/* =========================================
   NAVIGATION
========================================= */

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

/* =========================================
   CATALOGUE
========================================= */

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
        <button type="button" data-minus="${product.id}"
          ${quantity === 0 ? "disabled" : ""}>−</button>
        <span class="quantity-value">${quantity}</span>
        <button type="button" data-plus="${product.id}"
          ${quantity >= 5 ? "disabled" : ""}>+</button>
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

      if (quantity <= 1) {
        delete state.cart[id];
      } else {
        state.cart[id] = quantity - 1;
      }

      renderCatalog();
    });
  });

  $("cart-count").textContent = selectedCount();

  $("to-cart").disabled =
    selectedCount() === 0 || selectedProducts().length > 4;
}

$("to-cart").addEventListener("click", () => {
  if (selectedProducts().length === 0) return;
  renderCart();
  showScreen("cart");
});

/* =========================================
   PANIER
========================================= */

function renderCart() {
  const container = $("cart-list");
  container.innerHTML = "";

  selectedProducts().forEach(product => {
    const line = document.createElement("div");
    line.className = "cart-line";

    line.innerHTML = `
      <div>
        <strong>${product.emoji} ${product.name}</strong>
        <div class="muted">${state.cart[product.id]} × ${euros(product.price)}</div>
      </div>
      <strong>À calculer</strong>
    `;

    container.appendChild(line);
  });

  const count = selectedProducts().length;

  const note = document.createElement("p");
  note.textContent = `${count} référence(s) dans la commande.`;
  container.appendChild(note);
}

$("start-calculations").addEventListener("click", () => {
  state.lineResults = [];
  state.calculationIndex = 0;
  startLineCalculation();
});

/* =========================================
   OPERATIONS POSEES
========================================= */

function digitArray(number, length = 1) {
  return String(Math.abs(number)).padStart(length, "0").split("").map(Number);
}

function renderDigitInputs(number, idPrefix) {
  const digits = digitArray(number);
  return `
    <div class="posed-digits">
      ${digits.map((digit, index) => `
        <div class="posed-cell">
          <input
            type="number"
            inputmode="numeric"
            min="0"
            max="9"
            maxlength="1"
            class="digit-answer"
            data-digit="${index}"
            aria-label="Chiffre ${index + 1}"
          >
        </div>
      `).join("")}
    </div>
  `;
}

function startLineCalculation() {
  const list = selectedProducts();

  if (state.calculationIndex >= list.length) {
    renderInvoice();
    showScreen("invoice");
    return;
  }

  const product = list[state.calculationIndex];
  const quantity = state.cart[product.id];
  const total = expectedLineTotal(product);

  currentExercise = {
    type: "multiplication",
    product,
    quantity,
    answer: total
  };

  $("calculation-progress").textContent =
    `Calcul ${state.calculationIndex + 1} sur ${list.length}`;

  $("calculation-product").innerHTML = `
    <h3>${product.emoji} ${product.name}</h3>
    <p>${quantity} bonbon(s) à ${euros(product.price)} pièce.</p>
    <strong>Pose la multiplication :</strong>
  `;

  $("calculation-instruction").textContent =
    "Multiplie le prix par la quantité. Complète le résultat chiffre par chiffre.";

  renderMultiplicationWork(product.price, quantity, total);

  setFeedback("calculation-feedback", "");
  showScreen("calculations");
}

function renderMultiplicationWork(price, quantity, answer) {
  const priceText = euros(price).replace(" €", "");
  const answerText = euros(answer).replace(" €", "");

  $("calculation-work").innerHTML = `
    <div class="posed-operation">
      <div class="posed-label">Prix unitaire</div>
      <div class="posed-number">${priceText} €</div>
      <div class="posed-number">× ${quantity}</div>
      <div class="posed-rule"></div>
      <div class="posed-answer">
        ${answerText.split("").map((char, index) => {
          if (char === ",") return `<span class="comma">,</span>`;
          return `<input class="answer-digit" data-answer="${index}"
            type="number" inputmode="numeric" min="0" max="9"
            aria-label="Chiffre du résultat">`;
        }).join("")}
        <span>€</span>
      </div>
    </div>
    <p class="carry-note">N'oublie pas les retenues ! Elles font partie du calcul.</p>
  `;
}

function readAnswer(id) {
  const inputs = document.querySelectorAll(`#${id} .answer-digit`);
  let text = "";

  inputs.forEach(input => {
    text += input.value.trim();
  });

  return text;
}

function readMoneyAnswer(id) {
  const text = readAnswer(id);
  const clean = text.replace(/^0+/, "") || "0";
  return Number(clean);
}

function checkDigitAnswer(containerId, expected) {
  const inputs = document.querySelectorAll(
    `#${containerId} .answer-digit`
  );

  // On conserve uniquement les chiffres.
  // La virgule est déjà représentée visuellement.
  const expectedDigits = String(expected)
    .padStart(1, "0")
    .split("")
    .filter(char => /[0-9]/.test(char));

  if (inputs.length !== expectedDigits.length) {
    return false;
  }

  let correct = true;

  inputs.forEach((input, index) => {
    const entered = input.value.trim();
    const expectedDigit = expectedDigits[index];

    if (entered !== expectedDigit) {
      input.classList.add("wrong");
      correct = false;
    } else {
      input.classList.remove("wrong");
    }
  });

  return correct;
}

/* =========================================
   FACTURE ET ADDITION
========================================= */

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

  renderAdditionWork();
}

function renderAdditionWork() {
  const values = state.lineResults.map(line => line.total);
  const answer = state.total;

  $("invoice-work").innerHTML = `
    <div class="posed-operation">
      ${values.map(value => `
        <div class="posed-number">${euros(value).replace(" €", "")}</div>
      `).join("")}
      <div class="posed-rule"></div>
      <div class="posed-answer">
        ${euros(answer).replace(" €", "").split("").map((char, index) => {
          if (char === ",") return `<span class="comma">,</span>`;
          return `<input class="answer-digit" data-answer="${index}"
            type="number" inputmode="numeric" min="0" max="9">`;
        }).join("")}
        <span>€</span>
      </div>
    </div>
    <p>Pose l'addition en alignant les virgules.</p>
  `;
}

$("check-invoice").addEventListener("click", () => {
  if (!checkDigitAnswer("invoice-work", state.total)) {
    setFeedback(
      "invoice-feedback",
      "Ce n'est pas encore le bon résultat. Vérifie les colonnes et les retenues.",
      "error"
    );
    return;
  }

  setFeedback(
    "invoice-feedback",
    "Facture validée ! Le client peut payer ! 🎉",
    "success"
  );

  $("amount-due").textContent = euros(state.total);
  renderCustomerWallet();
  showScreen("register");
});

$("invoice-hint").addEventListener("click", () => {
  setFeedback(
    "invoice-feedback",
    "Indice : additionne les centimes entre eux, puis les euros. N'oublie pas les retenues !"
  );
});

/* =========================================
   PORTE-MONNAIE DU CLIENT
========================================= */

function renderCustomerWallet() {
  walletSelections = {};
  $("customer-wallet").innerHTML = "";

  moneyValues.forEach((money, index) => {
    const button = document.createElement("button");
    button.className = "money-item";
    button.textContent = money.label;
    button.type = "button";

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
  state.customerPayment = moneyValues.reduce((sum, money, index) => {
    return sum + money.value * (walletSelections[index] || 0);
  }, 0);

  $("payment-total").textContent =
    `Le client donne : ${euros(state.customerPayment)}`;
}

$("check-payment").addEventListener("click", () => {
  if (state.customerPayment < state.total) {
    $("payment-total").textContent =
      "Il manque de l'argent pour régler la commande. Le client doit compléter.";
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

/* =========================================
   MONNAIE A RENDRE
========================================= */

function renderChangeProblem() {
  $("change-problem").innerHTML = `
    <p>Montant de la facture : <strong>${euros(state.total)}</strong></p>
    <p>Le client donne : <strong>${euros(state.customerPayment)}</strong></p>
    <h3>Combien dois-tu lui rendre ?</h3>
  `;

  $("change-work").innerHTML = `
    <div class="posed-operation">
      <div class="posed-number">${euros(state.customerPayment).replace(" €", "")}</div>
      <div class="posed-number">− ${euros(state.total).replace(" €", "")}</div>
      <div class="posed-rule"></div>
      <div class="posed-answer">
        ${euros(state.change).replace(" €", "").split("").map((char, index) => {
          if (char === ",") return `<span class="comma">,</span>`;
          return `<input class="answer-digit" data-answer="${index}"
            type="number" inputmode="numeric" min="0" max="9">`;
        }).join("")}
        <span>€</span>
      </div>
    </div>
    <p>Pose la soustraction. Pense aux emprunts !</p>
  `;
}

$("check-change-calculation").addEventListener("click", () => {
  if (!checkDigitAnswer("change-work", state.change)) {
    setFeedback(
      "change-feedback",
      "Réessaie ! Attention aux emprunts dans la soustraction.",
      "error"
    );
    return;
  }

  setFeedback(
    "change-feedback",
    "Bravo ! Tu as trouvé la monnaie à rendre ! ⭐",
    "success"
  );

  $("change-wallet").classList.remove("hidden");
  renderChangeWallet();
});

$("change-hint").addEventListener("click", () => {
  setFeedback(
    "change-feedback",
    "Indice : tu peux compter de la somme de la facture jusqu'au billet donné."
  );
});

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
  state.changeComposition = moneyValues.reduce((sum, money, index) => {
    return sum + money.value * (changeSelections[index] || 0);
  }, 0);

  $("change-composition-total").textContent =
    `Monnaie préparée : ${euros(state.changeComposition)}`;
}

$("check-change-composition").addEventListener("click", () => {
  if (state.changeComposition !== state.change) {
    $("change-composition-total").textContent =
      "Ce n'est pas encore la bonne somme. Réessaie !";
    return;
  }

  finishSale();
});

/* =========================================
   FIN DE VENTE ET BILAN
========================================= */

function finishSale() {
  state.report.revenue += state.total;
  state.report.received += state.customerPayment;
  state.report.returned += state.change;
  state.report.customers++;
  state.report.items += selectedCount();

  $("change-wallet").classList.add("hidden");
  showScreen("result");
}

$("next-customer").addEventListener("click", () => {
  state.cart = {};
  state.lineResults = [];
  state.calculationIndex = 0;
  renderCatalog();
  showScreen("catalog");
});

$("finish-shop").addEventListener("click", () => {
  renderDailyReport();
  showScreen("daily-report");
});

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

  renderCatalog();
  showScreen("home");
});

/* =========================================
   INITIALISATION
========================================= */

updateStars();
showScreen("home");
