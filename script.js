
const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "fintrack_transactions_v1";
const categories = {
  income: ["Salary", "Business", "Freelance", "Gift", "Other"],
  expense: [
    "Food", "Transport", "Education",
    "Shopping", "Bills", "Health", "Other"
  ]
};

let transactions = loadTransactions();
let editingId = null;
let toastTimer;

const dialog = $("transactionDialog");
const form = $("transactionForm");

function today() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000)
    .toISOString().slice(0, 10);
}

function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === date;
}

function loadTransactions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const data = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(data)) return [];

    return data.filter((t) =>
      t &&
      typeof t.id === "string" &&
      typeof t.description === "string" &&
      ["income", "expense"].includes(t.type) &&
      typeof t.category === "string" &&
      Number.isFinite(t.amount) &&
      t.amount > 0 &&
      t.amount <= 1000000000 &&
      validDate(t.date) &&
      categories[t.type].includes(t.category)
    );
  } catch {
    return [];
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(transactions)
    );
    return true;
  } catch {
    showToast("Could not save data in this browser.");
    return false;
  }
}

function money(amount) {
  return "Rs. " + amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    $("toast").classList.remove("show");
  }, 2500);
}

function updateCategories(selected = "") {
  const type = $("type").value;
  $("category").innerHTML = categories[type]
    .map((c) =>
      `<option value="${c}" ${c === selected ? "selected" : ""}>${c}</option>`
    ).join("");
}

$("type").addEventListener("change", () => updateCategories());

function render() {
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  $("income").textContent = money(income);
  $("expenses").textContent = money(expenses);
  $("balance").textContent = money(income - expenses);
  $("transactionCount").textContent = transactions.length;

  const total = income + expenses;
  $("incomeShare").textContent =
    total ? Math.round(income / total * 100) + "%" : "0%";
  $("expenseShare").textContent =
    total ? Math.round(expenses / total * 100) + "%" : "0%";

  renderChart(income, expenses);
  renderTransactions();
}

function renderChart(income, expenses) {
  const max = Math.max(income, expenses);

  if (max === 0) {
    $("chart").innerHTML =
      '<p class="chart-placeholder">Add transactions to see your chart.</p>';
    return;
  }

  const incomeHeight = income / max * 140;
  const expenseHeight = expenses / max * 140;

  $("chart").innerHTML = `
    <div class="bar-group">
      <strong>${money(income)}</strong>
      <div class="bar income-bar"
        style="height:${Math.max(incomeHeight, 3)}px"></div>
      <span class="bar-label">Income</span>
    </div>
    <div class="bar-group">
      <strong>${money(expenses)}</strong>
      <div class="bar expense-bar"
        style="height:${Math.max(expenseHeight, 3)}px"></div>
      <span class="bar-label">Expenses</span>
    </div>
  `;
}

function renderTransactions() {
  const filter = $("typeFilter").value;

  const filtered = transactions
    .filter((t) => filter === "all" || t.type === filter)
    .sort((a, b) =>
      b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
    );

  $("transactionList").innerHTML = filtered.map((t) => `
    <tr>
      <td><strong>${escapeHTML(t.description)}</strong></td>
      <td>${escapeHTML(t.category)}</td>
      <td>${escapeHTML(t.date)}</td>
      <td>
        <span class="type-badge type-${t.type}">
          ${t.type === "income" ? "Income" : "Expense"}
        </span>
      </td>
      <td class="${t.type === "income" ? "green" : "red"}">
        ${t.type === "income" ? "+" : "−"}${money(t.amount)}
      </td>
      <td>
        <button class="action-btn"
          data-action="edit" data-id="${t.id}">Edit</button>
        <button class="action-btn delete"
          data-action="delete" data-id="${t.id}">Delete</button>
      </td>
    </tr>
  `).join("");

  $("emptyMessage").hidden = filtered.length > 0;
}

function resetForm() {
  form.reset();
  editingId = null;
  $("dialogTitle").textContent = "Add Transaction";
  $("formError").textContent = "";
  $("date").value = today();
  updateCategories();
}

function openAddDialog() {
  resetForm();
  dialog.showModal();
  $("description").focus();
}

function openEditDialog(id) {
  const t = transactions.find((item) => item.id === id);
  if (!t) return;

  resetForm();
  editingId = id;
  $("dialogTitle").textContent = "Edit Transaction";
  $("description").value = t.description;
  $("amount").value = t.amount;
  $("type").value = t.type;
  updateCategories(t.category);
  $("date").value = t.date;
  dialog.showModal();
}

$("addBtn").addEventListener("click", openAddDialog);
$("closeBtn").addEventListener("click", () => dialog.close());
$("cancelBtn").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", resetForm);
$("typeFilter").addEventListener("change", renderTransactions);

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const description = $("description").value.trim();
  const amount = Number($("amount").value);
  const type = $("type").value;
  const category = $("category").value;
  const date = $("date").value;

  if (!description || description.length > 100) {
    $("formError").textContent = "Enter a valid description.";
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0 ||
      amount > 1000000000) {
    $("formError").textContent = "Enter a valid amount.";
    return;
  }

  if (!categories[type] ||
      !categories[type].includes(category) ||
      !validDate(date)) {
    $("formError").textContent =
      "Please select valid transaction details.";
    return;
  }

  const previous = transactions.map((t) => ({ ...t }));

  if (editingId) {
    transactions = transactions.map((t) =>
      t.id === editingId
        ? { ...t, description, amount, type, category, date }
        : t
    );
  } else {
    transactions.push({
      id: crypto.randomUUID(),
      description,
      amount,
      type,
      category,
      date
    });
  }

  if (!saveTransactions()) {
    transactions = previous;
    return;
  }

  const wasEditing = Boolean(editingId);
  dialog.close();
  render();

  showToast(wasEditing
    ? "Transaction updated!"
    : "Transaction added!");
});

$("transactionList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  const transaction = transactions.find((t) => t.id === id);

  if (!transaction) return;

  if (action === "edit") {
    openEditDialog(id);
  }

  if (action === "delete") {
    if (!confirm(`Delete "${transaction.description}"?`)) return;

    const previous = transactions;
    transactions = transactions.filter((t) => t.id !== id);

    if (!saveTransactions()) {
      transactions = previous;
      return;
    }

    render();
    showToast("Transaction deleted.");
  }
});

resetForm();
render();
