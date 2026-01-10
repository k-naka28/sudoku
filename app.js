// app.js
// 依存: window.SudokuCore / SudokuGrid / SudokuSums / SudokuHints / window.Reasons
(function(){
  // ---------- ユーティリティ ----------
  const $ = id => document.getElementById(id);
  const coord = (r,c)=>`${String.fromCharCode(65+c)}${r+1}`;
  const rc = (r,c)=>coord(r,c);
  const rcTag = (r,c)=>`<code>${rc(r,c)}</code>`;

  function setMsg(html, kind='ok'){
    const m = $('msg');
    m.className = `msg ${kind}`;
    m.innerHTML = html; // 本アプリ内の生成文言のみ
  }

  // ---------- 候補の削除状態 ----------
  const emptyBans = () => Array.from({length:9},()=>Array.from({length:9},()=>new Set()));
  let candBans = emptyBans();
  const bansToArrays = () => candBans.map(row=>row.map(set=>Array.from(set).sort((a,b)=>a-b)));
  const applyBansFromArrays = (bans)=>{
    candBans = Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>new Set((bans && bans[r] && bans[r][c]) || [])));
  };
  const resetBans = ()=>{ candBans = emptyBans(); };
  const applyEliminations = (elims)=>{
    let added = 0;
    for(const e of elims || []){
      if(!candBans[e.r][e.c].has(e.d)){
        candBans[e.r][e.c].add(e.d);
        added++;
      }
    }
    return added;
  };
  let pendingElims = null;
  let pendingMove = null;
  let resetReduceUI = ()=>{};
  let setReduceDisabled = ()=>{};
  const clearPendingElims = ()=>{
    pendingElims = null;
    pendingMove = null;
    resetReduceUI();
    setReduceDisabled(false);
  };

  // ---------- 履歴（Undo/Redo） ----------
  const history = [];
  let hIndex = -1;
  const deepClone = v => (typeof structuredClone==='function')?structuredClone(v):JSON.parse(JSON.stringify(v));
  let lastKey = '';
  let suspendHistory = false;
  const snapKey = s => [
    s.grid.flat().join(''),
    s.given.flat().map(Number).join(''),
    s.manual.flat().map(Number).join(''),
    s.auto.flat().map(Number).join(''),
    s.ocr.flat().map(Number).join(''),
    s.lowconf.flat().map(Number).join(''),
    s.hinted ? s.hinted.flat().map(Number).join('') : '',
    s.bans ? s.bans.flat().map(a=>a.join('')).join('.') : ''
  ].join('|');

  function snapshot(){
    const {wraps,readGrid} = window.SudokuGrid;
    const g = readGrid();
    const given = Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>wraps[r][c].classList.contains('given')));
    const manual= Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>wraps[r][c].classList.contains('manual')));
    const auto  = Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>wraps[r][c].classList.contains('auto')));
    const ocr   = Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>wraps[r][c].classList.contains('ocr')));
    const lowconf = Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>wraps[r][c].classList.contains('lowconf')));
    const hinted = Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>wraps[r][c].classList.contains('hinted')));
    const bans = bansToArrays();
    return {grid:g, given, manual, auto, ocr, lowconf, hinted, bans};
  }
  function applySnapshot(snap){
    const {renderGrid,clearFlags,inputs,wraps} = window.SudokuGrid;
    suspendHistory = true;
    renderGrid(snap.grid);
    clearFlags();
    for(let r=0;r<9;r++)for(let c=0;c<9;c++){
      if(snap.given[r][c]){ wraps[r][c].classList.add('given'); inputs[r][c].readOnly = true; }
      else { inputs[r][c].readOnly = false; }
    }
    for(let r=0;r<9;r++)for(let c=0;c<9;c++){
      if(!snap.given[r][c] && snap.manual[r][c]) wraps[r][c].classList.add('manual');
      if(!snap.given[r][c] && snap.auto[r][c])   wraps[r][c].classList.add('auto');
      if(!snap.given[r][c] && snap.ocr[r][c])    wraps[r][c].classList.add('ocr');
      if(!snap.given[r][c] && snap.lowconf[r][c]) wraps[r][c].classList.add('lowconf');
      if(!snap.given[r][c] && snap.hinted && snap.hinted[r][c]) wraps[r][c].classList.add('hinted');
    }
    applyBansFromArrays(snap.bans || []);
    clearPendingElims();
    lastKey = snapKey(snap);
    refresh();
    suspendHistory = false;
    updateUndoRedoButtons();
  }
  function pushSnapshot(snap){
    const key = snapKey(snap);
    if(key === lastKey){ updateUndoRedoButtons(); return; }
    if(hIndex < history.length - 1) history.splice(hIndex+1);
    history.push(deepClone(snap));
    hIndex = history.length - 1;
    lastKey = key;
    updateUndoRedoButtons();
  }
  function canUndo(){ return hIndex > 0; }
  function canRedo(){ return hIndex < history.length - 1; }
  function updateUndoRedoButtons(){
    $('undo').disabled = !canUndo();
    $('redo').disabled = !canRedo();
  }

  // ---------- 初期化 ----------
  window.addEventListener('DOMContentLoaded', ()=>{
    const {initBoard,inputs,wraps,readGrid,renderGrid,applyGivenMask,clearFlags,setManualColor} = window.SudokuGrid;
    const {validGrid,solve} = window.SudokuCore;
    const R = window.Reasons;
    let hintActive = false;
    let candidatesOn = false;

    function initAxisLabels(){
      const col = $('colLabels');
      const row = $('rowLabels');
      if(!col || !row) return;
      col.innerHTML = '';
      row.innerHTML = '';
      for(let c=0;c<9;c++){
        const d=document.createElement('div'); d.className='label'; d.textContent=String.fromCharCode(65+c);
        col.appendChild(d);
      }
      for(let r=0;r<9;r++){
        const d=document.createElement('div'); d.className='label'; d.textContent=String(r+1);
        row.appendChild(d);
      }
    }

    function clearHintMarks(){
      for(let r=0;r<9;r++)for(let c=0;c<9;c++){
        wraps[r][c].classList.remove('hint-target','hint-unit','hint-focus','hint-elim');
      }
    }
    function exitHintMode(){
      if(!hintActive) return;
      hintActive = false;
      clearHintMarks();
      if(!candidatesOn) window.SudokuGrid.hideCandidates();
      else updateCandidates(readGrid());
    }
    function markCells(cells, cls){
      if(!cells) return;
      for(const [r,c] of cells){ wraps[r][c].classList.add(cls); }
    }
    function markElims(elims){
      if(!elims) return;
      const seen = new Set();
      for(const e of elims){
        const key = `${e.r},${e.c}`;
        if(seen.has(key)) continue;
        seen.add(key);
        wraps[e.r][e.c].classList.add('hint-elim');
      }
    }
  function showHintMode(cand, move){
      hintActive = true;
      clearHintMarks();
      if((move.action === 'place' || move.placeTarget) && Number.isInteger(move.r) && Number.isInteger(move.c)){
        wraps[move.r][move.c].classList.add('hint-target');
      }
      markCells(move.unitCells, 'hint-unit');
      markCells(move.pairCells, 'hint-focus');
      markCells(move.tripleCells, 'hint-focus');
      markCells(move.quadCells, 'hint-focus');
      markCells(move.baseCells, 'hint-focus');
      markCells(move.roofCells, 'hint-focus');
      if(move.pivot) markCells([move.pivot], 'hint-focus');
      if(move.p1) markCells([move.p1], 'hint-focus');
      if(move.p2) markCells([move.p2], 'hint-focus');
      markCells(move.eliminated, 'hint-elim');
      markElims(move.eliminations);
      if(candidatesOn){
        const candOverride = (move.action === 'eliminate') ? cand : null;
        updateCandidates(readGrid(), move.eliminations, candOverride);
      }
    }

    // 盤面生成 & 入力イベント
    initBoard($('board'));
    initAxisLabels();
    for(let r=0;r<9;r++){
      for(let c=0;c<9;c++){
        const w = wraps[r][c];
        const inp = inputs[r][c];
        inp.addEventListener('input', e=>{
          exitHintMode();
          clearPendingElims();
          resetBans();
          const v = e.target.value.replace(/[^0-9]/g,'');
          e.target.value = (v==='0') ? '' : v;
          if(w.classList.contains('given')) return;
          w.classList.remove('auto');
          w.classList.remove('ocr','lowconf');
          // ★ヒント色は編集した瞬間に通常色へ
          w.classList.remove('hinted');
          if(e.target.value) w.classList.add('manual');
          else w.classList.remove('manual');
          refresh();
          if(!suspendHistory) pushSnapshot(snapshot());
        });
      }
    }

    // 検算 UI
    let rowCells, colCells, blockCells;
    ({blockCells,rowCells,colCells} = window.SudokuSums.initSums($('rowSums'),$('colSums'),$('blockSums')));

    // ------ ボタン群 ------
    const doHintBtn = $('doHint');
    const candBtn = $('toggleCandidates');
    const reduceBtn = $('reduceCandidates');
    let reduceMode = 'hint';
    const setReduceLabel = ()=>{ reduceBtn.textContent = (reduceMode === 'hint') ? 'ヒントを表示' : '候補を減らす'; };
    resetReduceUI = ()=>{ reduceMode = 'hint'; setReduceLabel(); };
    let reduceNoHint = false;
    const isSolvedGrid = (g)=>{
      for(let r=0;r<9;r++)for(let c=0;c<9;c++) if(!g[r][c]) return false;
      return validGrid(g);
    };
    const updateHintButtons = (g)=>{
      const grid = g || readGrid();
      const solved = isSolvedGrid(grid);
      doHintBtn.disabled = solved;
      reduceBtn.disabled = solved || reduceNoHint;
    };
    setReduceDisabled = (disabled)=>{ reduceNoHint = !!disabled; updateHintButtons(); };
    const setCandLabel = ()=>{ candBtn.textContent = candidatesOn ? '候補:ON' : '候補:OFF'; };
    function buildCandidatesWithBans(g){
      const base = window.SudokuHints.buildCandidates(g);
      for(let r=0;r<9;r++)for(let c=0;c<9;c++){
        const banned = candBans[r][c];
        if(banned.size) base[r][c] = base[r][c].filter(d=>!banned.has(d));
      }
      return base;
    }
    function updateCandidates(g, eliminations, candOverride){
      if(!candidatesOn){ window.SudokuGrid.hideCandidates(); return; }
      const cand = candOverride || buildCandidatesWithBans(g);
      window.SudokuGrid.showCandidates(cand, g, eliminations);
    }

    $('reduceCandidates').addEventListener('click', ()=>{
      const g = readGrid();
      if(!validGrid(g)){
        setMsg('矛盾があるため候補を減らせません。','err');
        return;
      }
      exitHintMode();
      if(reduceMode === 'apply'){
        if(!pendingElims || pendingElims.length===0){
          clearPendingElims();
          const cand = buildCandidatesWithBans(g);
          const place = computePlaceHint(cand);
          if(place){
            showHintMode(cand, {...place, placeTarget:true});
            setMsg(`<div><strong>確定候補：</strong>${rcTag(place.r,place.c)} = <b>${place.d}</b></div>` + place.reason, 'ok');
          }else{
            setMsg('削除ヒントがありません。','warn');
          }
          return;
        }
        const applied = pendingElims.shift();
        const added = applyEliminations([applied]);
        if(added) pushSnapshot(snapshot());
        clearPendingElims();
        const candAfter = buildCandidatesWithBans(g);
        showHintMode(candAfter, {action:'eliminate', eliminations:[applied]});
        setMsg(`<div><strong>候補削除：</strong>${rcTag(applied.r,applied.c)} の <b>${applied.d}</b> を除外</div>`, 'ok');
        return;
      }

      const cand = buildCandidatesWithBans(g);
      const move = computeElimHint(cand);
      if(!move || !move.eliminations || move.eliminations.length===0){
        const place = computePlaceHint(cand);
        if(place){
          showHintMode(cand, {...place, placeTarget:true});
          setMsg(`<div><strong>確定候補：</strong>${rcTag(place.r,place.c)} = <b>${place.d}</b></div>` + place.reason, 'ok');
        }else{
          setMsg('今は削除ヒントなし。','warn');
        }
        setReduceDisabled(true);
        return;
      }
      pendingMove = move;
      const elim = move.eliminations[0];
      pendingElims = [elim];
      const displayMove = {...move, action:'eliminate', eliminations:[elim]};
      showHintMode(cand, displayMove);
      reduceMode = 'apply';
      setReduceLabel();
      setMsg(`<div><strong>削除ヒント：</strong>${rcTag(elim.r,elim.c)} の <b>${elim.d}</b></div>` + move.reason, 'ok');
    });
    candBtn.addEventListener('click', ()=>{
      candidatesOn = !candidatesOn;
      setCandLabel();
      updateCandidates(readGrid());
    });
    setReduceLabel();
    setCandLabel();

    $('solve').addEventListener('click', ()=>{
      exitHintMode();
      clearPendingElims();
      const g = readGrid();
      if(!validGrid(g)){ setMsg('<strong>矛盾：</strong> 行/列/ブロック内で重複があります。','err'); return; }
      const before = snapshot();

      const given = mask('given'), manual = mask('manual'), ocr = mask('ocr');
      const res = solve(g);
      if(res.ok){
        resetBans();
        renderGrid(res.grid);
        for(let r=0;r<9;r++)for(let c=0;c<9;c++){
          wraps[r][c].classList.remove('auto','hinted','lowconf');
          if(!given[r][c] && !manual[r][c] && !ocr[r][c] && res.grid[r][c]) wraps[r][c].classList.add('auto');
        }
        refresh(); setMsg('<strong>解けました。</strong>（赤=ソルバが埋めた数字）','ok');
        pushSnapshot(snapshot());
      }else{
        setMsg('解が存在しない可能性があります。','warn');
        applySnapshot(before);
      }
    });

    $('doHint').addEventListener('click', ()=>{
      const hintGrid = readGrid();
      if(!validGrid(hintGrid)){
        setMsg('矛盾があるためヒントを出せません。','err');
        return;
      }
      exitHintMode();
      clearPendingElims();
      const cand = buildCandidatesWithBans(hintGrid);
      const move = computePlaceHint(cand);
      if(!move){
        setMsg('今は確定ヒントなし。ヒントを表示を使ってください。','warn');
        return;
      }
      const {r,c,d,reason} = move;
      if(wraps[r][c].classList.contains('given')){ setMsg('そのマスは固定（黒）です。','warn'); return; }

      // ★ヒントを「1手適用」＋ 緑色にする（manual + hinted）
      suspendHistory = true;
      inputs[r][c].value = String(d);
      wraps[r][c].classList.remove('auto');
      wraps[r][c].classList.add('manual','hinted');  // ← 緑
      refresh();
      showHintMode(cand, move);
      suspendHistory = false;

      pushSnapshot(snapshot());
      setMsg(`<div><strong>ヒント適用：</strong>${rcTag(r,c)} に <b>${d}</b></div>` + reason, 'ok');
    });

    $('undo').addEventListener('click', ()=>{
      exitHintMode();
      if(!canUndo()) return;
      hIndex--; applySnapshot(deepClone(history[hIndex]));
      setMsg('1手戻しました。','ok'); updateUndoRedoButtons();
    });
    $('redo').addEventListener('click', ()=>{
      exitHintMode();
      if(!canRedo()) return;
      hIndex++; applySnapshot(deepClone(history[hIndex]));
      setMsg('1手進めました。','ok'); updateUndoRedoButtons();
    });

    $('check').addEventListener('click', ()=>{
      exitHintMode();
      const ok = window.SudokuCore.validGrid(window.SudokuGrid.readGrid());
      setMsg(ok ? '矛盾なし。' : '矛盾あり（行/列/3x3で重複）。', ok ? 'ok' : 'err');
    });

    $('clear').addEventListener('click', ()=>{
      exitHintMode();
      clearPendingElims();
      resetBans();
      renderGrid(Array.from({length:9},()=>Array(9).fill(0)));
      clearFlags(); refresh(); setMsg('クリアしました。','ok');
      pushSnapshot(snapshot());
    });

    $('demo').addEventListener('click', ()=>{
      exitHintMode();
      clearPendingElims();
      loadLinear('530070000600195000098000060800060003400803001700020006060000280000419005000080079');
    });
    $('load').addEventListener('click', ()=>{ clearPendingElims(); loadLinear($('linear').value); });
    $('export').addEventListener('click', ()=>{
      exitHintMode();
      const g = window.SudokuGrid.readGrid();
      $('linear').value = g.flat().map(v=>v||0).join('');
      setMsg('盤面を書き出しました。','ok');
    });
    $('manualColor').addEventListener('change', e=>{ exitHintMode(); clearPendingElims(); window.SudokuGrid.setManualColor(e.target.value); });

    function loadLinear(s){
      exitHintMode();
      clearPendingElims();
      s=(s||'').replace(/[^0-9.]/g,'').replace(/\./g,'0');
      if(s.length!==81){ setMsg('81文字の0-9で貼り付けてください。','warn'); return; }
      const g = Array.from({length:9},()=>Array(9).fill(0));
      for(let i=0;i<81;i++){ const r=Math.floor(i/9),c=i%9,d=Number(s[i]); g[r][c]=(d>=1&&d<=9)?d:0 }
      resetBans();
      suspendHistory = true;
      window.SudokuGrid.renderGrid(g);
      window.SudokuGrid.applyGivenMask(g);
      refresh();
      suspendHistory = false;
      setMsg('読み込み完了（黒=固定）。','ok');
      pushSnapshot(snapshot());
    }

    function mask(cls){ return Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>wraps[r][c].classList.contains(cls))) }
    function refresh(){
      const g = window.SudokuGrid.readGrid();
      window.SudokuSums.updateSums(g, rowCells, colCells, blockCells);
      updateCandidates(g);
      updateHintButtons(g);
      updateUndoRedoButtons();
    }

    // 初期スナップショット
    refresh(); pushSnapshot(snapshot());

  });

  // ---------- ヒント計算（1手適用用） ----------
  function computeHintWithOpts(cand, opts){
    const H = window.SudokuHints;
    const hiddenUnitCells = (h)=>{
      if(!h || !h.kind) return null;
      if(h.kind === 'hidden-row') return Array.from({length:9},(_,c)=>[h.unit,c]);
      if(h.kind === 'hidden-col') return Array.from({length:9},(_,r)=>[r,h.unit]);
      if(h.kind === 'hidden-box'){
        const br = Math.floor(h.unit/3)*3, bc = (h.unit%3)*3;
        const cells = [];
        for(let dr=0;dr<3;dr++)for(let dc=0;dc<3;dc++) cells.push([br+dr, bc+dc]);
        return cells;
      }
      return null;
    };

    // 優先度：「わかりやすい → 難しい」
    // Hidden → Naked → Locked → Pairs → Triples → X-Wing → Skyscraper → Kite → Swordfish → Jellyfish → XYZ-Wing → Y-Wing → Quads
    const order = [
      H.findHidden,
      H.findNaked,
      H.findLocked,
      H.findPairs,
      H.findTriples,
      H.findXWing,
      H.findSkyscraper,
      H.findKite,
      H.findSwordfish,   // ★追加
      H.findJellyfish,   // ★追加
      H.findXYZWing,
      H.findYWing,
      H.findQuads        // ★追加（Naked/Hidden Quad）
    ];

    const buildHint = (h)=>{
      if(!h) return null;
      // 解説は reasons.js 側で詳細化
      const R = window.Reasons;
      const reason =
        (h.kind?.startsWith('hidden'))  ? R.hidden(h)  :
        (h.kind==='naked-single')       ? R.naked(h)   :
        (h.kind?.includes('naked-pair') || h.kind?.includes('hidden-pair')) ? R.pairs(h) :
        (h.kind?.includes('triple'))    ? R.triples(h) :
        (h.kind?.startsWith('xwing'))   ? R.xwing(h)   :
        (h.kind==='ywing')              ? R.ywing(h)   :
        (h.kind?.includes('locked'))    ? R.locked(h)  :
        (h.kind?.includes('swordfish')) ? R.swordfish(h):
        (h.kind?.includes('jellyfish')) ? R.jellyfish(h):
        (h.kind?.includes('skyscraper')) ? R.skyscraper(h):
        (h.kind==='kite')               ? R.kite(h)    :
        (h.kind==='xyzwing')            ? R.xyzwing(h) :
        (h.kind?.includes('quad'))      ? R.quads(h)   :
        '論理の詳細は未定義です。';
      const action = h.action || (Number.isInteger(h.r) ? 'place' : 'eliminate');
      const unitCells = h.kind?.startsWith('hidden') ? hiddenUnitCells(h) : null;
      return {...h, action, reason, unitCells};
    };

    for(const fn of order){
      const h = fn && fn(cand, opts);
      if(h) return buildHint(h);
    }
    return null;
  }
  function computePlaceHint(cand){
    const h = computeHintWithOpts(cand, {allowElim:false});
    return (h && h.action==='place') ? h : null;
  }
  function computeElimHint(cand){
    const h = computeHintWithOpts(cand, {allowElim:true});
    if(!h || !h.eliminations || h.eliminations.length===0) return null;
    return {...h, action:'eliminate'};
  }
})();
