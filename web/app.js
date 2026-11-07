// Talks to DAB's REST API. Start DAB with run.bat first.
const API_ROOT = "http://localhost:5000/api";
const BOOK_URL = API_ROOT + "/Book";                  // table: create, update, delete
const BOOK_DETAILS_URL = API_ROOT + "/BookDetails";   // view (JOIN with Author): read-only list
const AUTHOR_URL = API_ROOT + "/Author";              // table: create, read, update, delete

const statusEl = document.getElementById("status");

// ---- Book form and table ----
const bookRows = document.getElementById("book-rows");
const bookForm = document.getElementById("book-form");
const bookFormTitle = document.getElementById("book-form-title");
const bookSaveBtn = document.getElementById("book-save-btn");
const bookCancelBtn = document.getElementById("book-cancel-btn");
const bookFields = {
  id: document.getElementById("bookId"),
  englishTitle: document.getElementById("englishTitle"),
  originalTitle: document.getElementById("originalTitle"),
  authorId: document.getElementById("authorId"),            // <select> of existing authors
  firstEditionYear: document.getElementById("firstEditionYear"),
};
bookFields.firstEditionYear.max = new Date().getFullYear(); // no hard-coded year

// ---- Author form and table ----
const authorRows = document.getElementById("author-rows");
const authorForm = document.getElementById("author-form");
const authorFormTitle = document.getElementById("author-form-title");
const authorSaveBtn = document.getElementById("author-save-btn");
const authorCancelBtn = document.getElementById("author-cancel-btn");
const authorFields = {
  id: document.getElementById("editAuthorId"),
  name: document.getElementById("authorName"),
};

let authors = [];   // latest list from DAB; used to fill the book form's drop-down

// ---- Helpers ----
function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "error" : "";
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Wraps fetch: throws a readable Error if DAB answers with a non-2xx status.
async function api(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error("Can't reach DAB at " + url + ". Is run.bat running?");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError("DAB returned " + res.status + ": " + body, res.status);
  }
  return res.status === 204 ? null : res.json();
}

function sendJson(url, method, data) {
  return api(url, {
    method,                                  // POST = create, PATCH = update
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

function cell(text) {
  const td = document.createElement("td");
  td.textContent = text;   // textContent (not innerHTML) so database data can't inject HTML
  return td;
}

function button(label, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function actionsCell(onEdit, onDelete) {
  const td = document.createElement("td");
  td.append(button("Edit", onEdit), " ", button("Delete", onDelete));
  return td;
}

function numberOrNull(text) {
  const t = text.trim();
  return t === "" ? null : Number(t);
}

// ---- Loading ----
async function loadAuthors() {
  const data = await api(AUTHOR_URL + "?$orderby=AuthorName");   // DAB wraps results as { value: [...] }
  authors = data.value;
  renderAuthorRows();
  renderAuthorOptions();
  return authors;
}

async function loadBooks() {
  const data = await api(BOOK_DETAILS_URL);
  renderBookRows(data.value);
  return data.value;
}

// Authors first, so the book form's drop-down is ready before a book is edited.
async function refreshAll() {
  try {
    await loadAuthors();
    const books = await loadBooks();
    setStatus(books.length + " books, " + authors.length + " authors");
  } catch (err) {
    setStatus(err.message, true);
  }
}

// ---- Authors ----
function renderAuthorRows() {
  authorRows.replaceChildren();
  for (const a of authors) {
    const tr = document.createElement("tr");
    tr.append(
      cell(a.AuthorId),
      cell(a.AuthorName),
      actionsCell(() => startAuthorEdit(a), () => deleteAuthor(a))
    );
    authorRows.append(tr);
  }
}

// Rebuild the book form's drop-down, keeping the current choice if there is one.
function renderAuthorOptions() {
  const selected = bookFields.authorId.value;
  bookFields.authorId.replaceChildren(new Option("Select an author", ""));
  for (const a of authors) {
    bookFields.authorId.append(new Option(a.AuthorName, a.AuthorId));
  }
  bookFields.authorId.value = selected;
}

function startAuthorEdit(a) {
  authorFields.id.value = a.AuthorId;
  authorFields.name.value = a.AuthorName;
  authorFormTitle.textContent = "Edit author " + a.AuthorId;
  authorSaveBtn.textContent = "Save changes";
  authorCancelBtn.hidden = false;
  authorFields.name.focus();
}

function resetAuthorForm() {
  authorForm.reset();
  authorFields.id.value = "";
  authorFormTitle.textContent = "Add an author";
  authorSaveBtn.textContent = "Add author";
  authorCancelBtn.hidden = true;
}

async function deleteAuthor(a) {
  if (!confirm("Delete " + a.AuthorName + "?")) return;
  try {
    await api(AUTHOR_URL + "/AuthorId/" + a.AuthorId, { method: "DELETE" });
    await refreshAll();
  } catch (err) {
    // The database refuses to delete an author who still has books (foreign key).
    if (err.status === 409 || /REFERENCE constraint|FOREIGN KEY/i.test(err.message)) {
      setStatus("Can't delete " + a.AuthorName + ": books still refer to this author. Reassign or delete those books first.", true);
    } else {
      setStatus(err.message, true);
    }
  }
}

authorForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const author = { AuthorName: authorFields.name.value.trim() };
  const id = authorFields.id.value;
  try {
    await sendJson(id ? AUTHOR_URL + "/AuthorId/" + id : AUTHOR_URL, id ? "PATCH" : "POST", author);
    resetAuthorForm();
    await refreshAll();   // book rows show author names too, so reload both
  } catch (err) {
    setStatus(err.message, true);
  }
});

authorCancelBtn.addEventListener("click", resetAuthorForm);

// ---- Books ----
function renderBookRows(books) {
  bookRows.replaceChildren();
  for (const b of books) {
    const title = b.OriginalTitle ? b.EnglishTitle + " (" + b.OriginalTitle + ")" : b.EnglishTitle;
    const tr = document.createElement("tr");
    tr.append(
      cell(b.BookId),
      cell(title),
      cell(b.AuthorName ?? "(unknown)"),     // name comes from the JOIN in the view
      cell(b.FirstEditionYear ?? "(unknown)"),
      actionsCell(() => startBookEdit(b), () => deleteBook(b))
    );
    bookRows.append(tr);
  }
}

function startBookEdit(b) {
  bookFields.id.value = b.BookId;
  bookFields.englishTitle.value = b.EnglishTitle;
  bookFields.originalTitle.value = b.OriginalTitle ?? "";
  bookFields.authorId.value = b.AuthorId ?? "";     // the view must include AuthorId
  bookFields.firstEditionYear.value = b.FirstEditionYear ?? "";

  bookFormTitle.textContent = "Edit book " + b.BookId;
  bookSaveBtn.textContent = "Save changes";
  bookCancelBtn.hidden = false;
  bookFields.englishTitle.focus();
}

function resetBookForm() {
  bookForm.reset();
  bookFields.id.value = "";
  bookFormTitle.textContent = "Add a book";
  bookSaveBtn.textContent = "Add book";
  bookCancelBtn.hidden = true;
}

async function deleteBook(b) {
  if (!confirm("Delete " + b.EnglishTitle + "?")) return;
  try {
    await api(BOOK_URL + "/BookId/" + b.BookId, { method: "DELETE" });
    await refreshAll();
  } catch (err) {
    setStatus(err.message, true);
  }
}

bookForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const book = {
    EnglishTitle: bookFields.englishTitle.value.trim(),
    OriginalTitle: bookFields.originalTitle.value.trim() || null,
    AuthorId: numberOrNull(bookFields.authorId.value),   // the id of an existing author
    FirstEditionYear: numberOrNull(bookFields.firstEditionYear.value),
  };
  const id = bookFields.id.value;
  try {
    await sendJson(id ? BOOK_URL + "/BookId/" + id : BOOK_URL, id ? "PATCH" : "POST", book);
    resetBookForm();
    await refreshAll();
  } catch (err) {
    setStatus(err.message, true);
  }
});

bookCancelBtn.addEventListener("click", resetBookForm);

refreshAll();
