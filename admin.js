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
let monthlyChart = null;
let distributionChart = null;
const loginBox = document.getElementById("loginBox");
const dashboard = document.getElementById("dashboard");
const loginError = document.getElementById("loginError");

document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));
document.getElementById("exportBtn").addEventListener("click", exportCsv);
document.getElementById("reportBtn").addEventListener("click", generatePdfReport);
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
const objective = 90;
const gap = globalPercent - objective;

document.getElementById("qualityGap").textContent =
  gap >= 0
    ? `Objectif atteint (+${gap}%)`
    : `Écart à combler : ${gap}%`;
  const gapElement = document.getElementById("qualityGap");

if (gap >= 0) {
  gapElement.style.color = "#2e9e38";
} else {
  gapElement.style.color = "#d71920";
}
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
renderDistributionChart();
renderMonthlyChart();
renderComments();
renderMonthlyTrend();
renderPositiveHighlights();
}
function renderMonthlyChart() {

  const canvas = document.getElementById("monthlyChart");

  if (!canvas) return;

  const monthlyData = {};

  filteredResponses.forEach(response => {

    if (!response.localSubmittedAt) return;

    const date = new Date(response.localSubmittedAt);

    const month = date.toLocaleDateString("fr-FR", {
      month: "short",
      year: "numeric"
    });

    if (!monthlyData[month]) {
      monthlyData[month] = {
        total: 0,
        count: 0
      };
    }

    monthlyData[month].total += Number(response.satisfactionPercent || 0);
    monthlyData[month].count += 1;
  });

  const labels = Object.keys(monthlyData);

  const values = labels.map(month =>
    Math.round(
      monthlyData[month].total /
      monthlyData[month].count
    )
  );

  if (monthlyChart) {
    monthlyChart.destroy();
  }

  monthlyChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Satisfaction moyenne (%)",
        data: values,
        tension: 0.3,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100
        }
      }
    }
  });
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
function renderDistributionChart() {

  const canvas = document.getElementById("distributionChart");

  if (!canvas) return;

  const distribution = {
    "Très satisfait": 0,
    "Satisfait": 0,
    "Moyen": 0,
    "Insatisfait": 0,
    "Très insatisfait": 0
  };

  filteredResponses.forEach(response => {

    const score = Math.round(Number(response.scoreAverage || 0));

    if (score === 5) distribution["Très satisfait"]++;
    else if (score === 4) distribution["Satisfait"]++;
    else if (score === 3) distribution["Moyen"]++;
    else if (score === 2) distribution["Insatisfait"]++;
    else if (score === 1) distribution["Très insatisfait"]++;
  });

  if (distributionChart) {
    distributionChart.destroy();
  }

  distributionChart = new Chart(canvas, {
    type: "pie",
    data: {
      labels: Object.keys(distribution),
      datasets: [{
        data: Object.values(distribution)
      }]
    },
    options: {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "right",
      labels: {
        boxWidth: 18,
        padding: 15
      }
    }
  }
}
  });
}
function renderComments() {
  const comments = filteredResponses
    .filter(response => response.comment && response.comment.trim() !== "")
    .slice(0, 10);

  const commentCount = document.getElementById("commentCount");
  const commentsList = document.getElementById("commentsList");

  if (!commentCount || !commentsList) return;

  commentCount.textContent = `${comments.length} commentaire${comments.length > 1 ? "s" : ""}`;

  if (!comments.length) {
    commentsList.innerHTML = "<p>Aucun commentaire pour le moment.</p>";
    return;
  }

  commentsList.innerHTML = comments.map(response => {
    const date = response.localSubmittedAt
      ? new Date(response.localSubmittedAt).toLocaleDateString("fr-FR")
      : "Date non disponible";

    const score = response.scoreAverage
      ? `${response.scoreAverage}/5`
      : "-";

    return `
      <article class="comment-item">
        <p>${escapeHtml(response.comment)}</p>
        <small>${date} — Score : ${score}</small>
      </article>
    `;
  }).join("");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
async function generatePdfReport() {

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
const logo = new Image();
logo.src = "assets/logo-amana.png";

await new Promise(resolve => {
  logo.onload = resolve;
  logo.onerror = resolve;
});

try {
  doc.addImage(logo, "PNG", 20, 10, 45, 25);
} catch (e) {
  console.warn("Logo non chargé dans le PDF", e);
}
  const totalResponses =
    document.getElementById("totalResponses").textContent;

  const globalSatisfaction =
    document.getElementById("globalSatisfaction").textContent;

  const averageScore =
    document.getElementById("averageScore").textContent;

  let qualityIndicator =
  document.getElementById("qualityIndicator").textContent;

qualityIndicator = qualityIndicator
  .replace("🟢","")
  .replace("🟠","")
  .replace("🔴","")
  .trim();

  const bestQuestion =
    document.getElementById("bestQuestion").textContent;

  const weakQuestion =
    document.getElementById("weakQuestion").textContent;

  const qualityGap =
    document.getElementById("qualityGap").textContent;

  let y = 45;

  doc.setFontSize(18);
  doc.text("RAPPORT QUALITE", 75, 20);
doc.setFontSize(12);
doc.text("Laboratoire AMANA de Pathologie", 75, 28);

  y += 15;

  doc.setFontSize(11);
  doc.text(
    `Date : ${new Date().toLocaleDateString("fr-FR")}`,
    20,
    y
  );

  y += 15;

  doc.text(`Nombre de réponses : ${totalResponses}`, 20, y);
  y += 10;

  doc.text(`Satisfaction globale : ${globalSatisfaction}`, 20, y);
  y += 10;

  doc.text(`Score moyen : ${averageScore}`, 20, y);
  y += 10;

  doc.text(`Indicateur qualité : ${qualityIndicator}`, 20, y);
  y += 10;

  doc.text(`Point fort : ${bestQuestion}`, 20, y);
  y += 10;

  doc.text(`Point à améliorer : ${weakQuestion}`, 20, y);
  y += 10;

  doc.text(`${qualityGap}`, 20, y);
  y += 20;

const chartCanvas = document.getElementById("satisfactionChart");

if (chartCanvas) {

  const chartImage = chartCanvas.toDataURL("image/png");

  doc.addPage();

  doc.setFontSize(16);
  doc.text("Graphique de satisfaction par question", 20, 20);

  doc.addImage(
    chartImage,
    "PNG",
    15,
    30,
    180,
    90
  );
}
    const distributionCanvas = document.getElementById("distributionChart");

  if (distributionCanvas) {

    const distributionImage = distributionCanvas.toDataURL("image/png");

    doc.addPage();

    doc.setFontSize(16);
    doc.text("Répartition des réponses", 20, 20);

    doc.addImage(
      distributionImage,
      "PNG",
      35,
      35,
      140,
      100
    );
  }

  doc.save(
    `Rapport_Qualite_AMANA_${new Date().toISOString().slice(0,10)}.pdf`
  );
y += 20;

doc.setFontSize(14);
doc.text("Conclusion", 20, y);

y += 10;

const conclusion = `
Le taux de satisfaction global est de ${globalSatisfaction}.

L'objectif qualité fixé à 90% ou plus ${
  parseInt(globalSatisfaction) >= 90
    ? "est atteint."
    : "n'est pas atteint."
}

${qualityGap}

Le principal point à améliorer est :
${weakQuestion}.

Une analyse des causes et un plan d'amélioration sont recommandés.
`;

doc.setFontSize(11);

const lines = doc.splitTextToSize(conclusion, 170);
doc.text(lines, 20, y + 10);
  y += 60;

doc.setFontSize(14);
doc.text("Plan d'action recommande", 20, y);

y += 10;

let action = "";

if (weakQuestion.includes("Accueil")) {
  action =
    "- Sensibilisation du personnel d'accueil\n" +
    "- Analyse des reclamations liees a l'accueil\n" +
    "- Evaluation de l'efficacite lors du prochain suivi";
}
else if (weakQuestion.includes("attente")) {
  action =
    "- Analyse des causes de retard\n" +
    "- Optimisation du flux patient\n" +
    "- Suivi mensuel du temps d'attente";
}
else if (weakQuestion.includes("resultats")) {
  action =
    "- Analyse des retards de rendu\n" +
    "- Renforcement du suivi des delais\n" +
    "- Evaluation lors de la prochaine revue";
}
else {
  action =
    "- Analyse des causes\n" +
    "- Mise en place d'actions correctives\n" +
    "- Verification de l'efficacite";
}

doc.setFontSize(11);

const actionLines = doc.splitTextToSize(action, 170);
doc.text(actionLines, 20, y + 10);
  doc.save(
    `Rapport_Qualite_AMANA_${new Date().toISOString().slice(0,10)}.pdf`
  );
}
function renderPositiveHighlights() {

  const container = document.getElementById("positiveHighlights");

  if (!container) return;

  const comments = filteredResponses
    .filter(r => r.comment && r.comment.trim() !== "")
    .map(r => r.comment.toLowerCase());

  if (!comments.length) {
    container.innerHTML = "<p>Aucun commentaire disponible.</p>";
    return;
  }

  const keywords = {
    accueil: "✓ Bon accueil",
    aimable: "✓ Personnel aimable",
    sympathique: "✓ Personnel sympathique",
    rapide: "✓ Rapidité des résultats",
    professionnel: "✓ Professionnalisme",
    propre: "✓ Propreté du laboratoire",
    satisfait: "✓ Satisfaction générale élevée"
  };

  const highlights = [];

  Object.entries(keywords).forEach(([word, label]) => {
    if (comments.some(comment => comment.includes(word))) {
      highlights.push(label);
    }
  });

  if (!highlights.length) {
    container.innerHTML =
      "<p>Pas assez de commentaires pour identifier des tendances.</p>";
    return;
  }

  container.innerHTML =
    "<ul>" +
    highlights.map(item => `<li>${item}</li>`).join("") +
    "</ul>";
}
function renderMonthlyTrend() {

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const currentMonthResponses = allResponses.filter(r => {
    const d = new Date(r.localSubmittedAt);
    return d.getMonth() === currentMonth &&
           d.getFullYear() === currentYear;
  });

  const previousMonthResponses = allResponses.filter(r => {
    const d = new Date(r.localSubmittedAt);

    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    return d.getMonth() === prevMonth &&
           d.getFullYear() === prevYear;
  });

  const currentCount = currentMonthResponses.length;
  const previousCount = previousMonthResponses.length;

  const trendElement = document.getElementById("monthlyTrend");
  const textElement = document.getElementById("monthlyTrendText");

  if (!trendElement || !textElement) return;

  if (previousCount === 0) {
    trendElement.textContent = `${currentCount} réponses`;
    textElement.textContent = "Premier mois de suivi";
    return;
  }

  const evolution = Math.round(
    ((currentCount - previousCount) / previousCount) * 100
  );

  trendElement.textContent =
    evolution >= 0 ? `↗ +${evolution}%` : `↘ ${evolution}%`;

  textElement.textContent =
    `${currentCount} réponses vs ${previousCount} le mois précédent`;
}
