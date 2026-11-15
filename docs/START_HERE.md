# Next session on Windows

The repository code is prepared. The following steps still require your local environment and Supabase dashboard. This document is the handoff checklist, not a claim that deployment is complete.

## 1. Pull the code

Open VS Code and a new PowerShell terminal. Run each command separately.

```powershell
cd "$env:USERPROFILE\Projects\clinicflow-ai"
```

```powershell
git pull --ff-only
```

If Git reports local changes, stop and inspect them. Preserve your edits before merging. Keep `.env` private.

## 2. Run the database upgrade

Open `backend/sql/003_business_settings.sql` in VS Code. Copy the entire file into a **new query in the Supabase SQL Editor**, then click Run.

For this existing project, migrations 001 and 002 are already represented by the tables and owner membership created earlier. Run only 003 now. It adds settings, settings versioning, anonymous chat event counts and appointment retry protection. It preserves existing appointments.

The last query should show your business name and a `settings_version` number. This number starts at 0 for an existing business without saved settings. If SQL fails, capture the error text and fix it before continuing.

For an entirely new Supabase project, use 001, create an Auth owner account, then use 002 with the owner's email substituted in both places, and finally run 003.

## 3. Install backend dependencies and restart

Stop the old backend with Ctrl+C in its own terminal. From the project root run:

```powershell
cd backend
```

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Keep the existing `backend/.env`. Its required Supabase and Cloudflare settings remain the same. `CLOUDFLARE_MODEL` has a server-side default. `ALLOWED_ORIGINS` defaults to the two local port-5173 origins.

For a fresh PC create a virtual environment first with `py -m venv .venv` from the backend folder, then install requirements.

## 4. Restart the frontend

In another new terminal:

```powershell
cd "$env:USERPROFILE\Projects\clinicflow-ai\frontend"
```

```powershell
npm.cmd ci
```

```powershell
npm.cmd run dev
```

Use port 5173. If Vite chooses 5174, close an old Vite process or add that explicit origin to backend `ALLOWED_ORIGINS` and restart the backend.

## 5. Final local checks

- Visit `http://localhost:5173/` and inspect desktop and mobile layouts.
- Visit `/admin`, sign in, open **Business settings** and change the introduction, greeting and one supplied sample price. Click **Save business settings**.
- Refresh the public website. The saved information should appear.
- Ask chat the exact service price. It should use the supplied value, while missing prices stay unavailable.
- Submit one synthetic appointment for an available service. Verify it in the owner dashboard.
- Change its status to Contacted, save and refresh.
- Submit a sample chat message and refresh dashboard counts. Counts reflect stored events and may take a moment to appear.
- Open `http://localhost:5173/embed-example.html`. Test the external launcher, typed chat and appointment form inside the iframe.
- Sign out and verify that private appointment data disappears. Refreshing the admin page also requires signing in again.

Chat event recording is best effort. No message text or phone numbers are stored in the events table. If analytics writes fail, the replies still work and stored counts may be incomplete.

## 6. Publish the demo

Follow [DEPLOYMENT.md](DEPLOYMENT.md). Deployment remains pending until both public URLs are configured and tested. A local build does not establish a live public URL.
