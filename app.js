(function () {
  "use strict";

  // ==========================================
  // State & DOM Elements
  // ==========================================
  const state = {
    theme: "auto",
    viewMode: "split", // 'split' | 'unified'
    wordWrap: true,
    options: {
      ignoreCase: false,
      ignoreLeadingTrailing: false,
      ignoreAllWhitespace: false,
      ignoreBlankLines: false,
      showOnlyChanged: true,
    },
    files: {
      left: null,
      right: null,
    },
    lastDiffResult: null,
    currentHunkIndex: 0,
    totalHunks: 0,
    hunkElements: [],
    allExpanded: false,
  };

  // DOM References
  const elements = {
    html: document.documentElement,
    themeToggle: document.getElementById("btn-theme-toggle"),
    themeIconSun: document.getElementById("theme-icon-sun"),
    themeIconMoon: document.getElementById("theme-icon-moon"),
    sampleBtn: document.getElementById("btn-sample-data"),

    // Screens
    inputScreen: document.getElementById("input-screen"),
    diffScreen: document.getElementById("diff-screen"),

    // Inputs & Panels
    leftPanel: document.getElementById("left-panel"),
    rightPanel: document.getElementById("right-panel"),
    leftText: document.getElementById("left-text"),
    rightText: document.getElementById("right-text"),
    leftFileInput: document.getElementById("left-file-input"),
    rightFileInput: document.getElementById("right-file-input"),
    leftFileBadge: document.getElementById("left-file-badge"),
    rightFileBadge: document.getElementById("right-file-badge"),
    leftFileName: document.getElementById("left-file-name"),
    rightFileName: document.getElementById("right-file-name"),
    leftFileRemove: document.getElementById("left-file-remove"),
    rightFileRemove: document.getElementById("right-file-remove"),
    btnClearLeft: document.getElementById("btn-clear-left"),
    btnClearRight: document.getElementById("btn-clear-right"),
    leftStats: document.getElementById("left-stats"),
    rightStats: document.getElementById("right-stats"),

    // Options
    optIgnoreCase: document.getElementById("opt-ignore-case"),
    optIgnoreLeadingTrailing: document.getElementById(
      "opt-ignore-leading-trailing",
    ),
    optIgnoreAllWhitespace: document.getElementById(
      "opt-ignore-all-whitespace",
    ),
    optIgnoreBlankLines: document.getElementById("opt-ignore-blank-lines"),
    optShowOnlyChanged: document.getElementById("opt-show-only-changed"),
    optWordWrap: document.getElementById("opt-word-wrap"),

    // Actions
    btnSwap: document.getElementById("btn-swap-texts"),
    btnFindDiff: document.getElementById("btn-find-diff"),
    btnEditInputs: document.getElementById("btn-edit-inputs"),
    kbdEnterHint: document.getElementById("kbd-enter-hint"),

    // Diff Toolbar
    btnViewSplit: document.getElementById("btn-view-split"),
    btnViewUnified: document.getElementById("btn-view-unified"),
    diffSummaryBar: document.getElementById("diff-summary-bar"),
    btnPrevDiff: document.getElementById("btn-prev-diff"),
    btnNextDiff: document.getElementById("btn-next-diff"),
    diffNavCounter: document.getElementById("diff-nav-counter"),
    btnExpandAll: document.getElementById("btn-expand-all"),
    expandAllText: document.getElementById("expand-all-text"),
    btnToggleWrapDiff: document.getElementById("btn-toggle-wrap-diff"),
    diffWrapStatus: document.getElementById("diff-wrap-status"),
    btnCopyDiff: document.getElementById("btn-copy-diff"),
    copyDiffText: document.getElementById("copy-diff-text"),

    // Diff Containers
    diffMainContainer: document.getElementById("diff-main-container"),
    splitViewContainer: document.getElementById("split-view-container"),
    splitTitleLeft: document.getElementById("split-title-left"),
    splitTitleRight: document.getElementById("split-title-right"),
    splitScrollerLeft: document.getElementById("split-scroller-left"),
    splitScrollerRight: document.getElementById("split-scroller-right"),
    splitRowsLeft: document.getElementById("split-rows-left"),
    splitRowsRight: document.getElementById("split-rows-right"),
    unifiedViewContainer: document.getElementById("unified-view-container"),
    unifiedRows: document.getElementById("unified-rows"),

    // Feedback
    loadingOverlay: document.getElementById("loading-overlay"),
    toastContainer: document.getElementById("toast-container"),
  };

  // Platform shortcut indicator
  const isMac =
    navigator.platform.toUpperCase().indexOf("MAC") >= 0 ||
    navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
  if (isMac && elements.kbdEnterHint) {
    elements.kbdEnterHint.textContent = "⌘+Enter";
  }

  // ==========================================
  // Theme Management
  // ==========================================
  function initTheme() {
    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem("diff_checker_theme");
    } catch (e) {
      console.warn("localStorage not accessible", e);
    }

    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme, false);
    } else {
      const prefersDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light", false);
    }

    if (window.matchMedia) {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", (e) => {
          try {
            if (!localStorage.getItem("diff_checker_theme")) {
              setTheme(e.matches ? "dark" : "light", false);
            }
          } catch (err) {}
        });
    }
  }

  function setTheme(theme, save = true) {
    state.theme = theme;
    elements.html.setAttribute("data-theme", theme);

    if (theme === "dark") {
      elements.themeIconSun.style.display = "block";
      elements.themeIconMoon.style.display = "none";
    } else {
      elements.themeIconSun.style.display = "none";
      elements.themeIconMoon.style.display = "block";
    }

    if (save) {
      try {
        localStorage.setItem("diff_checker_theme", theme);
      } catch (e) {}
    }
  }

  elements.themeToggle.addEventListener("click", () => {
    const current = elements.html.getAttribute("data-theme") || "light";
    setTheme(current === "dark" ? "light" : "dark", true);
  });

  // ==========================================
  // Notifications / Toasts
  // ==========================================
  function showToast(message, type = "info", duration = 3500) {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    let icon = "";
    if (type === "error") {
      icon =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    } else if (type === "success") {
      icon =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else {
      icon =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px) scale(0.95)";
      setTimeout(() => toast.remove(), 320);
    }, duration);
  }

  // ==========================================
  // File Handling & Drag & Drop
  // ==========================================
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  function setupFileInput(inputEl, panelEl, side) {
    inputEl.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleFile(file, side);
      inputEl.value = "";
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      panelEl.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        panelEl.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      panelEl.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        panelEl.classList.remove("drag-over");
      });
    });

    panelEl.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        handleFile(dt.files[0], side);
      }
    });
  }

  function handleFile(file, side) {
    if (file.size > MAX_FILE_SIZE) {
      showToast(
        `"${file.name}" exceeds the 5 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB). Please choose a smaller file.`,
        "error",
        5000,
      );
      return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
      const content = event.target.result;
      // Check for binary null bytes
      const sample = content.slice(0, 8000);
      if (sample.includes("\0")) {
        showToast(
          `"${file.name}" appears to be a binary file and cannot be read as text.`,
          "error",
          4500,
        );
        return;
      }

      const targetTextarea =
        side === "left" ? elements.leftText : elements.rightText;
      targetTextarea.value = content;
      setFileBadge(side, file.name);
      updateTextStats(side);
      showToast(
        `Loaded "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`,
        "success",
        2500,
      );
    };

    reader.onerror = function () {
      showToast(`Failed to read file "${file.name}".`, "error", 4000);
    };

    reader.readAsText(file, "utf-8");
  }

  function setFileBadge(side, filename) {
    state.files[side] = filename;
    const badge =
      side === "left" ? elements.leftFileBadge : elements.rightFileBadge;
    const nameEl =
      side === "left" ? elements.leftFileName : elements.rightFileName;
    if (filename) {
      nameEl.textContent = filename;
      badge.style.display = "inline-flex";
    } else {
      nameEl.textContent = "";
      badge.style.display = "none";
    }
  }

  setupFileInput(elements.leftFileInput, elements.leftPanel, "left");
  setupFileInput(elements.rightFileInput, elements.rightPanel, "right");

  elements.leftFileRemove.addEventListener("click", (e) => {
    e.stopPropagation();
    setFileBadge("left", null);
  });

  elements.rightFileRemove.addEventListener("click", (e) => {
    e.stopPropagation();
    setFileBadge("right", null);
  });

  elements.btnClearLeft.addEventListener("click", () => {
    elements.leftText.value = "";
    setFileBadge("left", null);
    updateTextStats("left");
    elements.leftText.focus();
  });

  elements.btnClearRight.addEventListener("click", () => {
    elements.rightText.value = "";
    setFileBadge("right", null);
    updateTextStats("right");
    elements.rightText.focus();
  });

  // Character and line count
  function updateTextStats(side) {
    const textarea = side === "left" ? elements.leftText : elements.rightText;
    const statEl = side === "left" ? elements.leftStats : elements.rightStats;
    const text = textarea.value;
    const charCount = text.length;
    const lineCount = text.length === 0 ? 0 : text.split("\n").length;
    statEl.textContent = `${lineCount.toLocaleString()} line${lineCount === 1 ? "" : "s"} \u00B7 ${charCount.toLocaleString()} character${charCount === 1 ? "" : "s"}`;
  }

  elements.leftText.addEventListener("input", () => updateTextStats("left"));
  elements.rightText.addEventListener("input", () => updateTextStats("right"));

  // Swap texts
  elements.btnSwap.addEventListener("click", () => {
    const tempText = elements.leftText.value;
    elements.leftText.value = elements.rightText.value;
    elements.rightText.value = tempText;

    const tempFile = state.files.left;
    setFileBadge("left", state.files.right);
    setFileBadge("right", tempFile);

    updateTextStats("left");
    updateTextStats("right");
    showToast("Swapped left and right texts", "info", 1800);
  });

  // Word wrap toggle
  function setWordWrap(wrap) {
    state.wordWrap = wrap;
    elements.optWordWrap.checked = wrap;

    const wrapClass = wrap ? "wrap" : "nowrap";
    const unwrapClass = wrap ? "nowrap" : "wrap";

    elements.leftText.classList.remove(unwrapClass);
    elements.leftText.classList.add(wrapClass);

    elements.rightText.classList.remove(unwrapClass);
    elements.rightText.classList.add(wrapClass);

    elements.diffWrapStatus.textContent = `Wrap: ${wrap ? "ON" : "OFF"}`;

    // Update in rendered diff output
    const diffTexts = elements.diffMainContainer.querySelectorAll(".diff-text");
    diffTexts.forEach((el) => {
      el.classList.remove(unwrapClass);
      el.classList.add(wrapClass);
    });

    // Synchronize row heights for split view
    if (state.viewMode === "split") {
      syncSplitRowHeights();
    }
  }

  elements.optWordWrap.addEventListener("change", (e) => {
    setWordWrap(e.target.checked);
  });

  elements.btnToggleWrapDiff.addEventListener("click", () => {
    setWordWrap(!state.wordWrap);
  });

  // Load sample data
  elements.sampleBtn.addEventListener("click", () => {
    const sampleOriginal = `// User Authentication Controller
function authenticateUser(username, password) {
  if (!username || !password) {
    return { success: false, error: "Missing credentials" };
  }

  const user = database.findUser({ username: username });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Verify hash
  const isValid = compareHash(password, user.passwordHash);
  if (!isValid) {
    logFailedAttempt(username);
    return { success: false, error: "Invalid password" };
  }

  const token = generateSessionToken(user.id);
  return {
    success: true,
    token: token,
    expiresIn: 3600
  };
}

// Helper utility
function logFailedAttempt(username) {
  console.warn("Failed login attempt for user:", username);
}

module.exports = { authenticateUser };
`;

    const sampleChanged = `// User Authentication Controller (v2.0)
import { verifyArgon2Hash } from './crypto';
import { createJwtToken } from './jwt';

export async function authenticateUser(username, password, options = {}) {
  if (!username || !password) {
    return { success: false, error: "Missing required credentials", code: 400 };
  }

  const user = await database.findUser({ username: username.toLowerCase() });
  if (!user) {
    return { success: false, error: "Invalid credentials", code: 401 };
  }

  // Verify hash using secure Argon2
  const isValid = await verifyArgon2Hash(password, user.passwordHash);
  if (!isValid) {
    await logFailedAttempt(username, options.ipAddress);
    return { success: false, error: "Invalid credentials", code: 401 };
  }

  const token = await createJwtToken(user.id, { role: user.role });
  return {
    success: true,
    token: token,
    expiresIn: options.rememberMe ? 86400 * 7 : 3600,
    user: { id: user.id, username: user.username, role: user.role }
  };
}

// Helper utility with rate limit tracking
async function logFailedAttempt(username, ip) {
  console.warn(\`Failed login attempt for \${username} from IP \${ip || 'unknown'}\`);
  await auditLog.record('auth_failure', { username, ip, timestamp: Date.now() });
}
`;

    elements.leftText.value = sampleOriginal;
    elements.rightText.value = sampleChanged;
    setFileBadge("left", "auth_controller_v1.js");
    setFileBadge("right", "auth_controller_v2.js");
    updateTextStats("left");
    updateTextStats("right");
    showToast("Loaded sample JavaScript data", "info", 2000);
  });

  // ==========================================
  // Synchronized Scrolling for Split View
  // ==========================================
  let isSyncingScroll = false;

  function syncScroll(source, target) {
    if (isSyncingScroll) return;
    isSyncingScroll = true;
    target.scrollTop = source.scrollTop;
    target.scrollLeft = source.scrollLeft;
    requestAnimationFrame(() => {
      isSyncingScroll = false;
    });
  }

  elements.splitScrollerLeft.addEventListener(
    "scroll",
    () => {
      syncScroll(elements.splitScrollerLeft, elements.splitScrollerRight);
    },
    { passive: true },
  );

  elements.splitScrollerRight.addEventListener(
    "scroll",
    () => {
      syncScroll(elements.splitScrollerRight, elements.splitScrollerLeft);
    },
    { passive: true },
  );

  // Synchronize row heights between left and right rows (essential when word-wrap is active)
  function syncSplitRowHeights() {
    const leftChildren = elements.splitRowsLeft.children;
    const rightChildren = elements.splitRowsRight.children;
    const count = Math.min(leftChildren.length, rightChildren.length);

    // If word wrap is disabled, each row has natural uniform height
    if (!state.wordWrap) {
      for (let i = 0; i < count; i++) {
        leftChildren[i].style.height = "";
        rightChildren[i].style.height = "";
      }
      return;
    }

    // Reset first to compute natural scroll heights
    for (let i = 0; i < count; i++) {
      leftChildren[i].style.height = "auto";
      rightChildren[i].style.height = "auto";
    }

    for (let i = 0; i < count; i++) {
      const h1 = leftChildren[i].offsetHeight;
      const h2 = rightChildren[i].offsetHeight;
      const maxH = Math.max(h1, h2);
      if (maxH > 0) {
        const hStr = maxH + "px";
        leftChildren[i].style.height = hStr;
        rightChildren[i].style.height = hStr;
      }
    }
  }

  window.addEventListener("resize", () => {
    if (
      state.viewMode === "split" &&
      !elements.diffScreen.classList.contains("hidden")
    ) {
      syncSplitRowHeights();
    }
  });

  // ==========================================
  // Diff Logic Engine (Myers Algorithm)
  // ==========================================
  function escapeHtml(text) {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function splitLines(text) {
    if (!text) return [];
    return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  }

  function normalizeLine(line, options) {
    let str = line;
    if (options.ignoreCase) {
      str = str.toLowerCase();
    }
    if (options.ignoreAllWhitespace) {
      str = str.replace(/\s+/g, "");
    } else if (options.ignoreLeadingTrailing) {
      str = str.trim();
    }
    return str;
  }

  function computeLineDiff(linesA, linesB, options) {
    const n = linesA.length;
    const m = linesB.length;

    if (n === 0 && m === 0) return [];
    if (n === 0) return linesB.map((line) => ({ type: "add", b: line }));
    if (m === 0) return linesA.map((line) => ({ type: "del", a: line }));

    const normA = new Array(n);
    const normB = new Array(m);
    for (let i = 0; i < n; i++) normA[i] = normalizeLine(linesA[i], options);
    for (let i = 0; i < m; i++) normB[i] = normalizeLine(linesB[i], options);

    const isBlank = (s) => /^\s*$/.test(s);

    // Fast check: identical
    if (n === m) {
      let allSame = true;
      for (let i = 0; i < n; i++) {
        if (normA[i] !== normB[i]) {
          allSame = false;
          break;
        }
      }
      if (allSame) {
        return linesA.map((line, i) => ({
          type: "equal",
          a: line,
          b: linesB[i],
        }));
      }
    }

    // 1. Prefix trim
    let prefixLen = 0;
    while (
      prefixLen < n &&
      prefixLen < m &&
      normA[prefixLen] === normB[prefixLen]
    ) {
      prefixLen++;
    }

    // 2. Suffix trim
    let aSuffixEnd = n - 1;
    let bSuffixEnd = m - 1;
    while (
      aSuffixEnd >= prefixLen &&
      bSuffixEnd >= prefixLen &&
      normA[aSuffixEnd] === normB[bSuffixEnd]
    ) {
      aSuffixEnd--;
      bSuffixEnd--;
    }

    const prefixOps = [];
    for (let i = 0; i < prefixLen; i++) {
      prefixOps.push({ type: "equal", a: linesA[i], b: linesB[i] });
    }

    const suffixOps = [];
    const suffixCount = n - 1 - aSuffixEnd;
    for (let i = 0; i < suffixCount; i++) {
      suffixOps.push({
        type: "equal",
        a: linesA[aSuffixEnd + 1 + i],
        b: linesB[bSuffixEnd + 1 + i],
      });
    }

    const midA = linesA.slice(prefixLen, aSuffixEnd + 1);
    const midB = linesB.slice(prefixLen, bSuffixEnd + 1);
    const normMidA = normA.slice(prefixLen, aSuffixEnd + 1);
    const normMidB = normB.slice(prefixLen, bSuffixEnd + 1);

    const N = midA.length;
    const M = midB.length;

    if (N === 0 && M === 0) return prefixOps.concat(suffixOps);
    if (N === 0)
      return prefixOps.concat(
        midB.map((l) => ({ type: "add", b: l })),
        suffixOps,
      );
    if (M === 0)
      return prefixOps.concat(
        midA.map((l) => ({ type: "del", a: l })),
        suffixOps,
      );

    // Disjoint check
    const setB = new Set(normMidB);
    let commonCount = 0;
    for (let i = 0; i < N; i++) {
      if (setB.has(normMidA[i])) {
        commonCount++;
        if (commonCount > 0) break;
      }
    }
    if (commonCount === 0) {
      return prefixOps.concat(
        midA.map((l) => ({ type: "del", a: l })),
        midB.map((l) => ({ type: "add", b: l })),
        suffixOps,
      );
    }

    // Map lines to integer IDs
    const idMap = new Map();
    let nextId = 1;
    const idA = new Int32Array(N);
    const idB = new Int32Array(M);

    for (let i = 0; i < N; i++) {
      const key = normMidA[i];
      let id = idMap.get(key);
      if (id === undefined) {
        id = nextId++;
        idMap.set(key, id);
      }
      idA[i] = id;
    }
    for (let i = 0; i < M; i++) {
      const key = normMidB[i];
      let id = idMap.get(key);
      if (id === undefined) {
        id = nextId++;
        idMap.set(key, id);
      }
      idB[i] = id;
    }

    // Myers Algorithm
    const maxD = N + M;
    const offset = maxD;
    const v = new Int32Array(2 * maxD + 1);
    v.fill(-1);
    v[offset + 1] = 0;

    const history = [];
    let finalD = -1;
    const MAX_MYERS_D = Math.min(maxD, 6000);

    outer: for (let d = 0; d <= MAX_MYERS_D; d++) {
      history.push(new Int32Array(v));
      for (let k = -d; k <= d; k += 2) {
        let x;
        if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
          x = v[offset + k + 1];
        } else {
          x = v[offset + k - 1] + 1;
        }
        let y = x - k;

        while (x < N && y < M && idA[x] === idB[y]) {
          x++;
          y++;
        }
        v[offset + k] = x;

        if (x >= N && y >= M) {
          finalD = d;
          break outer;
        }
      }
    }

    if (finalD === -1) {
      return prefixOps.concat(
        midA.map((l) => ({ type: "del", a: l })),
        midB.map((l) => ({ type: "add", b: l })),
        suffixOps,
      );
    }

    // Backtrack
    const midOps = [];
    let curX = N;
    let curY = M;

    for (let d = finalD; d > 0; d--) {
      const vPrev = history[d];
      const k = curX - curY;
      let prevK =
        k === -d || (k !== d && vPrev[offset + k - 1] < vPrev[offset + k + 1])
          ? k + 1
          : k - 1;
      const prevX = vPrev[offset + prevK];
      const prevY = prevX - prevK;

      while (curX > prevX && curY > prevY) {
        midOps.push({ type: "equal", a: midA[curX - 1], b: midB[curY - 1] });
        curX--;
        curY--;
      }

      if (curX > prevX) {
        midOps.push({ type: "del", a: midA[curX - 1] });
        curX--;
      } else if (curY > prevY) {
        midOps.push({ type: "add", b: midB[curY - 1] });
        curY--;
      }
    }

    while (curX > 0 && curY > 0) {
      midOps.push({ type: "equal", a: midA[curX - 1], b: midB[curY - 1] });
      curX--;
      curY--;
    }

    midOps.reverse();

    // Post-process for ignoreBlankLines
    let finalMidOps = midOps;
    if (options.ignoreBlankLines) {
      finalMidOps = [];
      for (const op of midOps) {
        if (op.type === "del" && isBlank(op.a)) {
          finalMidOps.push({ type: "equal", a: op.a, b: "" });
        } else if (op.type === "add" && isBlank(op.b)) {
          finalMidOps.push({ type: "equal", a: "", b: op.b });
        } else {
          finalMidOps.push(op);
        }
      }
    }

    return prefixOps.concat(finalMidOps, suffixOps);
  }

  // Tokenization with Unicode word and symbol support
  function tokenizeLine(text) {
    if (!text) return [];
    const tokens = text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu);
    return tokens || [text];
  }

  // Myers token-level diff for precision inline word highlighting
  function computeWordDiff(textA, textB, options) {
    if (textA === textB) {
      return {
        htmlA: escapeHtml(textA),
        htmlB: escapeHtml(textB),
      };
    }

    const tokensA = tokenizeLine(textA);
    const tokensB = tokenizeLine(textB);
    const na = tokensA.length;
    const nb = tokensB.length;

    const isMatch = (a, b) =>
      options.ignoreCase ? a.toLowerCase() === b.toLowerCase() : a === b;

    // Prefix trim
    let start = 0;
    while (start < na && start < nb && isMatch(tokensA[start], tokensB[start]))
      start++;

    // Suffix trim
    let endA = na - 1;
    let endB = nb - 1;
    while (
      endA >= start &&
      endB >= start &&
      isMatch(tokensA[endA], tokensB[endB])
    ) {
      endA--;
      endB--;
    }

    const prefix = [];
    for (let i = 0; i < start; i++)
      prefix.push({ type: "equal", val: tokensA[i] });

    const suffix = [];
    const suffixCount = na - 1 - endA;
    for (let i = 0; i < suffixCount; i++) {
      suffix.push({ type: "equal", val: tokensA[endA + 1 + i] });
    }

    const midA = tokensA.slice(start, endA + 1);
    const midB = tokensB.slice(start, endB + 1);
    const N = midA.length;
    const M = midB.length;

    let midOps = [];
    if (N === 0) {
      midOps = midB.map((t) => ({ type: "add", val: t }));
    } else if (M === 0) {
      midOps = midA.map((t) => ({ type: "del", val: t }));
    } else {
      // Run Myers on middle tokens
      const maxD = N + M;
      const offset = maxD;
      const v = new Int32Array(2 * maxD + 1);
      v.fill(-1);
      v[offset + 1] = 0;
      const history = [];
      let finalD = -1;

      for (let d = 0; d <= maxD; d++) {
        history.push(new Int32Array(v));
        for (let k = -d; k <= d; k += 2) {
          let x =
            k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])
              ? v[offset + k + 1]
              : v[offset + k - 1] + 1;
          let y = x - k;
          while (x < N && y < M && isMatch(midA[x], midB[y])) {
            x++;
            y++;
          }
          v[offset + k] = x;
          if (x >= N && y >= M) {
            finalD = d;
            break;
          }
        }
        if (finalD !== -1) break;
      }

      if (finalD !== -1) {
        let curX = N,
          curY = M;
        for (let d = finalD; d > 0; d--) {
          const vPrev = history[d];
          const k = curX - curY;
          let prevK =
            k === -d ||
            (k !== d && vPrev[offset + k - 1] < vPrev[offset + k + 1])
              ? k + 1
              : k - 1;
          const prevX = vPrev[offset + prevK];
          const prevY = prevX - prevK;
          while (curX > prevX && curY > prevY) {
            midOps.push({ type: "equal", val: midA[curX - 1] });
            curX--;
            curY--;
          }
          if (curX > prevX) {
            midOps.push({ type: "del", val: midA[curX - 1] });
            curX--;
          } else if (curY > prevY) {
            midOps.push({ type: "add", val: midB[curY - 1] });
            curY--;
          }
        }
        while (curX > 0 && curY > 0) {
          midOps.push({ type: "equal", val: midA[curX - 1] });
          curX--;
          curY--;
        }
        midOps.reverse();
      } else {
        midOps = midA
          .map((t) => ({ type: "del", val: t }))
          .concat(midB.map((t) => ({ type: "add", val: t })));
      }
    }

    const allOps = prefix.concat(midOps, suffix);

    // Render HTML with merged consecutive highlight tags
    let htmlA = "";
    let htmlB = "";
    let curDel = "";
    let curAdd = "";

    const flushDel = () => {
      if (curDel) {
        htmlA += `<mark class="diff-word-del">${escapeHtml(curDel)}</mark>`;
        curDel = "";
      }
    };
    const flushAdd = () => {
      if (curAdd) {
        htmlB += `<mark class="diff-word-add">${escapeHtml(curAdd)}</mark>`;
        curAdd = "";
      }
    };

    for (const op of allOps) {
      if (op.type === "equal") {
        flushDel();
        flushAdd();
        const esc = escapeHtml(op.val);
        htmlA += esc;
        htmlB += esc;
      } else if (op.type === "del") {
        flushAdd();
        curDel += op.val;
      } else if (op.type === "add") {
        flushDel();
        curAdd += op.val;
      }
    }
    flushDel();
    flushAdd();

    return { htmlA, htmlB };
  }

  // ==========================================
  // Diff Processing & Row Preparation
  // ==========================================
  function processDiff(textA, textB, options) {
    const linesA = splitLines(textA);
    const linesB = splitLines(textB);

    const ops = computeLineDiff(linesA, linesB, options);

    let addedLines = 0;
    let removedLines = 0;
    let modifiedLines = 0;

    const splitRows = [];
    let origLineNum = 1;
    let chgLineNum = 1;
    let hunkId = 0;
    let i = 0;
    const totalOps = ops.length;

    while (i < totalOps) {
      const op = ops[i];
      if (op.type === "equal") {
        splitRows.push({
          type: "equal",
          origLine: origLineNum++,
          chgLine: chgLineNum++,
          origText: op.a,
          chgText: op.b,
          hunkId: null,
        });
        i++;
      } else {
        hunkId++;
        const dels = [];
        const adds = [];

        while (
          i < totalOps &&
          (ops[i].type === "del" || ops[i].type === "add")
        ) {
          if (ops[i].type === "del") {
            dels.push({ text: ops[i].a, line: origLineNum++ });
          } else {
            adds.push({ text: ops[i].b, line: chgLineNum++ });
          }
          i++;
        }

        const maxLen = Math.max(dels.length, adds.length);
        for (let k = 0; k < maxLen; k++) {
          const delItem = dels[k] || null;
          const addItem = adds[k] || null;

          if (delItem && addItem) {
            modifiedLines++;
            splitRows.push({
              type: "modified",
              origLine: delItem.line,
              chgLine: addItem.line,
              origText: delItem.text,
              chgText: addItem.text,
              hunkId: hunkId,
            });
          } else if (delItem) {
            removedLines++;
            splitRows.push({
              type: "del",
              origLine: delItem.line,
              chgLine: null,
              origText: delItem.text,
              chgText: null,
              hunkId: hunkId,
            });
          } else {
            addedLines++;
            splitRows.push({
              type: "add",
              origLine: null,
              chgLine: addItem.line,
              origText: null,
              chgText: addItem.text,
              hunkId: hunkId,
            });
          }
        }
      }
    }

    // Unified Rows
    const unifiedRows = [];
    origLineNum = 1;
    chgLineNum = 1;
    let unifiedHunk = 0;
    i = 0;

    while (i < totalOps) {
      const op = ops[i];
      if (op.type === "equal") {
        unifiedRows.push({
          type: "equal",
          origLine: origLineNum++,
          chgLine: chgLineNum++,
          text: op.a,
          hunkId: null,
        });
        i++;
      } else {
        unifiedHunk++;
        const dels = [];
        const adds = [];

        while (
          i < totalOps &&
          (ops[i].type === "del" || ops[i].type === "add")
        ) {
          if (ops[i].type === "del") {
            dels.push({ text: ops[i].a, line: origLineNum++ });
          } else {
            adds.push({ text: ops[i].b, line: chgLineNum++ });
          }
          i++;
        }

        const minPairs = Math.min(dels.length, adds.length);
        for (let k = 0; k < dels.length; k++) {
          unifiedRows.push({
            type: "del",
            origLine: dels[k].line,
            chgLine: null,
            text: dels[k].text,
            pairedText: k < minPairs ? adds[k].text : null,
            hunkId: unifiedHunk,
          });
        }

        for (let k = 0; k < adds.length; k++) {
          unifiedRows.push({
            type: "add",
            origLine: null,
            chgLine: adds[k].line,
            text: adds[k].text,
            pairedText: k < minPairs ? dels[k].text : null,
            hunkId: unifiedHunk,
          });
        }
      }
    }

    return {
      ops,
      splitRows,
      unifiedRows,
      totalHunks: hunkId,
      stats: {
        added: addedLines,
        removed: removedLines,
        modified: modifiedLines,
        isIdentical: hunkId === 0,
      },
    };
  }

  // Collapse unchanged sections for "Show only changed lines"
  function collapseRows(rows, context = 3) {
    const n = rows.length;
    if (n === 0) return [];

    let hasChanges = false;
    for (let i = 0; i < n; i++) {
      if (rows[i].type !== "equal") {
        hasChanges = true;
        break;
      }
    }

    if (!hasChanges) {
      return [{ type: "row", row: rows[0], index: 0 }];
    }

    const visible = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (rows[i].type !== "equal") {
        const from = Math.max(0, i - context);
        const to = Math.min(n - 1, i + context);
        for (let j = from; j <= to; j++) visible[j] = 1;
      }
    }

    const items = [];
    let i = 0;

    while (i < n) {
      if (visible[i]) {
        items.push({ type: "row", row: rows[i], index: i });
        i++;
      } else {
        const startIdx = i;
        while (i < n && !visible[i]) i++;
        const count = i - startIdx;

        if (count <= 3) {
          for (let j = startIdx; j < i; j++) {
            items.push({ type: "row", row: rows[j], index: j });
          }
        } else {
          items.push({
            type: "expander",
            startIdx,
            endIdx: i - 1,
            count,
            rows: rows.slice(startIdx, i),
          });
        }
      }
    }

    return items;
  }

  // ==========================================
  // Rendering: Split View & Unified View
  // ==========================================
  function renderDiff() {
    const result = state.lastDiffResult;
    if (!result) return;

    const { splitRows, unifiedRows, totalHunks, stats } = result;
    const wrapClass = state.wordWrap ? "wrap" : "nowrap";
    state.totalHunks = totalHunks;
    state.currentHunkIndex = totalHunks > 0 ? 1 : 0;

    renderSummaryBar(stats, totalHunks);

    elements.splitTitleLeft.textContent = state.files.left || "Original Text";
    elements.splitTitleRight.textContent = state.files.right || "Changed Text";

    // Check if Expand All button should be visible
    if (state.options.showOnlyChanged && !stats.isIdentical && totalHunks > 0) {
      elements.btnExpandAll.style.display = "inline-flex";
      elements.expandAllText.textContent = state.allExpanded
        ? "Collapse"
        : "Expand All";
    } else {
      elements.btnExpandAll.style.display = "none";
    }

    if (stats.isIdentical) {
      elements.splitViewContainer.style.display = "none";
      elements.unifiedViewContainer.style.display = "block";
      elements.unifiedRows.innerHTML = `
          <div class="diff-empty-message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <h3>No differences found</h3>
            <p>The original and changed texts are identical based on your active options.</p>
          </div>
        `;
      updateNavCounter();
      return;
    }

    if (state.viewMode === "split") {
      elements.splitViewContainer.style.display = "flex";
      elements.unifiedViewContainer.style.display = "none";
      renderSplitRows(splitRows, wrapClass);
    } else {
      elements.splitViewContainer.style.display = "none";
      elements.unifiedViewContainer.style.display = "block";
      renderUnifiedRows(unifiedRows, wrapClass);
    }

    updateNavCounter();
    collectHunkElements();

    if (totalHunks > 0) {
      jumpToHunk(1, false);
    }
  }

  function renderSummaryBar(stats, totalHunks) {
    if (stats.isIdentical) {
      elements.diffSummaryBar.innerHTML = `
          <span class="stat-badge stat-badge-identical">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg>
            No differences found
          </span>
        `;
      return;
    }

    const badges = [];
    if (stats.added > 0) {
      badges.push(
        `<span class="stat-badge stat-badge-add">+${stats.added.toLocaleString()} added</span>`,
      );
    }
    if (stats.removed > 0) {
      badges.push(
        `<span class="stat-badge stat-badge-del">-${stats.removed.toLocaleString()} removed</span>`,
      );
    }
    if (stats.modified > 0) {
      badges.push(
        `<span class="stat-badge stat-badge-mod">~${stats.modified.toLocaleString()} modified</span>`,
      );
    }
    badges.push(
      `<span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(${totalHunks} change block${totalHunks === 1 ? "" : "s"})</span>`,
    );

    elements.diffSummaryBar.innerHTML = badges.join("");
  }

  function renderSplitRows(rows, wrapClass) {
    elements.splitRowsLeft.innerHTML = "";
    elements.splitRowsRight.innerHTML = "";

    let items = [];
    if (state.options.showOnlyChanged && !state.allExpanded) {
      items = collapseRows(rows, 3);
    } else {
      items = rows.map((r, i) => ({ type: "row", row: r, index: i }));
    }

    const fragLeft = document.createDocumentFragment();
    const fragRight = document.createDocumentFragment();

    items.forEach((item) => {
      if (item.type === "expander") {
        // Add aligned expander banners to both left and right columns
        const expLeft = createExpanderBanner(item, "split", wrapClass);
        const expRight = createExpanderBanner(item, "split", wrapClass);

        // Clicking either one expands both
        const doExpand = () =>
          expandSplitSection(expLeft, expRight, item.rows, wrapClass);
        expLeft.addEventListener("click", doExpand);
        expRight.addEventListener("click", doExpand);

        fragLeft.appendChild(expLeft);
        fragRight.appendChild(expRight);
      } else {
        const rowPair = createSplitRowElements(item.row, wrapClass);
        fragLeft.appendChild(rowPair.leftEl);
        fragRight.appendChild(rowPair.rightEl);
      }
    });

    elements.splitRowsLeft.appendChild(fragLeft);
    elements.splitRowsRight.appendChild(fragRight);

    // Align heights
    syncSplitRowHeights();
  }

  function createSplitRowElements(row, wrapClass) {
    const leftEl = document.createElement("div");
    const rightEl = document.createElement("div");

    leftEl.className = "diff-row-item";
    rightEl.className = "diff-row-item";

    if (row.hunkId) {
      leftEl.setAttribute("data-hunk", row.hunkId);
      rightEl.setAttribute("data-hunk", row.hunkId);
    }

    if (row.type === "equal") {
      leftEl.innerHTML = `
          <div class="diff-ln" aria-label="Line ${row.origLine}">${row.origLine}</div>
          <div class="diff-marker" aria-hidden="true">&nbsp;</div>
          <div class="diff-text ${wrapClass}">${escapeHtml(row.origText)}</div>
        `;
      rightEl.innerHTML = `
          <div class="diff-ln" aria-label="Line ${row.chgLine}">${row.chgLine}</div>
          <div class="diff-marker" aria-hidden="true">&nbsp;</div>
          <div class="diff-text ${wrapClass}">${escapeHtml(row.chgText)}</div>
        `;
    } else if (row.type === "modified") {
      const wDiff = computeWordDiff(row.origText, row.chgText, state.options);

      leftEl.classList.add("row-del");
      leftEl.innerHTML = `
          <div class="diff-ln" aria-label="Original line ${row.origLine}">${row.origLine}</div>
          <div class="diff-marker" aria-label="Removed line">&minus;</div>
          <div class="diff-text ${wrapClass}">${wDiff.htmlA}</div>
        `;

      rightEl.classList.add("row-add");
      rightEl.innerHTML = `
          <div class="diff-ln" aria-label="Changed line ${row.chgLine}">${row.chgLine}</div>
          <div class="diff-marker" aria-label="Added line">+</div>
          <div class="diff-text ${wrapClass}">${wDiff.htmlB}</div>
        `;
    } else if (row.type === "del") {
      leftEl.classList.add("row-del");
      leftEl.innerHTML = `
          <div class="diff-ln" aria-label="Original line ${row.origLine}">${row.origLine}</div>
          <div class="diff-marker" aria-label="Removed line">&minus;</div>
          <div class="diff-text ${wrapClass}">${escapeHtml(row.origText)}</div>
        `;

      rightEl.classList.add("row-empty");
      rightEl.innerHTML = `
          <div class="diff-ln"></div>
          <div class="diff-marker"></div>
          <div class="diff-text ${wrapClass}"></div>
        `;
    } else if (row.type === "add") {
      leftEl.classList.add("row-empty");
      leftEl.innerHTML = `
          <div class="diff-ln"></div>
          <div class="diff-marker"></div>
          <div class="diff-text ${wrapClass}"></div>
        `;

      rightEl.classList.add("row-add");
      rightEl.innerHTML = `
          <div class="diff-ln" aria-label="Changed line ${row.chgLine}">${row.chgLine}</div>
          <div class="diff-marker" aria-label="Added line">+</div>
          <div class="diff-text ${wrapClass}">${escapeHtml(row.chgText)}</div>
        `;
    }

    return { leftEl, rightEl };
  }

  function createExpanderBanner(item, mode, wrapClass) {
    const banner = document.createElement("div");
    banner.className = "diff-expander-banner";
    banner.setAttribute("role", "button");
    banner.setAttribute("tabindex", "0");
    banner.innerHTML = `
        <span class="diff-expander-icon">&#8597;</span>
        <span>Expand ${item.count} hidden unchanged line${item.count === 1 ? "" : "s"}</span>
      `;
    return banner;
  }

  function expandSplitSection(expLeft, expRight, hiddenRows, wrapClass) {
    const fragL = document.createDocumentFragment();
    const fragR = document.createDocumentFragment();

    hiddenRows.forEach((r) => {
      const pair = createSplitRowElements(r, wrapClass);
      fragL.appendChild(pair.leftEl);
      fragR.appendChild(pair.rightEl);
    });

    expLeft.parentNode.insertBefore(fragL, expLeft);
    expRight.parentNode.insertBefore(fragR, expRight);
    expLeft.remove();
    expRight.remove();

    syncSplitRowHeights();
    collectHunkElements();
  }

  function renderUnifiedRows(rows, wrapClass) {
    elements.unifiedRows.innerHTML = "";

    let items = [];
    if (state.options.showOnlyChanged && !state.allExpanded) {
      items = collapseRows(rows, 3);
    } else {
      items = rows.map((r, i) => ({ type: "row", row: r, index: i }));
    }

    const frag = document.createDocumentFragment();

    items.forEach((item) => {
      if (item.type === "expander") {
        const exp = createExpanderBanner(item, "unified", wrapClass);
        exp.addEventListener("click", () => {
          expandUnifiedSection(exp, item.rows, wrapClass);
        });
        frag.appendChild(exp);
      } else {
        frag.appendChild(createUnifiedRowElement(item.row, wrapClass));
      }
    });

    elements.unifiedRows.appendChild(frag);
  }

  function createUnifiedRowElement(row, wrapClass) {
    const rowEl = document.createElement("div");
    rowEl.className = "diff-row-item";
    if (row.hunkId) {
      rowEl.setAttribute("data-hunk", row.hunkId);
    }

    let contentHtml = escapeHtml(row.text);
    let markerText = "&nbsp;";
    let markerAria = "Unchanged line";

    if (row.type === "del") {
      rowEl.classList.add("row-del");
      markerText = "&minus;";
      markerAria = "Removed line";
      if (row.pairedText !== null) {
        const wDiff = computeWordDiff(row.text, row.pairedText, state.options);
        contentHtml = wDiff.htmlA;
      }
    } else if (row.type === "add") {
      rowEl.classList.add("row-add");
      markerText = "+";
      markerAria = "Added line";
      if (row.pairedText !== null) {
        const wDiff = computeWordDiff(row.pairedText, row.text, state.options);
        contentHtml = wDiff.htmlB;
      }
    }

    rowEl.innerHTML = `
        <div class="diff-ln" aria-label="Original line ${row.origLine || ""}">${row.origLine || ""}</div>
        <div class="diff-ln" aria-label="Changed line ${row.chgLine || ""}">${row.chgLine || ""}</div>
        <div class="diff-marker" aria-label="${markerAria}">${markerText}</div>
        <div class="diff-text ${wrapClass}">${contentHtml}</div>
      `;

    return rowEl;
  }

  function expandUnifiedSection(expanderEl, hiddenRows, wrapClass) {
    const frag = document.createDocumentFragment();
    hiddenRows.forEach((r) => {
      frag.appendChild(createUnifiedRowElement(r, wrapClass));
    });
    expanderEl.parentNode.insertBefore(frag, expanderEl);
    expanderEl.remove();
    collectHunkElements();
  }

  // Expand All / Collapse All Toggle
  elements.btnExpandAll.addEventListener("click", () => {
    state.allExpanded = !state.allExpanded;
    elements.expandAllText.textContent = state.allExpanded
      ? "Collapse"
      : "Expand All";
    renderDiff();
  });

  // ==========================================
  // Navigation Across Differences
  // ==========================================
  function collectHunkElements() {
    state.hunkElements = [];
    const container =
      state.viewMode === "split"
        ? elements.splitRowsLeft
        : elements.unifiedRows;
    const rows = container.querySelectorAll("[data-hunk]");
    const seen = new Set();
    rows.forEach((r) => {
      const id = parseInt(r.getAttribute("data-hunk"), 10);
      if (!seen.has(id)) {
        seen.add(id);
        state.hunkElements.push({ id, firstRow: r });
      }
    });
    state.hunkElements.sort((a, b) => a.id - b.id);
  }

  function jumpToHunk(hunkIndex, smooth = true) {
    if (state.totalHunks === 0) return;

    if (hunkIndex < 1) hunkIndex = 1;
    if (hunkIndex > state.totalHunks) hunkIndex = state.totalHunks;
    state.currentHunkIndex = hunkIndex;

    // Remove existing active highlight
    const activeRows =
      elements.diffMainContainer.querySelectorAll(".active-hunk");
    activeRows.forEach((r) => r.classList.remove("active-hunk"));

    // Highlight target hunk
    const targetHunk = state.hunkElements.find((h) => h.id === hunkIndex);
    if (targetHunk && targetHunk.firstRow) {
      const hunkRows = elements.diffMainContainer.querySelectorAll(
        `[data-hunk="${hunkIndex}"]`,
      );
      hunkRows.forEach((r) => r.classList.add("active-hunk"));

      targetHunk.firstRow.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "center",
      });
    }

    updateNavCounter();
  }

  function updateNavCounter() {
    if (state.totalHunks === 0) {
      elements.diffNavCounter.textContent = "0 / 0";
      elements.btnPrevDiff.disabled = true;
      elements.btnNextDiff.disabled = true;
    } else {
      elements.diffNavCounter.textContent = `${state.currentHunkIndex} / ${state.totalHunks}`;
      elements.btnPrevDiff.disabled = state.currentHunkIndex <= 1;
      elements.btnNextDiff.disabled =
        state.currentHunkIndex >= state.totalHunks;
    }
  }

  elements.btnPrevDiff.addEventListener("click", () => {
    if (state.currentHunkIndex > 1) {
      jumpToHunk(state.currentHunkIndex - 1);
    }
  });

  elements.btnNextDiff.addEventListener("click", () => {
    if (state.currentHunkIndex < state.totalHunks) {
      jumpToHunk(state.currentHunkIndex + 1);
    }
  });

  // View mode switching
  elements.btnViewSplit.addEventListener("click", () => {
    if (state.viewMode !== "split") {
      state.viewMode = "split";
      elements.btnViewSplit.classList.add("active");
      elements.btnViewSplit.setAttribute("aria-selected", "true");
      elements.btnViewUnified.classList.remove("active");
      elements.btnViewUnified.setAttribute("aria-selected", "false");
      renderDiff();
    }
  });

  elements.btnViewUnified.addEventListener("click", () => {
    if (state.viewMode !== "unified") {
      state.viewMode = "unified";
      elements.btnViewUnified.classList.add("active");
      elements.btnViewUnified.setAttribute("aria-selected", "true");
      elements.btnViewSplit.classList.remove("active");
      elements.btnViewSplit.setAttribute("aria-selected", "false");
      renderDiff();
    }
  });

  // Edit Inputs (Return to Input Screen)
  elements.btnEditInputs.addEventListener("click", () => {
    elements.diffScreen.classList.add("hidden");
    elements.inputScreen.classList.remove("hidden");
    elements.leftText.focus();
  });

  // Copy Diff Action
  elements.btnCopyDiff.addEventListener("click", () => {
    if (!state.lastDiffResult) return;
    const rawDiff = generateUnifiedDiffText(state.lastDiffResult.ops);

    navigator.clipboard
      .writeText(rawDiff)
      .then(() => {
        const originalText = elements.copyDiffText.textContent;
        elements.copyDiffText.textContent = "Copied!";
        showToast("Unified diff copied to clipboard", "success", 2200);
        setTimeout(() => {
          elements.copyDiffText.textContent = originalText;
        }, 2000);
      })
      .catch((err) => {
        showToast(
          "Unable to access clipboard. Please copy manually.",
          "error",
          3000,
        );
      });
  });

  function generateUnifiedDiffText(ops) {
    const origName = state.files.left || "Original Text";
    const chgName = state.files.right || "Changed Text";
    const header = `--- ${origName}\n+++ ${chgName}\n`;
    const body = ops
      .map((op) => {
        if (op.type === "equal") return ` ${op.a}`;
        if (op.type === "del") return `-${op.a}`;
        if (op.type === "add") return `+${op.b}`;
        return "";
      })
      .join("\n");
    return header + body;
  }

  // ==========================================
  // Find Difference Trigger
  // ==========================================
  function triggerDiff() {
    const leftVal = elements.leftText.value;
    const rightVal = elements.rightText.value;

    state.options.ignoreCase = elements.optIgnoreCase.checked;
    state.options.ignoreLeadingTrailing =
      elements.optIgnoreLeadingTrailing.checked;
    state.options.ignoreAllWhitespace = elements.optIgnoreAllWhitespace.checked;
    state.options.ignoreBlankLines = elements.optIgnoreBlankLines.checked;
    state.options.showOnlyChanged = elements.optShowOnlyChanged.checked;
    state.allExpanded = false;

    // On narrow viewport, automatically select unified view
    if (window.innerWidth < 768) {
      state.viewMode = "unified";
      elements.btnViewUnified.classList.add("active");
      elements.btnViewUnified.setAttribute("aria-selected", "true");
      elements.btnViewSplit.classList.remove("active");
      elements.btnViewSplit.setAttribute("aria-selected", "false");
    }

    elements.loadingOverlay.style.display = "flex";
    elements.btnFindDiff.disabled = true;

    // Defer calculation so browser repaints spinner
    setTimeout(() => {
      try {
        const t0 = performance.now();
        const result = processDiff(leftVal, rightVal, state.options);
        const t1 = performance.now();
        state.lastDiffResult = result;

        elements.inputScreen.classList.add("hidden");
        elements.diffScreen.classList.remove("hidden");

        renderDiff();
        console.log(`Diff computed in ${(t1 - t0).toFixed(2)} ms.`);
      } catch (err) {
        console.error("Diff calculation error:", err);
        showToast(
          "An error occurred while comparing texts: " + err.message,
          "error",
          5000,
        );
      } finally {
        elements.loadingOverlay.style.display = "none";
        elements.btnFindDiff.disabled = false;
      }
    }, 30);
  }

  elements.btnFindDiff.addEventListener("click", triggerDiff);

  // ==========================================
  // Global Keyboard Shortcuts
  // ==========================================
  window.addEventListener("keydown", (e) => {
    const isInputScreenVisible =
      !elements.inputScreen.classList.contains("hidden");
    const isDiffScreenVisible =
      !elements.diffScreen.classList.contains("hidden");

    // Ctrl + Enter or Cmd + Enter -> Find Difference
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      triggerDiff();
      return;
    }

    // Escape -> Edit inputs (when on diff screen)
    if (e.key === "Escape" && isDiffScreenVisible) {
      e.preventDefault();
      elements.btnEditInputs.click();
      return;
    }

    // Navigation shortcuts when not typing in an input
    const activeTag = document.activeElement
      ? document.activeElement.tagName.toLowerCase()
      : "";
    if (
      isDiffScreenVisible &&
      activeTag !== "textarea" &&
      activeTag !== "input"
    ) {
      // 'j' or 'n' or Alt+Down -> Next diff
      if (
        e.key === "j" ||
        e.key === "n" ||
        (e.altKey && e.key === "ArrowDown")
      ) {
        e.preventDefault();
        elements.btnNextDiff.click();
      }
      // 'k' or 'p' or Alt+Up -> Prev diff
      else if (
        e.key === "k" ||
        e.key === "p" ||
        (e.altKey && e.key === "ArrowUp")
      ) {
        e.preventDefault();
        elements.btnPrevDiff.click();
      }
    }
  });

  // Mobile fallback on resize
  window.addEventListener("resize", () => {
    if (
      window.innerWidth < 768 &&
      state.viewMode === "split" &&
      !elements.diffScreen.classList.contains("hidden")
    ) {
      elements.btnViewUnified.click();
    }
  });

  // Initialize on load
  initTheme();
  updateTextStats("left");
  updateTextStats("right");
})();
