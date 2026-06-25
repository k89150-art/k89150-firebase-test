const ADMIN_UID = "SesDhvXG6MUT38YhqGl0N6lVgMz1";
const firebaseConfig = {
  apiKey: "AIzaSyABQadKr-Am-55GgFJmhZ0tkRY-joARNAQ",
  authDomain: "k89150-web-login.firebaseapp.com",
  projectId: "k89150-web-login",
  storageBucket: "k89150-web-login.firebasestorage.app",
  messagingSenderId: "488040360398",
  appId: "1:488040360398:web:759698c16eb67e14f1639f"
};

function setAdminLinkVisibility(isAdmin) {
  document.body.classList.toggle("is-admin", isAdmin);

  document.querySelectorAll('.side-menu a[href="admin.html"]').forEach(link => {
    link.style.display = isAdmin ? "block" : "none";
  });

  document.querySelectorAll('.side-menu-section').forEach(section => {
    if (section.textContent.trim() === "管理") {
      section.style.display = isAdmin ? "block" : "none";
    }
  });
}

function installAdminLinkGuard() {
  setAdminLinkVisibility(false);

  import("https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js")
    .then(appModule => {
      return Promise.all([
        appModule,
        import("https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js")
      ]);
    })
    .then(([appModule, authModule, firestoreModule]) => {
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(firebaseConfig);
      const auth = authModule.getAuth(app);
      const db = firestoreModule.getFirestore(app);

      authModule.onAuthStateChanged(auth, user => {
        const isAdmin = Boolean(user && user.uid === ADMIN_UID);
        setAdminLinkVisibility(isAdmin);

        if (!user) return;

        firestoreModule.setDoc(
          firestoreModule.doc(db, "users", user.uid, "appData", "main"),
          {
            ownerUid: user.uid,
            ownerEmail: user.email || ""
          },
          { merge: true }
        ).catch(error => {
          console.warn("owner 資訊補寫失敗：", error);
        });
      });
    })
    .catch(error => {
      console.warn("管理員選單權限檢查初始化失敗：", error);
      setAdminLinkVisibility(false);
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installAdminLinkGuard);
} else {
  installAdminLinkGuard();
}
