---
type: guide
updated: 2026-10-30
---
# How to use Site Brief

Site Brief turns an NYC address into a **draft** zoning brief: lot facts, districts, permitted uses, bulk rules with
visible formulas, and a 3D envelope. Every number links to its source. It's research for a licensed professional to
review. It is not a zoning determination.

## Start it
- **Mac:** double-click **Start WXY Apps.command** in the vault folder. The first run installs and builds (a few
  minutes). Your browser then opens Site Brief at http://localhost:3101. Leave the Terminal window open while you work.
- **Windows:** double-click **Start WXY Apps.bat**. It was written for Windows but hasn't been tested there yet.
- You need Node.js 20 or newer (https://nodejs.org). No API key is needed; without one, the AI narrative is simply left out.

## Draft a brief
1. Type an address or a 10-digit BBL ("287 Convent Avenue, Manhattan"), or pick one of the evaluation lots.
2. Set **Intended use** (Residential, Commercial, Community facility, Mixed) and, if it applies, the affordable or
   senior housing program.
3. Press **Draft brief**. The step rail shows progress: Locate → Lot data → Districts → Rules → Calculate → Review.

## Read and check it
- **Key controls** at the top: max FAR, max floor area, base height, max height, rear yard, coverage. Each one shows
  how sure it is: **Cited** (from the Zoning Resolution), **Inferred** (from a proposed assumption) or **Needs input**.
- Click any **ZR tag** (e.g. ZR 23-22) to open the source text with the cited passage highlighted.
- **Assumptions and open questions:** accept, reject or edit each assumption, such as street width or lot type. The
  memo recalculates.
- **Flags requiring professional review:** split lots, landmarks, special districts and districts this build doesn't
  cover. These are never guessed.
- **Mark verified** once a person has checked a section. Your name and date go into the title block.
- **Plan / 3D** switches the site view between the map and the zoning envelope.

## Take it elsewhere

| You want to… | Do this | Opens in |
|---|---|---|
| Study massing options for this lot | **Open in Massing**. Massing Studio opens in a new tab with the lot loaded. | Massing Studio (same browser) |
| Share or print a sheet | **Export → Download PDF sheet** (A3 drawing sheet Z-101 with title block, north arrow, scale and DRAFT stamp) | Any PDF viewer, Bluebeam, email, iPad |
| Paste into notes or a report | **Export → Download Markdown** | Obsidian, Word, Notion |
| Hand the envelope to another tool | **Download JSON**, which is a ZoningEnvelope v1.0.0 | Massing Studio's *Load envelope*, scripts |

If your browser blocks the new tab from **Open in Massing**, allow pop-ups for the site or use **Download JSON**.

## On other devices
- **iPad or phone on the same Wi-Fi:** open `http://<your Mac's address>:3101`. The launcher prints this address.
  The brief, the source pane and the PDF export all work on a phone; the PDF is the easiest thing to share from one.
- **Dark mode:** use the sun/moon button in the header. The app also follows your system setting.
- **Reduced motion:** if your device's "Reduce motion" setting is on, everything appears in place without animation.

## Limits to keep in mind
Covered districts: R5, R6, R6A, R6B, R7A, R8A; C1/C2 overlays within them; C4-4A; M1-1/M1-2. Other districts show
*Needs input*. Wide/narrow street width is a proposed assumption from informational city data, so check it. The full
list is in `app/README.md`.

After **Open in Massing**, both apps use PLUTO's recorded lot area for FAR, so Massing Studio's allowed floor area
matches this brief's.
