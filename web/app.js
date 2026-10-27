// Talks to DAB's REST API. Start DAB with run.bat first.
const API = "http://localhost:5000/api/Student";

const rows = document.getElementById("student-rows");
const form = document.getElementById("student-form");
const statusEl = document.getElementById("status");
const fields = {
  id: document.getElementById("studentId"),
  firstName: document.getElementById("firstName"),
  lastName: document.getElementById("lastName"),
  program: document.getElementById("program"),
  email: document.getElementById("email"),
};
const formTitle = document.getElementById("form-title");
const saveBtn = document.getElementById("save-btn");
const cancelBtn = document.getElementById("cancel-btn");

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "error" : "";
}

// Wraps fetch: throws a readable Error if DAB answers with a non-2xx status.
async function api(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error("Can't reach DAB at " + API + ". Is run.bat running?");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error("DAB returned " + res.status + ": " + body);
  }
  return res.status === 204 ? null : res.json();
}

async function loadStudents() {
  try {
    const data = await api(API);          // DAB wraps results as { value: [...] }
    renderRows(data.value);
    setStatus(data.value.length + " students");
  } catch (err) {
    setStatus(err.message, true);
  }
}

function renderRows(students) {
  rows.replaceChildren();
  for (const s of students) {
    const tr = document.createElement("tr");
    // textContent (not innerHTML) so data from the database can't inject HTML
    for (const text of [s.StudentId, s.FirstName + " " + s.LastName, s.Program ?? "", s.Email ?? ""]) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.append(td);
    }
    const actions = document.createElement("td");
    const editBtn = button("Edit", () => startEdit(s));
    const delBtn = button("Delete", () => deleteStudent(s));
    actions.append(editBtn, " ", delBtn);
    tr.append(actions);
    rows.append(tr);
  }
}

function button(label, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function startEdit(s) {
  fields.id.value = s.StudentId;
  fields.firstName.value = s.FirstName;
  fields.lastName.value = s.LastName;
  fields.program.value = s.Program ?? "";
  fields.email.value = s.Email ?? "";
  formTitle.textContent = "Edit student " + s.StudentId;
  saveBtn.textContent = "Save changes";
  cancelBtn.hidden = false;
  fields.firstName.focus();
}

function resetForm() {
  form.reset();
  fields.id.value = "";
  formTitle.textContent = "Add a student";
  saveBtn.textContent = "Add student";
  cancelBtn.hidden = true;
}

async function deleteStudent(s) {
  if (!confirm("Delete " + s.FirstName + " " + s.LastName + "?")) return;
  try {
    await api(API + "/StudentId/" + s.StudentId, { method: "DELETE" });
    await loadStudents();
  } catch (err) {
    setStatus(err.message, true);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const student = {
    FirstName: fields.firstName.value.trim(),
    LastName: fields.lastName.value.trim(),
    Program: fields.program.value.trim() || null,
    Email: fields.email.value.trim() || null,
  };
  const id = fields.id.value;
  try {
    await api(id ? API + "/StudentId/" + id : API, {
      method: id ? "PATCH" : "POST",       // POST = create, PATCH = update
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(student),
    });
    resetForm();
    await loadStudents();
  } catch (err) {
    setStatus(err.message, true);
  }
});

cancelBtn.addEventListener("click", resetForm);
loadStudents();
