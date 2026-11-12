// Talks to DAB's REST API (books, authors) and to the file-store service (cover images).
// Start both with "npm start" first.
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
  coverImageId: document.getElementById("coverImageId"),    // hidden: id of the saved cover image, if any
  coverFile: document.getElementById("coverFile"),          // <input type="file"> for choosing a new cover
};
const coverFigure = document.getElementById("cover-figure");   // holds the preview image and Remove button
const coverPreview = document.getElementById("coverPreview");
const coverRemoveBtn = document.getElementById("cover-remove-btn");
let coverRemoved = false;   // true after "Remove cover" is clicked on a saved cover
let previewUrl = null;      // temporary URL for showing a chosen image before it is uploaded
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

// Wraps fetch: throws a readable Error if DAB can't be reached or answers with a non-2xx status.
async function api(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error("Can't reach DAB at " + url);
  }
  if (!res.ok) {
    const body = await res.text();
    const error = new Error("DAB returned " + res.status + ": " + body);
    error.status = res.status;   // lets the caller check for specific problems, e.g. 409
    throw error;
  }
  if (res.status === 204) {
    return null;               // 204 = success with no content (e.g. after a DELETE)
  }
  return res.json();
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
  authorRows.replaceChildren();   // remove the old rows first
  for (const a of authors) {
    const tr = document.createElement("tr");

    const idCell = document.createElement("td");
    idCell.textContent = a.AuthorId;   // textContent (not innerHTML) so database data can't inject HTML
    tr.appendChild(idCell);

    const nameCell = document.createElement("td");
    nameCell.textContent = a.AuthorName;
    tr.appendChild(nameCell);

    const actionsCell = document.createElement("td");
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => startAuthorEdit(a));
    actionsCell.appendChild(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteAuthor(a));
    actionsCell.appendChild(deleteButton);
    tr.appendChild(actionsCell);

    authorRows.appendChild(tr);
  }
}

// Rebuild the book form's drop-down, keeping the current choice if there is one.
function renderAuthorOptions() {
  const selected = bookFields.authorId.value;
  bookFields.authorId.replaceChildren(new Option("Select an author", ""));
  for (const a of authors) {
    bookFields.authorId.appendChild(new Option(a.AuthorName, a.AuthorId));
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
  e.preventDefault();   // stop the browser from reloading the page
  const author = { AuthorName: authorFields.name.value.trim() };
  const id = authorFields.id.value;

  // No id in the form = a new author (POST). An id = an existing author (PATCH).
  let url = AUTHOR_URL;
  let method = "POST";
  if (id) {
    url = AUTHOR_URL + "/AuthorId/" + id;
    method = "PATCH";
  }

  try {
    await api(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(author),
    });
    resetAuthorForm();
    await refreshAll();   // book rows show author names too, so reload both
  } catch (err) {
    setStatus(err.message, true);
  }
});

authorCancelBtn.addEventListener("click", resetAuthorForm);

// ---- Cover images (file-store service) ----

// Sends the image to the file store as the raw request body.
// The file store answers with JSON containing the new file's id.
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
  const data = await res.json();
  return data.id;
}

// Best effort: a leftover image is harmless, so a failure here never stops the user.
async function deleteCover(id) {
  if (!id) return;
  try {
    await fetch(FILES_URL + "/" + id, { method: "DELETE" });
  } catch {
    // file store not running: leave the file behind
  }
}

// Shows the newly chosen image if there is one, otherwise the saved cover, otherwise nothing.
function showCoverPreview() {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);   // free the previous temporary URL
    previewUrl = null;
  }

  const file = bookFields.coverFile.files[0];
  let savedId = bookFields.coverImageId.value;
  if (coverRemoved) {
    savedId = "";
  }

  if (file) {
    previewUrl = URL.createObjectURL(file);   // a temporary URL for a file that is only on this computer
    coverPreview.src = previewUrl;
    coverFigure.hidden = false;
  } else if (savedId) {
    coverPreview.src = FILES_URL + "/" + savedId;   // the file store serves the image at this URL
    coverFigure.hidden = false;
  } else {
    coverPreview.removeAttribute("src");
    coverFigure.hidden = true;
  }
}

// When a file is chosen: reject anything that is not an image or is too big, then show a preview.
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
    bookFields.coverFile.value = "";   // discard the image that was just chosen
  } else {
    coverRemoved = true;               // the saved cover is removed when the book is saved
    setStatus("The cover will be removed when you save.");
  }
  showCoverPreview();
});

// ---- Books ----
function renderBookRows(books) {
  bookRows.replaceChildren();   // remove the old rows first
  for (const b of books) {
    const title = b.OriginalTitle ? b.EnglishTitle + " (" + b.OriginalTitle + ")" : b.EnglishTitle;
    const tr = document.createElement("tr");

    const idCell = document.createElement("td");
    idCell.textContent = b.BookId;
    tr.appendChild(idCell);

    // Cover: an <img> pointing at the file store, or an empty cell if the book has no cover.
    const coverCell = document.createElement("td");
    if (b.CoverImageId) {
      const img = document.createElement("img");
      img.className = "thumb";
      img.src = FILES_URL + "/" + b.CoverImageId;
      img.alt = "Cover of " + title;
      coverCell.appendChild(img);
    }
    tr.appendChild(coverCell);

    const titleCell = document.createElement("td");
    titleCell.textContent = title;
    tr.appendChild(titleCell);

    const authorCell = document.createElement("td");
    authorCell.textContent = b.AuthorName ?? "(unknown)";   // name comes from the JOIN in the view
    tr.appendChild(authorCell);

    const yearCell = document.createElement("td");
    yearCell.textContent = b.FirstEditionYear ?? "(unknown)";
    tr.appendChild(yearCell);

    const actionsCell = document.createElement("td");
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => startBookEdit(b));
    actionsCell.appendChild(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteBook(b));
    actionsCell.appendChild(deleteButton);
    tr.appendChild(actionsCell);

    bookRows.appendChild(tr);
  }
}

function startBookEdit(b) {
  bookFields.id.value = b.BookId;
  bookFields.englishTitle.value = b.EnglishTitle;
  bookFields.originalTitle.value = b.OriginalTitle ?? "";
  bookFields.authorId.value = b.AuthorId ?? "";           // the view must include AuthorId
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
  e.preventDefault();   // stop the browser from reloading the page

  // The year is optional: an empty box is saved as NULL.
  const yearText = bookFields.firstEditionYear.value.trim();
  const book = {
    EnglishTitle: bookFields.englishTitle.value.trim(),
    OriginalTitle: bookFields.originalTitle.value.trim() || null,
    AuthorId: Number(bookFields.authorId.value),   // the id of an existing author
    FirstEditionYear: yearText === "" ? null : Number(yearText),
  };

  // No id in the form = a new book (POST). An id = an existing book (PATCH).
  const id = bookFields.id.value;
  let url = BOOK_URL;
  let method = "POST";
  if (id) {
    url = BOOK_URL + "/BookId/" + id;
    method = "PATCH";
  }

  const oldCoverId = bookFields.coverImageId.value;   // "" if the book has no cover yet
  const file = bookFields.coverFile.files[0];         // undefined if no new image was chosen
  let newCoverId = null;

  try {
    // 1. Upload the new image first, so the book row only ever points at a file that exists.
    if (file) {
      newCoverId = await uploadCover(file);
      book.CoverImageId = newCoverId;
    } else if (coverRemoved) {
      book.CoverImageId = null;
    }
    // Otherwise CoverImageId is left out: PATCH keeps the old value, POST leaves it NULL.

    // 2. Save the book row.
    try {
      await api(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(book),
      });
    } catch (err) {
      await deleteCover(newCoverId);   // the save failed, so delete the image we just uploaded
      throw err;                       // pass the error on to the outer catch below
    }

    // 3. The old image is no longer used, so delete it.
    if (file || coverRemoved) {
      await deleteCover(oldCoverId);
    }

    resetBookForm();
    await refreshAll();
  } catch (err) {
    setStatus(err.message, true);
  }
});

bookCancelBtn.addEventListener("click", resetBookForm);

refreshAll();
