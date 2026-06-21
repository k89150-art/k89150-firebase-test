import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";

import {
  getFirestore,
  collectionGroup,
  doc,
  getDocs,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyABQadKr-Am-55GgFJmhZ0tkRY-joARNAQ",
  authDomain: "k89150-web-login.firebaseapp.com",
  projectId: "k89150-web-login",
  storageBucket: "k89150-web-login.firebasestorage.app",
  messagingSenderId: "488040360398",
  appId: "1:488040360398:web:759698c16eb67e14f1639f"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_UIDS = [
  "SesDhvXG6MUT38YhqGl0N6lVgMz1"
];

function isAdminUser(user) {
  return user && ADMIN_UIDS.includes(user.uid);
}

function setAdminSyncStatus(text, type = "muted") {
  const el = document.getElementById("syncStatus");
  if (!el) return;

  el.textContent = text;
  el.classList.remove(
    "status-muted",
    "status-saving",
    "status-saved",
    "status-error",
    "status-login"
  );
  el.classList.add(`status-${type}`);
}

function clearAdminTable() {
  const tbody = document.querySelector("#adminConfigTable tbody");
  if (tbody) tbody.innerHTML = "";
}

function updateAdminView(user) {
  const adminViewSection = document.getElementById("adminViewSection");

  if (isAdminUser(user)) {
    if (adminViewSection) adminViewSection.style.display = "block";
    return;
  }

  if (adminViewSection) adminViewSection.style.display = "none";
  clearAdminTable();
}

async function saveOwnerMetadata(user) {
  if (!user) return;

  try {
    await setDoc(
      doc(db, "users", user.uid, "appData", "main"),
      {
        ownerUid: user.uid,
        ownerEmail: user.email || ""
      },
      { merge: true }
    );
  } catch (error) {
    console.warn("使用者 owner 資訊補寫失敗：", error);
  }
}

async function loadAllUserConfigsForAdmin() {
  const user = auth.currentUser;

  if (!user) {
    alert("請先使用 Google 登入，才能操作資料。");
    setAdminSyncStatus("請先登入後再操作", "muted");
    return;
  }

  if (!isAdminUser(user)) {
    alert("你沒有管理員權限。");
    return;
  }

  const tbody = document.querySelector("#adminConfigTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  try {
    setAdminSyncStatus("正在載入管理員檢視資料...", "saving");

    const snapshot = await getDocs(collectionGroup(db, "appData"));

    snapshot.forEach(docSnap => {
      if (docSnap.id !== "main") return;

      const data = docSnap.data();
      const ownerUid = data.ownerUid || docSnap.ref.parent.parent?.id || "";
      const ownerEmail = data.ownerEmail || ownerUid || "未知使用者";
      const updatedAt = data.updatedAt
        ? new Date(data.updatedAt).toLocaleString("zh-TW")
        : "-";

      const configRows = data.configTable || [];

      configRows.forEach(item => {
        const cells = item.cells || [];
        const row = tbody.insertRow();

        row.insertCell(0).innerText = ownerEmail;
        row.insertCell(1).innerText = cells[0] || "-";
        row.insertCell(2).innerText = cells[1] || "-";
        row.insertCell(3).innerText = cells[2] || "-";
        row.insertCell(4).innerText = cells[3] || "-";
        row.insertCell(5).innerText = cells[4] || "-";
        row.insertCell(6).innerText = cells[5] || "-";
        row.insertCell(7).innerText = cells[6] || "-";
        row.insertCell(8).innerText = cells[7] || "-";
        row.insertCell(9).innerText = cells[8] || "-";
        row.insertCell(10).innerText = updatedAt;
      });
    });

    setAdminSyncStatus("管理員檢視資料已載入", "saved");
  } catch (error) {
    console.error("管理員檢視資料載入失敗：", error);
    alert("管理員檢視資料載入失敗：" + error.message);
    setAdminSyncStatus("管理員資料載入失敗", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const loadAdminConfigsBtn = document.getElementById("loadAdminConfigsBtn");

  if (loadAdminConfigsBtn) {
    loadAdminConfigsBtn.addEventListener("click", loadAllUserConfigsForAdmin);
  }

  updateAdminView(auth.currentUser);
});

onAuthStateChanged(auth, user => {
  updateAdminView(user);
  saveOwnerMetadata(user);
});
