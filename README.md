# Command Centre

A personal productivity web app that runs anywhere via GitHub Pages and syncs across devices using Google Drive.

## Features

- **Dashboard** — Overview of tasks, time tracked, goals, and recent notes
- **To-Do List** — Tasks with per-task timers, priorities, due dates, and tags
- **Goals** — Goal tracking with milestones and progress bars
- **Notes** — Full-text notes with tags and search
- **Stats Board** — Charts for completions, time tracked, priorities, and goals
- **Storage** — Upload and manage files directly in your Google Drive

## Running on GitHub Pages

1. Fork or push this repo to your GitHub account
2. Go to **Settings → Pages** → set Source to **main branch / root**
3. Your app will be live at `https://<username>.github.io/<repo-name>/`

## Google Drive Sync (optional)

To enable cross-device sync:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project and enable the **Google Drive API**
3. Create **OAuth 2.0 credentials** (Web application type)
4. Add your GitHub Pages URL as an **Authorized JavaScript origin**
   - Example: `https://username.github.io`
5. Copy the **Client ID**
6. In the app, click **Connect Drive** and paste your Client ID

Data is saved in your own Drive as `command-centre-data.json`.

## Local use

Just open `index.html` in any browser — no build step or server needed.

> **Note:** Google Drive sync requires serving over HTTPS (GitHub Pages works perfectly).
