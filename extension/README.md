# Teacher Toolkit — Embed Unblocker

A small Chrome extension that lets the **Lesson Board**'s Web Page tile show
sites that normally refuse to be embedded — Google, BBC Bitesize, Quizlet and
plenty of others.

Without it those sites come up blank in a pane and you have to open them in a
separate tab. With it, they just work.

## Install (about a minute, one time per computer)

1. Download this `extension/` folder to the computer you teach from.
   (On the repo page: **Code → Download ZIP**, then unzip and find `extension/`.)
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and pick this `extension/` folder.
5. Reload the Lesson Board. The Web Page tile will now say the unblocker is
   active.

It stays installed until you remove it. Chrome may show a "Developer mode
extensions" notice on startup — that's normal for an extension installed this
way rather than from the Web Store.

## What it actually does

Sites stop themselves being embedded by sending an `X-Frame-Options` header or
a Content-Security-Policy `frame-ancestors` directive. Chrome enforces those
before any page script runs, which is why the toolkit itself cannot work around
it. This extension removes `X-Frame-Options` so the frame is allowed to render.

It no longer touches `Content-Security-Policy`. Chrome's rule API can only
remove a whole header, not one directive, so dropping CSP to get at
`frame-ancestors` also disabled the embedded site's own XSS defences — its
script allowlists and nonces — for as long as it sat in your board. That is a
much bigger trade than this feature needs. The cost is that a site which
blocks framing *only* via CSP `frame-ancestors`, with no `X-Frame-Options`
header, will still refuse to embed. Open those in a normal tab instead.

## Why this is scoped the way it is

Those headers exist to prevent **clickjacking** — a malicious page embedding, say,
your bank, laying invisible buttons over the real ones, and stealing your clicks.
Stripping them everywhere would remove that protection across your whole browser.

So the rule is deliberately narrow:

- `"resourceTypes": ["sub_frame"]` — only frames, never top-level pages you visit.
- `"initiatorDomains": ["dryck.github.io"]` — only frames loaded **by the
  Teacher Toolkit itself**.

`localhost` and `127.0.0.1` used to be in that list for development, and have
been removed. A local port is not a trust boundary: any other project serving
on localhost — including something a dependency's install script started —
would have inherited the ability to frame authenticated sites with
clickjacking protection stripped. If you need it while developing, add it back
locally and don't commit it.

Any other site that tries to frame Google still gets blocked exactly as before.
The change applies to your board and nothing else.

## If you also run the toolkit somewhere else

If you host it on another domain, add that domain to `initiatorDomains` in
`rules.json` and to `matches` in `manifest.json`, then reload the extension on
`chrome://extensions`.

## Removing it

`chrome://extensions` → **Remove**. The board carries on working; blocked sites
simply go back to needing the **↗ Tab** button.
