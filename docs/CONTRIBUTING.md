# Contributing

Thanks for your interest in DiffNote! It's a small, dependency-free project, so
contributing is low-friction.

## Principles

- **Zero build, zero dependencies.** Plain HTML/CSS/JS served as-is. Do not add
  a bundler, framework, or `npm` runtime dependency.
- **Local-first.** No file content is uploaded except an explicit LLM call the
  user triggers. Keep it that way.
- **Design tokens are the SSOT.** Every style value traces to a token in
  [`DESIGN.md`](../DESIGN.md). Don't hardcode colors/spacing.

## Local development

```bash
python3 -m http.server 8000   # serve over localhost (required for the SW)
# open http://localhost:8000
```

After changing a service-worked file, hard-reload; the network-first SW serves
latest on a normal online reload.

## Testing

The diff engine is pure and testable in Node:

```bash
node -e '
const fs=require("fs");
const D=new Function("self", fs.readFileSync("js/diff.js","utf8")+"\nreturn self.DiffNoteDiff;")({});
console.log(D.compute("a\nb","a\nB").stats);
'
```

For UI changes, verify in a real browser (not `file://`) across **light + dark**
themes and at least one **narrow** viewport, and check the console is clean.

## Adding a UI string (i18n)

1. Add a key to `DICT` in `js/i18n.js` with all five languages
   (`en`, `zh`, `vi`, `ms`, `ja`).
2. Reference it via `data-i18n="key"` / `data-i18n-attr="attr:key"` in markup,
   or `DiffNoteI18n.t('key', vars)` in JS.

## Adding an icon

Add an entry to `ICONS` in `js/icons.js` (24×24 `viewBox`, `currentColor`
stroke), then use `data-icon="name"` in markup or `DiffNoteIcons.set(el, name)`.

## Adding an LLM provider

1. Add it to `PROVIDERS` in `js/settings.js` with an `api` adapter name.
2. Implement / reuse the adapter in `js/llm.js`.

## Commit style

Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`…). Keep changes
focused and update the relevant docs in `docs/`.

## License

By contributing you agree your contributions are licensed under the project's
[MIT License](../LICENSE).
