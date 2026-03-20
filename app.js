const BASE_URL = "https://sample-delivery-system.vercel.app";

const statusResult = document.getElementById("statusResult");
const shipList = document.getElementById("shipList");

const shipmentIdInput = document.getElementById("shipmentId");
const mediaUrlsInput = document.getElementById("mediaUrls");

const btnReceive = document.getElementById("btnReceive");
const btnComplete = document.getElementById("btnComplete");
const btnFail = document.getElementById("btnFail");
const btnRefresh = document.getElementById("btnRefresh");
const btnPing = document.getElementById("btnPing");
const connectionStatus = document.getElementById("connectionStatus");

const toArray = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const renderResult = (element, data) => {
  element.textContent = JSON.stringify(data, null, 2);
};

const setConnectionStatus = (status, message) => {
  connectionStatus.textContent = message;
  connectionStatus.className = `status ${status}`;
};

const setLoading = (button, isLoading) => {
  if (!button) return;
  button.disabled = isLoading;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = "Đang xử lý...";
  } else if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
  }
};

const request = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof data === "string" ? data : data.message;
    throw new Error(message || "Request failed");
  }
  return data;
};

const pingServer = async () => {
  setConnectionStatus("pending", "Đang kiểm tra...");
  setLoading(btnPing, true);
  try {
    await request("/");
    setConnectionStatus("ok", "Kết nối OK");
  } catch (error) {
    setConnectionStatus("fail", "Không kết nối được");
  } finally {
    setLoading(btnPing, false);
  }
};

const loadShips = async () => {
  try {
    setLoading(btnRefresh, true);
    const data = await request("/ships");
    shipList.innerHTML = "";

    if (!data.data || data.data.length === 0) {
      shipList.innerHTML = "<p>Chưa có shipment.</p>";
      return;
    }

    data.data.forEach((ship) => {
      const item = document.createElement("div");
      item.className = "ship-item";
      const statusClass = ship.status ? ship.status.toLowerCase() : "";
      const createdAt = ship.createdAt
        ? new Date(ship.createdAt).toLocaleString("vi-VN")
        : "-";
      item.innerHTML = `
        <span><strong>ID:</strong> ${ship._id}</span>
        <span><strong>Invoice:</strong> ${ship.invoiceId || "-"}</span>
        <span><strong>Địa chỉ giao:</strong> ${ship.shipAddress || "-"}</span>
        <span><strong>Phí vận chuyển:</strong> ${ship.shipCost ?? "-"}</span>
        <span><strong>Trạng thái:</strong> <span class="tag ${statusClass}">${ship.status || "-"}</span></span>
        <span class="meta"><strong>Ngày tạo:</strong> ${createdAt}</span>
      `;
      shipList.appendChild(item);
    });
  } catch (error) {
    shipList.innerHTML = `<p>Lỗi tải shipment: ${error.message}</p>`;
  } finally {
    setLoading(btnRefresh, false);
  }
};

const updateStatus = async (path, body, button) => {
  try {
    setLoading(button, true);
    const data = await request(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    renderResult(statusResult, data);
    await loadShips();
  } catch (error) {
    renderResult(statusResult, { success: false, message: error.message });
  } finally {
    setLoading(button, false);
  }
};

btnReceive.addEventListener("click", () => {
  const id = shipmentIdInput.value.trim();
  const senderUrlMedia = toArray(mediaUrlsInput.value);
  if (!id) {
    renderResult(statusResult, { success: false, message: "Vui lòng nhập shipment id" });
    return;
  }
  updateStatus(`/mark-receive/${id}`, { senderUrlMedia }, btnReceive);
});

btnComplete.addEventListener("click", () => {
  const id = shipmentIdInput.value.trim();
  const receiverUrlMedia = toArray(mediaUrlsInput.value);
  if (!id) {
    renderResult(statusResult, { success: false, message: "Vui lòng nhập shipment id" });
    return;
  }
  updateStatus(`/mark-complete/${id}`, { receiverUrlMedia }, btnComplete);
});

btnFail.addEventListener("click", () => {
  const id = shipmentIdInput.value.trim();
  const receiverUrlMedia = toArray(mediaUrlsInput.value);
  if (!id) {
    renderResult(statusResult, { success: false, message: "Vui lòng nhập shipment id" });
    return;
  }
  updateStatus(`/mark-fail/${id}`, { receiverUrlMedia }, btnFail);
});

btnRefresh.addEventListener("click", loadShips);
btnPing.addEventListener("click", pingServer);

pingServer();
loadShips();
