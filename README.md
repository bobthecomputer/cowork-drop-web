# Cowork Drop Web

Static mobile-test version of the drop and gallery idea.

## What this repo is

- Deployable on GitHub Pages
- Openable on iPhone or Android in a normal browser
- Good for testing the mobile UX, layout, gallery feel, and staging flows
- Not a replacement for the Tauri desktop backend

## Local run

```powershell
npm install
npm run dev
```

## Build

```powershell
npm run build
```

## Create a new GitHub repository and push this app

From inside this folder:

```powershell
git init
git add .
git commit -m "Initial mobile web prototype"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

## Enable GitHub Pages

In the GitHub repository:

1. Open `Settings`
2. Open `Pages`
3. Set `Source` to `GitHub Actions`

After that, every push to `main` deploys automatically through `.github/workflows/deploy-pages.yml`.

## Important limitation

GitHub Pages only hosts static files. If you want real cross-device transfer later, this repo will need a real backend or a browser-to-browser transport layer, not just Pages.
