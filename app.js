// app.js
// 依存: window.SudokuCore / SudokuGrid / SudokuSums / SudokuHints / window.Reasons
(function(){
  // ---------- ユーティリティ ----------
  const $ = id => document.getElementById(id);
  const rc = (r,c)=>`行${r+1} 列${c+1}`;
  const rcTag = (r,c)=>`<code>${rc(r,c)}</code>`;

  function setMsg(html, kind='ok'){
    const m = $('msg');
    m.className = `msg ${kind}`;
    m.innerHTML = html; // 本アプリ内の生成文言のみ
  }

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
    s.lowconf.flat().map(Number).join('')
  ].join('|');

  function snapshot(){
    const {wraps,readGrid} = window.SudokuGrid;
    const g = readGrid();
    const given = Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>wraps[r][c].classList.contains('given')));
    const manual= Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>wraps[r][c].classList.contains('manual')));
    const auto  = Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>wraps[r][c].classList.contains('auto')));
    const ocr   = Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>wraps[r][c].classList.contains('ocr')));
    const lowconf = Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>wraps[r][c].classList.contains('lowconf')));
    return {grid:g, given, manual, auto, ocr, lowconf};
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
    }
    lastKey = snapKey(snap);
    refresh();
    suspendHistory = false;
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

    function clearHintMarks(){
      for(let r=0;r<9;r++)for(let c=0;c<9;c++){
        wraps[r][c].classList.remove('hint-target','hint-focus','hint-elim');
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
      if(move.action === 'place' && Number.isInteger(move.r) && Number.isInteger(move.c)){
        wraps[move.r][move.c].classList.add('hint-target');
      }
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
      if(candidatesOn) updateCandidates(readGrid(), move.eliminations);
    }

    // 盤面生成 & 入力イベント
    initBoard($('board'));
    for(let r=0;r<9;r++){
      for(let c=0;c<9;c++){
        const w = wraps[r][c];
        const inp = inputs[r][c];
        inp.addEventListener('input', e=>{
          exitHintMode();
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
    const candBtn = $('toggleCandidates');
    const setCandLabel = ()=>{ candBtn.textContent = candidatesOn ? '候補:ON' : '候補:OFF'; };
    function updateCandidates(g, eliminations){
      if(!candidatesOn){ window.SudokuGrid.hideCandidates(); return; }
      const cand = window.SudokuHints.buildCandidates(g);
      window.SudokuGrid.showCandidates(cand, g, eliminations);
    }
    candBtn.addEventListener('click', ()=>{
      candidatesOn = !candidatesOn;
      setCandLabel();
      updateCandidates(readGrid());
    });
    setCandLabel();

    $('solve').addEventListener('click', ()=>{
      exitHintMode();
      const g = readGrid();
      if(!validGrid(g)){ setMsg('<strong>矛盾：</strong> 行/列/ブロック内で重複があります。','err'); return; }
      const before = snapshot();

      const given = mask('given'), manual = mask('manual'), ocr = mask('ocr');
      const res = solve(g);
      if(res.ok){
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
      const cand = window.SudokuHints.buildCandidates(hintGrid);
      const move = computeNextHint(cand);
      if(!move){ setMsg('今は確定ヒントなし。','warn'); return; }
      const {r,c,d,reason} = move;
      if(move.action === 'eliminate'){
        showHintMode(cand, move);
        const count = move.eliminations ? move.eliminations.length : 0;
        setMsg(`<div><strong>消去ヒント：</strong>候補を ${count} 箇所削除できます。</div>` + reason, 'ok');
        return;
      }
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
      renderGrid(Array.from({length:9},()=>Array(9).fill(0)));
      clearFlags(); refresh(); setMsg('クリアしました。','ok');
      pushSnapshot(snapshot());
    });

    $('demo').addEventListener('click', ()=>{
      exitHintMode();
      loadLinear('530070000600195000098000060800060003400803001700020006060000280000419005000080079');
    });
    $('load').addEventListener('click', ()=> loadLinear($('linear').value));
    $('export').addEventListener('click', ()=>{
      exitHintMode();
      const g = window.SudokuGrid.readGrid();
      $('linear').value = g.flat().map(v=>v||0).join('');
      setMsg('盤面を書き出しました。','ok');
    });
    $('manualColor').addEventListener('change', e=>{ exitHintMode(); window.SudokuGrid.setManualColor(e.target.value); });

    function loadLinear(s){
      exitHintMode();
      s=(s||'').replace(/[^0-9.]/g,'').replace(/\./g,'0');
      if(s.length!==81){ setMsg('81文字の0-9で貼り付けてください。','warn'); return; }
      const g = Array.from({length:9},()=>Array(9).fill(0));
      for(let i=0;i<81;i++){ const r=Math.floor(i/9),c=i%9,d=Number(s[i]); g[r][c]=(d>=1&&d<=9)?d:0 }
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
    }

    // 初期スナップショット
    refresh(); pushSnapshot(snapshot());

  });

  // ---------- ヒント計算（1手適用用） ----------
  function computeNextHint(cand){
    const H = window.SudokuHints;

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
      return {...h, action, reason};
    };

    const pick = (opts)=>{
      for(const fn of order){
        const h = fn && fn(cand, opts);
        if(h) return buildHint(h);
      }
      return null;
    };

    // まず「数字を確定できる手」を優先
    return pick({allowElim:false}) || pick({allowElim:true});
  }
})();
