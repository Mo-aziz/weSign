# Sign Language Communicator (React + Vite + Tauri)

A desktop-first communication platform that bridges sign-language and spoken-language users. The frontend is built with React, TypeScript, Vite, TailwindCSS, and React Router, and it is bundled into a Windows desktop experience with Tauri.

## Features

- **Authentication flow** with `Login` / `Signup` screen (mocked password validation, sign/voice preference toggle).
- **Contact management** for saving, removing, and initiating calls with usernames.
- **Call experience** with simulated:
  - Sign recognition → text preview → text-to-speech playback.
  - Speech-to-text caption feed for hearing participants.
- **Settings** panel with dark mode, profile editing, and preference examples.
- **TailwindCSS**-driven dark, modern UI with card surfaces and responsive layout.
- **Context-driven state management** (user session, contacts, preferences).

## Project Structure

- `src/context/AppContext.tsx` — global state for user session, contacts, and theme.
- `src/services/` — mockable hooks for sign recognition, speech-to-text, and text-to-speech.
- `src/screens/` — `Login`, `Contacts`, `CallScreen`, and `Settings` screens.
- `src/components/AuthenticatedLayout.tsx` — navigation shell for authenticated routes.
- `src-tauri/` — Tauri backend, configuration, and build script.

## Prerequisites

- Node.js 18+
- Rust toolchain (stable) with the `x86_64-pc-windows-msvc` target
- Tauri prerequisites for Windows (Visual Studio build tools, etc.)

Refer to the official Tauri docs if you need to set up the environment: <https://tauri.app/v1/guides/getting-started/prerequisites>

## Install Dependencies

```bash
npm install
```

## Run in Development

```bash
npm run tauri:dev
```

This launches Vite in development mode and starts the Tauri shell so you can interact with the desktop window.

## Build Production Frontend Only

```bash
npm run build
```

## Build Windows Installer (.msi / .exe)

```bash
npm run tauri:build
```

The resulting binaries are generated under `src-tauri/target/release/` (look for `.msi`, `.exe`, and supporting artifacts).

## Styling

- TailwindCSS is configured via `tailwind.config.js` and `postcss.config.js`.
- Global styles use Tailwind directives in `src/index.css` and leverage utility classes across screens.
- Dark mode is controlled via the `AppContext` by toggling the `dark` class on the HTML root.

## Extending the Mock Services

Each service hook in `src/services/` returns structured state and actions. Replace the mocked timers and random phrase generators with real AI/ML or API integrations when you are ready to wire up live translation services.

## Packaging Notes

- Update `src-tauri/tauri.conf.json` to adjust product metadata, bundle icons (`src-tauri/icons`), and build targets.
- The `build.rs` script invokes `tauri_build::build()` to ensure Tauri configuration is available to the Rust compiler.

## Linting

Run ESLint across the workspace:

```bash
npm run lint
```

Tailwind-specific warnings inside editors generally disappear once the Tailwind VS Code extension (or language server) is active.
