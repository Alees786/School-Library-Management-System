# 📚 School Library Management System

A complete library management system hosted on **GitHub Pages** with **Google Sheets** as the database.

---

## Features

- **Student Panel** — Browse catalog, view borrowed books, reservations, fines
- **Teacher Panel** — Same as student with teacher-specific access
- **Admin Panel** — Issue/return books, manage catalog, users, fines, reports
- **Google Sheets Backend** — All data (books, members, transactions) stored in Google Sheets
- **Role-based Login** — Separate login flows for students, teachers, admins
- **Fine Tracking** — Auto-calculates ₹2/day overdue fines
- **Reservations** — Students/teachers can reserve unavailable books

---

## Setup Instructions

### Step 1: Set up Google Sheets + Apps Script

1. Go to [sheets.google.com](https://sheets.google.com) and create a **new blank spreadsheet**
2. Name it: `School Library Database`
3. Click **Extensions → Apps Script**
4. Delete any existing code in the editor
5. Copy the entire contents of **`Code.gs`** and paste it in
6. Click **Save** (💾)
7. In the top menu, click **Run → Run function → `setupSheets`**
   - Grant permissions when prompted
   - This creates all required sheets and a default admin account
8. Click **Deploy → New deployment**
   - Type: `Web app`
   - Execute as: `Me`
   - Who has access: `Anyone` *(required for GitHub Pages to connect)*
   - Click **Deploy**
9. **Copy the Web App URL** — you'll need it in the next step

> **Default admin credentials after setup:**
> - Username: `admin`
> - Password: `admin123`
> - **Change this immediately after first login!**

---

### Step 2: Configure the Frontend

Open **`js/app.js`** and replace:

```javascript
const API_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
```

with your actual Web App URL from Step 1:

```javascript
const API_URL = 'https://script.google.com/macros/s/YOUR_ID_HERE/exec';
```

---

### Step 3: Deploy to GitHub Pages

1. Create a new repository on [github.com](https://github.com)
2. Upload all files maintaining this folder structure:

```
your-repo/
├── index.html
├── student-panel.html
├── teacher-panel.html
├── admin-panel.html
├── css/
│   └── style.css
└── js/
    └── app.js
```

3. Go to **Settings → Pages**
4. Source: `Deploy from a branch`
5. Branch: `main` / `(root)`
6. Click **Save**

Your site will be live at:
`https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`

---

## Google Sheets Structure

After running `setupSheets`, your spreadsheet will have these tabs:

| Sheet | Contents |
|-------|----------|
| `Books` | Book catalog with availability |
| `Students` | Student accounts (passwords hashed) |
| `Teachers` | Teacher accounts (passwords hashed) |
| `Admins` | Admin accounts |
| `IssuedBooks` | All book issue/return records |
| `Reservations` | Book reservation queue |
| `Fines` | Fine records with payment status |
| `ActivityLog` | Audit trail of all actions |

> **Security Note:** Passwords are stored as SHA-256 hashes — never in plain text.

---

## Workflow Guide

### Issuing a Book (Admin)
1. Log in as Admin → **Issue / Return** tab
2. Enter the **Book ID** (visible in Book Catalog)
3. Enter the **Member ID** (Student or Teacher ID)
4. Select role → Click **Issue Book**

### Returning a Book (Admin)
1. Go to **Issued Books** tab — find the Issue ID
2. Go to **Issue / Return** → Return section
3. Enter the Issue ID → Click **Process Return**
4. System auto-calculates any overdue fine

### Adding Students/Teachers (Admin)
1. Go to **Users** tab
2. Click **+ Add User**
3. Select role, fill in details, set password
4. Share credentials with the member

### Fine Settings
Edit in `Code.gs`:
```javascript
const FINE_PER_DAY = 2;   // ₹ per day overdue
const LOAN_DAYS    = 14;  // default loan period
```

---

## Troubleshooting

**"Network error" or API not responding:**
- Make sure the Apps Script is deployed as "Anyone" can access
- Check that the API_URL in `app.js` is correct
- Re-deploy the Apps Script after any code changes

**CORS errors:**
- Google Apps Script handles CORS automatically — if you see this, re-check your deployment settings

**Login not working:**
- Run `setupSheets` again from Apps Script to ensure the default admin exists
- Check the Students/Teachers sheet has the correct headers

---

## Security Recommendations

1. Change the default admin password immediately
2. Deploy Apps Script as "Anyone with Google account" for stricter access
3. Keep your Google Sheet private (don't share the link publicly)
4. Regularly review the `ActivityLog` sheet for suspicious activity
5. Back up the Google Sheet periodically
