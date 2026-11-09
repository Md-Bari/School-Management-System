# School Admission System

Online admission for a school that admits on a **first-come, first-served** basis.
Applying puts a seat on **hold** for the student for a limited time. Paying the admission fee
within that time **confirms** the admission. Otherwise the seat goes back to the pool by itself.

- **Backend:** C# / ASP.NET Core (.NET 10), PostgreSQL 16, Dapper + Npgsql
- **Frontend:** React 18 + TypeScript (Vite), served by nginx
- **Everything runs with Docker.** Nothing else needs to be installed.

## Run the app

```bash
docker compose up --build
```

| What | URL |
|---|---|
| Frontend (UI) | **http://localhost:3000** |
| Backend API | http://localhost:8080 |

The first build downloads the .NET, Node and PostgreSQL images and takes a few minutes.
Later starts are fast. Stop with `Ctrl+C` or `docker compose down`. Data is kept in the
`pgdata` volume and survives `down` + `up`. Use `docker compose down -v` to wipe it.

### Using the UI

1. **Class তৈরি (Admin)**: create a class. Every shift is its own class,
   e.g. `Class 6 - Morning Shift` with 120 seats.
2. Type the student's **17-digit birth registration number** in the box at the top and press
   **ব্যবহার করুন**. There is no login: this number is the student's identity. It is remembered
   in the browser, and Bangla digits are accepted.
3. **Class তালিকা**: total / held / confirmed / free seats, refreshed every 3 seconds.
   Press **আবেদন করুন** to apply.
4. **আবেদন** page: live countdown, **ভর্তি ফি দিন** (simulated successful payment) and **বাতিল**.
5. **আমার আবেদন**: all applications of this student and their status.
