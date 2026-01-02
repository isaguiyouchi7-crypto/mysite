(function () {

  console.log("feedback.js loaded");

  // 🔥 Firebase config
  const firebaseConfig = {
    apiKey: "AIzaSyCAwum1O6WqAXbEqbvUTbUUXrki_nMcReE",
    authDomain: "tilawat-anas-ajlab.firebaseapp.com",
    projectId: "tilawat-anas-ajlab",
    storageBucket: "tilawat-anas-ajlab.firebasestorage.app",
    messagingSenderId: "213021127356",
    appId: "1:213021127356:web:6ad47ac442f9700e5c16b9"
  };

  // 🔐 مفتاح المشرف
  const ADMIN_KEY = "191222";
  let isAdmin = false;

  function enableAdminMode() {
    const key = window.prompt("أدخل مفتاح المشرف:");
    if (key === ADMIN_KEY) {
      isAdmin = true;
      alert("تم تفعيل وضع المشرف");
      renderList(lastSnapshot);
    } else {
      alert("مفتاح غير صحيح");
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "A") {
      enableAdminMode();
    }
  });

  // Init Firebase
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  const form = document.getElementById("feedbackForm");
  const inputText = document.getElementById("feedbackText");
  const inputName = document.getElementById("feedbackName");
  const list = document.getElementById("feedbackList");

  if (!form || !inputText || !list) return;

  let lastSnapshot = null;

  function renderList(snapshot) {
    if (!snapshot) return;
    list.innerHTML = "";

    snapshot.forEach(doc => {
      const data = doc.data();

      const name = data.name || "مستمع";

      const item = document.createElement("div");
      item.className = "feedback-item";
      item.innerHTML = `
        <strong>${name}</strong>
        <div>${data.text}</div>
        <div class="feedback-item__date">
          ${data.createdAt?.toDate().toLocaleString("ar-MA") || ""}
        </div>
        ${isAdmin ? `<button class="btn btn--ghost" data-del="${doc.id}">حذف</button>` : ""}
      `;

      list.appendChild(item);
    });
  }

  // 📥 قراءة Realtime
  db.collection("feedback")
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      lastSnapshot = snapshot;
      renderList(snapshot);
    });

  // 🗑️ حذف (Admin)
  list.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn || !isAdmin) return;

    const id = btn.getAttribute("data-del");
    if (!confirm("هل أنت متأكد من حذف هذه الرسالة؟")) return;

    try {
      await db.collection("feedback").doc(id).delete();
    } catch {
      alert("تعذر الحذف");
    }
  });

  // 📤 إرسال رسالة
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = inputText.value.trim();
    if (!text) return;

    const name = inputName?.value.trim() || "مستمع";

    try {
      await db.collection("feedback").add({
        name,
        text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      inputText.value = "";
      if (inputName) inputName.value = "";

    } catch (err) {
      alert("وقع خطأ أثناء الإرسال");
      console.error(err);
    }
  });

})();


