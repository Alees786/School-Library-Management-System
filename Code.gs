// ============================================================
//  SCHOOL LIBRARY MANAGEMENT SYSTEM — Google Apps Script API
//  Deploy as: Web App → Anyone (or Anyone with Google account)
// ============================================================

const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// Sheet names
const SHEETS = {
  BOOKS:        'Books',
  STUDENTS:     'Students',
  TEACHERS:     'Teachers',
  ADMINS:       'Admins',
  ISSUED:       'IssuedBooks',
  RESERVATIONS: 'Reservations',
  FINES:        'Fines',
  LOG:          'ActivityLog'
};

const FINE_PER_DAY = 2; // ₹ per day overdue
const LOAN_DAYS    = 14; // default loan period

// ── Entry Points ─────────────────────────────────────────────

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const params = e.parameter || {};
  const body   = e.postData ? JSON.parse(e.postData.contents || '{}') : {};
  const data   = Object.assign({}, params, body);
  const action = data.action || '';

  let result;
  try {
    switch (action) {
      // Auth
      case 'login':           result = login(data);           break;
      // Books
      case 'getBooks':        result = getBooks(data);        break;
      case 'addBook':         result = addBook(data);         break;
      case 'updateBook':      result = updateBook(data);      break;
      case 'deleteBook':      result = deleteBook(data);      break;
      // Issue & Return
      case 'issueBook':       result = issueBook(data);       break;
      case 'returnBook':      result = returnBook(data);      break;
      case 'getIssuedBooks':  result = getIssuedBooks(data);  break;
      // Reservations
      case 'reserveBook':     result = reserveBook(data);     break;
      case 'cancelReservation': result = cancelReservation(data); break;
      case 'getReservations': result = getReservations(data); break;
      // Fines
      case 'getFines':        result = getFines(data);        break;
      case 'payFine':         result = payFine(data);         break;
      // Users (Admin)
      case 'getUsers':        result = getUsers(data);        break;
      case 'addUser':         result = addUser(data);         break;
      case 'deleteUser':      result = deleteUser(data);      break;
      case 'resetPassword':   result = resetPassword(data);   break;
      // Reports
      case 'getReports':      result = getReports(data);      break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Sheet Helpers ─────────────────────────────────────────────

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function sheetToObjects(sh) {
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function appendRow(sh, obj, headers) {
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  sh.appendRow(headers.map(h => obj[h] || ''));
}

function updateRow(sh, keyCol, keyVal, updates) {
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const ki = headers.indexOf(keyCol);
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][ki]) === String(keyVal)) {
      Object.keys(updates).forEach(k => {
        const ci = headers.indexOf(k);
        if (ci >= 0) sh.getRange(r + 1, ci + 1).setValue(updates[k]);
      });
      return true;
    }
  }
  return false;
}

function deleteRow(sh, keyCol, keyVal) {
  const data = sh.getDataRange().getValues();
  const ki = data[0].indexOf(keyCol);
  for (let r = data.length - 1; r >= 1; r--) {
    if (String(data[r][ki]) === String(keyVal)) {
      sh.deleteRow(r + 1);
      return true;
    }
  }
  return false;
}

function hashPassword(pwd) {
  return Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pwd)
  );
}

function genId(prefix) {
  return prefix + Date.now();
}

// ── Auth ──────────────────────────────────────────────────────

function login(d) {
  const { username, password, role } = d;
  let sh, roleKey;
  if      (role === 'student') { sh = getSheet(SHEETS.STUDENTS); roleKey = 'StudentID'; }
  else if (role === 'teacher') { sh = getSheet(SHEETS.TEACHERS); roleKey = 'TeacherID'; }
  else if (role === 'admin')   { sh = getSheet(SHEETS.ADMINS);   roleKey = 'AdminID';   }
  else return { success: false, error: 'Invalid role' };

  const users = sheetToObjects(sh);
  const hashed = hashPassword(password);
  const user = users.find(u =>
    (u.Username === username || u[roleKey] === username) &&
    u.PasswordHash === hashed
  );

  if (!user) return { success: false, error: 'Invalid credentials' };
  const { PasswordHash, ...safeUser } = user;
  return { success: true, user: safeUser, role };
}

// ── Books ─────────────────────────────────────────────────────

const BOOK_HEADERS = ['BookID','Title','Author','Genre','ISBN','Publisher','Year','TotalCopies','AvailableCopies','ShelfLocation','AddedDate'];

function getBooks(d) {
  const sh = getSheet(SHEETS.BOOKS);
  let books = sheetToObjects(sh);
  if (d.search) {
    const q = d.search.toLowerCase();
    books = books.filter(b =>
      (b.Title||'').toLowerCase().includes(q) ||
      (b.Author||'').toLowerCase().includes(q) ||
      (b.Genre||'').toLowerCase().includes(q) ||
      (b.ISBN||'').includes(q)
    );
  }
  return { success: true, books };
}

function addBook(d) {
  const sh = getSheet(SHEETS.BOOKS);
  if (sh.getLastRow() === 0) sh.appendRow(BOOK_HEADERS);
  const book = {
    BookID: genId('BK'),
    Title: d.title, Author: d.author, Genre: d.genre,
    ISBN: d.isbn, Publisher: d.publisher, Year: d.year,
    TotalCopies: Number(d.totalCopies) || 1,
    AvailableCopies: Number(d.totalCopies) || 1,
    ShelfLocation: d.shelfLocation,
    AddedDate: new Date().toISOString().slice(0,10)
  };
  sh.appendRow(BOOK_HEADERS.map(h => book[h] || ''));
  log('ADD_BOOK', d.adminId || '', book.BookID, book.Title);
  return { success: true, book };
}

function updateBook(d) {
  const sh = getSheet(SHEETS.BOOKS);
  const fields = { Title: d.title, Author: d.author, Genre: d.genre,
    ISBN: d.isbn, Publisher: d.publisher, Year: d.year,
    TotalCopies: d.totalCopies, ShelfLocation: d.shelfLocation };
  Object.keys(fields).forEach(k => { if (!fields[k]) delete fields[k]; });
  updateRow(sh, 'BookID', d.bookId, fields);
  return { success: true };
}

function deleteBook(d) {
  deleteRow(getSheet(SHEETS.BOOKS), 'BookID', d.bookId);
  return { success: true };
}

// ── Issue & Return ────────────────────────────────────────────

const ISSUE_HEADERS = ['IssueID','BookID','BookTitle','UserID','UserRole','IssuedDate','DueDate','ReturnedDate','Status'];

function issueBook(d) {
  const bsh = getSheet(SHEETS.BOOKS);
  const books = sheetToObjects(bsh);
  const book = books.find(b => b.BookID === d.bookId);
  if (!book)                        return { success: false, error: 'Book not found' };
  if (Number(book.AvailableCopies) < 1) return { success: false, error: 'No copies available' };

  updateRow(bsh, 'BookID', d.bookId, { AvailableCopies: Number(book.AvailableCopies) - 1 });

  const sh = getSheet(SHEETS.ISSUED);
  if (sh.getLastRow() === 0) sh.appendRow(ISSUE_HEADERS);
  const issued = new Date();
  const due    = new Date(issued); due.setDate(due.getDate() + LOAN_DAYS);
  const issue  = {
    IssueID: genId('IS'), BookID: d.bookId, BookTitle: book.Title,
    UserID: d.userId, UserRole: d.userRole,
    IssuedDate: issued.toISOString().slice(0,10),
    DueDate: due.toISOString().slice(0,10),
    ReturnedDate: '', Status: 'Issued'
  };
  sh.appendRow(ISSUE_HEADERS.map(h => issue[h] || ''));
  log('ISSUE', d.userId, d.bookId, book.Title);
  return { success: true, issue };
}

function returnBook(d) {
  const ish = getSheet(SHEETS.ISSUED);
  const issues = sheetToObjects(ish);
  const issue  = issues.find(i => i.IssueID === d.issueId && i.Status === 'Issued');
  if (!issue) return { success: false, error: 'Issue record not found' };

  const today  = new Date();
  const due    = new Date(issue.DueDate);
  const daysLate = Math.max(0, Math.floor((today - due) / 86400000));
  const fine   = daysLate * FINE_PER_DAY;

  updateRow(ish, 'IssueID', d.issueId, {
    ReturnedDate: today.toISOString().slice(0,10),
    Status: 'Returned'
  });

  const bsh = getSheet(SHEETS.BOOKS);
  const books = sheetToObjects(bsh);
  const book  = books.find(b => b.BookID === issue.BookID);
  if (book) updateRow(bsh, 'BookID', issue.BookID, { AvailableCopies: Number(book.AvailableCopies) + 1 });

  if (fine > 0) {
    const fsh = getSheet(SHEETS.FINES);
    if (fsh.getLastRow() === 0) fsh.appendRow(['FineID','IssueID','UserID','UserRole','BookID','DaysLate','Amount','Status','PaidDate']);
    fsh.appendRow([genId('FN'), d.issueId, issue.UserID, issue.UserRole, issue.BookID, daysLate, fine, 'Unpaid', '']);
  }

  // clear any reservation for this book
  fulfillReservation(issue.BookID);

  log('RETURN', issue.UserID, issue.BookID, issue.BookTitle);
  return { success: true, fine, daysLate };
}

function getIssuedBooks(d) {
  let records = sheetToObjects(getSheet(SHEETS.ISSUED));
  if (d.userId)   records = records.filter(r => r.UserID === d.userId);
  if (d.status)   records = records.filter(r => r.Status === d.status);
  if (d.userRole) records = records.filter(r => r.UserRole === d.userRole);
  return { success: true, records };
}

// ── Reservations ──────────────────────────────────────────────

const RES_HEADERS = ['ReservationID','BookID','BookTitle','UserID','UserRole','ReservedDate','Status'];

function reserveBook(d) {
  const bsh = getSheet(SHEETS.BOOKS);
  const books = sheetToObjects(bsh);
  const book  = books.find(b => b.BookID === d.bookId);
  if (!book) return { success: false, error: 'Book not found' };

  const sh = getSheet(SHEETS.RESERVATIONS);
  if (sh.getLastRow() === 0) sh.appendRow(RES_HEADERS);
  const res = {
    ReservationID: genId('RS'), BookID: d.bookId, BookTitle: book.Title,
    UserID: d.userId, UserRole: d.userRole,
    ReservedDate: new Date().toISOString().slice(0,10),
    Status: 'Waiting'
  };
  sh.appendRow(RES_HEADERS.map(h => res[h] || ''));
  return { success: true, reservation: res };
}

function cancelReservation(d) {
  updateRow(getSheet(SHEETS.RESERVATIONS), 'ReservationID', d.reservationId, { Status: 'Cancelled' });
  return { success: true };
}

function getReservations(d) {
  let records = sheetToObjects(getSheet(SHEETS.RESERVATIONS));
  if (d.userId) records = records.filter(r => r.UserID === d.userId);
  if (d.status) records = records.filter(r => r.Status === d.status);
  return { success: true, records };
}

function fulfillReservation(bookId) {
  updateRow(getSheet(SHEETS.RESERVATIONS), 'BookID', bookId, { Status: 'Fulfilled' });
}

// ── Fines ─────────────────────────────────────────────────────

function getFines(d) {
  let fines = sheetToObjects(getSheet(SHEETS.FINES));
  if (d.userId) fines = fines.filter(f => f.UserID === d.userId);
  if (d.status) fines = fines.filter(f => f.Status === d.status);
  return { success: true, fines };
}

function payFine(d) {
  updateRow(getSheet(SHEETS.FINES), 'FineID', d.fineId, {
    Status: 'Paid',
    PaidDate: new Date().toISOString().slice(0,10)
  });
  return { success: true };
}

// ── User Management ───────────────────────────────────────────

const STUDENT_HEADERS  = ['StudentID','Name','Class','Section','Username','PasswordHash','Email','Phone','JoinDate'];
const TEACHER_HEADERS  = ['TeacherID','Name','Department','Username','PasswordHash','Email','Phone','JoinDate'];
const ADMIN_HEADERS    = ['AdminID','Name','Username','PasswordHash','Email','JoinDate'];

function getUsers(d) {
  const role = d.role || 'student';
  const shName = role === 'teacher' ? SHEETS.TEACHERS : role === 'admin' ? SHEETS.ADMINS : SHEETS.STUDENTS;
  const users = sheetToObjects(getSheet(shName)).map(u => { const {PasswordHash,...s}=u; return s; });
  return { success: true, users, role };
}

function addUser(d) {
  const role = d.role || 'student';
  const hashed = hashPassword(d.password);
  const now = new Date().toISOString().slice(0,10);

  if (role === 'student') {
    const sh = getSheet(SHEETS.STUDENTS);
    if (sh.getLastRow() === 0) sh.appendRow(STUDENT_HEADERS);
    sh.appendRow([genId('ST'), d.name, d.class_, d.section, d.username, hashed, d.email, d.phone, now]);
  } else if (role === 'teacher') {
    const sh = getSheet(SHEETS.TEACHERS);
    if (sh.getLastRow() === 0) sh.appendRow(TEACHER_HEADERS);
    sh.appendRow([genId('TC'), d.name, d.department, d.username, hashed, d.email, d.phone, now]);
  } else if (role === 'admin') {
    const sh = getSheet(SHEETS.ADMINS);
    if (sh.getLastRow() === 0) sh.appendRow(ADMIN_HEADERS);
    sh.appendRow([genId('AD'), d.name, d.username, hashed, d.email, now]);
  }
  return { success: true };
}

function deleteUser(d) {
  const role = d.role || 'student';
  const shName = role === 'teacher' ? SHEETS.TEACHERS : role === 'admin' ? SHEETS.ADMINS : SHEETS.STUDENTS;
  const keyCol = role === 'teacher' ? 'TeacherID' : role === 'admin' ? 'AdminID' : 'StudentID';
  deleteRow(getSheet(shName), keyCol, d.userId);
  return { success: true };
}

function resetPassword(d) {
  const role = d.role || 'student';
  const shName = role === 'teacher' ? SHEETS.TEACHERS : role === 'admin' ? SHEETS.ADMINS : SHEETS.STUDENTS;
  const keyCol = role === 'teacher' ? 'TeacherID' : role === 'admin' ? 'AdminID' : 'StudentID';
  updateRow(getSheet(shName), keyCol, d.userId, { PasswordHash: hashPassword(d.newPassword) });
  return { success: true };
}

// ── Reports ───────────────────────────────────────────────────

function getReports(d) {
  const books      = sheetToObjects(getSheet(SHEETS.BOOKS));
  const issued     = sheetToObjects(getSheet(SHEETS.ISSUED));
  const fines      = sheetToObjects(getSheet(SHEETS.FINES));
  const reservations = sheetToObjects(getSheet(SHEETS.RESERVATIONS));

  const today = new Date().toISOString().slice(0,10);
  const overdue = issued.filter(i => i.Status === 'Issued' && i.DueDate < today);

  return {
    success: true,
    stats: {
      totalBooks:      books.length,
      totalCopies:     books.reduce((s,b) => s + Number(b.TotalCopies||0), 0),
      availableCopies: books.reduce((s,b) => s + Number(b.AvailableCopies||0), 0),
      totalIssued:     issued.filter(i => i.Status === 'Issued').length,
      overdueCount:    overdue.length,
      unpaidFines:     fines.filter(f => f.Status === 'Unpaid').reduce((s,f) => s + Number(f.Amount||0), 0),
      activeReservations: reservations.filter(r => r.Status === 'Waiting').length
    },
    overdue,
    topGenres:    topCount(books, 'Genre', 5),
    recentIssues: issued.slice(-10).reverse()
  };
}

function topCount(arr, field, n) {
  const count = {};
  arr.forEach(r => { const v = r[field]||'Unknown'; count[v]=(count[v]||0)+1; });
  return Object.entries(count).sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k,v])=>({name:k,count:v}));
}

// ── Activity Log ──────────────────────────────────────────────

function log(action, userId, bookId, detail) {
  const sh = getSheet(SHEETS.LOG);
  if (sh.getLastRow() === 0) sh.appendRow(['Timestamp','Action','UserID','BookID','Detail']);
  sh.appendRow([new Date().toISOString(), action, userId, bookId, detail]);
}

// ── Setup: Initialize all sheets with headers ─────────────────

function setupSheets() {
  function ensure(name, headers) {
    const sh = getSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(headers);
  }
  ensure(SHEETS.BOOKS,        BOOK_HEADERS);
  ensure(SHEETS.STUDENTS,     STUDENT_HEADERS);
  ensure(SHEETS.TEACHERS,     TEACHER_HEADERS);
  ensure(SHEETS.ADMINS,       ADMIN_HEADERS);
  ensure(SHEETS.ISSUED,       ISSUE_HEADERS);
  ensure(SHEETS.RESERVATIONS, RES_HEADERS);
  ensure(SHEETS.FINES,        ['FineID','IssueID','UserID','UserRole','BookID','DaysLate','Amount','Status','PaidDate']);
  ensure(SHEETS.LOG,          ['Timestamp','Action','UserID','BookID','Detail']);

  // Create default admin
  const adSh = getSheet(SHEETS.ADMINS);
  if (adSh.getLastRow() <= 1) {
    adSh.appendRow([genId('AD'), 'Administrator', 'admin', hashPassword('admin123'), 'admin@school.edu', new Date().toISOString().slice(0,10)]);
    Logger.log('Default admin created: username=admin, password=admin123');
  }
  Logger.log('Sheets initialized successfully!');
}
