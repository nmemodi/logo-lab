# Logo Lab

Logo Lab is an open-source collection of parametric tools for making strong minimalist logos from real design systems.

The tools start from specific modernist frameworks, mostly from the 1950s to 1980s, and turn each idea into a small browser-based system. Every output has a shareable URL, PNG/SVG export, and an iframe embed.

Live site: [natemodi.com/logo](https://natemodi.com/logo/)

## Tools

- Line Warp
- Brutalist Letters
- Interlocking Circles
- Parallel Letters
- Shape Tiles
- Sliced Shapes
- Slash Mark
- Polygon Rosette
- Echo Stripes
- Dot Grid

## Run locally

```sh
npm install
npm run dev
```

Then open `http://127.0.0.1:5173/logo/`.

You can also serve the repo as plain static files:

```sh
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000/logo/`.

## Structure

```text
logo/                 Landing page, Explorer, individual tools, and images
shared/               Shared controls, permalink logic, exports, registry, nav
tests/                Vitest coverage for shared browser behavior
index.html            Redirects the repo root to /logo/
```

The tools are intentionally static. There is no build step for the Logo Lab pages themselves.

## Add a tool

1. Create `logo/<slug>/index.html`.
2. Register the tool in `shared/tools-registry.js`.
3. Use the shared scripts from `shared/` for schema validation, permalinks, exports, embeds, and navigation.
4. Add a preview image if the tool should appear in the landing page or social cards.

Keep the tool state URL-safe. If a parameter cannot be validated and restored from the hash, it should not be part of the public URL.

## Notes

The generated marks are starting points. Check distinctiveness, conflicts, and trademark availability before using any mark for a real company or product.

The historical references are included to show the design systems behind each tool, not to reproduce existing marks.

## License

MIT
