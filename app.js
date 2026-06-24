import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase.js";
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const questions = [
  { id:"accueil_visite", ar:"كيف تقيم الاستقبال والرعاية أثناء زيارتك لمختبرنا؟", fr:"Comment évaluez-vous l'accueil lors de votre visite à notre laboratoire ?" },
  { id:"accueil_telephonique", ar:"كيف تقيم الاستقبال عبر الهاتف في مختبرنا؟", fr:"Comment évaluez-vous l'accueil téléphonique de notre laboratoire ?" },
  { id:"temps_attente", ar:"هل كان وقت الانتظار معقولاً؟", fr:"Le temps d'attente avant votre prise en charge a-t-il été raisonnable ?" },
  { id:"confort_proprete", ar:"كيف تقيم الراحة والنظافة في مختبرنا؟", fr:"Comment évaluez-vous le confort et la propreté du laboratoire ?" },
  { id:"delai_resultats", ar:"هل تم تسليم نتائج تحاليلك في الوقت المتفق عليه؟", fr:"Les résultats de vos analyses ont-ils été délivrés dans les délais convenus ?" },
  { id:"satisfaction_globale", ar:"هل أنت راضٍ بشكل عام عن خدمات مختبرنا؟", fr:"Êtes-vous globalement satisfait(e) des services de notre laboratoire ?" }
];
const urlSource = new URLSearchParams(window.location.search).get("source");

const source = urlSource || (
  window.innerWidth <= 768 ? "mobile" : "tablette"
);
let currentQuestionIndex = 0;
let answers = {};
const screens = {
  welcome: document.getElementById("welcomeScreen"),
  question: document.getElementById("questionScreen"),
  comment: document.getElementById("commentScreen"),
  thanks: document.getElementById("thankScreen")
};
const questionAr = document.getElementById("questionAr");
const questionFr = document.getElementById("questionFr");
const progressText = document.getElementById("progressText");
const progressTextAr = document.getElementById("progressTextAr");
const progressFill = document.getElementById("progressFill");
const statusMessage = document.getElementById("statusMessage");
document.getElementById("startBtn").addEventListener("click", startSurvey);
document.querySelectorAll(".emoji-option").forEach(button => button.addEventListener("click", () => selectAnswer(Number(button.dataset.score))));
document.getElementById("skipCommentBtn").addEventListener("click", () => submitSurvey(""));
document.getElementById("submitCommentBtn").addEventListener("click", () => {
  const comment = document.getElementById("patientComment").value.trim();
  submitSurvey(comment);
});
function showScreen(name){ Object.values(screens).forEach(s=>s.classList.remove("active")); screens[name].classList.add("active"); }
function startSurvey(){ currentQuestionIndex = 0; answers = {}; showQuestion(); }
function showQuestion(){ const q=questions[currentQuestionIndex]; questionAr.textContent=q.ar; questionFr.textContent=q.fr; const n=currentQuestionIndex+1,t=questions.length; progressText.textContent=`Question ${n} / ${t}`; progressTextAr.textContent=`سؤال ${n} / ${t}`; progressFill.style.width=`${(n/t)*100}%`; showScreen("question");

window.scrollTo({
  top: 0,
  behavior: "smooth"
}); }
async function selectAnswer(score){ const q=questions[currentQuestionIndex]; answers[q.id]=score; currentQuestionIndex++; if(currentQuestionIndex<questions.length){

  setTimeout(() => {

    showQuestion();

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }, 200);

  return;
} document.getElementById("patientComment").value = "";
showScreen("comment"); }
async function submitSurvey(comment = ""){ const values=Object.values(answers); const avg=values.reduce((s,v)=>s+v,0)/values.length; const percent=Math.round((avg/5)*100); const payload={answers,comment: comment,scoreAverage:Number(avg.toFixed(2)),satisfactionPercent:percent,source,questionCount:questions.length,submittedAt:serverTimestamp(),localSubmittedAt:new Date().toISOString(),appVersion:"1.0.0"}; try{ await addDoc(collection(db,"responses"),payload); showScreen("thanks"); setTimeout(()=>showScreen("welcome"),5000); }catch(e){ console.error(e); showStatus("Erreur d'enregistrement. Vérifiez la connexion internet."); showScreen("welcome"); }}
function showStatus(message){ statusMessage.textContent=message; statusMessage.classList.remove("hidden"); setTimeout(()=>statusMessage.classList.add("hidden"),5000); }
