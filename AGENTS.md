# Working on this project

Use pnpm and Vite+. Keep development and preview servers bound to `0.0.0.0`.
Start the development server when working on the app, keep it running, and give
the user its Tailscale IP and port as soon as it is listening.

Use `agent-browser` for browser inspection and interaction checks.
Keep browser sessions brief and close them after verification. Avoid parallel
browser sessions and repeated screenshots. Check the renderer before extended
3D testing: software rendering can consume several CPU cores. The scene should
render on demand and use hardware acceleration when the browser provides it.
On this Linux host, launch agent-browser with
`--args '--enable-gpu,--use-angle=vulkan'`. This was verified to select the
NVIDIA RTX 5080; the default headless renderer used CPU-based SwiftShader.

Prefer GPT-5.6-Sol agents for application code, GPT-5.6-Luna with maximum
reasoning for research, and GPT-6-Astra for 3D models and spatial work.

Write simple, readable code with generous whitespace. Apply YAGNI and DRY:
add abstractions only when they make existing code easier to understand.

The builder covers all four Vitsœ 606 mounting systems and the full available
606 component catalogue. Verify product dimensions and combination rules
against Vitsœ's sources. Keep dimensions in millimetres in configuration data
and convert to metres at the 3D boundary.

Room width, depth, and ceiling height are configurable outside AR. iPhone and
iPad are the first AR targets. Render and export the same furniture geometry.

Prioritise accurate component models and distinct materials. Inspect the real
component photographs in `docs/references`, or Vitsœ's official component
photographs if the local references are absent, before changing model geometry.
Keep the pricebook's prices visible per component, finish, and parts list.

Apply colours and wood finishes globally, with explicit per-item overrides and
a way to return to the system finish. Resolve appearance consistently for the
scene, catalogue previews, pricing, and AR export. Use actual component models
for cached catalogue previews; do not create a live WebGL canvas for every card.
Fix overlapping surfaces and incorrect joints at the geometry level.

Recommend E-track stock lengths, stacked sections, and cuts automatically from
component placement. Support editing both faces of compressed and freestanding
systems. Provide deletion, undo/redo, and Escape shortcuts without interfering
with text or number-field editing.

Make tracks selectable and allow the connected system to move within each
mounting mode's constraints, preserving the fixed bay centres and shared supports.
Test front and back placement explicitly in both freestanding and compressed modes.

Follow Vitsœ's typography, column grids, restrained colours, and spacing.
Use generous whitespace, readable controls, neutral grey sections, and blue
primary actions, following the actual Vitsœ website reference.
