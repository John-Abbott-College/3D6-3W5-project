// Talks to DAB's REST API. Start DAB with run.bat first.
const API = "http://localhost:5000/api/Book";

const rows = document.getElementById("Book-rows");
const form = document.getElementById("Book-form");
const statusEl = document.getElementById("status");
const fields = {
  id: document.getElementById("BookId"),
  englishTitle: document.getElementById("englishTitle"),
  originalTitle: document.getElementById("originalTitle"),
  author: document.getElementById("author"),
  year: document.getElementById("year"),
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

async function loadBooks() {
  try {
    const data = await api(API);          // DAB wraps results as { value: [...] }
    renderRows(data.value);
    setStatus(data.value.length + " Books");
  } catch (err) {
    setStatus(err.message, true);
  }
}

function renderRows(Books) {
  rows.replaceChildren();
  for (const s of Books) {
    const tr = document.createElement("tr");
    // textContent (not innerHTML) so data from the database can't inject HTML
    for (const text of [s.BookId, s.OriginalTitle ? s.EnglishTitle + "(" + s.OriginalTitle + ")" : s.EnglishTitle, s.Author ?? "(unknown)", s.FirstEditionYear ?? "(unknown)"]) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.append(td);
    }
    const actions = document.createElement("td");
    const editBtn = button("Edit", () => startEdit(s));
    const delBtn = button("Delete", () => deleteBook(s));
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
  fields.id.value = s.BookId;
  fields.englishTitle.value = s.EnglishTitle;
  fields.originalTitle.value = s.OriginalTitle;
  fields.author.value = s.Author ?? "";
  fields.firstEditionYear.value = s.FirstEditionYear ?? "";

  formTitle.textContent = "Edit Book " + s.BookId;
  saveBtn.textContent = "Save changes";
  cancelBtn.hidden = false;
  fields.firstName.focus();
}

function resetForm() {
  form.reset();
  fields.id.value = "";
  formTitle.textContent = "Add a Book";
  saveBtn.textContent = "Add Book";
  cancelBtn.hidden = true;
}

async function deleteBook(s) {
  if (!confirm("Delete " + s.EnglishTitle + " ?")) return;
  try {
    await api(API + "/BookId/" + s.BookId, { method: "DELETE" });
    await loadBooks();
  } catch (err) {
    setStatus(err.message, true);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const Book = {
    EnglishTitle: fields.englishTitle.value.trim(),
    OriginalTitle: fields.originalTitle.value.trim() || null,
    Author: fields.author.value.trim() || null,
    FirstEditionYear: fields.firstEditionYear.value.trim() || null,
  };
  const id = fields.id.value;
  try {
    await api(id ? API + "/BookId/" + id : API, {
      method: id ? "PATCH" : "POST",       // POST = create, PATCH = update
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Book),
    });
    resetForm();
    await loadBooks();
  } catch (err) {
    setStatus(err.message, true);
  }
});

cancelBtn.addEventListener("click", resetForm);
loadBooks();
