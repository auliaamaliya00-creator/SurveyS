/*
 * PinkPetal Survey
 * 1) Ganti CONFIG.WEB_APP_URL dengan URL deployment Google Apps Script.
 * 2) Tempel 42 item resmi yang telah dikonfirmasi dosen ke CONFIG.dassItems.
 *    Jangan menyalin item dari sumber tidak resmi atau mengubah redaksinya.
 */
const CONFIG = {
  WEB_APP_URL: "https://script.google.com/macros/s/AKfycbxz5UxgC6aFA03voLKkunVG-b36-2xTqJIySkkcBltzwlAlsblipUcftcRbfYKLVbA/exec",
  dassItems: [
    // Contoh struktur SAJA; bukan item kuesioner:
    // { id: "D01", text: "TEMPEL REDAKSI RESMI ITEM 1 DI SINI" },
    // Tambahkan seluruh item resmi yang diizinkan dosen, dengan id unik.
  ],
  dassOptions: [
    { value: "0", label: "0 — Tidak sesuai" },
    { value: "1", label: "1 — Kadang sesuai" },
    { value: "2", label: "2 — Sering sesuai" },
    { value: "3", label: "3 — Sangat sesuai" }
  ]
};

const form = document.getElementById("surveyForm");
const dassContainer = document.getElementById("dassContainer");
const statusBox = document.getElementById("status");
const submitBtn = document.getElementById("submitBtn");

function renderDassItems() {
  if (!CONFIG.dassItems.length) {
    dassContainer.innerHTML = '<div class="dass-placeholder">Item kuesioner belum dimasukkan. Tambahkan redaksi resmi yang telah dikonfirmasi dosen di bagian CONFIG.dassItems pada script.js sebelum menerbitkan survei.</div>';
    return;
  }
  if (CONFIG.dassItems.length !== 42) {
    dassContainer.innerHTML = `<div class="instrument-alert">Konfigurasi saat ini berisi ${CONFIG.dassItems.length} item. Untuk pilihan tugas 42 item, masukkan dan verifikasi seluruh 42 item resmi sebelum survei dibagikan.</div>`;
  } else {
    dassContainer.innerHTML = "";
  }

  CONFIG.dassItems.forEach((item, index) => {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "dass-item";
    const legend = document.createElement("legend");
    legend.textContent = `${index + 1}. ${item.text}`;
    fieldset.appendChild(legend);
    const choices = document.createElement("div");
    choices.className = "dass-choices";
    CONFIG.dassOptions.forEach(option => {
      const label = document.createElement("label");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `dass_${item.id}`;
      radio.value = option.value;
      radio.required = true;
      label.appendChild(radio);
      label.appendChild(document.createTextNode(option.label));
      choices.appendChild(label);
    });
    fieldset.appendChild(choices);
    dassContainer.appendChild(fieldset);
  });
}
renderDassItems();

// Pop click sound via Web Audio; starts only after user interaction, with no audio file.
let audioContext;
function popSound() {
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain); gain.connect(audioContext.destination);
    osc.start(now); osc.stop(now + 0.13);
  } catch (error) {
    // Sound is decorative; form must still work if audio is unavailable.
  }
}
document.addEventListener("click", event => {
  if (event.target.closest("button, .dass-choices label")) popSound();
});

function setStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
}

function collectAnswers() {
  const data = {};
  const fields = new FormData(form);
  for (const [key, value] of fields.entries()) {
    if (key.startsWith("dass_")) {
      data[key] = value;
    } else if (key !== "consent") {
      data[key] = String(value).trim();
    }
  }
  data.consent = fields.get("consent") === "on";
  data.dassItemCount = CONFIG.dassItems.length;
  data.submittedAtClient = new Date().toISOString();
  return data;
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  popSound();

  if (!form.reportValidity()) {
    setStatus("Periksa kembali isian yang masih kosong atau belum valid.", "error");
    return;
  }
  const age = Number(form.elements.age.value);
  if (!Number.isInteger(age) || age < 17 || age > 24) {
    setStatus("Survei ini hanya untuk responden berusia 17–24 tahun.", "error");
    form.elements.age.focus();
    return;
  }
  if (CONFIG.dassItems.length !== 42) {
    setStatus("Pengiriman dinonaktifkan: masukkan dan verifikasi 42 item resmi sesuai lampiran dosen terlebih dahulu.", "error");
    dassContainer.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (CONFIG.WEB_APP_URL.includes("PASTE_YOUR") || !CONFIG.WEB_APP_URL.startsWith("https://script.google.com/")) {
    setStatus("URL Google Apps Script belum diatur. Ikuti README.md sebelum menguji pengiriman.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.querySelector("span").textContent = "Mengirim…";
  setStatus("Mengirim jawaban. Jangan tutup halaman dulu.");

  try {
    // no-cors makes the response opaque; browser cannot confirm server-side success.
    // Always verify the row appears in the private Google Sheet before relying on it.
    await fetch(CONFIG.WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(collectAnswers())
    });
    setStatus("Permintaan pengiriman telah dikirim. Karena browser membatasi respons, status simpan belum bisa dipastikan di halaman ini. Pengelola perlu memeriksa Google Sheets untuk memastikan baris masuk.", "");
    form.reset();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    setStatus("Pengiriman gagal dimulai. Periksa koneksi internet dan URL deployment, lalu coba lagi.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector("span").textContent = "Kirim jawaban";
  }
});
