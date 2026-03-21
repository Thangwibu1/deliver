const BASE_URL = "https://sample-delivery-system.vercel.app";

// ─────────────────────────────────────────────────────────
// DOM References
// ─────────────────────────────────────────────────────────
const shipmentIdInput = document.getElementById("shipmentId");
const mediaUrlsInput = document.getElementById("mediaUrls");
const connectionBadge = document.getElementById("connectionBadge");
const connectionText = document.getElementById("connectionText");
const eyewearApiInput = document.getElementById("eyewearApi");
const statusResult = document.getElementById("statusResult");
const toastContainer = document.getElementById("toastContainer");
const shipSimStatus = document.getElementById("shipSimStatus");

const btnReceive = document.getElementById("btnReceive");
const btnComplete = document.getElementById("btnComplete");
const btnFail = document.getElementById("btnFail");
const btnRefresh = document.getElementById("btnRefresh");
const btnPing = document.getElementById("btnPing");

const stats = {
  total: document.getElementById("statTotal"),
  delivering: document.getElementById("statDelivering"),
  completed: document.getElementById("statCompleted"),
};

// Shared shipment cache
let _shipsCache = [];

// ─────────────────────────────────────────────────────────
// Toast Notification System
// ─────────────────────────────────────────────────────────
const TOAST_ICONS = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" };

/**
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {string} title
 * @param {string} [message]
 */
const showToast = (type, title, message = "", duration = 4500) => {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${TOAST_ICONS[type]}</div>
    <div class="toast-content">
      <p class="toast-title">${title}</p>
      ${message ? `<p class="toast-message">${message}</p>` : ""}
    </div>`;
  toastContainer.appendChild(toast);

  const remove = () => {
    toast.classList.add("hiding");
    toast.addEventListener("animationend", () => toast.remove(), {
      once: true,
    });
  };
  const timer = setTimeout(remove, duration);
  toast.addEventListener("click", () => {
    clearTimeout(timer);
    remove();
  });
};

// ─────────────────────────────────────────────────────────
// SPA Navigation
// ─────────────────────────────────────────────────────────
const pages = document.querySelectorAll(".page-view");
const navItems = document.querySelectorAll(".nav-item[data-page]");

/**
 * Chuyển sang page tương ứng
 * @param {string} pageId  - ví dụ 'dashboard'
 */
const navigateTo = (pageId) => {
  // Hide all pages
  pages.forEach((p) => p.classList.remove("active"));
  // Deactivate nav items
  navItems.forEach((n) => n.classList.remove("active"));

  // Show selected page
  const target = document.getElementById(`page-${pageId}`);
  if (target) target.classList.add("active");

  // Highlight nav item
  const navEl = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navEl) navEl.classList.add("active");
};

// Bind nav items events
navItems.forEach((item) => {
  item.addEventListener("click", () => {
    navigateTo(item.dataset.page);
  });
});

// Logout = alert placeholder
const logoutBtn = document.getElementById("navLogout");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    showToast("info", "Logout", "Logout functionality is not configured.");
  });
}

// ─────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────
const toArray = (v) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const renderResult = (data) => {
  if (!statusResult) return;
  statusResult.style.display = "block";
  statusResult.textContent =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
  setTimeout(() => (statusResult.style.display = "none"), 12000);
};

const setConnectionStatus = (status, message) => {
  if (connectionText) connectionText.textContent = message;
  if (connectionBadge) connectionBadge.className = `pulse ${status}`;
  if (shipSimStatus) {
    shipSimStatus.textContent =
      status === "ok"
        ? "🟢 Ready"
        : status === "fail"
          ? "🔴 Offline"
          : "⏳ Checking...";
  }
};

const setLoading = (btn, isLoading) => {
  if (!btn) return;
  btn.disabled = isLoading;
  if (isLoading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Processing...';
  } else if (btn.dataset.originalText) {
    btn.innerHTML = btn.dataset.originalText;
  }
};

const animateCounter = (el, targetValue) => {
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const end = parseInt(targetValue) || 0;
  if (start === end) {
    el.textContent = end;
    return;
  }
  const duration = 600;
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min((now - t0) / duration, 1);
    const ep = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (end - start) * ep);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const copyText = async (text) => {
  if (!text) throw new Error("Nothing to copy");

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
};

// ─────────────────────────────────────────────────────────
// API Helper
// ─────────────────────────────────────────────────────────
const request = async (baseUrl, path, options = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json")
    ? await res.json()
    : await res.text();
  if (!res.ok)
    throw new Error(
      data?.message || (typeof data === "string" ? data : "Request failed"),
    );
  return data;
};

// ─────────────────────────────────────────────────────────
// Business Logic — Ping
// ─────────────────────────────────────────────────────────
const pingServer = async () => {
  setConnectionStatus("pending", "Connecting...");
  try {
    await request(BASE_URL, "/");
    setConnectionStatus("ok", "ShipSim Ready");
    showToast(
      "success",
      "Connected",
      "ShipSim API is running normally.",
    );
  } catch {
    setConnectionStatus("fail", "ShipSim Offline");
    showToast("error", "Connection Lost", "Cannot connect to ShipSim API.");
  }
};

// ─────────────────────────────────────────────────────────
// Business Logic — Load Shipments
// ─────────────────────────────────────────────────────────
const updateMetrics = (list) => {
  animateCounter(stats.total, list.length);
  animateCounter(
    stats.delivering,
    list.filter((s) => s.status === "delivering").length,
  );
  animateCounter(
    stats.completed,
    list.filter((s) => s.status === "completed").length,
  );
};

/** Build a ship card element */
const buildShipCard = (ship, onClickCb) => {
  const item = document.createElement("div");
  const statusCls = (ship.status || "pending").toLowerCase();
  const createdAt = ship.createdAt
    ? new Date(ship.createdAt).toLocaleString("en-US", { dateStyle: 'medium', timeStyle: 'short' })
    : "—";

  item.className = `ship-item is-${statusCls}`;
  item.onclick = onClickCb;
  item.innerHTML = `
    <div class="ship-item-header">
      <div class="ship-id-row">
        <span class="ship-id" title="${ship._id}">ID: ${ship._id}</span>
        <button class="ship-copy-btn" type="button" data-copy-id="${ship._id}" title="Copy full shipment ID">Copy</button>
      </div>
      <span class="status-tag ${statusCls}">${ship.status || "pending"}</span>
    </div>
    <div class="ship-invoice">Invoice: ${ship.invoiceId || "N/A"}</div>
    <p class="ship-address">📍 ${ship.shipAddress || "No address provided"}</p>
    <div class="ship-footer">
      <span class="ship-date">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        ${createdAt}
      </span>
      <span class="ship-cost">$ ${Number(ship.shipCost ?? 0).toLocaleString("en-US")}</span>
    </div>`;

  const copyBtn = item.querySelector(".ship-copy-btn");
  copyBtn?.addEventListener("click", async (event) => {
    event.stopPropagation();
    try {
      await copyText(ship._id);
      showToast("success", "Copied", "Shipment ID copied to clipboard.");
    } catch {
      showToast("error", "Copy Failed", "Unable to copy shipment ID.");
    }
  });

  return item;
};

const SORT_ORDER = { pending: 0, delivering: 1, completed: 2, failed: 3 };

/**
 * Load and render ship list
 */
const loadShips = async () => {
  const shipList = document.getElementById("shipList");
  if (!shipList) return;
  try {
    setLoading(btnRefresh, true);
    const data = await request(BASE_URL, "/ships");

    _shipsCache = data.data || [];
    updateMetrics(_shipsCache);
    shipList.innerHTML = "";

    if (_shipsCache.length === 0) {
      shipList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <h3>No shipments found</h3>
          <p>The system has not recorded any orders yet.</p>
        </div>`;
      return;
    }

    const sorted = [..._shipsCache].sort(
      (a, b) => (SORT_ORDER[a.status] ?? 4) - (SORT_ORDER[b.status] ?? 4),
    );

    sorted.forEach((ship) => {
      const card = buildShipCard(ship, () => {
        shipmentIdInput.value = ship._id;
        shipmentIdInput.focus();
        // Highlight
        shipmentIdInput.style.boxShadow = "0 0 0 3px rgba(74,215,176,.35)";
        shipmentIdInput.style.borderColor = "var(--mint-500)";
        setTimeout(() => {
          shipmentIdInput.style.boxShadow = "";
          shipmentIdInput.style.borderColor = "";
        }, 1800);
      });
      shipList.appendChild(card);
    });
  } catch (err) {
    if (shipList)
      shipList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Loading Error</h3>
        <p>${err.message}</p>
      </div>`;
    showToast("error", "Shipments Loading Error", err.message);
  } finally {
    setLoading(btnRefresh, false);
  }
};

// ─────────────────────────────────────────────────────────
// Core Business Logic — Double Update
// ─────────────────────────────────────────────────────────
/**
 * Update both:
 *  1. Mock Shipping System (ShipSim)
 *  2. EyeWear Backend (Webhook simulation)
 */
const performDoubleUpdate = async (type, shipId, media, btn) => {
  setLoading(btn, true);
  try {
    let ship = _shipsCache.find((s) => s._id === shipId);
    if (!ship) {
      const listData = await request(BASE_URL, "/ships");
      _shipsCache = listData.data || [];
      ship = _shipsCache.find((s) => s._id === shipId);
      if (!ship)
        throw new Error("Shipment ID not found in the list.");
    }

    const invoiceId = ship.invoiceId;
    const eyewearApiBase = eyewearApiInput?.value?.trim();

    let mockPath = "";
    let mockBody = {};
    let eyewearPath = "";

    switch (type) {
      case "receive":
        mockPath = `/mark-receive/${shipId}`;
        mockBody = { senderUrlMedia: media };
        eyewearPath = `/${invoiceId}/status/delivering`;
        break;
      case "complete":
        mockPath = `/mark-complete/${shipId}`;
        mockBody = { receiverUrlMedia: media };
        eyewearPath = `/${invoiceId}/status/delivered`;
        break;
      case "fail":
        mockPath = `/mark-fail/${shipId}`;
        mockBody = { receiverUrlMedia: media };
        eyewearPath = `/${invoiceId}/status/failed`;
        break;
      default:
        throw new Error("Unknown action type: " + type);
    }

    // ── Step 1: Update Mock ShipSim ─────────────────
    console.log(`[ShipSim] ${mockPath}`);
    const mockRes = await request(BASE_URL, mockPath, {
      method: "POST",
      body: JSON.stringify(mockBody),
    });

    // ── Step 2: Notify EyeWear Backend ──────────────
    const labels = {
      receive: "Mark Received Successful",
      complete: "Delivery Successful",
      fail: "Delivery Failed",
    };
    if (invoiceId && eyewearApiBase) {
      try {
        console.log(`[EyeWear] PATCH ${eyewearApiBase}${eyewearPath}`);
        await request(eyewearApiBase, eyewearPath, { method: "PATCH" });
        showToast(
          type === "fail" ? "warning" : "success",
          labels[type],
          `Invoice ${invoiceId} has been synced to both systems.`,
        );
        renderResult({ success: true, note: "Both systems synced", mockRes });
      } catch (err) {
        showToast(
          "warning",
          "Partial Update",
          `ShipSim OK, EyeWear Error: ${err.message}`,
        );
        renderResult({
          success: true,
          note: "Mock OK – EyeWear Error: " + err.message,
          mockRes,
        });
      }
    } else {
      showToast(
        "info",
        labels[type],
        "No EyeWear URL — only updated ShipSim.",
      );
      renderResult(mockRes);
    }

    await loadShips();
  } catch (err) {
    showToast("error", "Update Error", err.message);
    renderResult({ success: false, message: err.message });
  } finally {
    setLoading(btn, false);
  }
};

// ─────────────────────────────────────────────────────────
// Event Listeners — Dashboard Buttons
// ─────────────────────────────────────────────────────────
btnReceive?.addEventListener("click", () => {
  const id = shipmentIdInput?.value.trim();
  if (!id) {
    showToast("warning", "Missing Shipment ID", "Please enter or select a shipment.");
    return;
  }
  performDoubleUpdate(
    "receive",
    id,
    toArray(mediaUrlsInput?.value || ""),
    btnReceive,
  );
});

btnComplete?.addEventListener("click", () => {
  const id = shipmentIdInput?.value.trim();
  if (!id) {
    showToast("warning", "Missing Shipment ID", "Please enter or select a shipment.");
    return;
  }
  performDoubleUpdate(
    "complete",
    id,
    toArray(mediaUrlsInput?.value || ""),
    btnComplete,
  );
});

btnFail?.addEventListener("click", () => {
  const id = shipmentIdInput?.value.trim();
  if (!id) {
    showToast("warning", "Missing Shipment ID", "Please enter or select a shipment.");
    return;
  }
  performDoubleUpdate(
    "fail",
    id,
    toArray(mediaUrlsInput?.value || ""),
    btnFail,
  );
});

btnRefresh?.addEventListener("click", () => {
  loadShips();
  showToast(
    "info",
    "Refreshing...",
    "Shipment list is being updated.",
  );
});

btnPing?.addEventListener("click", pingServer);

// ─────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────
navigateTo("dashboard");
pingServer();
loadShips();

// Auto-refresh every 20s
setInterval(loadShips, 20_000);
