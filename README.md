# Site Hidden for Joomla

This repository packages two Joomla plugins into one installable package ZIP:

- `Content - Site Hidden` removes `{site-hidden}...{/site-hidden}` blocks from frontend output, or reveals them only to allowed users.
- `Button - Site Hidden` adds an editor button that inserts and edits `{site-hidden}` blocks from the Joomla editor.

## Repository Layout

- `package/` contains the Joomla package manifest and package language files.
- `package/plugins/content/sitehidden/` contains the source for `Content - Site Hidden`.
- `package/plugins/editors-xtd/sitehiddenbutton/` contains the source for `Button - Site Hidden`.
- `build/build.ps1` builds the installable Joomla package ZIP.
- `build/output/` contains generated release artifacts.
- `build/stage/` is a temporary packaging area used during the build.
- `build.bat` is a Windows shortcut for the PowerShell build script.

## What the Package Installs

### Content - Site Hidden

Use this plugin to wrap content that should not appear on the frontend:

```text
{site-hidden}
Hidden content goes here.
{/site-hidden}
```

Frontend behavior is controlled by the plugin parameters:

- `Never` removes the wrapped block completely.
- `Only to Super Users` reveals it only to users with `core.admin`.
- `Only to Groups` reveals it only to the specified Joomla user group IDs.

### Button - Site Hidden

This editor button helps authors insert and edit `{site-hidden}` blocks without typing the markers manually.

- It adds a toolbar button to the Joomla editor.
- It inserts a visible inline preview block inside the editor.
- It supports inline edit/remove controls directly on that preview block.

## Versioning

The release/build version is taken from:

- `package/pkg_sitehidden.xml`

The bundled child plugins keep their own manifest versions:

- `package/plugins/content/sitehidden/sitehidden.xml`
- `package/plugins/editors-xtd/sitehiddenbutton/sitehiddenbutton.xml`

The release tag validation checks the package manifest version, not the child plugin versions.

## Build

Run either:

```bat
build.bat
```

or:

```powershell
powershell -ExecutionPolicy Bypass -File .\build\build.ps1
```

The generated package is written to:

```text
build/output/pkg_sitehidden_vX.Y.Z.zip
```

The final archive is built with the Joomla-installable root layout directly at ZIP root:

- `pkg_sitehidden.xml`
- `language/`
- `packages/plg_content_sitehidden.zip`
- `packages/plg_editors_xtd_sitehiddenbutton.zip`

## Installation

1. Build the package ZIP.
2. In Joomla Administrator go to `System -> Install -> Extensions`.
3. Upload `build/output/pkg_sitehidden_v<version>.zip`.
4. Enable `Content - Site Hidden` and `Button - Site Hidden` if they are not already enabled.
5. Configure the content plugin visibility settings as needed.

## GitHub Releases

This repository publishes the installable package automatically through GitHub Actions when a tag in the form `vX.Y.Z` is pushed.

Release flow:

1. Update the version in `package/pkg_sitehidden.xml`.
2. Commit and push your changes.
3. Create and push a matching tag:

```powershell
git tag v1.4.7
git push origin v1.4.7
```

4. The workflow in `.github/workflows/release.yml` will:
   - validate that the tag matches `package/pkg_sitehidden.xml`
   - run `build/build.ps1`
   - upload `build/output/pkg_sitehidden_v<version>.zip` to the GitHub Release

Generated ZIP files stay out of git history and are distributed through GitHub Releases instead.
