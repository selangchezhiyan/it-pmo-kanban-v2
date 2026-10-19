# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An IT PMO Kanban board for a fictitious bank, used as an internal demo/training tool. This is **v2** (redesign, published to the `it-pmo-kanban-v2` repo; v1 lives on `main` of `it-pmo-kanban`). The whole app is one file: `index.html`, with all markup, one `<style>` block and one `<script>` block. Do not use a real bank's logo, trademarks or styling; the only branding is the neutral "IT PMO" text wordmark and a corporate blue palette. The task-ID prefix `UOB-ITPM-####` and the email subject `[UOB IT PMO] …` are plain-text identifiers the spec asks for.

## Hard constraints (from the original spec — keep them)

- Vanilla HTML/CSS/JS only: no frameworks, libraries, build step, npm, CDN scripts, web fonts or image files. Use the system font stack, with inline SVG or Unicode for icons.
- It must run by double-clicking `index.html` (a `file://` origin) with no server.
- No persistence: do not use localStorage, sessionStorage, IndexedDB, cookies or any other storage API. A page refresh resets the board to the seed data on purpose, and the header note says so.
- The only network call is FormSubmit's AJAX endpoint (`notifyNewTask()`). A failure there must never break the board.
- No `alert()`/`confirm()` (use inline errors and toasts) and no `!important`. Colours and spacing come from CSS custom properties on `:root`.

## Running / checking

There is no build, lint or test tooling. Open `index.html` in a browser. A quick check that the constraints still hold:

```bash
rg -n "localStorage|sessionStorage|indexedDB|document\.cookie|alert\(|confirm\(|!important|https?://" index.html
```

The only expected hit is the `FORMSUBMIT_ENDPOINT` line.

## Architecture (the `<script>` block, in numbered commented sections)

- **Single source of truth:** `state = { tasks, filters, ui, nextId }`. `state.ui` holds transient per-card UI: `confirmDeleteId` (the inline "Delete? Yes / No"), `moveMenuId` (the open "Move ▸" menu), `draggingId` and `sending`.
- **Render-from-state:** `renderBoard()` is the only code that writes card markup. It rebuilds each column's `<ul>` from `applyFilters(state.tasks)` using `renderCard()` (which returns an HTML string), updates the column count badges (`shown / total` when filters are active), and calls `renderSummary()`; the header summary always uses unfiltered totals. To change what a card shows, change state and re-render; do not patch card DOM in place. Since a re-render replaces the DOM, it takes `{ focus: selector }` to restore keyboard focus (`controlSelector(action, id)` builds those selectors).
- **Mutations:** `addTask()`, `moveTask()` and `deleteTask()` change `state.tasks` and then call `renderBoard()`.
- **Event handling is delegated** on `#board`: a click handler switches on `data-action` (`delete`, `confirm-delete`, `cancel-delete`, `move-open`, `move-go`, `move-cancel`) plus `data-id`. Native HTML5 drag-and-drop listeners (`dragstart`/`dragover`/`dragleave`/`drop`/`dragend`) are also on `#board`, and only the `.drag-over`/`.dragging` classes are toggled directly.
- **Escaping:** every user-supplied string goes through `escapeHtml()` before being interpolated into HTML. Toasts use `textContent`.
- **Dates:** dates are local `YYYY-MM-DD` strings from `toISODate()`/`todayISO()`, not UTC, and are compared as strings. A task is overdue when `dueDate < today` and its status is not Done. The seed due dates use `addDays()` so the demo always shows some overdue tasks.
- **Add Task flow (`handleSubmit`):** `validateForm()` → inline errors with `aria-invalid` → `addTask()` adds the card straight away (optimistic) → form reset and success toast → `setSending(true)` → `await notifyNewTask()` in try/catch (a failure shows the warning toast "Card added locally — email notification failed") → `setSending(false)`. The modal stays open after submit.
- **v2 theming:** colours are shadcn-style semantic tokens stored as H S L triples (`--primary: 213 72% 36%`, used as `hsl(var(--primary))`). Dark values are defined twice: under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and under `:root[data-theme="dark"]`. Keep both blocks in sync. The app-bar toggle only sets `data-theme` on `<html>` (in memory, never stored).
- **Delivery health:** `computeHealth()` (called from `renderSummary()`, unfiltered) returns red when a Critical task is blocked or overdue, amber when any other open task is, and green otherwise. The completion bar is Done ÷ Total.
- **Status charts:** `renderCharts()` (called from `renderSummary()`, unfiltered) rebuilds `#chart-status` (bars stacked by priority in `PRIORITIES` order) and `#chart-project` (open tasks per project, sorted by count) as HTML/CSS bars, with a spoken summary in each `aria-label` and a table in "View as table". `.bars` is one grid per chart and `.bar-row` uses `display: contents`, so every bar track is the same length. `--prio-*` doubles as the chart palette; re-run the dataviz validator if you change it. One shared `#chart-tip` reads `data-tip="title|value"`.
- **Vocabularies:** `STATUSES`, `PRIORITIES`, `PROJECTS`, `CATEGORIES` and `LIMITS` are defined once and used to fill the selects at `init()`. The four board columns are hard-coded in the markup (`data-status` must match `STATUSES`).

## FormSubmit

The email address is set in one place: the `FORMSUBMIT_ENDPOINT` constant at the top of the script. FormSubmit needs a one-time activation: the first submission sends a confirmation email to that address, and nothing is delivered until the link in it is clicked. With the placeholder address, requests fail (e.g. HTTP 429), and the warning toast is the expected result.
