const TILE_SIZE = 54;
const GRID_COLS = 12;
const GRID_ROWS = 10;
const BOARD_OFFSET_X = 30;
const BOARD_OFFSET_Y = 30;

const TERRAIN_LOOKUP = {
  grass: { label: 'Grass', color: '#4a9c46' },
  forest: { label: 'Forest', color: '#2e7d32' },
  hill: { label: 'Hill', color: '#8d8f82' },
  desert: { label: 'Desert', color: '#d4b768' },
  water: { label: 'Water', color: '#2d6ca5' },
  plains: { label: 'Plains', color: '#91c96a' },
};

const RESOURCE_LOOKUP = {
  wheat: { label: 'Wheat', glyph: 'W', color: '#f7d261' },
  gold: { label: 'Gold', glyph: 'G', color: '#f4c95d' },
  stone: { label: 'Stone', glyph: 'S', color: '#aeb4b8' },
  timber: { label: 'Timber', glyph: 'T', color: '#9ad07b' },
};

const UNIT_TYPES = {
  settler: { label: 'Settler', hp: 8, color: '#6fe2ff', glyph: 'S' },
  warrior: { label: 'Warrior', hp: 12, color: '#ff9d7d', glyph: 'W' },
  worker: { label: 'Worker', hp: 9, color: '#d1d777', glyph: 'K' },
};

const state = {
  turn: 1,
  gameOver: false,
  selectedTile: null,
  selectedUnitId: null,
  selectedCityId: null,
  grid: [],
  log: [],
  player: {
    name: 'Player',
    cities: [],
    units: [],
  },
  ai: {
    name: 'AI',
    cities: [],
    units: [],
  },
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const turnValue = document.getElementById('turnValue');
const playerCitiesValue = document.getElementById('playerCitiesValue');
const aiCitiesValue = document.getElementById('aiCitiesValue');
const selectionInfo = document.getElementById('selectionInfo');
const eventLog = document.getElementById('eventLog');

function addLog(message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 12);
  renderLog();
}

function renderLog() {
  eventLog.innerHTML = '';
  for (const entry of state.log) {
    const li = document.createElement('li');
    li.textContent = entry;
    eventLog.appendChild(li);
  }
}

function withinBounds(x, y) {
  return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
}

function tileAt(x, y) {
  if (!withinBounds(x, y)) return null;
  return state.grid[y][x];
}

function getCityById(id) {
  const fromPlayer = state.player.cities.find((city) => city.id === id);
  if (fromPlayer) return fromPlayer;
  return state.ai.cities.find((city) => city.id === id) || null;
}

function getUnitById(id) {
  const fromPlayer = state.player.units.find((unit) => unit.id === id);
  if (fromPlayer) return fromPlayer;
  return state.ai.units.find((unit) => unit.id === id) || null;
}

function randomTerrain() {
  const roll = Math.random();
  if (roll < 0.48) return 'grass';
  if (roll < 0.62) return 'plains';
  if (roll < 0.75) return 'forest';
  if (roll < 0.84) return 'hill';
  if (roll < 0.92) return 'desert';
  return 'water';
}

function randomResource(terrain) {
  if (terrain === 'water') return null;
  const roll = Math.random();
  if (roll < 0.14) return 'wheat';
  if (roll < 0.22) return 'gold';
  if (roll < 0.30) return 'stone';
  if (roll < 0.36) return 'timber';
  return null;
}

function createCity(owner, x, y, name) {
  const city = {
    id: `${owner}-city-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    owner,
    x,
    y,
    name,
    population: 1,
  };

  state[owner].cities.push(city);
  state.grid[y][x].cityId = city.id;
  return city;
}

function createUnit(owner, type, x, y) {
  const unit = {
    id: `${owner}-unit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    owner,
    type,
    x,
    y,
    hp: UNIT_TYPES[type].hp,
    movement: 2,
    moved: false,
  };

  state[owner].units.push(unit);
  state.grid[y][x].unitId = unit.id;
  return unit;
}

function findCity(name) {
  const allCities = [...state.player.cities, ...state.ai.cities];
  return allCities.find((city) => city.name === name) || null;
}

function setSelection(tile) {
  state.selectedTile = tile;
  const selectionDetails = [];

  if (!tile) {
    selectionInfo.textContent = 'No selection';
    state.selectedCityId = null;
    state.selectedUnitId = null;
    return;
  }

  if (tile.cityId) {
    const city = getCityById(tile.cityId);
    state.selectedCityId = city.id;
    selectionDetails.push(`${city.name} | ${city.owner === 'player' ? 'Your city' : 'Enemy city'}`);
  }

  if (tile.unitId) {
    const unit = getUnitById(tile.unitId);
    state.selectedUnitId = unit.id;
    selectionDetails.push(`${UNIT_TYPES[unit.type].label} | HP ${unit.hp} | ${unit.owner === 'player' ? 'Yours' : 'Enemy'}`);
  }

  selectionInfo.textContent = selectionDetails.length ? selectionDetails.join(' • ') : `Tile ${tile.x}, ${tile.y}`;
}

function isTileOccupied(x, y) {
  const tile = tileAt(x, y);
  if (!tile) return true;
  return Boolean(tile.unitId || tile.cityId);
}

function canMoveTo(unit, x, y) {
  if (!withinBounds(x, y)) return false;
  const tile = tileAt(x, y);
  if (!tile) return false;
  if (tile.terrain === 'water') return false;
  if (tile.unitId && getUnitById(tile.unitId).owner !== unit.owner) {
    return unit.type === 'warrior';
  }
  if (tile.unitId && getUnitById(tile.unitId).owner === unit.owner) return false;
  if (tile.cityId && getCityById(tile.cityId).owner !== unit.owner) {
    return unit.type === 'warrior';
  }
  return !tile.unitId && !tile.cityId;
}

function getNeighbors(x, y) {
  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, 1], [1, -1], [-1, -1],
  ];

  return dirs.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter((pos) => withinBounds(pos.x, pos.y));
}

function moveUnit(unit, x, y) {
  const fromTile = tileAt(unit.x, unit.y);
  const targetTile = tileAt(x, y);

  if (!fromTile || !targetTile || !canMoveTo(unit, x, y)) {
    return false;
  }

  // Attack if enemy city or unit occupying the tile
  if (targetTile.unitId || targetTile.cityId) {
    const occupantId = targetTile.unitId || targetTile.cityId;
    const occupant = targetTile.unitId ? getUnitById(targetTile.unitId) : getCityById(targetTile.cityId);

    if (targetTile.unitId && occupant.owner !== unit.owner) {
      const enemyUnit = occupant;
      enemyUnit.hp -= 4;
      addLog(`${UNIT_TYPES[unit.type].label} attacks ${UNIT_TYPES[enemyUnit.type].label} for 4 damage.`);
      if (enemyUnit.hp <= 0) {
        const enemyTile = tileAt(enemyUnit.x, enemyUnit.y);
        enemyTile.unitId = null;
        const ownerList = state[enemyUnit.owner].units;
        const idx = ownerList.findIndex((item) => item.id === enemyUnit.id);
        if (idx >= 0) ownerList.splice(idx, 1);
        addLog(`${enemyUnit.owner === 'player' ? 'Your' : 'Enemy'} ${UNIT_TYPES[enemyUnit.type].label} is defeated.`);
      }
      return true;
    }

    if (targetTile.cityId && occupant.owner !== unit.owner) {
      captureCity(occupant, unit.owner);
      addLog(`${unit.owner === 'player' ? 'You' : 'The AI'} captured ${occupant.name}.`);
    }
  }

  fromTile.unitId = null;
  targetTile.unitId = unit.id;
  unit.x = x;
  unit.y = y;
  unit.moved = true;

  if (unit.owner === 'player') {
    const city = getCityById(state.selectedCityId);
    if (city && city.x === unit.x && city.y === unit.y) {
      state.selectedCityId = city.id;
    }
  }

  return true;
}

function captureCity(city, newOwner) {
  const prevOwner = city.owner;
  const prevList = state[prevOwner].cities;
  const idx = prevList.findIndex((entry) => entry.id === city.id);
  if (idx >= 0) prevList.splice(idx, 1);

  city.owner = newOwner;
  state[newOwner].cities.push(city);
  state.grid[city.y][city.x].cityId = city.id;

  if (newOwner === 'player') {
    addLog(`${city.name} is now under your control.`);
  } else {
    addLog(`${city.name} has fallen to the enemy.`);
  }
}

function updateHUD() {
  turnValue.textContent = String(state.turn);
  playerCitiesValue.textContent = String(state.player.cities.length);
  aiCitiesValue.textContent = String(state.ai.cities.length);
}

function buildUnitAtSelectedCity(type) {
  if (state.gameOver) return;

  const city = getCityById(state.selectedCityId);
  if (!city || city.owner !== 'player') {
    addLog('Select one of your cities to build a unit.');
    return;
  }

  const openTile = getNearestOpenTile(city.x, city.y);
  if (!openTile) {
    addLog('No room for a new unit near that city.');
    return;
  }

  createUnit('player', type, openTile.x, openTile.y);
  const unitInfo = UNIT_TYPES[type];
  addLog(`Built ${unitInfo.label} in ${city.name}.`);
  render();
}

function getNearestOpenTile(x, y) {
  const candidates = getNeighbors(x, y).filter((pos) => !isTileOccupied(pos.x, pos.y));
  return candidates[0] || null;
}

function foundCityFromSettler() {
  if (state.gameOver) return;

  const unit = getUnitById(state.selectedUnitId);
  if (!unit || unit.owner !== 'player' || unit.type !== 'settler') {
    addLog('Select your settler before founding a city.');
    return;
  }

  const tile = state.selectedTile;
  if (!tile) {
    addLog('Select a valid empty tile to found a city.');
    return;
  }

  if (Math.abs(tile.x - unit.x) > 1 || Math.abs(tile.y - unit.y) > 1) {
    addLog('Settlers can found a city on an adjacent tile.');
    return;
  }

  if (tileAt(tile.x, tile.y).terrain === 'water' || tileAt(tile.x, tile.y).cityId || tileAt(tile.x, tile.y).unitId) {
    addLog('You can only found a city on an empty land tile.');
    return;
  }

  const cityName = `Colony ${state.player.cities.length + 1}`;
  createCity('player', tile.x, tile.y, cityName);
  removeUnit(unit.id, 'player');
  addLog(`${cityName} founded!`);
  render();
}

function removeUnit(unitId, owner) {
  const list = state[owner].units;
  const idx = list.findIndex((unit) => unit.id === unitId);
  if (idx >= 0) {
    const unit = list[idx];
    const tile = tileAt(unit.x, unit.y);
    if (tile) tile.unitId = null;
    list.splice(idx, 1);
  }
}

function endPlayerTurn() {
  if (state.gameOver) return;
  aiTakeTurn();
}

function aiTakeTurn() {
  addLog('Enemy turn begins.');

  for (const city of [...state.ai.cities]) {
    if (Math.random() < 0.6) {
      const openTile = getNearestOpenTileForOwner(city.x, city.y, 'ai');
      if (openTile) {
        createUnit('ai', 'warrior', openTile.x, openTile.y);
        addLog(`${city.name} trains a warrior.`);
      }
    }
  }

  for (const unit of [...state.ai.units]) {
    if (!unit) continue;
    const playerCities = state.player.cities;
    const targetCity = playerCities.length ? playerCities[0] : null;

    if (targetCity) {
      const step = pickAiStep(unit, targetCity.x, targetCity.y);
      if (step) {
        moveUnit(unit, step.x, step.y);
      }
    }
  }

  state.turn += 1;
  updateHUD();
  checkVictory();
  render();
}

function getNearestOpenTileForOwner(x, y, owner) {
  const candidates = getNeighbors(x, y).filter((pos) => {
    const tile = tileAt(pos.x, pos.y);
    return tile && !tile.unitId && !tile.cityId && tile.terrain !== 'water';
  });

  if (owner === 'ai') {
    return candidates[Math.floor(Math.random() * candidates.length)] || null;
  }

  return candidates[0] || null;
}

function pickAiStep(unit, targetX, targetY) {
  let bestStep = null;
  let bestDistance = Infinity;

  for (const neighbor of getNeighbors(unit.x, unit.y)) {
    const tile = tileAt(neighbor.x, neighbor.y);
    if (!tile || tile.terrain === 'water') continue;

    const distance = Math.abs(neighbor.x - targetX) + Math.abs(neighbor.y - targetY);
    if (distance < bestDistance && canMoveTo(unit, neighbor.x, neighbor.y)) {
      bestStep = neighbor;
      bestDistance = distance;
    }
  }

  return bestStep;
}

function checkVictory() {
  if (state.player.cities.length === 0) {
    state.gameOver = true;
    addLog('The AI has conquered your civilization.');
    return;
  }

  if (state.ai.cities.length === 0) {
    state.gameOver = true;
    addLog('Victory! You have defeated the enemy empire.');
    return;
  }

  if (state.turn > 30) {
    if (state.player.cities.length > state.ai.cities.length) {
      state.gameOver = true;
      addLog('You win by legacy and control of the map.');
    } else if (state.ai.cities.length > state.player.cities.length) {
      state.gameOver = true;
      addLog('The AI dominates the world by turn 30.');
    }
  }
}

function drawTile(x, y, tile) {
  const tileX = BOARD_OFFSET_X + x * TILE_SIZE;
  const tileY = BOARD_OFFSET_Y + y * TILE_SIZE;
  const terrain = TERRAIN_LOOKUP[tile.terrain];

  ctx.fillStyle = terrain.color;
  ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);

  if (state.selectedTile && state.selectedTile.x === x && state.selectedTile.y === y) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(tileX + 2, tileY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
  }

  if (tile.resource) {
    const resource = RESOURCE_LOOKUP[tile.resource];
    ctx.fillStyle = resource.color;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(resource.glyph, tileX + 8, tileY + 18);
  }

  if (tile.cityId) {
    const city = getCityById(tile.cityId);
    const color = city.owner === 'player' ? '#6ec8ff' : '#ff9071';
    ctx.beginPath();
    ctx.arc(tileX + TILE_SIZE / 2, tileY + TILE_SIZE / 2, 12, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#0f2735';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (tile.unitId) {
    const unit = getUnitById(tile.unitId);
    ctx.beginPath();
    ctx.arc(tileX + TILE_SIZE / 2, tileY + TILE_SIZE / 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = unit.owner === 'player' ? '#6ec8ff' : '#ff9071';
    ctx.fill();
    ctx.fillStyle = '#091b22';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(UNIT_TYPES[unit.type].glyph, tileX + TILE_SIZE / 2 - 4, tileY + TILE_SIZE / 2 + 4);
  }
}

function renderBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f1c24';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      drawTile(x, y, state.grid[y][x]);
    }
  }

  if (state.gameOver) {
    ctx.fillStyle = 'rgba(10, 14, 18, 0.68)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f1f5f8';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
  }
}

function render() {
  updateHUD();
  renderBoard();
}

function handleCanvasClick(event) {
  if (state.gameOver) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.floor((event.clientX - rect.left) * scaleX - BOARD_OFFSET_X) / TILE_SIZE;
  const y = Math.floor((event.clientY - rect.top) * scaleY - BOARD_OFFSET_Y) / TILE_SIZE;

  const gridX = Math.floor((event.clientX - rect.left) * scaleX - BOARD_OFFSET_X) / TILE_SIZE;
  const gridY = Math.floor((event.clientY - rect.top) * scaleY - BOARD_OFFSET_Y) / TILE_SIZE;

  if (gridX < 0 || gridY < 0 || gridX >= GRID_COLS || gridY >= GRID_ROWS) {
    return;
  }

  const tile = tileAt(gridX, gridY);
  setSelection(tile);

  const selectedUnit = state.selectedUnitId ? getUnitById(state.selectedUnitId) : null;

  if (selectedUnit && selectedUnit.owner === 'player') {
    if (Math.abs(gridX - selectedUnit.x) <= 1 && Math.abs(gridY - selectedUnit.y) <= 1 && canMoveTo(selectedUnit, gridX, gridY)) {
      moveUnit(selectedUnit, gridX, gridY);
      render();
      checkVictory();
      return;
    }
  }

  if (tile.cityId) {
    const city = getCityById(tile.cityId);
    if (city && city.owner === 'player') {
      state.selectedCityId = city.id;
      setSelection(tile);
    }
  }

  if (tile.unitId) {
    const unit = getUnitById(tile.unitId);
    if (unit && unit.owner === 'player') {
      state.selectedUnitId = unit.id;
      setSelection(tile);
    }
  }

  render();
}

function initializeMap() {
  state.grid = Array.from({ length: GRID_ROWS }, (_, y) =>
    Array.from({ length: GRID_COLS }, (_, x) => {
      const terrain = randomTerrain();
      return {
        x,
        y,
        terrain,
        resource: randomResource(terrain),
        cityId: null,
        unitId: null,
      };
    })
  );

  // Clamp a few water tiles to make a playable board.
  for (let x = 0; x < GRID_COLS; x += 1) {
    state.grid[5][x].terrain = x >= 4 && x <= 7 ? 'water' : state.grid[5][x].terrain;
    state.grid[5][x].resource = null;
  }

  const playerCapital = createCity('player', 5, 6, 'Civitas');
  const aiCapital = createCity('ai', 8, 2, 'Aemulor');

  createUnit('player', 'warrior', 4, 6);
  createUnit('player', 'settler', 6, 6);
  createUnit('player', 'worker', 5, 7);

  createUnit('ai', 'warrior', 7, 2);
  createUnit('ai', 'settler', 9, 2);
  createUnit('ai', 'worker', 8, 3);

  state.selectedCityId = playerCapital.id;
  state.selectedTile = { x: playerCapital.x, y: playerCapital.y };
  addLog('Your empire awakens. Build, expand, and outlast the rival city-state.');
  addLog('Select a city to build units or a settler to found a new city.');
  setSelection(state.selectedTile);
  updateHUD();
}

function attachControls() {
  document.getElementById('endTurnBtn').addEventListener('click', endPlayerTurn);
  document.getElementById('buildSettlerBtn').addEventListener('click', () => buildUnitAtSelectedCity('settler'));
  document.getElementById('buildWarriorBtn').addEventListener('click', () => buildUnitAtSelectedCity('warrior'));
  document.getElementById('buildWorkerBtn').addEventListener('click', () => buildUnitAtSelectedCity('worker'));
  document.getElementById('foundCityBtn').addEventListener('click', foundCityFromSettler);
  document.getElementById('resetBtn').addEventListener('click', () => {
    state.gameOver = false;
    state.turn = 1;
    state.log = [];
    state.player = { name: 'Player', cities: [], units: [] };
    state.ai = { name: 'AI', cities: [], units: [] };
    initializeMap();
    render();
  });

  canvas.addEventListener('click', handleCanvasClick);
}

function initGame() {
  initializeMap();
  attachControls();
  render();
  renderLog();
}

initGame();
