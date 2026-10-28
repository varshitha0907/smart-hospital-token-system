const DEPARTMENTS = ["General", "Dental", "Eye"];
const STORAGE_KEY = "smartHospitalTokenSystemPhase2";
const MINUTES_PER_PATIENT = 10;

function emptyState() {
  return { patients: [], nextToken: { General: 1, Dental: 1, Eye: 1 } };
}
function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return emptyState();
    const data = JSON.parse(saved);
    if (!data || !Array.isArray(data.patients) || !data.nextToken) return emptyState();
    DEPARTMENTS.forEach(function (dept) {
      if (!Number.isInteger(data.nextToken[dept])) {
        const nums = data.patients.filter(p => p.department === dept).map(p => Number(p.token) || 0);
        data.nextToken[dept] = Math.max(0, ...nums) + 1;
      }
    });
    data.patients.forEach(function (p) {
      if (!["waiting", "called", "in consultation", "completed"].includes(p.status)) p.status = "waiting";
    });
    return data;
  } catch (error) { return emptyState(); }
}
let state = loadData();
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function departmentPatients(dept) {
  return state.patients.filter(p => p.department === dept).sort((a, b) => a.token - b.token);
}
function findPatient(dept, token) {
  return state.patients.find(p => p.department === dept && Number(p.token) === Number(token));
}
function activePatient(dept, status) {
  return state.patients.find(p => p.department === dept && p.status === status);
}
function showQueue() {
  const dept = document.getElementById("queueDepartment").value;
  const body = document.getElementById("queueBody");
  body.innerHTML = "";
  const patients = departmentPatients(dept);
  if (!patients.length) {
    body.innerHTML = '<tr><td colspan="3">No patients registered yet.</td></tr>';
    return;
  }
  patients.forEach(function (p) {
    const row = document.createElement("tr");
    const token = document.createElement("td");
    const name = document.createElement("td");
    const status = document.createElement("td");
    const pill = document.createElement("span");
    token.textContent = p.token;
    name.textContent = p.name;
    pill.className = "status-pill status-" + p.status.replaceAll(" ", "-");
    pill.textContent = p.status;
    status.appendChild(pill);
    row.append(token, name, status);
    body.appendChild(row);
  });
}
function updateServing(dept) {
  const current = departmentPatients(dept).find(p => p.status === "called" || p.status === "in consultation");
  document.getElementById("currentlyServing").textContent = current ? "Token " + current.token : "None";
}
function showStatus(dept, token) {
  const details = document.getElementById("tokenDetails");
  const p = findPatient(dept, token);
  if (!p) {
    details.textContent = "Token not found in the selected department.";
    document.getElementById("patientsAhead").textContent = "—";
    document.getElementById("estimatedWait").textContent = "—";
    updateServing(dept);
    return;
  }
  const ahead = departmentPatients(dept).filter(other => other.token < p.token && other.status !== "completed").length;
  document.getElementById("patientsAhead").textContent = ahead;
  if (p.status === "waiting") {
    const mins = ahead * MINUTES_PER_PATIENT;
    document.getElementById("estimatedWait").textContent = mins + " minutes";
    details.textContent = "Your token is waiting. Estimated wait: " + mins + " minutes.";
  } else if (p.status === "called") {
    document.getElementById("estimatedWait").textContent = "0 minutes";
    details.textContent = "It is your turn! Please go to the doctor.";
  } else if (p.status === "in consultation") {
    document.getElementById("estimatedWait").textContent = "In progress";
    details.textContent = "Your consultation is in progress.";
  } else {
    document.getElementById("estimatedWait").textContent = "Completed";
    details.textContent = "Your consultation is completed.";
  }
  updateServing(dept);
}
function refreshVisibleStatus() {
  const token = document.getElementById("statusToken").value;
  const dept = document.getElementById("statusDepartment").value;
  if (token !== "") showStatus(dept, Number(token));
  else updateServing(dept);
}
function refreshAll() { showQueue(); refreshVisibleStatus(); }

document.getElementById("registrationForm").addEventListener("submit", function (event) {
  event.preventDefault();
  const nameInput = document.getElementById("patientName");
  const name = nameInput.value.trim();
  const dept = document.getElementById("patientDepartment").value;
  const message = document.getElementById("registrationMessage");
  if (!name) { message.textContent = "Please enter the patient name."; return; }
  const token = state.nextToken[dept]++;
  state.patients.push({ name, department: dept, token, status: "waiting" });
  saveData();
  message.textContent = "Hello " + name + "! Your token number is " + token + " (" + dept + "). Please keep this number.";
  document.getElementById("statusDepartment").value = dept;
  document.getElementById("statusToken").value = token;
  document.getElementById("queueDepartment").value = dept;
  document.getElementById("staffDepartment").value = dept;
  nameInput.value = "";
  refreshAll();
});

document.getElementById("statusForm").addEventListener("submit", function (event) {
  event.preventDefault();
  showStatus(document.getElementById("statusDepartment").value, Number(document.getElementById("statusToken").value));
});
document.getElementById("queueDepartment").addEventListener("change", showQueue);
document.getElementById("statusDepartment").addEventListener("change", refreshVisibleStatus);
document.getElementById("staffDepartment").addEventListener("change", function () {
  document.getElementById("staffStatus").textContent = "Managing " + this.value + " department.";
});

document.getElementById("callNext").addEventListener("click", function () {
  const dept = document.getElementById("staffDepartment").value;
  if (activePatient(dept, "called") || activePatient(dept, "in consultation")) {
    document.getElementById("staffStatus").textContent = "Finish the current patient's process before calling the next patient.";
    return;
  }
  const next = departmentPatients(dept).find(p => p.status === "waiting");
  if (!next) {
    document.getElementById("staffStatus").textContent = "No waiting patients in " + dept + " department.";
    return;
  }
  next.status = "called";
  saveData();
  document.getElementById("staffStatus").textContent = "Now calling Token " + next.token + " — " + next.name + " (" + dept + ").";
  refreshAll();
});
document.getElementById("startConsultation").addEventListener("click", function () {
  const dept = document.getElementById("staffDepartment").value;
  const p = activePatient(dept, "called");
  if (!p) {
    document.getElementById("staffStatus").textContent = "Please call a patient first in " + dept + " department.";
    return;
  }
  p.status = "in consultation";
  saveData();
  document.getElementById("staffStatus").textContent = "Consultation started for Token " + p.token + " — " + p.name + ".";
  refreshAll();
});
document.getElementById("completeConsultation").addEventListener("click", function () {
  const dept = document.getElementById("staffDepartment").value;
  const p = activePatient(dept, "in consultation");
  if (!p) {
    document.getElementById("staffStatus").textContent = "No consultation is in progress in " + dept + " department.";
    return;
  }
  p.status = "completed";
  saveData();
  document.getElementById("staffStatus").textContent = "Consultation completed for Token " + p.token + " — " + p.name + ".";
  refreshAll();
});
document.getElementById("resetDemo").addEventListener("click", function () {
  if (!confirm("Are you sure you want to clear all patients?")) return;
  state = emptyState();
  saveData();
  document.getElementById("registrationMessage").textContent = "";
  document.getElementById("staffStatus").textContent = "Demo reset successfully.";
  document.getElementById("statusToken").value = "";
  document.getElementById("tokenDetails").textContent = "Demo reset. Register a patient or enter a token to check status.";
  document.getElementById("patientsAhead").textContent = "0";
  document.getElementById("estimatedWait").textContent = "0 minutes";
  document.getElementById("currentlyServing").textContent = "None";
  refreshAll();
});
showQueue();
updateServing(document.getElementById("statusDepartment").value);
