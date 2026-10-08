# civ6-clone

A small turn-based Civilization-inspired prototype built as a browser game.

## What is included

- 12x10 tile world with terrain and resources
- City building and unit creation
- Real-time map selection and unit movement
- Simple AI turn cycle
- Victory and defeat conditions

## How to run

Open `index.html` directly in a browser, or serve the folder locally:

```bash
cd civ6-clone
python3 -m http.server 8000
```

Then open <http://localhost:8000> in your browser.

## Controls

- Click a tile to inspect it.
- Select one of your cities to build units.
- Select a settler and click an adjacent empty land tile, then press "Found City".
- Click your unit and then an adjacent valid tile to move it.
- End the turn to let the AI act.

This is intentionally a lightweight prototype rather than a full Civ VI clone, but it provides a playable foundation you can expand on.

