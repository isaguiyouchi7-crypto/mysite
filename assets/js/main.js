/* =========================================================
   main.js — منطق الواجهة (بحث، رندر، وضع ليلي، انتقالات)
   WebView fixes: guards + safe paths + clipboard/mailto fallback
   ========================================================= */

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ✅ إصلاح مهم لـ WebView: أي مسار يبدا بـ / يخرب file:///android_asset
  // نحيدو / من البداية باش يبقى Relative
  function safePath(p) {
    if (!p) return p;
    return String(p).replace(/^\/+/, "");
  }

  // سنة الفوتر
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // =========================
  // الوضع الليلي (LocalStorage)
  // =========================
  const THEME_KEY = "ta_theme";
  const root = document.documentElement;
  const themeToggle = $("#themeToggle");

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);

    // ✅ WebView-safe: localStorage ممكن يرفض فبعض الحالات
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch { }

    if (themeToggle) {
      const isDark = theme === "dark";
      const iconEl = themeToggle.querySelector("span[aria-hidden='true']");
      const textEl = themeToggle.querySelector(".btn__text");
      if (iconEl) iconEl.textContent = isDark ? "☀️" : "🌙";
      if (textEl) textEl.textContent = isDark ? "الوضع النهاري" : "الوضع الليلي";
    }
  }

  // ✅ WebView-safe
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch { }
  if (saved === "dark" || saved === "light") setTheme(saved);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = root.getAttribute("data-theme") || "light";
      setTheme(current === "dark" ? "light" : "dark");
    });
  }

  // =========================
  // انتقالات ناعمة بين الصفحات
  // =========================
  $$("a[href]").forEach(a => {
    const href = a.getAttribute("href") || "";
    const isSameSite = !href.startsWith("http") && !href.startsWith("mailto:") && !href.startsWith("#");
    if (!isSameSite) return;

    a.addEventListener("click", (e) => {
      // تجاهل فتح تبويب جديد
      if (a.target === "_blank" || e.metaKey || e.ctrlKey) return;

      const page = $(".page");
      if (!page) return;

      e.preventDefault();
      page.classList.add("is-leaving");
      setTimeout(() => {
        window.location.href = href;
      }, 170);
    });
  });

  // =========================
  // صفحات: حدّد أي صفحة نحن فيها
  // =========================
  const page = $(".page");
  const pageName = page?.dataset.page;

  // =========================
  // الرئيسية: آخر تلاوة مضافة
  // =========================
  if (pageName === "home") {
    const box = $("#latestRecitation");
    if (box) {
      const list = Array.isArray(window.SURAHS) ? window.SURAHS : [];
      const latest = list.length ? list[list.length - 1] : null; // افتراضيًا آخر عنصر (114)

      box.classList.remove("skeleton");

      const latestName = latest?.name || "—";
      const latestNumber = latest?.number ?? "—";
      const latestAudio = safePath(latest?.audio || "");

      box.innerHTML = `
        <div class="surah__meta">
          <h3 class="surah__name" style="margin:0;">سورة ${latestName}</h3>
          <span class="surah__num">رقم ${latestNumber}</span>
        </div>
        <audio class="audio" controls preload="none">
          <source src="${latestAudio}" type="audio/mpeg" />
          المتصفح لا يدعم تشغيل الصوت.
        </audio>
        <div class="surah__actions" style="margin-top:10px;">
          <a class="btn btn--primary" href="surahs.html">الذهاب للسور</a>
          <a class="btn" href="${latestAudio || "#"}" download>تحميل</a>
        </div>
      `;
    }
  }

  // =========================
  // السور: رندر + بحث
  // =========================
  if (pageName === "surahs") {
    const grid = $("#surahsGrid");
    const input = $("#surahSearch");
    const clearBtn = $("#clearSurahSearch");

    function pad3(n) {
      return String(n).padStart(3, "0");
    }

    function renderSurahs(list) {
      if (!grid) return;

      if (!list.length) {
        grid.innerHTML = `
          <div class="card card--pad" style="grid-column:1/-1;">
            <h2 class="card__title">لا توجد نتائج</h2>
            <p class="text subtle">جرّب كتابة اسم آخر أو رقم السورة.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = list.map(s => {
        const num = s.number;
        const name = s.name;

        // ✅ WebView-safe: لو كان audio جا بـ /... نحيدو / من البداية
        const audio = safePath(s.audio || `assets/audio/surahs/${pad3(num)}.mp3`);

        return `
          <article class="card surah" aria-label="سورة ${name}">
            <div class="surah__meta">
              <h3 class="surah__name">سورة ${name}</h3>
              <span class="surah__num">#${num}</span>
            </div>

            <audio class="audio" controls preload="none">
              <source src="${audio}" type="audio/mpeg" />
              المتصفح لا يدعم تشغيل الصوت.
            </audio>

            <div class="surah__actions">
              <a class="btn btn--primary" href="${audio}" download>تحميل</a>
              <button class="btn" type="button" data-copy="${num}">نسخ رقم السورة</button>
            </div>
          </article>
        `;
      }).join("");

      // زر نسخ رقم السورة
      $$("[data-copy]", grid).forEach(btn => {
        btn.addEventListener("click", async () => {
          const num = btn.getAttribute("data-copy");

          // ✅ WebView fix: navigator.clipboard غالبا ما كيخدمش
          const fallbackCopy = () => {
            // fallback بسيط ومضمون: prompt كيخلي المستخدم ينسخ يدويًا
            try {
              window.prompt("انسخ رقم السورة:", String(num));
              btn.textContent = "انسخ من النافذة ✓";
            } catch {
              btn.textContent = "تعذر النسخ";
            }
            setTimeout(() => (btn.textContent = "نسخ رقم السورة"), 900);
          };

          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(String(num));
              btn.textContent = "تم النسخ ✓";
              setTimeout(() => (btn.textContent = "نسخ رقم السورة"), 900);
            } else {
              fallbackCopy();
            }
          } catch {
            fallbackCopy();
          }
        });
      });
    }

    function normalize(str) {
      // تبسيط بسيط للبحث العربي (بدون تعقيد كبير)
      return (str || "")
        .toString()
        .trim()
        .replace(/[إأآا]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/\s+/g, " ");
    }

    const all = Array.isArray(window.SURAHS) ? window.SURAHS : [];
    renderSurahs(all);

    function applySearch() {
      const q = normalize(input?.value || "");
      if (!q) return renderSurahs(all);

      const isNumber = /^\d+$/.test(q);
      const filtered = all.filter(s => {
        const name = normalize(s.name);
        const num = String(s.number);
        return isNumber ? num.includes(q) : name.includes(q);
      });

      renderSurahs(filtered);
    }

    if (input) input.addEventListener("input", applySearch);
    if (clearBtn) clearBtn.addEventListener("click", () => {
      if (!input) return;
      input.value = "";
      input.focus();
      renderSurahs(all);
    });
  }

  // =========================
  // المقاطع: رندر
  // =========================
  if (pageName === "clips") {
    const listEl = $("#clipsList");
    const baseClips = Array.isArray(window.CLIPS) ? window.CLIPS : [];
    const clips = baseClips.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    function fmtDate(dateStr) {
      // عرض تاريخ بسيط (YYYY-MM-DD → YYYY/MM/DD)
      if (!dateStr) return "—";
      // ✅ replaceAll قد لا تكون موجودة فبعض WebViews القديمة
      return String(dateStr).split("-").join("/");
    }

    if (listEl) {
      if (!clips.length) {
        listEl.innerHTML = `
          <div class="card card--pad">
            <h2 class="card__title">لا توجد مقاطع بعد</h2>
            <p class="text subtle">أضف مقاطعك في assets/js/data.js.</p>
          </div>
        `;
      } else {
        listEl.innerHTML = clips.map(c => {
          const audio = safePath(c.audio || "");
          return `
            <article class="card clip">
              <div class="clip__top">
                <h3 class="clip__title">${c.title}</h3>
                <div class="clip__meta">
                  <span class="chip">المدة: ${c.duration || "—"}</span>
                  <span class="chip">النشر: ${fmtDate(c.date)}</span>
                </div>
              </div>

              <audio class="audio" controls preload="none">
                <source src="${audio}" type="audio/mpeg" />
                المتصفح لا يدعم تشغيل الصوت.
              </audio>

              <div class="surah__actions">
                <a class="btn btn--primary" href="${audio || "#"}" download>تحميل</a>
              </div>
            </article>
          `;
        }).join("");
      }
    }
  }

  // =========================
  // التواصل: mailto بدون Back-End
  // =========================
  if (pageName === "contact") {
    const emailLink = $("#contactEmail");
    const form = $("#contactForm");

    // تعبئة البريد والروابط من البيانات
    if (emailLink) {
      const email = window.SITE?.contactEmail || "example@domain.com";
      emailLink.textContent = email;
      emailLink.href = `mailto:${email}`;
    }

    // روابط التواصل (chips)
    const chips = $$(".social .chip");
    if (chips.length) {
      const links = window.SITE?.socialLinks || {};
      const map = { "YouTube": links.youtube, "Telegram": links.telegram, "Instagram": links.instagram };
      chips.forEach(ch => {
        const key = ch.textContent.trim();
        const href = map[key] || "#";
        ch.href = href;
        if (href && href !== "#") ch.target = "_blank";
      });
    }

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();

        const email = window.SITE?.contactEmail || "example@domain.com";
        const name = $("#name")?.value?.trim() || "";
        const from = $("#email")?.value?.trim() || "";
        const subject = $("#subject")?.value?.trim() || "";
        const message = $("#message")?.value?.trim() || "";

        const body = [
          `الاسم: ${name}`,
          `البريد: ${from}`,
          "",
          "الرسالة:",
          message
        ].join("\n");

        const mailto =
          `mailto:${encodeURIComponent(email)}` +
          `?subject=${encodeURIComponent(subject)}` +
          `&body=${encodeURIComponent(body)}`;

        // ✅ WebView fix: mailto أحيانًا يسبب crash صامت -> نحط try/catch + fallback
        try {
          window.location.href = mailto;
        } catch {
          // fallback: نحط الرابط في صفحة بسيطة
          alert("تعذر فتح تطبيق البريد. انسخ الرسالة وأرسلها يدويًا.");
        }
      });
    }
  }

   // =========================
  // ======= إضافات الصوت =====
  // =========================

  let currentAudio = null;
  const LAST_AUDIO_KEY = "ta_last_audio";

  // أي audio تشغّل → يوقف اللي قبلو + تمييز بصري
  document.addEventListener("play", function (e) {
    const audio = e.target;
    if (!(audio instanceof HTMLAudioElement)) return;

    // وقف السابق
    if (currentAudio && currentAudio !== audio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio.closest(".card")?.classList.remove("is-playing");
      } catch { }
    }

    currentAudio = audio;
    audio.closest(".card")?.classList.add("is-playing");

    // حفظ آخر مقطع
    try {
      if (audio.currentSrc) {
        localStorage.setItem(LAST_AUDIO_KEY, audio.currentSrc);
      }
    } catch { }
  }, true);

  // إزالة التمييز عند الإيقاف
  document.addEventListener("pause", function (e) {
    const audio = e.target;
    if (!(audio instanceof HTMLAudioElement)) return;
    audio.closest(".card")?.classList.remove("is-playing");
  }, true);

  // تشغيل تلقائي للمقطع التالي (داخل نفس الصفحة)
  document.addEventListener("ended", function (e) {
    const audio = e.target;
    if (!(audio instanceof HTMLAudioElement)) return;

    const audios = $$("audio");
    const index = audios.indexOf(audio);
    if (index > -1 && audios[index + 1]) {
      try { audios[index + 1].play(); } catch { }
    }
  }, true);

  // زر مشاركة (يعتمد على data-shareable أو وجود audio)
  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-share]");
    if (!btn) return;

    const audio = btn.closest(".card")?.querySelector("audio");
    if (!audio || !audio.currentSrc) return;

    const url = audio.currentSrc;

    try {
      if (navigator.share) {
        navigator.share({ url });
      } else {
        window.prompt("انسخ رابط المقطع:", url);
      }
    } catch { }
  });
})();

