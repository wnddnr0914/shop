// TossPayments 결제위젯(v2) 공식 문서에 공개된 테스트 클라이언트 키입니다. (실결제 불가, 샌드박스 전용)
const TOSS_CLIENT_KEY = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";

const PRODUCTS = [
  { id: "p1", name: "오버사이즈 코튼 티셔츠", price: 19000, emoji: "👕" },
  { id: "p2", name: "데일리 와이드 데님", price: 49000, emoji: "👖" },
  { id: "p3", name: "경량 바람막이 자켓", price: 65000, emoji: "🧥" },
  { id: "p4", name: "니트 가디건", price: 39000, emoji: "🧶" },
  { id: "p5", name: "캔버스 스니커즈", price: 55000, emoji: "👟" },
  { id: "p6", name: "울 비니", price: 15000, emoji: "🧢" },
];

const cart = new Map(); // id -> qty

const productGrid = document.getElementById("product-grid");
const cartPanel = document.getElementById("cart-panel");
const cartToggle = document.getElementById("cart-toggle");
const overlay = document.getElementById("overlay");
const cartItemsEl = document.getElementById("cart-items");
const emptyCartEl = document.getElementById("empty-cart");
const cartCountEl = document.getElementById("cart-count");
const totalAmountEl = document.getElementById("total-amount");
const payBtn = document.getElementById("pay-btn");

function formatWon(n) {
  return n.toLocaleString("ko-KR") + "원";
}

function renderProducts() {
  productGrid.innerHTML = PRODUCTS.map(
    (p) => `
    <div class="product">
      <div class="thumb">${p.emoji}</div>
      <div class="info">
        <div class="name">${p.name}</div>
        <div class="price">${formatWon(p.price)}</div>
        <button data-id="${p.id}" class="add-btn">담기</button>
      </div>
    </div>
  `
  ).join("");
}

function getCartTotal() {
  let total = 0;
  for (const [id, qty] of cart) {
    const product = PRODUCTS.find((p) => p.id === id);
    total += product.price * qty;
  }
  return total;
}

function renderCart() {
  const entries = [...cart.entries()];
  cartCountEl.textContent = entries.reduce((sum, [, qty]) => sum + qty, 0);

  if (entries.length === 0) {
    cartItemsEl.innerHTML = "";
    emptyCartEl.style.display = "block";
    payBtn.disabled = true;
  } else {
    emptyCartEl.style.display = "none";
    payBtn.disabled = false;
    cartItemsEl.innerHTML = entries
      .map(([id, qty]) => {
        const product = PRODUCTS.find((p) => p.id === id);
        return `
        <div class="cart-item">
          <div>${product.emoji} ${product.name}<br/><small>${formatWon(product.price)}</small></div>
          <div class="qty-btns">
            <button data-id="${id}" data-delta="-1">-</button>
            <span style="margin:0 8px;">${qty}</span>
            <button data-id="${id}" data-delta="1">+</button>
          </div>
        </div>
      `;
      })
      .join("");
  }

  totalAmountEl.textContent = formatWon(getCartTotal());
  syncWidgets();
}

productGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".add-btn");
  if (!btn) return;
  const id = btn.dataset.id;
  cart.set(id, (cart.get(id) || 0) + 1);
  renderCart();
  openCart();
});

cartItemsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-delta]");
  if (!btn) return;
  const id = btn.dataset.id;
  const delta = Number(btn.dataset.delta);
  const newQty = (cart.get(id) || 0) + delta;
  if (newQty <= 0) {
    cart.delete(id);
  } else {
    cart.set(id, newQty);
  }
  renderCart();
});

function openCart() {
  cartPanel.classList.add("open");
  overlay.classList.add("open");
}
function closeCart() {
  cartPanel.classList.remove("open");
  overlay.classList.remove("open");
}
cartToggle.addEventListener("click", () => {
  cartPanel.classList.contains("open") ? closeCart() : openCart();
});
overlay.addEventListener("click", closeCart);

// ---- TossPayments 결제위젯 ----
let widgets = null;
let widgetsReady = null; // renderPaymentMethods/renderAgreement 완료를 추적하는 Promise

// 금액을 먼저 설정(setAmount)한 뒤에 결제수단/약관 UI를 렌더링해야 한다.
// 순서를 반대로 하면 "결제금액이 설정되지 않았습니다" 오류가 발생한다.
async function initWidgets(amount) {
  const tossPayments = TossPayments(TOSS_CLIENT_KEY);
  // 비회원 결제 (customerKey 익명)
  widgets = tossPayments.widgets({ customerKey: TossPayments.ANONYMOUS });

  await widgets.setAmount({ currency: "KRW", value: amount });

  widgetsReady = Promise.all([
    widgets.renderPaymentMethods({
      selector: "#payment-method",
      variantKey: "DEFAULT",
    }),
    widgets.renderAgreement({
      selector: "#agreement",
      variantKey: "AGREEMENT",
    }),
  ]);
  await widgetsReady;
}

// 장바구니 금액이 바뀔 때마다 결제위젯을 미리 렌더링/갱신해서,
// 결제 버튼을 누르기 전에 결제수단 선택과 약관 동의가 가능하게 한다.
async function syncWidgets() {
  const amount = getCartTotal();
  if (amount <= 0) return;

  if (!widgets) {
    await initWidgets(amount);
  } else {
    await widgetsReady;
    await widgets.setAmount({ currency: "KRW", value: amount });
  }
}

payBtn.addEventListener("click", async () => {
  const amount = getCartTotal();
  if (amount <= 0) return;

  payBtn.disabled = true;
  payBtn.textContent = "결제 요청 중...";

  try {
    await syncWidgets();

    const orderId = "order-" + Date.now();
    const orderName =
      [...cart.keys()]
        .map((id) => PRODUCTS.find((p) => p.id === id).name)
        .slice(0, 2)
        .join(", ") + (cart.size > 2 ? ` 외 ${cart.size - 2}건` : "");

    await widgets.requestPayment({
      orderId,
      orderName,
      successUrl: `${window.location.origin}/success.html`,
      failUrl: `${window.location.origin}/fail.html`,
    });
  } catch (err) {
    if (err.code !== "USER_CANCEL") {
      alert("결제 요청 중 오류가 발생했습니다: " + err.message);
    }
  } finally {
    payBtn.disabled = false;
    payBtn.textContent = "결제하기";
  }
});

renderProducts();
renderCart();
