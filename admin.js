import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { firebaseConfig } from "./firebase.js";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const questionsLabels = {
  accueil_visite: "Accueil lors de la visite",
  accueil_telephonique: "Accueil téléphonique",
  temps_attente: "Temps d'attente",
  confort_proprete: "Confort et propreté",
  delai_resultats: "Délai de remise des résultats",
  satisfaction_globale: "Satisfaction globale"
};

let allResponses = [];
let filteredResponses = [];
let satisfactionChart = null;
const loginBox = document.getElementById("loginBox");
const dashboard = document.getElementById("dashboard");
const loginError = document.getElementById("loginError");

document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));
document.getElementById("exportBtn").addEventListener("click", exportCsv);
document.getElementById("filterBtn").addEventListener("click", applyDateFilter);
document.getElementById("resetFilterBtn").addEventListener("click", resetDateFilter);
onAuthStateChanged(auth, async user => {
  if (user) {
    loginBox.classList.add("hidden");
    dashboard.classList.remove("hidden");
    await loadDashboard();
  } else {
    dashboard.classList.add("hidden");
    loginBox.classList.remove("hidden");
  }
});

async function login() {
  loginError.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    console.error(e);
    loginError.textContent = "Email ou mot de passe incorrect.";
  }
}

async function loadDashboard() {
  const q = query(collection(db, "responses"), orderBy("localSubmittedAt", "desc"));
  const snap = await getDocs(q);

  allResponses = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

 filteredResponses = allResponses;
renderStats();
}

function renderStats() {
  const total = filteredResponses.length;

  document.getElementById("totalResponses").textContent = total;

  if (!total) {
    document.getElementById("globalSatisfaction").textContent = "0%";
    document.getElementById("averageScore").textContent = "0/5";
    document.getElementById("questionStats").innerHTML = "<p>Aucune réponse pour le moment.</p>";

    document.getElementById("qualityIndicator").textContent = "-";
    document.getElementById("qualityStatus").textContent = "En attente de données";
    document.getElementById("bestQuestion").textContent = "-";
    document.getElementById("bestQuestionScore").textContent = "-";
    document.getElementById("weakQuestion").textContent = "-";
    document.getElementById("weakQuestionScore").textContent = "-";
    return;
  }

  const average = filteredResponses.reduce((sum, r) => sum + Number(r.scoreAverage || 0), 0) / total;
  const globalPercent = Math.round((average / 5) * 100);

  document.getElementById("globalSatisfaction").textContent = `${globalPercent}%`;
  document.getElementById("averageScore").textContent = `${average.toFixed(2)}/5`;

  renderQualityIndicator(globalPercent);

  const questionStats = {};

  Object.keys(questionsLabels).forEach(key => {
    const scores = filteredResponses
      .map(r => Number(r.answers?.[key] || 0))
      .filter(Boolean);

    const avg = scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    const percent = Math.round((avg / 5) * 100);

    questionStats[key] = {
      label: questionsLabels[key],
      average: avg,
      percent
    };
  });

renderBestAndWeakPoints(questionStats);
renderQuestionBars(questionStats);
renderChart(questionStats);
}

function renderQualityIndicator(percent) {
  const indicator = document.getElementById("qualityIndicator");
  const status = document.getElementById("qualityStatus");

  if (percent >= 90) {
    indicator.textContent = "🟢 Conforme";
    status.textContent = "Niveau de satisfaction très satisfaisant";
  } else if (percent >= 80) {
    indicator.textContent = "🟠 À surveiller";
    status.textContent = "Niveau acceptable avec amélioration possible";
  } else {
    indicator.textContent = "🔴 Action requise";
    status.textContent = "Une analyse et des actions d'amélioration sont recommandées";
  }
}

function renderBestAndWeakPoints(stats) {
  const statsArray = Object.values(stats).filter(item => item.average > 0);

  if (!statsArray.length) return;

  const best = statsArray.reduce((a, b) => a.percent >= b.percent ? a : b);
  const weak = statsArray.reduce((a, b) => a.percent <= b.percent ? a : b);

  document.getElementById("bestQuestion").textContent = best.label;
  document.getElementById("bestQuestionScore").textContent = `${best.percent}% — ${best.average.toFixed(2)}/5`;

  document.getElementById("weakQuestion").textContent = weak.label;
  document.getElementById("weakQuestionScore").textContent = `${weak.percent}% — ${weak.average.toFixed(2)}/5`;
}

function renderQuestionBars(stats) {
  document.getElementById("questionStats").innerHTML = Object.values(stats)
    .map(item => {
      let statusClass = "good";
      let statusText = "Satisfaisant";

      if (item.percent < 80) {
        statusClass = "danger";
        statusText = "Action recommandée";
      } else if (item.percent < 90) {
        statusClass = "warning";
        statusText = "À surveiller";
      }

      return `
        <div class="question-row ${statusClass}">
          <label>
            ${item.label} — ${item.average.toFixed(2)}/5 (${item.percent}%)
            <span>${statusText}</span>
          </label>
          <div class="bar">
            <span style="width:${item.percent}%"></span>
          </div>
        </div>
      `;
    })
    .join("");
}

function exportCsv() {
  if (!allResponses.length) return;

  const header = [
    "date",
    "source",
    "scoreAverage",
    "satisfactionPercent",
    ...Object.keys(questionsLabels)
  ];

  const rows = allResponses.map(r => [
    r.localSubmittedAt || "",
    r.source || "",
    r.scoreAverage || "",
    r.satisfactionPercent || "",
    ...Object.keys(questionsLabels).map(key => r.answers?.[key] ?? "")
  ]);

  const csv = [header, ...rows]
    .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `satisfaction-amana-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}
function applyDateFilter() {
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  filteredResponses = allResponses.filter(response => {
    const responseDate = new Date(response.localSubmittedAt);

    if (startDate && responseDate < new Date(startDate)) {
      return false;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      if (responseDate > end) {
        return false;
      }
    }

    return true;
  });

  renderStats();
}

function resetDateFilter() {
  document.getElementById("startDate").value = "";
  document.getElementById("endDate").value = "";

  filteredResponses = allResponses;
  renderStats();
}
function renderChart(stats) {

  const ctx = document.getElementById("satisfactionChart");

  if (!ctx) return;

  const labels = Object.values(stats).map(item => item.label);
  const values = Object.values(stats).map(item => item.percent);

  if (satisfactionChart) {
    satisfactionChart.destroy();
  }

  satisfactionChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Satisfaction (%)",
        data: values,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}
