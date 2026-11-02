# 606 planner

A planner for the Vitsœ 606 Universal Shelving System that runs in the browser. Plan a
system on your wall, see it in 3D or as a Vitsœ-style line drawing, check the parts
and price, and place it in your room with AR on an iPhone or iPad.

Built with React, React Three Fiber, Three.js, StyleX and Vite+.

## Development

```sh
pnpm install
vp run dev
```

The dev server runs through [Portless](https://github.com/vercel-labs/portless) at
`https://vitsoe.test`. In a Git worktree, the branch name becomes a subdomain, such as
`https://my-branch.vitsoe.test`. Set `PORTLESS=0` to run Vite on its own.

```sh
vp run check     # format, lint and type-check
vp run test
vp run build
vp run preview
```

The tasks live in `vite.config.ts`. `t3.json` sets up T3 Code: new threads start in a
worktree, and `scripts/setup-worktree.sh` installs dependencies and links the
`docs` folder from the main checkout.

On this Linux machine, headless Chromium falls back to software rendering unless
you ask for the GPU:

```sh
pnpm dlx agent-browser --args '--enable-gpu,--use-angle=vulkan' open https://vitsoe.test
```

## Deployment

The app is static and runs on Cloudflare Workers as static assets, with no server
code or database.

```sh
pnpm exec wrangler login
vp run deploy
```

Pushes to `main` deploy through Workers Builds, with these settings:

- Build command: `pnpm exec vp build`
- Deploy command: `pnpm exec wrangler deploy`

Use the installed Wrangler. `pnpx wrangler deploy` fetches another copy, and pnpm then
stops with `ERR_PNPM_IGNORED_BUILDS`.

## How the planner models 606

- Sizes are whole millimetres. Bays are 667 or 912 mm between support centres, with
  655 or 900 mm of shelf between them. Neighbouring bays share a support.
- Components hang on pins in the E-tracks. The first hole is 35 mm from the bottom
  of a track, then there's one every 70 mm. With the tracks at the usual 345 mm, a
  cabinet can sit with its top at 740 mm, level with a table.
- There are four ways to mount a system: on the wall, on posts tied to the wall
  (semi-wall-mounted), on posts held between floor and ceiling, or freestanding on
  feet. The last two can carry components on both sides.
- E-track lengths follow the components on each support. The planner picks the
  cheapest stock lengths and stacks them when one is not enough. A support that
  carries only cabinets at one height gets the 395 mm cabinet-height track, flush
  with the cabinets at top and bottom. You can also set a length yourself.
- The parts list counts every part, adds cutting charges and flags anything Vitsœ
  doesn't publish a price for.
- The 3D models follow the dimensioned drawings in Vitsœ's planning guide where it
  has them. Colours and textures are close, not exact. Check finishes against real
  samples.

## Using it

- **Place components** from the Components tab. The component follows the pointer,
  snaps to a bay and pin height, and takes the width of that bay. With a mouse you can
  also drag it straight from the catalogue into the view.
- **Move components** by dragging them, or with the arrow keys: left and right change
  the bay, up and down the height. If a spot is taken, the component moves to the
  nearest free hole. Hold Alt as you drag to copy instead.
- **Layers** lists every side, bay, component and support. Drag rows to move
  components to another bay or side, or between two others to set their height.
- **Two-sided systems**: Front and Back on the view switch sides. To move a component
  across, use Move to back in Details or the right-click menu, or drag it onto the
  other side's button.
- **Bookends** slide along their shelf and can move to another shelf on the same side.
- **Select several** with Shift-click or Cmd/Ctrl-click, or Cmd/Ctrl+A for everything.
  Copy, cut, paste, duplicate (Cmd/Ctrl+D), delete and undo work as you'd expect.
- **Dimensions** stay out of the way. Point at something to see its size, hold Alt
  to see them all, or turn on Dimensions. Select one component and point at another to
  see the space between them.
- **Views**: 3D, Elevation (straight on) and Drawing, a line drawing in the style of
  Vitsœ's own illustrations. All three can be edited.
- **The room** is a rectangle. Pick one of its four walls for the system and drag the
  system along it. Positions are measured to the centres of the outer supports.
- **Phones and tablets** get one panel beside or below the view, larger controls,
  and touch gestures.

## Plans and the library

Plans save in the browser as you work, and the whole plan is also packed into the
URL, so a link opens it anywhere. A link to a plan you don't have opens as a new
plan and leaves yours alone.

The Library, under the plan's name, shows your saved plans as line drawings to open,
copy or delete. Its Inspiration tab has ten well-known 606 systems from
[Vitsœ's gallery](https://www.vitsoe.com/gb/606/gallery) and
[Are.na](https://www.are.na/vitsoe-9aarysl-i4w), each redrawn as a plan and shown
beside its photograph. The photographs load from where they're published. The plan
menu also imports and exports plans as JSON.

## AR on iPhone and iPad

View in AR exports the system as a USDZ file for Apple Quick Look, at full size.
Other devices can download the file.

A wall-mounted system has no anchor in the file, so Quick Look shows it upright and
lets you drag it onto a wall, the same as model-viewer does. Floor-to-ceiling
systems use the ceiling height from the planner, not the real one. Placement can only
be checked on a real device.

## References

- [606 planning guide (UK/EU)](https://www.vitsoe.com/site/download/3563/606_Universal_Shelving_System_planning_guide_UK_EU_RW.pdf)
- [606 Regalplanung (German planning guide)](https://www.vitsoe.com/site/download/3023/Regalsystem_606_Regalplanung.pdf)
- [EUR price list](https://www.vitsoe.com/login/pricebook/0/pdf/22618/EUR/Vits%C5%93_Preisliste.pdf)
- [Support systems](https://www.vitsoe.com/de/606/structures)
- [Components](https://www.vitsoe.com/de/606/components)
- [Materials and construction FAQ](https://www.vitsoe.com/de/faqs)

Prices come from the August 2026 German price list and include 19% VAT. The wordmark
in `public/brand/vitsoe.svg` is from Vitsœ's website. The interface is set in Inter,
standing in for Vitsœ's licensed typeface.

This is an independent tool, not made by Vitsœ. Vitsœ's planners confirm the final
plan with you before you order.
