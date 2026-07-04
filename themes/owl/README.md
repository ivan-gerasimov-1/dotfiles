# Owl theme

Canonical low-colour theme for this setup.

Model:

- Ghostty owns the base palette and background: `theme = owl`.
- Terminal apps should use transparent backgrounds when possible.
- App chrome may add small contrast locally, but should not introduce a new full palette.
- Primary accent: `#da5b2c`.
- Everything else is grayscale.

App notes:

- `ghostty`: built-in `owl` theme.
- `herdr`: `gruvbox` is intentionally kept for pane/tab chrome contrast.
- `btop`: `TTY` + `theme_background = false`, so it follows terminal ANSI colours.
- `nvim`: custom `colors/owl.lua`, based on this palette.
- `lazygit`: custom low-colour UI/delta styles.
- `yazi`: custom low-colour theme, transparent app background.
- `starship`: already low-colour (`white`).

Subdirectories under `apps/` are reference/source snippets for app-specific theme work.
