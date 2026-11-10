# Rhino 8 verification of the .3dm export (manual)

**Not run in this environment — Rhino is not installed on the build machine; automated round-trip test via rhino3dm passes**
(`src/lib/export/__tests__/export3dm.test.ts`: units = Feet, layer tree, object counts per layer, user-string round trip, document strings).
The steps below need a human with Rhino 8. All sample sites are SAMPLE data.

Expected file: `Massing Studio - <envelopeId>.3dm` exported with "Export .3dm for Rhino".

1. **Open** the file (File > Open). Expect no unit-conversion prompt.
2. **Units = Feet.** Open Document Properties (command `DocumentProperties`, confirmed:
   "The DocumentProperties command opens the Document Properties dialog box to manage the settings for the current model."
   — https://docs.mcneel.com/rhino/8/help/en-us/commands/documentproperties.htm). On its Units page confirm model units read Feet.
   (The page text I could fetch does not describe the Units page itself — the page path is UNVERIFIED; describe: Document Properties > Units.)
3. **Layer tree.** Open the Layers panel. Expect `Envelope`, `Context`, and `Option_01` ... `Option_0N`, each Option with children
   `Residential`, `Commercial`, `Community facility`. Option layers hold meshes named "Option N · <name> · floors a–b".
4. **Object user text.** Select one option mesh, open Properties > Attribute User Text. Expect keys `wxy.option`, `wxy.typology`,
   `wxy.program`, `wxy.floors`, `wxy.z0_ft`, `wxy.z1_ft`; the first mesh of each option also carries `wxy.metric.*`, `wxy.param.*`,
   `wxy.rule.*`, `wxy.assumption.*`, `wxy.citation.*`, `wxy.intent`. Command-line alternative: `GetUserText` — UNVERIFIED
   (the McNeel page fetched only returned a redirect stub, so the command's behaviour is not confirmed here; use the Properties panel).
5. **Document user text.** Open Document Properties > Document User Text (listed as a link on the DocumentProperties page).
   Expect entries under section `wxy` (e.g. `wxy\option_1.metric.gfa_sf`). The same values are also stored under dotted keys
   (`wxy.option_1.metric.gfa_sf`); whether Rhino lists un-sectioned dotted keys in that panel is UNVERIFIED. Also expect `wxy.units` = feet,
   `wxy.sample` = "SAMPLE — not a real parcel" (sample sites), `wxy.disclaimer`. `GetDocumentUserText` — UNVERIFIED (redirect stub only).
6. **Measure.** Run `Distance` (confirmed: "The Distance command reports the distance between two points." —
   https://docs.mcneel.com/rhino/8/help/en-us/commands/distance.htm). Snap to two ends of one edge of the lot outline
   (Envelope layer, z = 0). For the 100 x 100 ft square SAMPLE lot the distance is 100 ft. Also check an option's height in
   Properties/bounding box equals its `wxy.metric.height_ft`.
7. Record pass/fail and Rhino version in `STATUS.md`.
