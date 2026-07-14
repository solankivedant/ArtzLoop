# Design / UX conventions

Applies to every toy so the collection feels like one family of apps rather than 20 unrelated pages.

## Layout

- Canvas fills the viewport below a slim control bar. The canvas is the app - controls stay minimal and out of the way.
- Control bar holds only what's specific to the toy's mechanic (a couple of sliders/inputs) plus the four constants every toy has: Save, Load, Clear, Mute.
- Fully responsive: works at any window size and on mobile viewports, not just desktop.

## Interaction

- Mouse, touch, and pen must all work identically via Pointer Events - never assume a mouse is present.
- The core mechanic should be discoverable within a few seconds of interacting with the canvas, without reading instructions.
- Audio starts only on first user interaction (browser autoplay rules), as a soft ambient pad mixed quietly (~-18dB) so it never competes with the visual focus.
- Mute state persists across reloads via `localStorage`.

## Visual tone

- No sign-in screens, onboarding walls, ads, or upsells inside the toy itself - the app opens straight into the canvas.
- Keep chrome (buttons, sliders, labels) visually quiet - neutral colors, small footprint - so the generative art the user creates is always the most visually prominent thing on screen.
- Prefer color choices that stay legible/usable in both light and dark ambient environments, since these are likely used with the room lights off as much as on.

## Consistency across toys

- Keep the Save/Load/Clear/Mute control positions and iconography consistent toy-to-toy so the collection feels like one product line.
- Keep the "resume last session?" prompt's copy and placement consistent across toys.
