---
type: guide
updated: 2026-10-30
---
# How to use Massing Studio

Massing Studio takes a zoning envelope and a plain-language brief and gives you six different massing options. For
each one you get metrics, a zoning compliance table and a sun study, and you can export it to Rhino. The geometry engine
computes every number. Options that break a rule are labelled with the rule, never hidden or quietly fixed. Results are
study-grade; verify them with a zoning professional.

## Start it
- **Mac:** double-click **Start WXY Apps.command** in the vault folder. It starts Site Brief and Massing Studio
  together. Massing Studio is at http://localhost:3301.
- **Windows:** double-click **Start WXY Apps.bat**. It was written for Windows but hasn't been tested there yet.
- No API key is needed. Options come from the **Built-in strategies**, at no cost, in about a second.

## Make options
1. **Site.** Choose one of three ways:
   - In Site Brief, press **Open in Massing**. The real lot arrives already loaded.
   - Pick a sample lot on the first screen (all three are labelled SAMPLE).
   - Use **Load envelope (.json)** with a file from Site Brief.
2. **Brief.** Describe the project the way you'd brief the team, e.g. "~120 units, ground-floor retail, a public
   courtyard, step down toward the park". Press **Read brief**, or skip and start with an empty schedule.
3. **Program schedule.** Check the uses and areas it read from your brief, then press **Confirm schedule**.
4. **Assumptions.** Floor-to-floor heights, unit size and efficiency. Edit any of them.
5. **Generate 6 options.**

## Compare and refine
- **Compare** shows all six; **Focus** shows one large. Press **C** to switch, or **1–6** to pick an option.
- The right panel shows the option's headline numbers, its **zoning table** (Rule, Allowed, Proposed, Status) and
  parameter sliders. Sliders update the model live.
- **Iterate:** tell an option what to change ("pull the tower east") and press **Apply changes**. **⌘Z** (Ctrl+Z on
  Windows) undoes.
- **Sun:** press **S** for the sun study.
- **3D view:** drag (one finger on touch) to orbit, scroll or pinch to zoom, and right-drag or two-finger drag to pan.
  The toolbar under the viewer has camera views (Axon NE, Axon SW, Plan, Street), a section cut with its elevation
  in feet, the sun study, and model or diagram style. Diagram style colours each use.

## Take it elsewhere

| You want to… | Do this | Opens in |
|---|---|---|
| Keep designing in Rhino | **Export → Export .3dm for Rhino**. The file is in feet, with layers `Envelope`, `Context`, `Option_01…` and sub-layers per use. Metrics, parameters and rules are attached as object user text. | Rhino 8 (File › Open) |
| Drive a Grasshopper definition | **Export → Export parameters (JSON for Grasshopper)** | Grasshopper (read with a JSON component) |
| Present or view on the web | **Export → Export glTF** | Blender, three.js viewers, PowerPoint 3D |
| Put it on a board | **Export → Export boards (PNG)** | InDesign, Illustrator, Slides |

Press **E** to open the export menu. The .3dm round-trips correctly in automated tests but hasn't been opened in Rhino 8
on this machine; `app/docs/rhino-verification.md` has the manual check.

## On other devices
- **Laptops and desktops** (1024 px and wider): setup on the left, viewer in the middle, details on the right.
- **iPad and phones:** the same app. **Setup** (top left) slides in the site, brief and schedule steps; **Details** (top
  right) slides in the selected option's numbers and zoning table. The 3D view works with touch. On the same Wi-Fi,
  open `http://<your Mac's address>:3301`; the launcher prints the address.
- **Dark mode:** the moon button in the footer switches to the dark "graphite night" theme.
- **Reduced motion:** with your device's "Reduce motion" setting on, the camera jumps instead of flying and nothing animates.

## Limits to keep in mind
The rules are SIMPLIFIED where marked † in the zoning table: ZFA = GFA, yards apply at all heights, towers aren't
modelled, and more. The full list is in `app/README.md`. AI mode exists but has never been run against the live API.

**Lot area:** FAR, lot coverage and open space use the lot area recorded in the envelope (PLUTO, for lots from Site
Brief), so the allowed floor area matches Site Brief. The drawn outline is only used for geometry. When the two differ
by more than 1%, the Site step says so. For example, at 287 Convent Avenue FAR uses 4,675 sf, while the outline
measures 4,887 sf.
