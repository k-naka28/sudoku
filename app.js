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

    // 盤面生成 & 入力イベント
    initBoard($('board'));
    for(let r=0;r<9;r++){
      for(let c=0;c<9;c++){
        const w = wraps[r][c];
        const inp = inputs[r][c];
        inp.addEventListener('input', e=>{
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
    $('solve').addEventListener('click', ()=>{
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
      const move = computeNextHint();
      if(!move){ setMsg('今は確定ヒントなし。','warn'); return; }
      const {r,c,d,reason} = move;
      if(wraps[r][c].classList.contains('given')){ setMsg('そのマスは固定（黒）です。','warn'); return; }

      // ★ヒントを「1手適用」＋ 緑色にする（manual + hinted）
      suspendHistory = true;
      inputs[r][c].value = String(d);
      wraps[r][c].classList.remove('auto');
      wraps[r][c].classList.add('manual','hinted');  // ← 緑
      refresh();
      suspendHistory = false;

      pushSnapshot(snapshot());
      setMsg(`<div><strong>ヒント適用：</strong>${rcTag(r,c)} に <b>${d}</b></div>` + reason, 'ok');
    });

    $('undo').addEventListener('click', ()=>{
      if(!canUndo()) return;
      hIndex--; applySnapshot(deepClone(history[hIndex]));
      setMsg('1手戻しました。','ok'); updateUndoRedoButtons();
    });
    $('redo').addEventListener('click', ()=>{
      if(!canRedo()) return;
      hIndex++; applySnapshot(deepClone(history[hIndex]));
      setMsg('1手進めました。','ok'); updateUndoRedoButtons();
    });

    $('check').addEventListener('click', ()=>{
      const ok = window.SudokuCore.validGrid(window.SudokuGrid.readGrid());
      setMsg(ok ? '矛盾なし。' : '矛盾あり（行/列/3x3で重複）。', ok ? 'ok' : 'err');
    });

    $('clear').addEventListener('click', ()=>{
      renderGrid(Array.from({length:9},()=>Array(9).fill(0)));
      clearFlags(); refresh(); setMsg('クリアしました。','ok');
      pushSnapshot(snapshot());
    });

    $('demo').addEventListener('click', ()=>{
      loadLinear('530070000600195000098000060800060003400803001700020006060000280000419005000080079');
    });
    $('load').addEventListener('click', ()=> loadLinear($('linear').value));
    $('export').addEventListener('click', ()=>{
      const g = window.SudokuGrid.readGrid();
      $('linear').value = g.flat().map(v=>v||0).join('');
      setMsg('盤面を書き出しました。','ok');
    });
    $('manualColor').addEventListener('change', e=> window.SudokuGrid.setManualColor(e.target.value));

    function loadLinear(s){
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
    function refresh(){ const g = window.SudokuGrid.readGrid(); window.SudokuSums.updateSums(g, rowCells, colCells, blockCells); }

    // 初期スナップショット
    refresh(); pushSnapshot(snapshot());

    // ---------- OCR 画像取り込み ----------
    if(window.SudokuOCR){
      window.SudokuOCR.init({
        setMsg,
        onApply: (grid, lowConf)=>{
          suspendHistory = true;
          renderGrid(grid);
          clearFlags();
          for(let r=0;r<9;r++)for(let c=0;c<9;c++){
            if(grid[r][c]) wraps[r][c].classList.add('ocr');
          }
          for(const [r,c] of lowConf) wraps[r][c].classList.add('lowconf');
          refresh();
          suspendHistory = false;
          pushSnapshot(snapshot());
        }
      });
    }
  });

  // ---------- ヒント計算（1手適用用） ----------
  function computeNextHint(){
    const H = window.SudokuHints;
    const g = window.SudokuGrid.readGrid();
    const cand = H.buildCandidates(g);

    // 優先度：「わかりやすい → 難しい」
    // Hidden → Naked → Locked → Pairs → Triples → X-Wing → Swordfish → Y-Wing → Quads
    const order = [
      H.findHidden,
      H.findNaked,
      H.findLocked,
      H.findPairs,
      H.findTriples,
      H.findXWing,
      H.findSwordfish,   // ★追加
      H.findYWing,
      H.findQuads        // ★追加（Naked/Hidden Quad）
    ];

    for(const fn of order){
      const h = fn && fn(cand);
      if(h){
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
          (h.kind?.includes('quad'))      ? R.quads(h)   :
          '論理の詳細は未定義です。';
        return {r:h.r, c:h.c, d:h.d, reason};
      }
    }
    return null;
  }
})();
