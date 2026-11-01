# 606 planner

A browser planner for the Vitsœ 606 Universal Shelving System, built with
React, React Three Fiber, Three.js, Vite+, and pnpm.

## Development

```sh
pnpm install
vp run dev
```

Project commands are Vite+ tasks in `vite.config.ts`. The dev and preview
servers run through [Portless](https://github.com/vercel-labs/portless) at
`https://vitsoe.test`. In a Git worktree, Portless adds the branch name as a
subdomain, for example `https://my-branch.vitsoe.test`. Set `PORTLESS=0` to run
Vite directly.

```sh
vp run check
vp run test
vp run build
vp run preview
```

`t3.json` configures T3 Code. New threads start in a worktree, and
`scripts/setup-worktree.sh` installs dependencies and links the ignored `docs`
reference folder from the main checkout.

The preview renders on demand, caps device pixel ratio at 1.5, and requests the
high-performance WebGL device. Camera movement and component edits request new
frames. Static views do not need a continuous animation loop.

For brief automated browser checks on this Linux host, use GPU acceleration:

```sh
pnpm dlx agent-browser --args '--enable-gpu,--use-angle=vulkan' open https://vitsoe.test
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
vp run deploy
```

Wrangler prints the public HTTPS URL after deployment. `vp run deploy` builds the
app before uploading it. Cloudflare credentials, local Wrangler state, generated
builds, and the `docs` reference folder are excluded from Git.

Pushes to `main` deploy through Cloudflare Workers Builds, with these settings:

- Build command: `pnpm exec vp build`
- Deploy command: `pnpm exec wrangler deploy`

Use the installed Wrangler. `pnpx wrangler deploy` installs another copy, and pnpm
stops on its unapproved build scripts with `ERR_PNPM_IGNORED_BUILDS`.

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
- Choose a component and its size, then place it in the view: it follows the
  pointer, snaps to the bay and pin height under it, and takes the width of that
  bay. Place several in a row, and press Escape or Done to finish. With a mouse,
  drag a component from the catalogue straight into a bay.
- Drag a component to another bay or pin height; double-click it for a closer view.
  It glides between positions, takes the width of a bay of the other width, and
  slides to the nearest free hole when the one under the pointer is taken.
- Choose 3D for a free view of the shaded system, Elevation for a straight view of
  the active face, or Drawing for a line drawing in the style of Vitsœ's system
  illustrations. Drawing always shows the active face from the same oblique angle:
  the front is true to scale and depth goes up and to the right at half scale. It
  pans and zooms, does not turn, and stays editable.
- The left panel holds the plan's name and file menu, the Layers of the system,
  and the Components catalogue. Layers lists each side, bay, component, accessory,
  and support. Select a layer to select it in the view; double-click it for a closer
  view.
- The right panel shows the total price, sharing and AR, the Details of the
  selection or of the whole system, and the Parts list. Use Details for finishes,
  orientations, opening state, and front/back placement.
- Tablets and phones on their side show one panel beside the view; phones held
  upright show it under the view. That panel has every tab, and the plan's name
  and file menu sit at the top of Details. Fields and buttons grow for fingers.
  Drag with one finger to move a component or turn the view, and pinch to zoom.
- Use Front or Back on the view to choose a side in compressed or freestanding
  systems. The camera turns to that side, and orbiting round the system switches
  side too. New components go to the side in view. Drop a dragged component on the
  other side's button to move it there at the same bay and height, or rest on the
  button until the view turns round and go on dragging it on that side. Switching
  sides does not add an undo step.
- Dimensions stay hidden until you need them. Point at a component to see its width,
  depth, and pin height, or at a support for the run's distances to the corners, the
  wall, and the ceiling. Hold Alt to see every dimension, or tick Dimensions to keep
  them visible. A dragged component always shows where it would land. On a touch
  screen, selecting a component shows its dimensions, and the ruler button on the
  view keeps all of them visible.
- Move the selected component with the arrow keys: left and right change the bay,
  up and down change the pin height.
- Use Delete or Backspace to remove the selection, including hosted accessories.
- Undo with Ctrl/Cmd+Z; redo with Ctrl/Cmd+Shift+Z or Ctrl+Y.
- Escape stops placing or clears the selection. Text fields retain normal editing shortcuts.
- Plans save in the URL as a compressed configuration, with local browser storage
  as a backup. Copy link opens the same plan on another device. JSON import/export
  is also available.

Every system stands along one of the four walls of a rectangular room, with its
front facing into the room. Position, in the system's Details, shows the room from
above: choose a wall there, and drag the system along it. Its position is measured from the wall's
corners to the centres of the outer supports, and the view shows the same chain
of dimensions. Walls between the camera and the system are hidden.

Selecting a track or post selects its connected support run. Moving it preserves
the bay centres: wall-mounted systems move along the wall and vertically,
semi-wall systems move along the wall at their bracket depth, and compressed or
freestanding systems also move out from the wall. A run stops at the room's
corners and holds at the centre of its wall. These are changes to the plan;
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
