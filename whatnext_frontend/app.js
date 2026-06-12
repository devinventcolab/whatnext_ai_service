const storage = {
  access: "whatnext_access_token",
  refresh: "whatnext_refresh_token",
  apiBase: "whatnext_api_base",
  socketBase: "whatnext_socket_base",
};

const els = {
  apiBase: document.getElementById("apiBase"),
  socketBase: document.getElementById("socketBase"),
  debug: document.getElementById("debug"),
  authState: document.getElementById("authState"),
  socketState: document.getElementById("socketState"),
  assistantTranscript: document.getElementById("assistantTranscript"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  displayName: document.getElementById("displayName"),
  deviceId: document.getElementById("deviceId"),
  taskTitle: document.getElementById("taskTitle"),
  taskDescription: document.getElementById("taskDescription"),
  taskPriority: document.getElementById("taskPriority"),
  taskStatus: document.getElementById("taskStatus"),
  taskDueDate: document.getElementById("taskDueDate"),
  tasks: document.getElementById("tasks"),
};

let socket = null;
let mediaStream = null;
let audioContext = null;
let sourceNode = null;
let processorNode = null;

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures (private mode / restricted contexts)
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures
  }
}

function getToken(type) {
  return safeStorageGet(type) || "";
}

function setTokens(payload) {
  if (payload.accessToken) safeStorageSet(storage.access, payload.accessToken);
  if (payload.refreshToken) safeStorageSet(storage.refresh, payload.refreshToken);
  updateAuthState();
}

function clearTokens() {
  safeStorageRemove(storage.access);
  safeStorageRemove(storage.refresh);
  updateAuthState();
}

function updateAuthState() {
  const hasAccess = !!getToken(storage.access);
  els.authState.textContent = "Access token: " + (hasAccess ? "present" : "missing");
}

function apiBase() {
  return (els.apiBase.value || "http://localhost:8980/api/v1").replace(/\/$/, "");
}

function socketBase() {
  return (els.socketBase.value || "http://localhost:8980").replace(/\/$/, "");
}

function setBackendOrigin(origin) {
  const clean = origin.replace(/\/$/, "");
  els.apiBase.value = `${clean}/api/v1`;
  els.socketBase.value = clean;
  safeStorageSet(storage.apiBase, els.apiBase.value);
  safeStorageSet(storage.socketBase, els.socketBase.value);
}

function headers() {
  const token = getToken(storage.access);
  const out = { "Content-Type": "application/json" };
  if (token) out.Authorization = "Bearer " + token;
  return out;
}

function logDebug(data) {
  els.debug.textContent = JSON.stringify(data, null, 2);
}

async function api(path, options = {}) {
  const url = apiBase() + path;
  const init = {
    method: options.method || "GET",
    headers: headers(),
  };
  if (options.body) init.body = JSON.stringify(options.body);
  logDebug({
    request: { url, method: init.method, body: options.body || null },
    status: "pending",
  });
  let response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    logDebug({
      request: { url, method: init.method, body: options.body || null },
      networkError: error?.message || String(error),
      hint: "Check backend URL, backend running port, and CORS APP_ORIGIN.",
    });
    throw new Error(
      `Network error for ${url}. Check backend port and CORS settings.`,
    );
  }
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  logDebug({
    request: { url, method: init.method, body: options.body || null },
    response: { status: response.status, payload },
  });
  if (!response.ok) throw new Error(payload?.message || "Request failed");
  return payload;
}

function authInput() {
  return {
    email: els.email.value.trim(),
    password: els.password.value,
    displayName: els.displayName.value.trim() || undefined,
    deviceId: els.deviceId.value.trim() || undefined,
  };
}

function taskInput() {
  const dueDateRaw = els.taskDueDate.value;
  return {
    title: els.taskTitle.value.trim(),
    description: els.taskDescription.value.trim() || undefined,
    priority: els.taskPriority.value,
    status: els.taskStatus.value,
    dueDate: dueDateRaw ? new Date(dueDateRaw).toISOString() : undefined,
  };
}

function appendTranscript(text) {
  const current = els.assistantTranscript.value;
  els.assistantTranscript.value = (current ? current + "\n" : "") + text;
  els.assistantTranscript.scrollTop = els.assistantTranscript.scrollHeight;
}

function waitForSocketEvent(eventName, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error("Socket not initialized"));
      return;
    }

    const timer = window.setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    function onEvent(payload) {
      window.clearTimeout(timer);
      resolve(payload);
    }

    socket.once(eventName, onEvent);
  });
}

function playAssistantAudio(payload) {
  let bytes = null;
  if (payload instanceof ArrayBuffer) {
    bytes = new Uint8Array(payload);
  } else if (payload instanceof Uint8Array) {
    bytes = payload;
  } else if (payload && payload.type === "Buffer" && Array.isArray(payload.data)) {
    bytes = new Uint8Array(payload.data);
  }
  if (!bytes || !bytes.byteLength) return;

  const blob = new Blob([bytes], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play().catch(() => {});
  audio.onended = () => URL.revokeObjectURL(url);
}

function downsampleTo16k(input, fromSampleRate) {
  if (fromSampleRate === 16000) return input;
  const ratio = fromSampleRate / 16000;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < output.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i += 1) {
      accum += input[i];
      count += 1;
    }
    output[offsetResult] = accum / count;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }
  return output;
}

function floatTo16BitPCM(input) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

async function startMicStreaming() {
  if (!socket || !socket.connected) throw new Error("Socket not connected");
  if (processorNode) return;
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  sourceNode = audioContext.createMediaStreamSource(mediaStream);
  processorNode = audioContext.createScriptProcessor(4096, 1, 1);
  sourceNode.connect(processorNode);
  processorNode.connect(audioContext.destination);

  processorNode.onaudioprocess = (event) => {
    if (!socket || !socket.connected) return;
    const floatData = event.inputBuffer.getChannelData(0);
    const downsampled = downsampleTo16k(floatData, audioContext.sampleRate);
    const pcm16 = floatTo16BitPCM(downsampled);
    socket.emit("voice:audio", pcm16.buffer);
  };

  appendTranscript("[mic] streaming started");
}

function stopMicStreaming() {
  if (processorNode) {
    processorNode.disconnect();
    processorNode.onaudioprocess = null;
    processorNode = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
}

function connectSocket() {
  if (socket?.connected) return Promise.resolve(socket);
  const token = getToken(storage.access);
  if (!token) throw new Error("Login first to get access token");
  if (typeof io !== "function") {
    throw new Error(
      "Socket.IO client did not load. Hard refresh the page or restart the frontend server.",
    );
  }
  socket = io(socketBase(), {
    auth: { token },
    transports: ["websocket", "polling"],
    timeout: 8000,
  });

  const connected = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Socket connection timed out"));
    }, 9000);

    socket.once("connect", () => {
      window.clearTimeout(timeout);
      els.socketState.textContent = "Socket: connected";
      appendTranscript(`[socket] connected (${socket.id})`);
      resolve(socket);
    });

    socket.once("connect_error", (error) => {
      window.clearTimeout(timeout);
      reject(error);
    });
  });

  socket.on("disconnect", () => {
    els.socketState.textContent = "Socket: disconnected";
    appendTranscript("[socket] disconnected");
    stopMicStreaming();
  });
  socket.on("connect_error", (error) => {
    appendTranscript("[socket error] " + error.message);
  });
  socket.on("voice:ready", (data) => appendTranscript("[voice:ready] " + JSON.stringify(data)));
  socket.on("voice:pong", (data) => appendTranscript("[voice:pong] " + JSON.stringify(data)));
  socket.on("voice:error", (data) => appendTranscript("[voice:error] " + (data?.message || "unknown")));
  socket.on("voice:closed", () => appendTranscript("[voice:closed]"));
  socket.on("transcript:partial", (data) => appendTranscript("partial: " + data.text));
  socket.on("transcript:final", (data) => appendTranscript("final: " + data.text));
  socket.on("assistant:text", (data) => appendTranscript("assistant: " + data.text));
  socket.on("assistant:audio", (data) => playAssistantAudio(data));

  return connected;
}

function disconnectSocket() {
  stopMicStreaming();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  els.socketState.textContent = "Socket: disconnected";
}

async function loadTasks() {
  const response = await api("/tasks?page=1&limit=50");
  const items = response?.items || [];
  if (!items.length) {
    els.tasks.innerHTML = "<p>No tasks found.</p>";
    return;
  }
  els.tasks.innerHTML = "";
  items.forEach((task) => {
    const div = document.createElement("div");
    div.className = "task";
    div.innerHTML = `
      <h3>${task.title}</h3>
      <p>Status: ${task.status || "todo"}</p>
      <p>Priority: ${task.priority || "medium"}</p>
      <p>Description: ${task.description || "-"}</p>
      <div class="row">
        <button data-action="mark-done" data-id="${task._id}">Mark Done</button>
        <button data-action="delete" data-id="${task._id}" class="danger">Delete</button>
      </div>
    `;
    els.tasks.appendChild(div);
  });
}

async function createTask() {
  await api("/tasks", { method: "POST", body: taskInput() });
  await loadTasks();
}

async function updateTask(id, body) {
  await api(`/tasks/${id}`, { method: "PATCH", body });
  await loadTasks();
}

async function deleteTask(id) {
  await api(`/tasks/${id}`, { method: "DELETE" });
  await loadTasks();
}

async function ensureAuthForTesting() {
  if (getToken(storage.access)) return;

  if (!els.email.value.trim()) els.email.value = "test@example.com";
  if (!els.password.value) els.password.value = "password123";
  if (!els.displayName.value.trim()) els.displayName.value = "Test User";
  if (!els.deviceId.value.trim()) els.deviceId.value = "web-test-device";

  try {
    const payload = await api("/auth/register", {
      method: "POST",
      body: authInput(),
    });
    setTokens(payload);
    appendTranscript("[auth] registered test user");
  } catch (error) {
    if (!String(error.message).toLowerCase().includes("registered")) {
      throw error;
    }
    const payload = await api("/auth/login", {
      method: "POST",
      body: {
        email: els.email.value.trim(),
        password: els.password.value,
        deviceId: els.deviceId.value.trim() || undefined,
      },
    });
    setTokens(payload);
    appendTranscript("[auth] logged in existing test user");
  }
}

async function runFrontendSmokeTest() {
  appendTranscript("[smoke] starting");
  const apiUrl = new URL(apiBase());
  const healthUrl = apiUrl.origin + "/health";
  const health = await fetch(healthUrl).then((res) => res.json());
  appendTranscript("[smoke] health ok: " + JSON.stringify(health));

  await ensureAuthForTesting();
  await connectSocket();

  const pongPromise = waitForSocketEvent("voice:pong");
  socket.emit("voice:ping", { source: "frontend-smoke-test" });
  const pong = await pongPromise;
  appendTranscript("[smoke] voice:pong ok: " + JSON.stringify(pong));

  const readyPromise = waitForSocketEvent("voice:ready");
  socket.emit("voice:start", {
    deviceId: els.deviceId.value.trim() || "web-test-device",
  });
  const ready = await readyPromise;
  appendTranscript("[smoke] voice:ready ok: " + JSON.stringify(ready));

  socket.emit("voice:stop");
  appendTranscript("[smoke] complete");
}

function bind() {
  const onClick = (id, handler) => {
    document.getElementById(id).addEventListener("click", async (event) => {
      try {
        await handler(event);
      } catch (error) {
        alert(error?.message || "Unexpected error");
        logDebug({ error: error?.message || String(error) });
      }
    });
  };

  onClick("healthBtn", async () => {
    const apiUrl = new URL(apiBase());
    const host = apiUrl.origin.replace(/\/$/, "");
    logDebug({ healthTarget: host + "/health" });
    const res = await fetch(host + "/health");
    const json = await res.json();
    logDebug({ request: host + "/health", response: json });
  });

  onClick("resetUrlsBtn", () => {
    setBackendOrigin("http://localhost:8980");
    logDebug({
      status: "backend_urls_reset",
      apiBase: els.apiBase.value,
      socketBase: els.socketBase.value,
    });
  });

  onClick("smokeTestBtn", async () => {
    await runFrontendSmokeTest();
  });

  els.apiBase.addEventListener("change", () => {
    safeStorageSet(storage.apiBase, els.apiBase.value.trim());
  });
  els.socketBase.addEventListener("change", () => {
    safeStorageSet(storage.socketBase, els.socketBase.value.trim());
  });

  onClick("registerBtn", async () => {
    const payload = await api("/auth/register", { method: "POST", body: authInput() });
    setTokens(payload);
  });

  onClick("loginBtn", async () => {
    const payload = await api("/auth/login", {
      method: "POST",
      body: {
        email: els.email.value.trim(),
        password: els.password.value,
        deviceId: els.deviceId.value.trim() || undefined,
      },
    });
    setTokens(payload);
  });

  onClick("refreshBtn", async () => {
    const payload = await api("/auth/refresh", {
      method: "POST",
      body: { refreshToken: getToken(storage.refresh) },
    });
    setTokens(payload);
  });

  onClick("logoutBtn", async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      clearTokens();
      disconnectSocket();
    }
  });

  onClick("clearBtn", () => {
    clearTokens();
    disconnectSocket();
  });

  onClick("socketConnectBtn", () => {
    return connectSocket();
  });
  onClick("socketPingBtn", async () => {
    if (!socket?.connected) await connectSocket();
    const pongPromise = waitForSocketEvent("voice:pong");
    socket.emit("voice:ping", { source: "manual-button" });
    const pong = await pongPromise;
    appendTranscript("[voice:pong] " + JSON.stringify(pong));
  });
  onClick("socketDisconnectBtn", () => {
    disconnectSocket();
  });
  onClick("voiceStartBtn", () => {
    if (!socket?.connected) throw new Error("Connect socket first");
    socket.emit("voice:start", { deviceId: els.deviceId.value.trim() || undefined });
  });
  onClick("micStartBtn", async () => {
    await startMicStreaming();
  });
  onClick("commitBtn", () => {
    socket?.emit("voice:commit");
  });
  onClick("voiceStopBtn", () => {
    socket?.emit("voice:stop");
    stopMicStreaming();
  });

  onClick("createTaskBtn", async () => {
    await createTask();
  });
  onClick("loadTasksBtn", async () => {
    await loadTasks();
  });

  els.tasks.addEventListener("click", async (event) => {
    try {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.dataset.action;
      const id = target.dataset.id;
      if (!action || !id) return;
      if (action === "delete") {
        await deleteTask(id);
        return;
      }
      if (action === "mark-done") {
        await updateTask(id, { status: "done" });
      }
    } catch (error) {
      alert(error?.message || "Unexpected error");
      logDebug({ error: error?.message || String(error) });
    }
  });
}

function inferBackendOrigin() {
  try {
    const url = new URL(window.location.href);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return "http://localhost:8980";
    }
    return url.origin;
  } catch {
    return "http://localhost:8980";
  }
}

function initializeConnectionDefaults() {
  const inferredOrigin = inferBackendOrigin();
  const savedApiBase = safeStorageGet(storage.apiBase);
  const savedSocketBase = safeStorageGet(storage.socketBase);

  els.apiBase.value = savedApiBase || `${inferredOrigin}/api/v1`;
  els.socketBase.value = savedSocketBase || inferredOrigin;
}

function reportStartup() {
  logDebug({
    status: "frontend_ready",
    apiBase: els.apiBase.value,
    socketBase: els.socketBase.value,
    page: window.location.href,
    timestamp: new Date().toISOString(),
  });
}

window.addEventListener("error", (event) => {
  logDebug({
    status: "runtime_error",
    message: event.message,
    source: event.filename,
    line: event.lineno,
    column: event.colno,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  logDebug({
    status: "unhandled_rejection",
    reason: event.reason?.message || String(event.reason),
  });
});

initializeConnectionDefaults();
bind();
updateAuthState();
reportStartup();
