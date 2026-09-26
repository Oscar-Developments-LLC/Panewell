# Panewell

A borderless browser where fullscreen fills the **window**, not your whole monitor.

Hit fullscreen on YouTube, Netflix, ESPN or anything else and the video expands to
fill the Panewell window at whatever size and shape you left it. Resize the window
and the video follows. Nothing takes over your screen.

## Why

Every browser treats fullscreen as all-or-nothing: either a video sits inside a page
full of chrome, or it swallows your entire monitor. Panewell gives you the middle
ground, a clean video pane you can park anywhere and size however you like while you
work in other windows.

## Security notice

Panewell is an independent, community-built project. It has not had a professional
security audit, and it does not get the frequent, fast security patches that major
browsers like Chrome, Edge, or Firefox do.

**Do not use it for banking, passwords, or anything else sensitive.** Stick to
general browsing, streaming, and everyday sites.

Panewell is provided "as is" under the MIT license, with no warranty of any kind.
Oscar Developments LLC is not liable for any damages, data loss, or security
incidents arising from its use.

## Features

- **Window fullscreen.** A site's own fullscreen button, or `F11`, fills the
  Panewell window instead of your display.
- **Borderless.** No OS title bar. Drag the empty tab-bar space to move it, drag any
  edge or corner to resize.
- **A real browser.** Tabs, back/forward/reload, address bar with search, favicons,
  persistent logins.
- **DRM streaming works.** Netflix, Disney+, Hulu and Prime Video play, because
  Panewell ships Widevine support (see [Streaming notes](#streaming-notes)).
- **Light and dark.** Follows your system theme.

## Install

Grab the latest build from [Releases](https://github.com/Oscar-Developments-LLC/panewell/releases).

| Platform | File |
| --- | --- |
| Windows | `Panewell-x.y.z-win-x64-setup.exe` (installer) or `-portable.exe` (no install) |
| macOS | `Panewell-x.y.z-mac-arm64.dmg` (Apple Silicon) or `-x64.dmg` (Intel) |
| Linux | `Panewell-x.y.z-linux-x86_64.AppImage` or `-linux-amd64.deb` |

Builds are **unsigned**, so the first launch shows a warning.

- **Windows:** "Windows protected your PC" then More info, then Run anyway.
- **macOS:** right-click the app, then Open, then Open again.
- **Linux AppImage:** `chmod +x Panewell-*.AppImage` then run it.

## Shortcuts

| Key | Action |
| --- | --- |
| `F11` | Fill the window with the page, hide the tab bar |
| `Esc` | Leave fill mode |
| `Ctrl/Cmd + T` | New tab |
| `Ctrl/Cmd + W` | Close tab |
| `Ctrl/Cmd + L` | Focus the address bar |
| `Ctrl/Cmd + R` | Reload |
| Middle-click a tab | Close it |

## Streaming notes

Panewell is built on [castlabs Electron for Content Security](https://github.com/castlabs/electron-releases),
which bundles Google's Widevine CDM, so DRM video plays.

Two limits are worth knowing:

1. **Netflix and some other services also require VMP signing** on Windows and macOS.
   That approval is free through castlabs EVS, and the release workflow will apply it
   automatically once `EVS_ACCOUNT_NAME` and `EVS_PASSWD` are set as repository
   secrets. Without it, everything works except those specific DRM sites.
2. **Quality is capped**, same as any desktop browser using software Widevine. Expect
   720p on Linux and up to 1080p elsewhere, never 4K. This is a studio restriction,
   not a Panewell bug.

## Build from source

Requires Node.js 20 or newer.

```bash
git clone https://github.com/Oscar-Developments-LLC/panewell.git
cd panewell
npm install
npm start           # run in development
npm run dist        # package for your current platform
```

Cross-platform packaging happens in CI. Push a version tag and the workflow in
`.github/workflows/release.yml` builds Windows, macOS and Linux, then attaches
everything to a GitHub release:

```bash
git tag v1.0.0
git push --tags
```

## How the fullscreen trick works

Electron normally takes over the whole monitor when a page calls the HTML fullscreen
API. Panewell creates its window with `fullscreenable: false`, so that request can't
resize the window. The page still enters its own fullscreen layout, it just does so
inside the window's existing bounds. Panewell then hides the tab bar and stretches
the page view edge to edge, so the video gets every pixel of the window.

## License

MIT, Copyright (c) 2026 Oscar Developments LLC. See [LICENSE](LICENSE).
