// Talks to DAB's REST API. Start DAB with run.bat first.
const API_ROOT = "http://localhost:5000/api";
const BOOK_URL = API_ROOT + "/Book";                  // table: create, update, delete
const BOOK_DETAILS_URL = API_ROOT + "/BookDetails";   // view (JOIN with Author): read-only list
const AUTHOR_URL = API_ROOT + "/Author";              // table: create, read, update, delete
const FILES_URL = "http://localhost:3000/files";      // file-store service: book cover images
const MAX_COVER_BYTES = 10 * 1024 * 1024;             // the file store refuses anything bigger

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
  coverImageId: document.getElementById("coverImageId"),    // hidden: UUID of the saved cover, if any
  coverFile: document.getElementById("coverFile"),          // <input type="file"> for a new cover
};
const coverPreview = document.getElementById("coverPreview");
const coverRemoveBtn = document.getElementById("cover-remove-btn");
let coverRemoved = false;   // true once "Remove cover" was clicked on a saved cover
let previewUrl = null;      // object URL for a newly chosen (not yet uploaded) image
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

// ---- Cover images (file-store service) ----
function coverUrl(id) {
  return FILES_URL + "/" + id;   // works directly as an <img src>; no JavaScript fetch needed
}

// Uploads the image as the raw request body and returns the UUID the file store assigns.
async function uploadCover(file) {
  let res;
  try {
    res = await fetch(FILES_URL + "?filename=" + encodeURIComponent(file.name), {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
  } catch {
    throw new Error("Can't reach the file store at " + FILES_URL + ". Is it running (npm start)?");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error("File store returned " + res.status + ": " + (body.error ?? res.statusText));
  }
  return (await res.json()).id;
}

// Best effort: an orphaned image is harmless, so a failure here never blocks the user.
async function deleteCover(id) {
  if (!id) return;
  try {
    await fetch(FILES_URL + "/" + id, { method: "DELETE" });
  } catch {
    /* file store not running: leave the file behind */
  }
}

// Shows the newly chosen image if there is one, otherwise the saved cover, otherwise nothing.
function showCoverPreview() {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  const file = bookFields.coverFile.files[0];
  const savedId = coverRemoved ? "" : bookFields.coverImageId.value;
  if (file) {
    previewUrl = URL.createObjectURL(file);
    coverPreview.src = previewUrl;
  } else if (savedId) {
    coverPreview.src = coverUrl(savedId);
  } else {
    coverPreview.removeAttribute("src");
  }
  coverPreview.hidden = !(file || savedId);
  coverRemoveBtn.hidden = !(file || savedId);
}

function coverCell(id, title) {
  const td = document.createElement("td");
  if (id) {
    const img = document.createElement("img");
    img.className = "thumb";
    img.src = coverUrl(id);
    img.alt = "Cover of " + title;
    img.loading = "lazy";
    td.append(img);
  }
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
      coverCell(b.CoverImageId, title),
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
  bookFields.coverImageId.value = b.CoverImageId ?? "";   // the view must include CoverImageId
  bookFields.coverFile.value = "";
  coverRemoved = false;
  showCoverPreview();

  bookFormTitle.textContent = "Edit book " + b.BookId;
  bookSaveBtn.textContent = "Save changes";
  bookCancelBtn.hidden = false;
  bookFields.englishTitle.focus();
}

function resetBookForm() {
  bookForm.reset();
  bookFields.id.value = "";
  bookFields.coverImageId.value = "";
  coverRemoved = false;
  showCoverPreview();
  bookFormTitle.textContent = "Add a book";
  bookSaveBtn.textContent = "Add book";
  bookCancelBtn.hidden = true;
}

async function deleteBook(b) {
  if (!confirm("Delete " + b.EnglishTitle + "?")) return;
  try {
    await api(BOOK_URL + "/BookId/" + b.BookId, { method: "DELETE" });
    await deleteCover(b.CoverImageId);   // the row is gone, so its image can go too
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
  const oldCoverId = bookFields.coverImageId.value || null;
  const file = bookFields.coverFile.files[0];
  let newCoverId = null;
  try {
    // 1. Store the image first, so a book row only ever points at a file that exists.
    if (file) {
      newCoverId = await uploadCover(file);
      book.CoverImageId = newCoverId;
    } else if (coverRemoved) {
      book.CoverImageId = null;
    }   // otherwise leave CoverImageId out: PATCH keeps the old value, POST leaves it NULL

    // 2. Save the book row.
    try {
      await sendJson(id ? BOOK_URL + "/BookId/" + id : BOOK_URL, id ? "PATCH" : "POST", book);
    } catch (err) {
      await deleteCover(newCoverId);   // don't leave the new upload orphaned
      throw err;
    }

    // 3. The previous image is no longer referenced, so remove it.
    if (file || coverRemoved) await deleteCover(oldCoverId);

    resetBookForm();
    await refreshAll();
  } catch (err) {
    setStatus(err.message, true);
  }
});

bookFields.coverFile.addEventListener("change", () => {
  const file = bookFields.coverFile.files[0];
  if (file && !file.type.startsWith("image/")) {
    bookFields.coverFile.value = "";
    setStatus("Please choose an image file.", true);
  } else if (file && file.size > MAX_COVER_BYTES) {
    bookFields.coverFile.value = "";
    setStatus("That image is over 10 MB. Please choose a smaller one.", true);
  }
  showCoverPreview();
});

coverRemoveBtn.addEventListener("click", () => {
  if (bookFields.coverFile.value) {
    bookFields.coverFile.value = "";   // discard the newly chosen image
  } else {
    coverRemoved = true;               // remove the saved cover when the book is saved
    setStatus("The cover will be removed when you save.");
  }
  showCoverPreview();
});

bookCancelBtn.addEventListener("click", resetBookForm);

refreshAll();
