/* =====================================================
   ASCII Draw Studio — app.js
   ===================================================== */
(function () {
    'use strict';

    // ─── CONFIG ──────────────────────────────────────
    const FONT_SIZE   = 14;
    const FONT_FAMILY = '"Courier New", Courier, monospace';
    const GRID_COLOR  = '#e8e8e8';
    const BG_COLOR    = '#ffffff';
    const CHAR_COLOR  = '#222222';
    const RULER_BG    = '#ececec';
    const RULER_TEXT  = '#888888';
    const RULER_TICK  = '#cccccc';

    // ─── STATE ───────────────────────────────────────
    let COLS = 80, ROWS = 25;
    let grid = [];
    let cellW = 0, cellH = 0;
    let zoom = 1;
    let panX = 0, panY = 0;
    let currentTool = 'pencil';
    let undoStack = [], redoStack = [];
    let isMouseDown = false;
    let spaceDown = false, isPanning = false;
    let panStart = { x: 0, y: 0 };
    let drawStart = { col: 0, row: 0 };
    let previewCells = [];
    let hoverCell = { col: -1, row: -1 };
    let selection = null; // { c1, r1, c2, r2 }
    let clipboard = null; // 2D array of chars
    let isMovingSel = false;
    let selMoveStart = { col: 0, row: 0 };
    let selMoveContent = null;
    let freehandPrev = null;

    // Tool settings
    let brushStyle    = 'character'; // character | smooth | directional | single | double
    let brushChar     = '#';
    let brushSize     = 1;
    let eraserSize    = 1;
    let fillChar      = '#';
    let rectStyle     = 'simple';
    let rectFill      = false;
    let showGrid      = true;
    let rectFillChar  = '#';
    let circleStyle   = 'smooth';
    let lineBrushStyle= 'directional';
    let borderStyle   = 'simple';
    let selectedBorderIdx = 0;
    let selectedClipIdx   = 0;
    let selectedDivIdx    = 0;
    let figletText    = '';
    let figletStyle   = 'block';

    // ─── DOM ─────────────────────────────────────────
    const mainCanvas    = document.getElementById('main-canvas');
    const overlayCanvas = document.getElementById('overlay-canvas');
    const mCtx          = mainCanvas.getContext('2d', { alpha: false });
    const oCtx          = overlayCanvas.getContext('2d');
    const viewport      = document.getElementById('canvas-viewport');
    const wrapper       = document.getElementById('canvas-wrapper');
    const btnUndo       = document.getElementById('btn-undo');
    const btnRedo       = document.getElementById('btn-redo');
    const statusSize    = document.getElementById('status-size');
    const statusPos     = document.getElementById('status-pos');
    const zoomLabel     = document.getElementById('zoom-label');
    const zoomSlider    = document.getElementById('zoom-slider');
    const panelHeader   = document.getElementById('panel-header');
    const panelContent  = document.getElementById('panel-content');
    const toast         = document.getElementById('toast');
    const textOverlay   = document.getElementById('text-overlay');
    const textInputEl   = document.getElementById('text-input-el');
    const toolBtns      = document.querySelectorAll('.tool-btn');

    // ─── INIT ────────────────────────────────────────
    function init() {
        measureCell();
        initGrid(COLS, ROWS);
        resizeCanvases();
        renderAll();
        renderRulers();
        updateStatus();
        fitToWindow();
        buildPanel('pencil');
    }

    function measureCell() {
        mCtx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
        cellW = Math.round(mCtx.measureText('M').width);
        cellH = Math.round(FONT_SIZE * 1.4);
    }

    function initGrid(cols, rows) {
        grid = [];
        for (let r = 0; r < rows; r++) {
            grid[r] = new Array(cols).fill(' ');
        }
        COLS = cols; ROWS = rows;
        statusSize.textContent = `□ ${COLS} × ${ROWS} characters`;
    }

    function resizeGrid(newCols, newRows) {
        const newGrid = [];
        for (let r = 0; r < newRows; r++) {
            newGrid[r] = new Array(newCols).fill(' ');
            if (r < ROWS) {
                for (let c = 0; c < Math.min(newCols, COLS); c++) {
                    newGrid[r][c] = grid[r][c];
                }
            }
        }
        grid = newGrid;
        COLS = newCols; ROWS = newRows;
        statusSize.textContent = `□ ${COLS} × ${ROWS} characters`;
    }

    function resizeCanvases() {
        const dpr = window.devicePixelRatio || 1;
        const w = COLS * cellW, h = ROWS * cellH;

        mainCanvas.width    = w * dpr; mainCanvas.height    = h * dpr;
        overlayCanvas.width = w * dpr; overlayCanvas.height = h * dpr;
        mainCanvas.style.width    = w + 'px'; mainCanvas.style.height    = h + 'px';
        overlayCanvas.style.width = w + 'px'; overlayCanvas.style.height = h + 'px';

        mCtx.scale(dpr, dpr);
        oCtx.scale(dpr, dpr);

        wrapper.style.width  = w + 'px';
        wrapper.style.height = h + 'px';
        applyTransform();
    }

    function applyTransform() {
        wrapper.style.transform = `translate(${panX}px,${panY}px) scale(${zoom})`;
        wrapper.style.transformOrigin = '0 0';
        zoomLabel.textContent = Math.round(zoom * 100) + '%';
        zoomSlider.value = Math.round(zoom * 100);
        renderRulers();
    }

    // ─── RENDERING ───────────────────────────────────
    function renderAll() {
        const w = COLS * cellW, h = ROWS * cellH;
        mCtx.fillStyle = BG_COLOR;
        mCtx.fillRect(0, 0, w, h);

        // Grid
        if (showGrid) {
        mCtx.strokeStyle = GRID_COLOR;
        mCtx.lineWidth = 0.5;
        for (let c = 0; c <= COLS; c++) {
            mCtx.beginPath(); mCtx.moveTo(c * cellW, 0); mCtx.lineTo(c * cellW, h); mCtx.stroke();
        }
        for (let r = 0; r <= ROWS; r++) {
            mCtx.beginPath(); mCtx.moveTo(0, r * cellH); mCtx.lineTo(w, r * cellH); mCtx.stroke();
        }
        } // end showGrid

        // Characters
        mCtx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
        mCtx.textBaseline = 'middle';
        mCtx.fillStyle = CHAR_COLOR;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (grid[r][c] !== ' ') {
                    mCtx.fillText(grid[r][c], c * cellW, r * cellH + cellH * 0.5);
                }
            }
        }
        renderOverlay();
    }

    function renderCell(col, row) {
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
        const x = col * cellW, y = row * cellH;
        mCtx.fillStyle = BG_COLOR;
        mCtx.fillRect(x, y, cellW, cellH);
        mCtx.strokeStyle = GRID_COLOR;
        mCtx.lineWidth = 0.5;
        mCtx.strokeRect(x + 0.25, y + 0.25, cellW - 0.5, cellH - 0.5);
        if (grid[row][col] !== ' ') {
            mCtx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
            mCtx.textBaseline = 'middle';
            mCtx.fillStyle = CHAR_COLOR;
            mCtx.fillText(grid[row][col], x, y + cellH * 0.5);
        }
    }

    function renderOverlay() {
        const dpr = window.devicePixelRatio || 1;
        oCtx.clearRect(0, 0, overlayCanvas.width / dpr, overlayCanvas.height / dpr);

        // Preview cells
        if (previewCells.length) {
            oCtx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
            oCtx.textBaseline = 'middle';
            previewCells.forEach(pc => {
                if (pc.col < 0 || pc.col >= COLS || pc.row < 0 || pc.row >= ROWS) return;
                oCtx.fillStyle = 'rgba(59,125,216,0.15)';
                oCtx.fillRect(pc.col * cellW, pc.row * cellH, cellW, cellH);
                if (pc.char && pc.char !== ' ') {
                    oCtx.fillStyle = 'rgba(59,125,216,0.85)';
                    oCtx.fillText(pc.char, pc.col * cellW, pc.row * cellH + cellH * 0.5);
                }
            });
        }

        // Selection
        if (selection) {
            const { c1, r1, c2, r2 } = normalizeSelection(selection);
            oCtx.strokeStyle = '#3b7dd8';
            oCtx.lineWidth = 1.5;
            oCtx.setLineDash([4, 2]);
            oCtx.strokeRect(c1 * cellW, r1 * cellH, (c2 - c1 + 1) * cellW, (r2 - r1 + 1) * cellH);
            oCtx.setLineDash([]);
            oCtx.fillStyle = 'rgba(59,125,216,0.06)';
            oCtx.fillRect(c1 * cellW, r1 * cellH, (c2 - c1 + 1) * cellW, (r2 - r1 + 1) * cellH);
        }

        // Hover
        if (hoverCell.col >= 0 && hoverCell.row >= 0 && currentTool !== 'select') {
            oCtx.fillStyle = 'rgba(59,125,216,0.12)';
            const s = currentTool === 'eraser' ? eraserSize : brushSize;
            const hc = hoverCell.col - Math.floor(s / 2);
            const hr = hoverCell.row - Math.floor(s / 2);
            for (let dr = 0; dr < s; dr++) for (let dc = 0; dc < s; dc++) {
                const cc = hc + dc, rr = hr + dr;
                if (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS)
                    oCtx.fillRect(cc * cellW, rr * cellH, cellW, cellH);
            }
        }
    }

    function renderRulers() {
        const topCanvas  = document.getElementById('ruler-top-canvas');
        const leftCanvas = document.getElementById('ruler-left-canvas');
        const topArea    = document.getElementById('ruler-top');
        const leftArea   = document.getElementById('ruler-left');

        const topW  = topArea.clientWidth;
        const leftH = leftArea.clientHeight;
        topCanvas.width  = topW;   topCanvas.height = 22;
        leftCanvas.width = 32;     leftCanvas.height = leftH;
        topCanvas.style.width   = topW + 'px';  topCanvas.style.height   = '22px';
        leftCanvas.style.width  = '32px';       leftCanvas.style.height  = leftH + 'px';

        const tc = topCanvas.getContext('2d');
        const lc = leftCanvas.getContext('2d');

        tc.fillStyle = RULER_BG; tc.fillRect(0, 0, topW, 22);
        lc.fillStyle = RULER_BG; lc.fillRect(0, 0, 32, leftH);

        tc.font = '9px sans-serif'; tc.textBaseline = 'middle'; tc.fillStyle = RULER_TEXT;
        lc.font = '9px sans-serif'; lc.textBaseline = 'middle'; lc.fillStyle = RULER_TEXT;

        // Viewport scroll offset
        const scrollX = viewport.scrollLeft;
        const scrollY = viewport.scrollTop;

        // Top ruler
        for (let c = 0; c <= COLS; c++) {
            const x = Math.round(c * cellW * zoom + panX - scrollX);
            if (x < 0 || x > topW) continue;
            tc.fillStyle = RULER_TICK;
            tc.fillRect(x, 18, 1, 4);
            if (c % 5 === 0) {
                tc.fillStyle = RULER_TEXT;
                tc.fillText(c, x + 1, 10);
            }
        }
        // Left ruler
        for (let r = 0; r <= ROWS; r++) {
            const y = Math.round(r * cellH * zoom + panY - scrollY);
            if (y < 0 || y > leftH) continue;
            lc.fillStyle = RULER_TICK;
            lc.fillRect(28, y, 4, 1);
            if (r % 5 === 0) {
                lc.fillStyle = RULER_TEXT;
                lc.fillText(r, 1, y + 6);
            }
        }
    }

    // ─── GRID HELPERS ────────────────────────────────
    function setCell(col, row, char) {
        if (col >= 0 && col < COLS && row >= 0 && row < ROWS) grid[row][col] = char;
    }
    function getCell(col, row) {
        return (col >= 0 && col < COLS && row >= 0 && row < ROWS) ? grid[row][col] : ' ';
    }
    function cloneGrid() { return grid.map(r => [...r]); }

    // ─── UNDO / REDO ─────────────────────────────────
    function pushUndo() {
        undoStack.push(cloneGrid());
        if (undoStack.length > 80) undoStack.shift();
        redoStack = [];
        updateUndoRedoBtns();
    }
    function undo() {
        if (!undoStack.length) return;
        redoStack.push(cloneGrid());
        grid = undoStack.pop();
        updateUndoRedoBtns();
        renderAll();
    }
    function redo() {
        if (!redoStack.length) return;
        undoStack.push(cloneGrid());
        grid = redoStack.pop();
        updateUndoRedoBtns();
        renderAll();
    }
    function updateUndoRedoBtns() {
        btnUndo.disabled = undoStack.length === 0;
        btnRedo.disabled = redoStack.length === 0;
    }

    // ─── COORDINATE CONVERSION ───────────────────────
    function eventToGrid(e) {
        const rect = viewport.getBoundingClientRect();
        const x = (e.clientX - rect.left - panX + viewport.scrollLeft) / zoom;
        const y = (e.clientY - rect.top  - panY + viewport.scrollTop)  / zoom;
        return { col: Math.floor(x / cellW), row: Math.floor(y / cellH) };
    }

    // ─── BRUSH CHARACTER SELECTION ───────────────────
    const DIRECTIONAL_CHARS = {
        h: '-', v: '|', tl: '+', tr: '+', bl: '+', br: '+', diag1: '/', diag2: '\\'
    };
    const SINGLE_CHARS = {
        h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘',
        th: '┬', bh: '┴', lv: '├', rv: '┤', x: '┼'
    };
    const DOUBLE_CHARS = {
        h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝',
        th: '╦', bh: '╩', lv: '╠', rv: '╣', x: '╬'
    };

    function getBrushChar(prevCol, prevRow, col, row) {
        if (brushStyle === 'character') return brushChar;
        const dc = col - (prevCol === undefined ? col : prevCol);
        const dr = row - (prevRow === undefined ? row : prevRow);
        if (brushStyle === 'directional') {
            if (dc === 0 && dr === 0) return brushChar;
            if (Math.abs(dc) > Math.abs(dr)) return '-';
            if (Math.abs(dr) > Math.abs(dc)) return '|';
            return dc * dr > 0 ? '\\' : '/';
        }
        if (brushStyle === 'smooth') {
            if (dc === 0 && dr === 0) return brushChar;
            if (Math.abs(dc) > Math.abs(dr) * 1.5) return '-';
            if (Math.abs(dr) > Math.abs(dc) * 1.5) return '|';
            return dc * dr > 0 ? '\\' : '/';
        }
        if (brushStyle === 'single') {
            if (Math.abs(dc) >= Math.abs(dr)) return SINGLE_CHARS.h;
            return SINGLE_CHARS.v;
        }
        if (brushStyle === 'double') {
            if (Math.abs(dc) >= Math.abs(dr)) return DOUBLE_CHARS.h;
            return DOUBLE_CHARS.v;
        }
        return brushChar;
    }

    // ─── DRAW SHAPES ─────────────────────────────────
    function getRectCells(c1, r1, c2, r2) {
        const cells = [];
        const mnC = Math.min(c1, c2), mxC = Math.max(c1, c2);
        const mnR = Math.min(r1, r2), mxR = Math.max(r1, r2);
        const b = RECT_BORDERS[rectStyle] || RECT_BORDERS.simple;
        if (mxC - mnC < 1 || mxR - mnR < 1) {
            cells.push({ col: mnC, row: mnR, char: b.tl }); return cells;
        }
        cells.push({ col: mnC, row: mnR, char: b.tl });
        cells.push({ col: mxC, row: mnR, char: b.tr });
        cells.push({ col: mnC, row: mxR, char: b.bl });
        cells.push({ col: mxC, row: mxR, char: b.br });
        for (let c = mnC + 1; c < mxC; c++) {
            cells.push({ col: c, row: mnR, char: b.h });
            cells.push({ col: c, row: mxR, char: b.h });
        }
        for (let r = mnR + 1; r < mxR; r++) {
            cells.push({ col: mnC, row: r, char: b.v });
            cells.push({ col: mxC, row: r, char: b.v });
        }
        if (rectFill) {
            for (let r = mnR + 1; r < mxR; r++)
                for (let c = mnC + 1; c < mxC; c++)
                    cells.push({ col: c, row: r, char: rectFillChar });
        }
        return cells;
    }

    function getCircleCells(c1, r1, c2, r2) {
        const cells = [];
        const cx = (c1 + c2) / 2, cy = (r1 + r2) / 2;
        const rx = Math.abs(c2 - c1) / 2, ry = Math.abs(r2 - r1) / 2;
        if (rx < 1 || ry < 1) { cells.push({ col: c1, row: r1, char: 'O' }); return cells; }
        const placed = new Set();
        const steps = Math.max(4 * (rx + ry), 60);
        for (let i = 0; i < steps; i++) {
            const t = (2 * Math.PI * i) / steps;
            const col = Math.round(cx + rx * Math.cos(t));
            const row = Math.round(cy + ry * Math.sin(t));
            const key = `${col},${row}`;
            if (!placed.has(key)) {
                placed.add(key);
                const ch = circleStyle === 'smooth' ? getCircleChar(Math.cos(t), Math.sin(t)) : 'O';
                cells.push({ col, row, char: ch });
            }
        }
        return cells;
    }

    function getCircleChar(cosT, sinT) {
        const angle = Math.atan2(sinT, cosT);
        const deg = ((angle * 180 / Math.PI) + 360) % 360;
        if (deg < 22.5 || deg >= 337.5) return '-';
        if (deg < 67.5) return '\\';
        if (deg < 112.5) return '|';
        if (deg < 157.5) return '/';
        if (deg < 202.5) return '-';
        if (deg < 247.5) return '\\';
        if (deg < 292.5) return '|';
        return '/';
    }

    function getLineCells(c1, r1, c2, r2) {
        const cells = [];
        const dx = Math.abs(c2 - c1), dy = Math.abs(r2 - r1);
        const sc = c1 < c2 ? 1 : -1, sr = r1 < r2 ? 1 : -1;
        let c = c1, r = r1, err = dx - dy;
        while (true) {
            const ch = getLineChar(c1, r1, c2, r2, c, r);
            cells.push({ col: c, row: r, char: ch });
            if (c === c2 && r === r2) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; c += sc; }
            if (e2 < dx)  { err += dx; r += sr; }
        }
        return cells;
    }

    function getLineChar(c1, r1, c2, r2, c, r) {
        const dx = c2 - c1, dy = r2 - r1;
        const d = lineBrushStyle;
        if (d === 'directional') {
            if (dy === 0) return '-';
            if (dx === 0) return '|';
            return dx * dy > 0 ? '\\' : '/';
        }
        if (d === 'single') {
            if (dy === 0) return SINGLE_CHARS.h;
            if (dx === 0) return SINGLE_CHARS.v;
            return dx * dy > 0 ? '\\' : '/';
        }
        if (d === 'double') {
            if (dy === 0) return DOUBLE_CHARS.h;
            if (dx === 0) return DOUBLE_CHARS.v;
            return dx * dy > 0 ? '\\' : '/';
        }
        // smooth
        if (Math.abs(dx) > Math.abs(dy) * 2) return '-';
        if (Math.abs(dy) > Math.abs(dx) * 2) return '|';
        return dx * dy > 0 ? '\\' : '/';
    }

    function getTriangleCells(c1, r1, c2, r2) {
        const cells = [];
        const mnC = Math.min(c1, c2), mxC = Math.max(c1, c2);
        const mnR = Math.min(r1, r2), mxR = Math.max(r1, r2);
        const midC = Math.round((mnC + mxC) / 2);
        // Apex at top-center
        const apex = { col: midC, row: mnR };
        const bl   = { col: mnC,  row: mxR };
        const br   = { col: mxC,  row: mxR };
        // Draw three sides
        getLineCells(apex.col, apex.row, bl.col, bl.row).forEach(c => cells.push(c));
        getLineCells(apex.col, apex.row, br.col, br.row).forEach(c => cells.push(c));
        getLineCells(bl.col, bl.row, br.col, br.row).forEach(c => cells.push(c));
        return cells;
    }

    // ─── FLOOD FILL ──────────────────────────────────
    function floodFill(startCol, startRow, fillCh) {
        const target = getCell(startCol, startRow);
        if (target === fillCh) return;
        pushUndo();
        const stack = [{ col: startCol, row: startRow }];
        const visited = new Set();
        while (stack.length) {
            const { col, row } = stack.pop();
            const key = `${col},${row}`;
            if (visited.has(key)) continue;
            if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
            if (getCell(col, row) !== target) continue;
            visited.add(key);
            setCell(col, row, fillCh);
            stack.push({ col: col + 1, row }, { col: col - 1, row }, { col, row: row + 1 }, { col, row: row - 1 });
        }
        renderAll();
    }

    // ─── MOUSE EVENTS ────────────────────────────────
    viewport.addEventListener('mousedown', onMouseDown);
    viewport.addEventListener('mousemove', onMouseMove);
    viewport.addEventListener('mouseup',   onMouseUp);
    viewport.addEventListener('mouseleave', () => { hoverCell = { col: -1, row: -1 }; renderOverlay(); });
    viewport.addEventListener('contextmenu', e => e.preventDefault());
    viewport.addEventListener('scroll', () => { renderRulers(); });

    let prevPaintCell = null;

    function onMouseDown(e) {
        e.preventDefault();
        if (spaceDown || e.button === 1) {
            isPanning = true;
            panStart = { x: e.clientX - panX, y: e.clientY - panY };
            viewport.style.cursor = 'grabbing';
            return;
        }
        if (e.button !== 0) return;
        isMouseDown = true;
        const { col, row } = eventToGrid(e);
        drawStart = { col, row };
        prevPaintCell = { col, row };

        switch (currentTool) {
            case 'pencil':
                pushUndo();
                paintBrush(col, row, undefined, undefined);
                break;
            case 'eraser':
                pushUndo();
                erase(col, row);
                break;
            case 'fill':
                floodFill(col, row, fillChar);
                break;
            case 'text':
                showTextInput(col, row, e.clientX, e.clientY);
                isMouseDown = false;
                break;
            case 'select':
                if (selection) {
                    const ns = normalizeSelection(selection);
                    if (col >= ns.c1 && col <= ns.c2 && row >= ns.r1 && row <= ns.r2) {
                        // Start moving selection
                        isMovingSel = true;
                        selMoveStart = { col, row };
                        selMoveContent = extractSelection(ns);
                        eraseSelection(ns);
                        renderAll();
                    } else {
                        selection = { c1: col, r1: row, c2: col, r2: row };
                        isMovingSel = false;
                    }
                } else {
                    selection = { c1: col, r1: row, c2: col, r2: row };
                }
                renderOverlay();
                break;
            default:
                // shape tools — show preview on move/up
                break;
        }
    }

    function onMouseMove(e) {
        const { col, row } = eventToGrid(e);
        hoverCell = { col, row };
        statusPos.textContent = `⊙ ${Math.max(0, col)}, ${Math.max(0, row)}`;

        if (isPanning) {
            panX = e.clientX - panStart.x;
            panY = e.clientY - panStart.y;
            applyTransform();
            return;
        }

        if (!isMouseDown) { renderOverlay(); return; }

        switch (currentTool) {
            case 'pencil':
                paintBrush(col, row, prevPaintCell.col, prevPaintCell.row);
                break;
            case 'eraser':
                erase(col, row);
                break;
            case 'rect':
                previewCells = getRectCells(drawStart.col, drawStart.row, col, row);
                renderOverlay();
                break;
            case 'circle':
                previewCells = getCircleCells(drawStart.col, drawStart.row, col, row);
                renderOverlay();
                break;
            case 'triangle':
                previewCells = getTriangleCells(drawStart.col, drawStart.row, col, row);
                renderOverlay();
                break;
            case 'line':
                previewCells = getLineCells(drawStart.col, drawStart.row, col, row);
                renderOverlay();
                break;
            case 'select':
                if (isMovingSel && selMoveContent) {
                    const dc = col - selMoveStart.col;
                    const dr = row - selMoveStart.row;
                    const ns = normalizeSelection(selection);
                    const w = ns.c2 - ns.c1 + 1, h = ns.r2 - ns.r1 + 1;
                    previewCells = [];
                    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
                        if (selMoveContent[r] && selMoveContent[r][c] !== ' ')
                            previewCells.push({ col: ns.c1 + dc + c, row: ns.r1 + dr + r, char: selMoveContent[r][c] });
                    }
                    renderOverlay();
                } else {
                    selection.c2 = col; selection.r2 = row;
                    renderOverlay();
                }
                break;
        }
        prevPaintCell = { col, row };
    }

    function onMouseUp(e) {
        if (isPanning) {
            isPanning = false;
            viewport.style.cursor = '';
            return;
        }
        if (!isMouseDown) return;
        isMouseDown = false;
        const { col, row } = eventToGrid(e);

        switch (currentTool) {
            case 'rect': case 'circle': case 'triangle': case 'line':
                if (previewCells.length) {
                    pushUndo();
                    previewCells.forEach(pc => setCell(pc.col, pc.row, pc.char));
                    previewCells = [];
                    renderAll();
                }
                break;
            case 'select':
                if (isMovingSel && selMoveContent) {
                    const dc = col - selMoveStart.col;
                    const dr = row - selMoveStart.row;
                    const ns = normalizeSelection(selection);
                    const w = ns.c2 - ns.c1 + 1, h = ns.r2 - ns.r1 + 1;
                    pushUndo();
                    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
                        if (selMoveContent[r]) setCell(ns.c1 + dc + c, ns.r1 + dr + r, selMoveContent[r][c]);
                    }
                    selection = { c1: ns.c1 + dc, r1: ns.r1 + dr, c2: ns.c2 + dc, r2: ns.r2 + dr };
                    isMovingSel = false;
                    selMoveContent = null;
                    previewCells = [];
                    renderAll();
                }
                break;
        }
    }

    function paintBrush(col, row, prevCol, prevRow) {
        const ch = getBrushChar(prevCol, prevRow, col, row);
        const offset = Math.floor(brushSize / 2);
        for (let dr = 0; dr < brushSize; dr++) for (let dc = 0; dc < brushSize; dc++) {
            const cc = col - offset + dc, rr = row - offset + dr;
            setCell(cc, rr, ch);
            renderCell(cc, rr);
        }
        renderOverlay();
    }

    function erase(col, row) {
        const offset = Math.floor(eraserSize / 2);
        for (let dr = 0; dr < eraserSize; dr++) for (let dc = 0; dc < eraserSize; dc++) {
            const cc = col - offset + dc, rr = row - offset + dr;
            setCell(cc, rr, ' ');
            renderCell(cc, rr);
        }
        renderOverlay();
    }

    // ─── SELECTION HELPERS ───────────────────────────
    function normalizeSelection(sel) {
        return {
            c1: Math.min(sel.c1, sel.c2), c2: Math.max(sel.c1, sel.c2),
            r1: Math.min(sel.r1, sel.r2), r2: Math.max(sel.r1, sel.r2)
        };
    }

    function extractSelection(ns) {
        const rows = [];
        for (let r = ns.r1; r <= ns.r2; r++) {
            rows.push([]);
            for (let c = ns.c1; c <= ns.c2; c++) rows[rows.length - 1].push(getCell(c, r));
        }
        return rows;
    }

    function eraseSelection(ns) {
        for (let r = ns.r1; r <= ns.r2; r++)
            for (let c = ns.c1; c <= ns.c2; c++) setCell(c, r, ' ');
    }

    function copySelection() {
        if (!selection) return;
        const ns = normalizeSelection(selection);
        clipboard = extractSelection(ns);
        showToast('Copied!');
    }

    function cutSelection() {
        if (!selection) return;
        const ns = normalizeSelection(selection);
        pushUndo();
        clipboard = extractSelection(ns);
        eraseSelection(ns);
        selection = null;
        renderAll();
        showToast('Cut!');
    }

    function pasteClipboard() {
        if (!clipboard) return;
        pushUndo();
        const sc = selection ? normalizeSelection(selection).c1 : 0;
        const sr = selection ? normalizeSelection(selection).r1 : 0;
        clipboard.forEach((row, ri) => row.forEach((ch, ci) => setCell(sc + ci, sr + ri, ch)));
        renderAll();
        showToast('Pasted!');
    }

    function deleteSelection() {
        if (!selection) return;
        pushUndo();
        eraseSelection(normalizeSelection(selection));
        selection = null;
        renderAll();
    }

    function selectAll() {
        selection = { c1: 0, r1: 0, c2: COLS - 1, r2: ROWS - 1 };
        renderOverlay();
    }

    // ─── TEXT INPUT ──────────────────────────────────
    function showTextInput(col, row, clientX, clientY) {
        const rect = viewport.getBoundingClientRect();
        const x = col * cellW * zoom + panX + rect.left - viewport.scrollLeft;
        const y = row * cellH * zoom + panY + rect.top  - viewport.scrollTop;
        textOverlay.classList.add('active');
        textOverlay.style.left = x + 'px';
        textOverlay.style.top  = y + 'px';
        textInputEl.value = '';
        textInputEl.style.fontSize    = (FONT_SIZE * zoom) + 'px';
        textInputEl.style.lineHeight  = (cellH * zoom) + 'px';
        textInputEl.style.height      = (cellH * zoom) + 'px';
        textInputEl.style.letterSpacing = ((cellW - FONT_SIZE * 0.6) * zoom) + 'px';
        textInputEl.focus();

        const commit = () => {
            const text = textInputEl.value;
            if (text) {
                pushUndo();
                const lines = text.split('\n');
                lines.forEach((line, li) => {
                    [...line].forEach((ch, ci) => setCell(col + ci, row + li, ch));
                });
                renderAll();
            }
            textOverlay.classList.remove('active');
            textInputEl.removeEventListener('blur', commit);
            textInputEl.removeEventListener('keydown', onKey);
        };

        const onKey = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { textOverlay.classList.remove('active'); textInputEl.removeEventListener('blur', commit); textInputEl.removeEventListener('keydown', onKey); }
        };

        textInputEl.addEventListener('blur', commit);
        textInputEl.addEventListener('keydown', onKey);
    }

    // ─── FIGLET FONT ─────────────────────────────────
    // 3×5 pixel font — each char is "row0/row1/row2/row3/row4" where 1=fill 0=space
    const PIXEL_FONT = {
        'A':'01010/10101/11111/10001/10001',
        'B':'11100/10010/11100/10010/11110',
        'C':'01110/10001/10000/10001/01110',
        'D':'11100/10010/10001/10010/11100',
        'E':'11111/10000/11110/10000/11111',
        'F':'11111/10000/11110/10000/10000',
        'G':'01110/10001/10111/10001/01110',
        'H':'10001/10001/11111/10001/10001',
        'I':'01110/00100/00100/00100/01110',
        'J':'00111/00010/00010/10010/01100',
        'K':'10001/10010/11100/10010/10001',
        'L':'10000/10000/10000/10000/11111',
        'M':'10001/11011/10101/10001/10001',
        'N':'10001/11001/10101/10011/10001',
        'O':'01110/10001/10001/10001/01110',
        'P':'11110/10001/11110/10000/10000',
        'Q':'01110/10001/10001/10011/01111',
        'R':'11110/10001/11110/10010/10001',
        'S':'01111/10000/01110/00001/11110',
        'T':'11111/00100/00100/00100/00100',
        'U':'10001/10001/10001/10001/01110',
        'V':'10001/10001/10001/01010/00100',
        'W':'10001/10001/10101/11011/10001',
        'X':'10001/01010/00100/01010/10001',
        'Y':'10001/01010/00100/00100/00100',
        'Z':'11111/00010/00100/01000/11111',
        '0':'01110/10011/10101/11001/01110',
        '1':'00100/01100/00100/00100/01110',
        '2':'01110/10001/00110/01000/11111',
        '3':'11110/00001/00110/00001/11110',
        '4':'00010/00110/01010/11111/00010',
        '5':'11111/10000/11110/00001/11110',
        '6':'01110/10000/11110/10001/01110',
        '7':'11111/00001/00010/00100/00100',
        '8':'01110/10001/01110/10001/01110',
        '9':'01110/10001/01111/00001/01110',
        ' ':'00000/00000/00000/00000/00000',
        '!':'00100/00100/00100/00000/00100',
        '?':'01110/10001/00110/00000/00100',
        '.':'00000/00000/00000/00000/00100',
        ',':'00000/00000/00000/00100/00100',
        '-':'00000/00000/11111/00000/00000',
        '_':'00000/00000/00000/00000/11111',
        ':':'00000/00100/00000/00100/00000',
        '+':'00000/00100/01110/00100/00000',
        '*':'00000/10101/01110/10101/00000',
        '(':'00010/00100/00100/00100/00010',
        ')':'01000/00100/00100/00100/01000',
    };

    function renderFigletText(text, fillCh) {
        const upper = text.toUpperCase();
        const rows = [[], [], [], [], []];
        [...upper].forEach((ch, ci) => {
            const def = PIXEL_FONT[ch] || PIXEL_FONT[' '];
            const bits = def.split('/');
            for (let r = 0; r < 5; r++) {
                for (let b = 0; b < bits[r].length; b++) {
                    rows[r].push(bits[r][b] === '1' ? fillCh : ' ');
                }
                if (ci < upper.length - 1) rows[r].push(' ');
            }
        });
        return rows;
    }

    function getFigletPreview(text) {
        const rows = renderFigletText(text, '#');
        return rows.map(r => r.join('')).join('\n');
    }

    function placeFiglet(col, row) {
        if (!figletText.trim()) return;
        const rows = renderFigletText(figletText, brushChar);
        pushUndo();
        rows.forEach((row_chars, ri) => {
            row_chars.forEach((ch, ci) => setCell(col + ci, row + ri, ch));
        });
        renderAll();
    }

    // ─── BORDERS LIBRARY ─────────────────────────────
    const RECT_BORDERS = {
        simple:  { tl: '+',  tr: '+',  bl: '+',  br: '+',  h: '-',  v: '|'  },
        rounded: { tl: '╭',  tr: '╮',  bl: '╰',  br: '╯',  h: '─',  v: '│'  },
        double:  { tl: '╔',  tr: '╗',  bl: '╚',  br: '╝',  h: '═',  v: '║'  },
        heavy:   { tl: '┏',  tr: '┓',  bl: '┗',  br: '┛',  h: '━',  v: '┃'  },
        ascii:   { tl: '/',  tr: '\\', bl: '\\', br: '/',  h: '-',  v: '|'  },
        dotted:  { tl: '.',  tr: '.',  bl: '\'', br: '\'', h: '.',  v: ':'  },
        stars:   { tl: '*',  tr: '*',  bl: '*',  br: '*',  h: '*',  v: '*'  },
        hash:    { tl: '#',  tr: '#',  bl: '#',  br: '#',  h: '#',  v: '#'  },
        block:   { tl: '█',  tr: '█',  bl: '█',  br: '█',  h: '█',  v: '█'  },
        wave:    { tl: '~',  tr: '~',  bl: '~',  br: '~',  h: '~',  v: '|'  },
    };

    const BORDER_PREVIEWS = Object.keys(RECT_BORDERS).map(name => {
        const b = RECT_BORDERS[name];
        return {
            name,
            preview: `${b.tl}${b.h}${b.h}${b.tr}\n${b.v}  ${b.v}\n${b.bl}${b.h}${b.h}${b.br}`
        };
    });

    // ─── DIVIDERS LIBRARY ────────────────────────────
    const DIVIDERS = [
        '────────────────────────────────────',
        '════════════════════════════════════',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '- - - - - - - - - - - - - - - - - -',
        '= = = = = = = = = = = = = = = = = =',
        '* * * * * * * * * * * * * * * * * *',
        '# # # # # # # # # # # # # # # # # #',
        '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
        '· · · · · · · · · · · · · · · · · ·',
        '░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░',
        '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
        '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
        '---===---===---===---===---===---===',
        '***===***===***===***===***===***===',
        '-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·-·',
        '<><><><><><><><><><><><><><><><><><>',
        '-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-',
        '][][][][][][][][][][][][][][][][][]',
        '/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/',
        '~~*~~*~~*~~*~~*~~*~~*~~*~~*~~*~~*~~',
        '|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|',
        '. . . . . . . . . . . . . . . . . .',
        ':::::::::::::::::::::::::::::::::::::',
        ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
        '|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|',
        '◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇◆◇',
        '★☆★☆★☆★☆★☆★☆★☆★☆★☆★☆★☆★☆★☆★☆',
        '♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦♦',
        '+--+--+--+--+--+--+--+--+--+--+--+',
        '##################################',
    ];

    // ─── CLIPARTS LIBRARY ────────────────────────────
    const CLIPARTS = [
        { name: 'Cat', category: 'animals', art: `  /\\_____/\\\n /  o   o  \\\n( ==  ^  == )\n )         (\n(___________)\n  \\_|\\_/|_/` },
        { name: 'Dog', category: 'animals', art: `  / \\__\n (    @\\___\n /         O\n/   (_____/\n/_____/   U` },
        { name: 'Rabbit', category: 'animals', art: `  (\\ /)\n  ( . .)\n C(") (")` },
        { name: 'Owl', category: 'animals', art: `  ,_,\n (O,O)\n (   )\n -"-"-` },
        { name: 'Fish', category: 'animals', art: `    ><>\n   / ><>\n  /  ><>\n ><>  ><>\n  \\  ><>\n   \\ ><>\n    ><>` },
        { name: 'Bear', category: 'animals', art: `  (•‿•)\n  /|oo|\\\n (_|  |_)\n   |  |\n  /|  |\\\n /_\\  /_\\` },
        { name: 'Butterfly', category: 'animals', art: `  \\ | /\n --oOo--\n  / | \\` },
        { name: 'Snail', category: 'animals', art: `    __\n   /  \\\n  | @  |\n   \\__/\n---( )---` },
        { name: 'Rocket', category: 'objects', art: `   /\\\n  /  \\\n /----\\\n| [  ] |\n \\ [] /\n  \\--/\n  /||\\ ` },
        { name: 'House', category: 'objects', art: `     /\\\n    /  \\\n   /    \\\n  /------\\\n  |  []  |\n  |  []  |\n  +------+` },
        { name: 'Coffee', category: 'objects', art: `  ) ) )\n ( ( (\n+-----+\n| ; ; |\n+-----+\n \\___ /` },
        { name: 'Laptop', category: 'objects', art: `  ________\n |  ____  |\n | |    | |\n | |____| |\n |________|\n/__________\\` },
        { name: 'Phone', category: 'objects', art: `  +-----+\n  |     |\n  | (_) |\n  |  _  |\n  | [_] |\n  |     |\n  +-----+` },
        { name: 'Car', category: 'objects', art: `  _____\n /     \\\n| () () |\n|_______|\n oOo oOo` },
        { name: 'Sword', category: 'objects', art: `  |\n  |\n  |\n _|_\n| + |\n  |\n  |\n  |` },
        { name: 'Crown', category: 'objects', art: `|\\ /\\  /\\  /|\n| V  \\/  \\/ |\n|__________|\n|__________|` },
        { name: 'Heart', category: 'shapes', art: ` ##   ##\n#########\n#########\n #######\n  #####\n   ###\n    #` },
        { name: 'Star', category: 'shapes', art: `    *\n  * * *\n*********\n  * * *\n    *` },
        { name: 'Diamond', category: 'shapes', art: `   /\\\n  /  \\\n /    \\\n \\    /\n  \\  /\n   \\/` },
        { name: 'Arrow →', category: 'shapes', art: `---->` },
        { name: 'Arrow ↓', category: 'shapes', art: `  |\n  |\n  |\n  V` },
        { name: 'Sun', category: 'nature', art: `    \\   |   /\n      \\ | /\n  ---( O )---\n      / | \\\n    /   |   \\` },
        { name: 'Tree', category: 'nature', art: `    *\n   /|\\\n  / | \\\n /  |  \\\n----+----\n   [  ]` },
        { name: 'Flower', category: 'nature', art: `  _\n >*<\n  |\n  |` },
        { name: 'Mountain', category: 'nature', art: `    /\\\n   /  \\\n  / /\\ \\\n / /  \\ \\\n/________\\` },
        { name: 'Wave', category: 'nature', art: `~  ~  ~\n~ ~~ ~\n~  ~  ~` },
        { name: 'Skull', category: 'misc', art: `  ___\n /   \\\n| () () |\n \\ ^  /\n  |||||\n  |||||` },
        { name: 'Bug', category: 'misc', art: `  O O\n \\|||/\n  |||` },
        { name: 'Ghost', category: 'misc', art: `  _\n ( )\n( o o)\n|     |\n|_|_|_|` },
        { name: 'Smiley', category: 'misc', art: `  ___\n(     )\n| ^ ^ |\n|  _  |\n( \\___/ )` },
        { name: 'Box Empty', category: 'frames', art: `╔════╗\n║    ║\n║    ║\n╚════╝` },
        { name: 'Box Heavy', category: 'frames', art: `┏━━━━┓\n┃    ┃\n┃    ┃\n┗━━━━┛` },
        { name: 'Box Double', category: 'frames', art: `╔════╗\n║    ║\n╠════╣\n║    ║\n╚════╝` },
        { name: 'Badge', category: 'frames', art: `/---------\\\n|  LABEL  |\n\\---------/` },
    ];

    // ─── TOOL SWITCHING ──────────────────────────────
    function setTool(name) {
        currentTool = name;
        toolBtns.forEach(b => b.classList.toggle('active', b.dataset.tool === name));
        viewport.style.cursor = name === 'text' ? 'text' : name === 'move' ? 'grab' : 'crosshair';
        previewCells = [];
        selection = null;
        renderOverlay();
        buildPanel(name);
    }

    toolBtns.forEach(btn => btn.addEventListener('click', () => setTool(btn.dataset.tool)));

    // ─── PROPERTIES PANEL ────────────────────────────
    function buildPanel(tool) {
        const titles = {
            pencil: 'Pencil', fill: 'Fill',
            eraser: 'Eraser', rect: 'Rectangle', circle: 'Circle',
            triangle: 'Triangle', line: 'Line', select: 'Select',
            move: 'Move', text: 'Text', figlet: 'FIGlet Text',
            cliparts: 'Cliparts',
            dividers: 'Dividers'
        };
        panelHeader.textContent = titles[tool] || tool;

        const html = buildPanelHTML(tool);
        panelContent.innerHTML = html;
        bindPanelEvents(tool);
    }

    function buildPanelHTML(tool) {
        switch (tool) {
            case 'pencil':
                return `
                <div class="panel-section">
                    <div class="panel-label">Style</div>
                    <div class="style-btn-group" id="brushStyleGroup">
                        ${brushStyleBtn('character','Character','XXX')}
                        ${brushStyleBtn('smooth','Smooth','·-·')}
                        ${brushStyleBtn('directional','Directional','-/|\\')}
                        ${brushStyleBtn('single','Single','─│')}
                        ${brushStyleBtn('double','Double','═║')}
                    </div>
                </div>
                <div class="panel-section">
                    <div class="panel-label">Brush Size</div>
                    <div class="size-slider-row">
                        <input type="range" id="brushSizeSlider" min="1" max="5" value="${brushSize}">
                        <span class="size-label" id="brushSizeLbl">${brushSize}×${brushSize}</span>
                    </div>
                </div>
                <div class="panel-section" id="charSection">
                    <div class="panel-label">Character</div>
                    <div class="char-input-row">
                        <label>Draw:</label>
                        <input class="char-input" id="brushCharInput" maxlength="1" value="${brushChar}">
                    </div>
                    ${buildCharPalette()}
                </div>`;


            case 'eraser':
                return `
                <div class="panel-section">
                    <div class="panel-label">Brush Size</div>
                    <div class="size-slider-row">
                        <input type="range" id="eraserSizeSlider" min="1" max="7" value="${eraserSize}">
                        <span class="size-label" id="eraserSizeLbl">${eraserSize}×${eraserSize}</span>
                    </div>
                </div>
                <div class="panel-section">
                    <div class="panel-label">Erase Single Character</div>
                    <div class="char-list" id="docCharList">${buildDocCharList()}</div>
                </div>`;

            case 'fill':
                return `
                <div class="panel-section">
                    <div class="panel-label">Fill Character</div>
                    <div class="char-input-row">
                        <label>Fill with:</label>
                        <input class="char-input" id="fillCharInput" maxlength="1" value="${fillChar}">
                    </div>
                    ${buildCharPalette('fill')}
                </div>`;

            case 'rect':
                return `
                <div class="panel-section">
                    <div class="panel-label">Border Style</div>
                    <div class="border-gallery" id="rectBorderGallery">
                        ${BORDER_PREVIEWS.map((b, i) => `
                            <div class="border-item ${rectStyle === b.name ? 'active' : ''}" data-border="${b.name}">
                                <pre>${b.preview}</pre>
                            </div>`).join('')}
                    </div>
                </div>
                <div class="panel-section">
                    <div class="panel-label">Fill Inside</div>
                    <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;margin-bottom:8px;">
                        <input type="checkbox" id="rectFillChk" ${rectFill ? 'checked' : ''}> Fill inside rectangle
                    </label>
                    <div id="rectFillCharSection" style="${rectFill ? '' : 'opacity:0.4;pointer-events:none;'}">
                        <div class="panel-label">Fill Character</div>
                        <div class="char-input-row">
                            <label>Char:</label>
                            <input class="char-input" id="rectFillCharInput" maxlength="1" value="${rectFillChar}">
                        </div>
                        ${buildCharPalette('rectfill')}
                    </div>
                </div>`;

            case 'circle':
                return `
                <div class="panel-section">
                    <div class="panel-label">Style</div>
                    <div class="style-btn-group" id="circleStyleGroup">
                        ${radioBtnRow('circle','smooth','Smooth','o-/\\|')}
                        ${radioBtnRow('circle','standard','Standard','O')}
                    </div>
                </div>`;

            case 'line':
                return `
                <div class="panel-section">
                    <div class="panel-label">Style</div>
                    <div class="style-btn-group" id="lineStyleGroup">
                        ${radioBtnRow('line','directional','Directional','-/|\\')}
                        ${radioBtnRow('line','smooth','Smooth','~-|')}
                        ${radioBtnRow('line','single','Single','─│')}
                        ${radioBtnRow('line','double','Double','═║')}
                    </div>
                </div>`;

            case 'triangle':
                return `<div class="panel-section"><p style="font-size:12px;color:#888;">Drag to draw triangle.<br>Apex is centered at top.</p></div>`;

            case 'select':
                return `
                <div class="panel-section">
                    <div class="panel-label">Actions</div>
                    <div class="selection-actions">
                        <button class="sel-btn" id="selCopy">Copy</button>
                        <button class="sel-btn" id="selCut">Cut</button>
                        <button class="sel-btn" id="selPaste">Paste</button>
                        <button class="sel-btn" id="selDelete">Delete</button>
                        <button class="sel-btn" id="selAll">All</button>
                    </div>
                </div>
                <div class="panel-section" style="font-size:11px;color:#888;">
                    Drag to select. Drag inside selection to move.
                </div>`;

            case 'text':
                return `<div class="panel-section"><p style="font-size:12px;color:#888;">Click on the canvas to place text.<br>Press Enter to commit,<br>Shift+Enter for new line,<br>Esc to cancel.</p></div>`;

            case 'move':
                return `<div class="panel-section"><p style="font-size:12px;color:#888;">Hold Space + drag anywhere, or use the toolbar move tool to pan the canvas.</p></div>`;

            case 'figlet':
                return `
                <div class="panel-section">
                    <div class="panel-label">Text</div>
                    <input type="text" class="figlet-input" id="figletInput" placeholder="Enter text…" value="${figletText}">
                    <div class="panel-label">Fill Character</div>
                    <div class="char-input-row" style="margin-bottom:8px;">
                        <label>Char:</label>
                        <input class="char-input" id="figletCharInput" maxlength="1" value="${brushChar}">
                    </div>
                    <pre id="figlet-preview-panel">${figletText ? getFigletPreview(figletText) : ''}</pre>
                    <button class="panel-action-btn primary" id="figletPlaceBtn">Click canvas to place</button>
                </div>`;


            case 'cliparts':
                return `
                <div class="panel-section">
                    <div class="panel-label">Category</div>
                    <select class="panel-select" id="clipCatSelect">
                        <option value="">All</option>
                        ${[...new Set(CLIPARTS.map(c => c.category))].map(cat => `<option>${cat}</option>`).join('')}
                    </select>
                    <div class="clipart-gallery" id="clipGallery">
                        ${buildClipartGallery('')}
                    </div>
                </div>
                <div class="panel-section"><p style="font-size:11px;color:#888;">Click a clipart, then click on the canvas to place it.</p></div>`;

            case 'dividers':
                return `
                <div class="panel-section">
                    <div class="panel-label">Click to insert at row</div>
                    <div class="divider-list" id="dividerList">
                        ${DIVIDERS.map((d, i) => `<div class="divider-item" data-idx="${i}">${d.substring(0, 34)}</div>`).join('')}
                    </div>
                </div>`;

            default:
                return `<p style="color:#888;font-size:12px;">No properties.</p>`;
        }
    }

    function brushStyleBtn(val, label, preview) {
        return `<button class="style-btn ${brushStyle === val ? 'active' : ''}" data-brush="${val}">
            <span>${label}</span><span class="preview">${preview}</span></button>`;
    }

    function radioBtnRow(group, val, label, preview) {
        const isActive = (group === 'circle' ? circleStyle : lineBrushStyle) === val;
        return `<button class="style-btn ${isActive ? 'active' : ''}" data-${group}="${val}">
            <span>${label}</span><span class="preview">${preview}</span></button>`;
    }

    function buildCharPalette(mode) {
        const chars = ['.', ',', ':', ';', '!', '|', '/', '\\', '(', ')', '+', '-', '_', '=',
                       '*', '#', '@', '%', '&', '?', '^', '~', 'X', 'O', 'o', '0', 'x',
                       '█', '▓', '▒', '░', '▄', '▀', '■', '□', '●', '○', '★', '◆'];
        return `<div class="char-list">${chars.map(ch =>
            `<div class="char-chip" data-char="${ch}" data-mode="${mode || 'brush'}">${ch}</div>`
        ).join('')}</div>`;
    }

    function buildDocCharList() {
        const chars = new Set();
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
            if (grid[r][c] !== ' ') chars.add(grid[r][c]);
        if (!chars.size) return '<span style="font-size:11px;color:#aaa;">No characters found</span>';
        return [...chars].map(ch =>
            `<div class="char-chip" data-erase-char="${ch}">${ch}</div>`
        ).join('');
    }

    function buildClipartGallery(cat) {
        const filtered = cat ? CLIPARTS.filter(c => c.category === cat) : CLIPARTS;
        return filtered.map((c, i) => {
            const art = c.art.split('\n').map(l => l.substring(0, 14)).slice(0, 4).join('\n');
            return `<div class="clipart-item ${selectedClipIdx === i ? 'active' : ''}" data-clip-idx="${CLIPARTS.indexOf(c)}">
                <pre>${art}</pre>
                <div class="clipart-item-name">${c.name}</div>
            </div>`;
        }).join('');
    }

    function bindPanelEvents(tool) {
        // Brush style buttons
        document.querySelectorAll('[data-brush]').forEach(btn => {
            btn.addEventListener('click', () => {
                brushStyle = btn.dataset.brush;
                document.querySelectorAll('[data-brush]').forEach(b => b.classList.toggle('active', b === btn));
            });
        });

        // Brush size
        const bsSlider = document.getElementById('brushSizeSlider');
        if (bsSlider) bsSlider.addEventListener('input', () => {
            brushSize = parseInt(bsSlider.value);
            const lbl = document.getElementById('brushSizeLbl');
            if (lbl) lbl.textContent = `${brushSize}×${brushSize}`;
        });

        // Eraser size
        const esSlider = document.getElementById('eraserSizeSlider');
        if (esSlider) esSlider.addEventListener('input', () => {
            eraserSize = parseInt(esSlider.value);
            renderOverlay();
            const lbl = document.getElementById('eraserSizeLbl');
            if (lbl) lbl.textContent = `${eraserSize}×${eraserSize}`;
        });

        // Brush char input
        const brushInput = document.getElementById('brushCharInput');
        if (brushInput) brushInput.addEventListener('input', () => { if (brushInput.value) brushChar = brushInput.value; });

        // Fill char input
        const fillInput = document.getElementById('fillCharInput');
        if (fillInput) fillInput.addEventListener('input', () => { if (fillInput.value) fillChar = fillInput.value; });

        // Char palette chips
        document.querySelectorAll('.char-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const ch = chip.dataset.char;
                if (chip.dataset.eraseChar) {
                    // erase-char mode
                    pushUndo();
                    const ec = chip.dataset.eraseChar;
                    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
                        if (grid[r][c] === ec) setCell(c, r, ' ');
                    renderAll();
                    buildPanel('eraser');
                    return;
                }
                if (chip.dataset.mode === 'fill') { fillChar = ch; const fi = document.getElementById('fillCharInput'); if (fi) fi.value = ch; }
                else if (chip.dataset.mode === 'rectfill') { rectFillChar = ch; const ri = document.getElementById('rectFillCharInput'); if (ri) ri.value = ch; }
                else { brushChar = ch; const bi = document.getElementById('brushCharInput'); if (bi) bi.value = ch; }
            });
        });

        // Rect fill checkbox + fill char
        const rfChk = document.getElementById('rectFillChk');
        if (rfChk) rfChk.addEventListener('change', () => {
            rectFill = rfChk.checked;
            const sec = document.getElementById('rectFillCharSection');
            if (sec) { sec.style.opacity = rectFill ? '1' : '0.4'; sec.style.pointerEvents = rectFill ? '' : 'none'; }
        });
        const rfCharInput = document.getElementById('rectFillCharInput');
        if (rfCharInput) rfCharInput.addEventListener('input', () => { if (rfCharInput.value) rectFillChar = rfCharInput.value; });

        // Rect border gallery
        document.querySelectorAll('#rectBorderGallery .border-item').forEach(item => {
            item.addEventListener('click', () => {
                rectStyle = item.dataset.border;
                document.querySelectorAll('#rectBorderGallery .border-item').forEach(b => b.classList.toggle('active', b === item));
            });
        });

        // Borders gallery
        document.querySelectorAll('#borderGallery .border-item').forEach(item => {
            item.addEventListener('click', () => {
                selectedBorderIdx = parseInt(item.dataset.idx);
                rectStyle = BORDER_PREVIEWS[selectedBorderIdx].name;
                document.querySelectorAll('#borderGallery .border-item').forEach(b => b.classList.toggle('active', b === item));
            });
        });

        // Circle style
        document.querySelectorAll('[data-circle]').forEach(btn => {
            btn.addEventListener('click', () => {
                circleStyle = btn.dataset.circle;
                document.querySelectorAll('[data-circle]').forEach(b => b.classList.toggle('active', b === btn));
            });
        });

        // Line style
        document.querySelectorAll('[data-line]').forEach(btn => {
            btn.addEventListener('click', () => {
                lineBrushStyle = btn.dataset.line;
                document.querySelectorAll('[data-line]').forEach(b => b.classList.toggle('active', b === btn));
            });
        });

        // Selection actions
        const selCopy   = document.getElementById('selCopy');
        const selCut    = document.getElementById('selCut');
        const selPaste  = document.getElementById('selPaste');
        const selDelete = document.getElementById('selDelete');
        const selAll    = document.getElementById('selAll');
        if (selCopy)   selCopy.addEventListener('click', copySelection);
        if (selCut)    selCut.addEventListener('click', cutSelection);
        if (selPaste)  selPaste.addEventListener('click', pasteClipboard);
        if (selDelete) selDelete.addEventListener('click', deleteSelection);
        if (selAll)    selAll.addEventListener('click', selectAll);

        // FIGlet
        const figInput = document.getElementById('figletInput');
        if (figInput) {
            figInput.addEventListener('input', () => {
                figletText = figInput.value;
                const prev = document.getElementById('figlet-preview-panel');
                if (prev) prev.textContent = figletText ? getFigletPreview(figletText) : '';
            });
        }
        const figCharInput = document.getElementById('figletCharInput');
        if (figCharInput) figCharInput.addEventListener('input', () => { if (figCharInput.value) brushChar = figCharInput.value; });

        const figPlaceBtn = document.getElementById('figletPlaceBtn');
        if (figPlaceBtn) {
            figPlaceBtn.addEventListener('click', () => {
                if (!figletText.trim()) { showToast('Enter some text first'); return; }
                showToast('Click on canvas to place FIGlet text');
                const handler = (e) => {
                    const { col, row } = eventToGrid(e);
                    placeFiglet(col, row);
                    viewport.removeEventListener('mousedown', handler, true);
                };
                viewport.addEventListener('mousedown', handler, true);
            });
        }

        // Cliparts category filter
        const clipCat = document.getElementById('clipCatSelect');
        if (clipCat) clipCat.addEventListener('change', () => {
            const gallery = document.getElementById('clipGallery');
            if (gallery) gallery.innerHTML = buildClipartGallery(clipCat.value);
            // Re-bind after rebuild
            bindClipartClicks();
        });
        bindClipartClicks();

        // Dividers
        document.querySelectorAll('.divider-item').forEach(item => {
            item.addEventListener('click', () => {
                selectedDivIdx = parseInt(item.dataset.idx);
                showToast('Click a row on canvas to insert divider');
                const handler = (e) => {
                    const { row } = eventToGrid(e);
                    placeDivider(row, DIVIDERS[selectedDivIdx]);
                    viewport.removeEventListener('mousedown', handler, true);
                };
                viewport.addEventListener('mousedown', handler, true);
            });
        });
    }

    function bindClipartClicks() {
        document.querySelectorAll('.clipart-item').forEach(item => {
            item.addEventListener('click', () => {
                selectedClipIdx = parseInt(item.dataset.clipIdx);
                document.querySelectorAll('.clipart-item').forEach(c => c.classList.toggle('active', c === item));
                showToast('Click on canvas to place clipart');
                const handler = (e) => {
                    const { col, row } = eventToGrid(e);
                    placeClipart(col, row, CLIPARTS[selectedClipIdx]);
                    viewport.removeEventListener('mousedown', handler, true);
                };
                viewport.addEventListener('mousedown', handler, true);
            });
        });
    }

    function placeClipart(col, row, clipart) {
        pushUndo();
        clipart.art.split('\n').forEach((line, li) => {
            [...line].forEach((ch, ci) => setCell(col + ci, row + li, ch));
        });
        renderAll();
        showToast(`Placed: ${clipart.name}`);
    }

    function placeDivider(row, divText) {
        pushUndo();
        const chars = [...divText];
        for (let c = 0; c < COLS && c < chars.length; c++) setCell(c, row, chars[c]);
        renderAll();
        showToast('Divider placed!');
    }

    // ─── ZOOM ────────────────────────────────────────
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const mx = e.clientX - rect.left + viewport.scrollLeft;
        const my = e.clientY - rect.top  + viewport.scrollTop;
        const oldZoom = zoom;
        zoom = Math.max(0.3, Math.min(4, zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
        panX = mx - (mx - panX) * (zoom / oldZoom);
        panY = my - (my - panY) * (zoom / oldZoom);
        applyTransform();
    }, { passive: false });

    document.getElementById('zoom-in').addEventListener('click', () => {
        zoom = Math.min(4, zoom * 1.2);
        applyTransform();
    });
    document.getElementById('zoom-out').addEventListener('click', () => {
        zoom = Math.max(0.3, zoom * 0.85);
        applyTransform();
    });
    document.getElementById('zoom-fit').addEventListener('click', fitToWindow);

    zoomSlider.addEventListener('input', () => {
        zoom = parseInt(zoomSlider.value) / 100;
        applyTransform();
    });

    function fitToWindow() {
        const rect = viewport.getBoundingClientRect();
        const scaleX = (rect.width  - 40) / (COLS * cellW);
        const scaleY = (rect.height - 40) / (ROWS * cellH);
        zoom = Math.min(scaleX, scaleY, 1);
        panX = (rect.width  - COLS * cellW * zoom) / 2;
        panY = (rect.height - ROWS * cellH * zoom) / 2;
        applyTransform();
    }

    // ─── SPACE-TO-PAN ────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ' && document.activeElement !== textInputEl) {
            e.preventDefault();
            spaceDown = true;
            viewport.style.cursor = 'grab';
        }
    });
    document.addEventListener('keyup', (e) => {
        if (e.key === ' ') {
            spaceDown = false;
            if (!isPanning) viewport.style.cursor = '';
        }
    });

    // ─── KEYBOARD SHORTCUTS ──────────────────────────
    document.addEventListener('keydown', (e) => {
        if (document.activeElement === textInputEl) return;
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

        // Tool shortcuts
        if (!e.ctrlKey && !e.metaKey) {
            const map = { p: 'pencil', b: 'brush', g: 'fill', e: 'eraser', r: 'rect', o: 'circle', l: 'line', s: 'select', t: 'text', m: 'move' };
            if (map[e.key.toLowerCase()]) { setTool(map[e.key.toLowerCase()]); return; }
        }

        // Ctrl shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z': e.preventDefault(); e.shiftKey ? redo() : undo(); break;
                case 'y': e.preventDefault(); redo(); break;
                case 's': e.preventDefault(); exportTXT(); break;
                case 'h': e.preventDefault(); openModal('modal-find'); break;
                case 'g': e.preventDefault(); toggleGrid(); break;
                case 'a': e.preventDefault(); selectAll(); setTool('select'); break;
                case 'c': e.preventDefault(); copySelection(); break;
                case 'x': e.preventDefault(); cutSelection(); break;
                case 'v': e.preventDefault(); pasteClipboard(); break;
            }
        }

        if (e.key === 'Escape') { selection = null; previewCells = []; renderOverlay(); }
        if (e.key === 'Delete' && selection) deleteSelection();
    });

    // ─── MENUS ───────────────────────────────────────
    document.querySelectorAll('.menu-trigger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const menuId = 'menu-' + btn.dataset.menu;
            const dropdown = document.getElementById(menuId);
            const isOpen = dropdown.classList.contains('open');
            closeAllDropdowns();
            if (!isOpen) {
                const rect = btn.getBoundingClientRect();
                dropdown.style.left = rect.left + 'px';
                dropdown.style.top  = (rect.bottom + 2) + 'px';
                dropdown.classList.add('open');
                btn.classList.add('open');
            }
        });
    });

    document.addEventListener('click', closeAllDropdowns);

    function closeAllDropdowns() {
        document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
        document.querySelectorAll('.menu-trigger').forEach(b => b.classList.remove('open'));
    }

    document.querySelectorAll('.dd-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllDropdowns();
            handleAction(item.dataset.action);
        });
    });

    btnUndo.addEventListener('click', undo);
    btnRedo.addEventListener('click', redo);

    function handleAction(action) {
        switch (action) {
            case 'new':
                if (confirm('Create a new canvas? Unsaved work will be lost.')) {
                    pushUndo(); initGrid(COLS, ROWS); resizeCanvases(); renderAll();
                }
                break;
            case 'resize': openModal('modal-resize'); break;
            case 'export-txt': exportTXT(); break;
            case 'export-png': exportPNG(); break;
            case 'undo': undo(); break;
            case 'redo': redo(); break;
            case 'cut': cutSelection(); break;
            case 'copy-sel': copySelection(); break;
            case 'paste': pasteClipboard(); break;
            case 'select-all': selectAll(); setTool('select'); break;
            case 'deselect': selection = null; renderOverlay(); break;
            case 'find-replace': openModal('modal-find'); break;
            case 'clear': pushUndo(); initGrid(COLS, ROWS); renderAll(); showToast('Canvas cleared'); break;
            case 'copy-ascii': copyASCIIText(); break;
            case 'align-left': alignContent('left'); break;
            case 'align-center': alignContent('center'); break;
            case 'align-right': alignContent('right'); break;
            case 'shortcuts': openModal('modal-shortcuts'); break;
            case 'about': showToast('ASCII Draw Studio — built with HTML/CSS/JS'); break;
        }
    }

    // ─── MODALS ──────────────────────────────────────
    function openModal(id) {
        document.getElementById('modal-overlay').classList.add('open');
        document.getElementById(id).classList.add('open');
    }
    function closeModal(id) {
        document.getElementById('modal-overlay').classList.remove('open');
        if (id) document.getElementById(id).classList.remove('open');
        else document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
    }

    document.getElementById('modal-overlay').addEventListener('click', () => closeModal());

    document.querySelectorAll('.modal-cancel').forEach(btn => {
        btn.addEventListener('click', () => closeModal());
    });

    document.getElementById('resize-confirm').addEventListener('click', () => {
        const nc = parseInt(document.getElementById('resize-cols').value) || 80;
        const nr = parseInt(document.getElementById('resize-rows').value) || 25;
        pushUndo();
        resizeGrid(nc, nr);
        resizeCanvases();
        renderAll();
        closeModal('modal-resize');
        showToast(`Canvas resized to ${nc}×${nr}`);
    });

    document.getElementById('replace-confirm').addEventListener('click', () => {
        const find    = document.getElementById('find-char').value;
        const replace = document.getElementById('replace-char').value;
        if (!find) return;
        pushUndo();
        let count = 0;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            if (grid[r][c] === find) { grid[r][c] = replace || ' '; count++; }
        }
        renderAll();
        closeModal('modal-find');
        showToast(`Replaced ${count} occurrence${count !== 1 ? 's' : ''}`);
    });

    // ─── EXPORT ──────────────────────────────────────
    function getASCIIText() {
        const lines = [];
        for (let r = 0; r < ROWS; r++) lines.push(grid[r].join('').trimEnd());
        while (lines.length && lines[lines.length - 1] === '') lines.pop();
        return lines.join('\n');
    }

    function exportTXT() {
        const text = getASCIIText();
        if (!text) { showToast('Canvas is empty'); return; }
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ascii-art.txt';
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('Downloaded as TXT');
    }

    function exportPNG() {
        const expCanvas = document.createElement('canvas');
        const lines = getASCIIText().split('\n');
        const rows = lines.length || 1;
        const maxCols = Math.max(...lines.map(l => l.length), 1);
        expCanvas.width  = maxCols * cellW + 20;
        expCanvas.height = rows  * cellH + 20;
        const ec = expCanvas.getContext('2d');
        ec.fillStyle = '#ffffff';
        ec.fillRect(0, 0, expCanvas.width, expCanvas.height);
        ec.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
        ec.textBaseline = 'top';
        ec.fillStyle = '#222222';
        lines.forEach((line, ri) => {
            [...line].forEach((ch, ci) => {
                if (ch !== ' ') ec.fillText(ch, 10 + ci * cellW, 10 + ri * cellH);
            });
        });
        expCanvas.toBlob(blob => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'ascii-art.png';
            a.click();
            URL.revokeObjectURL(a.href);
            showToast('Downloaded as PNG');
        });
    }

    function copyASCIIText() {
        const text = getASCIIText();
        if (!text) { showToast('Canvas is empty'); return; }
        navigator.clipboard.writeText(text).then(() => showToast('ASCII text copied!')).catch(() => showToast('Copy failed'));
    }

    // ─── ALIGNMENT ───────────────────────────────────
    function alignContent(dir) {
        pushUndo();
        for (let r = 0; r < ROWS; r++) {
            const line = grid[r].join('');
            const trimmed = line.trim();
            if (!trimmed) continue;
            const empty = COLS - trimmed.length;
            let padding = 0;
            if (dir === 'center') padding = Math.floor(empty / 2);
            if (dir === 'right')  padding = empty;
            grid[r] = new Array(COLS).fill(' ');
            [...trimmed].forEach((ch, i) => setCell(padding + i, r, ch));
        }
        renderAll();
        showToast(`Aligned ${dir}`);
    }

    // ─── STATUS BAR ──────────────────────────────────
    function updateStatus() {
        statusSize.textContent = `□ ${COLS} × ${ROWS} characters`;
    }

    // ─── TOAST ───────────────────────────────────────
    let toastTimer;
    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
    }

    // ─── GRID TOGGLE ─────────────────────────────────
    const gridToggleBtn = document.getElementById('grid-toggle');
    function toggleGrid() {
        showGrid = !showGrid;
        gridToggleBtn.classList.toggle('active', showGrid);
        renderAll();
    }
    gridToggleBtn.addEventListener('click', toggleGrid);

    // ─── WINDOW RESIZE ───────────────────────────────
    window.addEventListener('resize', () => { renderRulers(); });

    // ─── TOOLBAR TOOLTIPS (fixed position, no overflow clipping) ────
    const toolbarTooltip = document.getElementById('toolbar-tooltip');
    document.querySelectorAll('.tool-btn[data-tooltip]').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            const rect = btn.getBoundingClientRect();
            toolbarTooltip.textContent = btn.dataset.tooltip;
            toolbarTooltip.style.left  = (rect.right + 10) + 'px';
            toolbarTooltip.style.top   = (rect.top + rect.height / 2) + 'px';
            toolbarTooltip.classList.add('show');
        });
        btn.addEventListener('mouseleave', () => {
            toolbarTooltip.classList.remove('show');
        });
    });

    // ─── TOUCH SUPPORT ───────────────────────────────
    function touchToMouse(type, touch) {
        return new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: touch.clientX,
            clientY: touch.clientY,
            button: 0,
            buttons: type === 'mouseup' ? 0 : 1
        });
    }

    viewport.addEventListener('touchstart', (e) => {
        e.preventDefault();
        viewport.dispatchEvent(touchToMouse('mousedown', e.touches[0]));
    }, { passive: false });

    viewport.addEventListener('touchmove', (e) => {
        e.preventDefault();
        viewport.dispatchEvent(touchToMouse('mousemove', e.touches[0]));
    }, { passive: false });

    viewport.addEventListener('touchend', (e) => {
        e.preventDefault();
        viewport.dispatchEvent(touchToMouse('mouseup', e.changedTouches[0]));
    }, { passive: false });

    // ─── MOBILE PANEL TOGGLE ─────────────────────────
    const mobilePanelToggle = document.getElementById('mobile-panel-toggle');
    const propsPanel = document.getElementById('props-panel');

    mobilePanelToggle.addEventListener('click', () => {
        propsPanel.classList.toggle('mobile-visible');
        mobilePanelToggle.style.background = propsPanel.classList.contains('mobile-visible')
            ? 'var(--navy-hover)'
            : 'transparent';
    });

    viewport.addEventListener('touchstart', () => {
        if (propsPanel.classList.contains('mobile-visible')) {
            propsPanel.classList.remove('mobile-visible');
            mobilePanelToggle.style.background = 'transparent';
        }
    }, { passive: true });

    // ─── START ───────────────────────────────────────
    init();

})();
