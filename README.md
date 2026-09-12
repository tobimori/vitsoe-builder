# 606 planner

A browser planner for the Vitsœ 606 Universal Shelving System, built with
React, React Three Fiber, Three.js, Vite+, and pnpm.

## Development

```sh
pnpm install
pnpm dev
```

The development server binds to `0.0.0.0`, including the machine's Tailscale
interface. Vite prints the available URLs at startup. Use `tailscale ip -4`
to look up the Tailscale address.

```sh
pnpm check
pnpm test
pnpm build
```

The preview renders on demand, caps device pixel ratio at 1.5, and requests the
high-performance WebGL device. Camera movement and component edits request new
frames. Static views do not need a continuous animation loop.

For brief automated browser checks on this Linux host, use GPU acceleration:

```sh
pnpm dlx agent-browser --args '--enable-gpu,--use-angle=vulkan' open http://localhost:5173
pnpm dlx agent-browser close
```

These flags selected the NVIDIA RTX 5080 during verification. Default headless
Chromium used SwiftShader and consumed substantial CPU. Hardware selection is
controlled by the browser and host drivers; see the
[Chromium headless GPU guide](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/gpu/using-gpu-hardware-in-headless-chrome.md).

## Cloudflare deployment

The app deploys to Cloudflare Workers as static assets. Wrangler serves the
production build from `dist` with single-page application routing; no server
code or database is required.

```sh
pnpm exec wrangler login
pnpm run deploy
```

Wrangler prints the public HTTPS URL after deployment. `pnpm run deploy` builds the
app before uploading it. Cloudflare credentials, local Wrangler state, generated
builds, and the `docs` reference folder are excluded from Git.

See [Cloudflare's static asset documentation](https://developers.cloudflare.com/workers/static-assets/).

## Product model

Configuration dimensions are integer millimetres. The scene converts them to
metres, and the furniture assembly is shared with the USDZ export. Room walls,
dimensions, selection indicators, and lighting are outside that assembly.

The two bay widths are measured between support centres: 667 and 912 mm.
Their usable shelf widths are 655 and 900 mm. Adjacent bays share supports.
The E-track mounting holes follow a 70 mm vertical pitch.

The four support systems have different construction: wall-mounted E-tracks;
semi-wall X-posts with wall ties; floor-to-ceiling posts; and freestanding
H-posts with feet and components on both faces.

The catalogue includes shelves, display shelves, desks and tables, cabinet and
drawer variants, and their internal accessories. Select a compatible host before
adding an internal shelf, liner, divider, tray, bookend, or open-back option.
Accessory placement follows its host when the host moves.

Automatic E-track sizing uses each support and face independently. It compares
standard stock lengths and stacked combinations, retaining uncut stock when it
fits. Manual lengths allow cuts and the special shelf- and cabinet-height tracks.
The parts list shows stock quantities, cutting estimates, finish-specific prices,
and a known subtotal when a structural price is unpublished.

## Editing

- Set the system colour and wood finish once; individual components can override
  them or return to the system finish. The same resolved finish determines the
  3D material, catalogue preview, price, and exported AR model.
- Drag a component to another bay or pin height; double-click it for a closer view.
- Turn on Render for an optional higher-quality GPU view.
- Use the inspector for finishes, orientations, opening state, and front/back placement.
- Use Front or Back above the scene to choose a side in compressed or freestanding
  systems. The camera turns to that side, and the Add button names its destination.
  Switching sides does not add an undo step.
- Use Delete or Backspace to remove the selection, including hosted accessories.
- Undo with Ctrl/Cmd+Z; redo with Ctrl/Cmd+Shift+Z or Ctrl+Y.
- Escape closes a panel or clears the selection. Text fields retain normal editing shortcuts.
- Plans save in the URL as a compressed configuration, with local browser storage
  as a backup. Copy link opens the same plan on another device. JSON import/export
  is also available.

Selecting a track or post selects its connected support run. Moving it preserves
the bay centres: wall-mounted systems move along the wall and vertically,
semi-wall systems move along the wall at their bracket depth, and compressed or
freestanding systems move across the floor. These are changes to the plan;
installed wall and ceiling fixings would need repositioning.

Catalogue illustrations are cached still renders of the component geometry,
generated only when the catalogue opens. They share one offscreen renderer and
do not animate.

Optional display objects attach to their shelf or table and move, copy, save,
and export with it. They are visual planning aids and do not appear in the parts
price. Record sleeves are approximated as 315 × 315 × 5 mm; the 606 planning
guide recommends the 655 × 360 mm shelf for vinyl storage. The art books use the
published 210 × 260 mm format of TASCHEN's 96-page Basic Art editions, with an
approximately 14 mm spine.

## Presentation render

Render is an opt-in GPU presentation view and starts disabled on all devices,
including phones. It progressively lights the same configured model geometry
used by the editor and AR export. Rendering stops after 128 samples or 20 seconds
of active work, whichever comes first, and does not continue drawing once the
image is complete.

Moving the camera or changing the configuration restarts the image. Use Cancel
render, Back to edit, or Escape to return immediately to normal editing without
changing the plan or camera.

Surface colours, roughness, anodised aluminium, wood grain, and felt texture are
visual approximations. Confirm final finishes from physical samples.

## iPhone and iPad AR

The AR flow exports the current assembly as USDZ for Apple Quick Look. Configure
the furniture in the browser, then place and inspect it in AR at actual scale.
Desktop browsers can download the USDZ file.

Quick Look controls surface detection and final placement. A wall-mounted unit
may need its height adjusted in AR. Floor-to-ceiling units retain the ceiling
height entered in the planner; they do not measure the real ceiling.

Native Quick Look placement needs verification on an actual iPhone or iPad;
a desktop browser check cannot verify camera tracking or real-world scale.

## References

- [606 planning guide](https://www.vitsoe.com/site/download/3023/Regalsystem_606_Regalplanung.pdf)
- [EUR pricebook](https://www.vitsoe.com/login/pricebook/0/pdf/22618/EUR/Vits%C5%93_Preisliste.pdf)
- [Vitsœ support systems](https://www.vitsoe.com/de/606/structures)
- [Vitsœ components](https://www.vitsoe.com/de/606/components)
- [Vitsœ material and construction FAQ](https://www.vitsoe.com/de/faqs)
- [Vitsœ 606 planning guide with vinyl storage guidance](https://www.vitsoe.com/site/download/3563/606_Universal_Shelving_System_planning_guide_UK_EU_RW.pdf)
- [TASCHEN Bauhaus Basic Art edition](https://www.taschen.com/en/books/architecture-design/49208/bauhaus/)
- [TASCHEN Eames Basic Art edition](https://www.taschen.com/en/books/architecture-design/49209/eames/)
- [TASCHEN Kandinsky Basic Art edition](https://www.taschen.com/en/books/art/49243/kandinsky/)

The wordmark in `public/brand/vitsoe.svg` comes from Vitsœ's public website
stylesheet. The interface uses system-font fallbacks rather than redistributing
the website's licensed font files.

Prices are estimates from the August 2026 German EUR pricebook, including 19%
VAT, where a price can be verified. Product-specific mounting conditions and
precise small hardware geometry are documented in the research notes.

This is an independent planning tool. Vitsœ's planning service remains the
source for a final installation specification and quotation.
