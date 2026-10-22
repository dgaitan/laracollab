# CLAUDE.md

LaraCollab: a project-management app (clients, projects, kanban tasks, time logging, invoices, reports). Laravel 13 (PHP ^8.3) backend + React 18 frontend glued with Inertia 2.x, UI built with Mantine 7. App version lives in `config/app.php` (`version`) and is shared to the frontend.

## Commands

```bash
composer install && npm install
php artisan migrate --seed          # seeds roles, permissions, labels, currencies, countries, admin user
php artisan app:create-admin "Name" email@x.com --password=secret
npm run dev                         # Vite dev server
npm run build                       # production assets
npm run format                      # Prettier over resources/js
./vendor/bin/pint                   # PHP formatting (laravel preset)
./vendor/bin/pest                   # tests (Pest 4 / PHPUnit 12)
./vendor/bin/pest --filter=Name     # single test
./vendor/bin/sail up                # optional Docker env (MySQL 8 + Mailpit)
```

Seeded admin: `admin@mail.com` / `password` (overridable via `ADMIN_*` in `.env`).

Scheduler (`app/Console/Kernel.php`): `project:prune-activities` and `user:prune-notifications` nightly. Queued mail uses the `email` queue (`App\Enums\Queue::EMAIL`); worker: `php artisan queue:work --queue=default,email`.

## Architecture

### Laravel 10-style skeleton on Laravel 13
The app still uses `app/Http/Kernel.php`, `app/Console/Kernel.php` and `app/Providers/*ServiceProvider.php` (including `RouteServiceProvider`, `EventServiceProvider`). Register middleware, schedules and event listeners there, not in `bootstrap/app.php`. CSRF middleware is `App\Http\Middleware\PreventRequestForgery` (Laravel 13 name; it also enforces `Sec-Fetch-Site` origin checks).

### Request flow
- All app routes are in `routes/web.php` behind `auth:sanctum`. Nested project routes use `->scopeBindings()`; restore routes take a raw `{xxxId}` because archived models are excluded from implicit binding.
- **Controllers** (`app/Http/Controllers`) authorize with `$this->authorize(...)`, validate via **Form Requests** (`app/Http/Requests/<Domain>/`), and delegate writes to **Actions** (`app/Actions/<Domain>/CreateX|UpdateX`) instantiated inline: `(new CreateTask)->create($project, $request->validated())`. Actions wrap work in `DB::transaction` and dispatch events.
- Page responses: `Inertia::render('Folder/Page', [...])`, resolving to `resources/js/pages/Folder/Page.jsx`.
- Mutations that don't change pages (task update, reorder, move, complete) return `response()->json()`; the UI updates optimistically and other users get the change via websockets.
- Flash messages use custom redirect macros from `AppServiceProvider`: `redirect()->back()->success('Title', 'Message')` (also `info`, `warning`, `error`).
- `JsonResource::withoutWrapping()` is on; API Resources live in `app/Http/Resources/<Domain>/`.
- Shared Inertia props (`HandleInertiaRequests`): `auth.user` (with `roles` and `permissions` arrays), `auth.notifications`, `shared.roles`, `flash`, `version`.

### Authorization
- Spatie Permission. The canonical role→permission map is `PermissionService::$permissionsByRole`; `PermissionSeeder` builds the DB from it. **Adding a permission means editing that array and re-seeding**, plus checking it in the Policy.
- Permission names are plain lowercase strings (`'edit task'`, `'archive project'`). Policies (`app/Policies`) combine `hasPermissionTo(...)` with `$user->hasProjectAccess($project)`.
- Project visibility: `PermissionService::usersWithAccessToProject($project)`; also used for broadcast channel auth in `routes/channels.php`.
- Users with the `client` role must not see tasks where `hidden_from_clients = true`; keep that filter on any new task query.
- Frontend: `useAuthorization()` → `can('permission name')`, `isAdmin()`.

### Models
- "Delete" means **archive**: models use `LaravelArchivable\Archivable` (`archive()`, `unArchive()`, `withArchived()`, `onlyArchived()`), not SoftDeletes. Controllers' `destroy` archives; `restore` un-archives.
- `Task` and `TaskGroup` are ordered with `spatie/eloquent-sortable` (`order_column`, `setNewOrder`, `moveToStart`).
- Task query helpers: `withDefault()` / `loadDefault()` eager-load `$defaultWith`; filtering and search come from `lacodix/laravel-model-filter` (`filterByQueryString()`, `searchByQueryString()`, custom filters in `app/Models/Filters`).
- Auditing via `owen-it/laravel-auditing`; user-facing history goes in the `activities` table (`$task->activities()->create([...])`, also written by Observers in `app/Observers`).
- Task `number` is per-project (`count(withArchived) + 1`).

### Real-time
- Events in `app/Events/Task` and `app/Events/TaskGroup` implement `ShouldBroadcast` on private channels `App.Models.Project.{id}` / `App.Models.User.{id}`, usually with `dontBroadcastToCurrentUser()`.
- `resources/js/hooks/useWebSockets.js` listens (e.g. `'Task\\TaskUpdated'`) and applies changes to Zustand stores. **A new broadcast event needs a matching `.listen(...)` there and a `*Locally` handler in the store slice.**
- Pusher via Laravel Echo; `BROADCAST_DRIVER=log` locally unless `PUSHER_*` is configured.

### Frontend (`resources/js`)
- Plain JSX (no TypeScript except a stray `types.ts`). Alias `@/` → `resources/js/`.
- `pages/` = Inertia pages (sub-components live in sibling folders like `pages/Projects/Tasks/Index/`, `Drawers/`); `components/` shared UI; `layouts/MainLayout.jsx`; `utils/` helpers.
- State: Zustand stores in `hooks/store/` (`useTasksStore`, `useTaskGroupsStore`, …) composed from slices in `hooks/store/tasks/` and `hooks/store/taskGroups/`, using Immer.
- Forms: `hooks/useForm.js` wraps `laravel-precognition-react-inertia` (0.8 is its final release; Inertia 3 absorbs it, so moving to Inertia 3 means replacing this wrapper) and returns `[form, submit, updateValue]`. Precognition middleware is on the web group, so Form Requests also drive live validation.
- Routing: Ziggy's global `route('name', params)`; query-string helpers in `utils/route.js` (`reloadWithQuery`, `reloadWithoutQueryParams`).
- Rich text: Tiptap with mentions (`components/RichTextEditor`); mentions are parsed server-side by `UserMentionService`.
- Styling: Mantine components + CSS modules (`css/*.module.css` next to components). Dark mode via Mantine color scheme.

### Storage
Default disk is `s3` (`config/filesystems.php`). Task attachments go to `tasks/{taskId}/...` on S3 with public visibility (`CreateTask::uploadAttachments`).

## Conventions

- PHP: Pint `laravel` preset; CI (`.github/workflows/laravel-pint-fixer.yml`) auto-commits Pint fixes on push/PR, so pull before pushing again.
- JS: `.prettierrc` says single quotes / width 100, but much existing code uses double quotes. Format only the code you touch; don't reformat whole files.
- New domain feature checklist: migration → model (archivable/sortable as needed) → permissions in `PermissionService` → Policy → Form Request(s) → Action(s) → controller + routes in `routes/web.php` → Inertia page(s) → broadcast event + `useWebSockets` listener if it should be live.

## Gotchas

- **Tests are essentially empty** (only `ExampleTest`s; the Feature one always fails because `/` redirects to `/dashboard`). `phpunit.xml` expects a MySQL database named `testing`; `DB_CONNECTION=sqlite DB_DATABASE=:memory: ./vendor/bin/pest` works for quick runs. Add Pest feature tests for new behavior.
- **`php artisan migrate --seed` crashes in `UserSeeder`**: `getJobTitle()` only maps `admin`, so other roles hit a `TypeError`. Use `app:create-admin` until fixed.
- Browser automation clicks on task rows and filter buttons in the kanban can be swallowed by `@hello-pangea/dnd`; trigger a native `element.click()` or use `/projects/{id}/tasks/{task}/open` instead.
- `intervention/image` is v3 but `CreateTask::generateThumb` uses the v2 API (`Intervention\Image\Facades\Image::make`). The error is swallowed by `catch (Throwable)`, so thumbnails silently come out `null`. The thumb is also written to `public/{path}` while its URL is built from `{path}`.
- The README says `migrate --seed` asks whether to seed dev data. That prompt is commented out in `DatabaseSeeder`; dev seeders (`ProjectSeeder`, `TasksSeeder`, …) must be called explicitly (`php artisan db:seed --class=...`) and need an authenticated admin (`auth()->setUser(...)`).
- Clockwork (`itsgoingd/clockwork`) and Log Viewer (`opcodesio/log-viewer`) are installed for debugging.
