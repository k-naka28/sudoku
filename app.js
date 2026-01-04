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
    const ocrBtn = $('ocr');
    const ocrCancel = $('ocrCancel');
    const ocrFile = $('ocrFile');
    let ocrWorker = null;
    let ocrCanceled = false;

    if(ocrBtn && ocrFile){
      ocrBtn.addEventListener('click', ()=> ocrFile.click());
      ocrFile.addEventListener('change', async ()=>{
        const file = ocrFile.files && ocrFile.files[0];
        ocrFile.value = '';
        if(!file) return;
        await runOcr(file);
      });
    }
    if(ocrCancel){
      ocrCancel.addEventListener('click', async ()=>{
        ocrCanceled = true;
        if(ocrWorker && typeof ocrWorker.terminate === 'function'){
          await ocrWorker.terminate();
          ocrWorker = null;
        }
        setOcrBusy(false);
        setMsg('OCRを中止しました。','warn');
      });
    }

    function setOcrBusy(busy){
      if(ocrBtn) ocrBtn.disabled = busy;
      if(ocrCancel) ocrCancel.hidden = !busy;
    }

    async function runOcr(file){
      if(!window.Tesseract){
        setMsg('OCRライブラリが読み込めません。','err');
        return;
      }
      setOcrBusy(true);
      ocrCanceled = false;
      setMsg('画像を解析中... 0/81','warn');

      try{
        const img = await loadImage(file);
        setMsg('画像を読み込みました。盤面を検出中...','warn');
        const cvReady = await waitForOpenCv(5000);
        if(!cvReady){
          setMsg('OpenCVが準備できませんでした。簡易解析で続行します。','warn');
        }
        const prep = preprocessImage(img);
        if(!prep){
          setMsg('盤面の検出に失敗しました。画像のコントラストが低い可能性があります。','err');
          return;
        }
        if(prep.error){
          setMsg(`盤面の検出に失敗しました。${prep.error}`,'err');
          return;
        }

        const {canvas, x, y, size} = prep;
        const cellSize = Math.floor(size / 9);
        if(cellSize < 8){
          setMsg('盤面が小さすぎて解析できません。もう少し近くで撮影してください。','err');
          return;
        }
        const grid = Array.from({length:9},()=>Array(9).fill(0));
        const lowConf = [];

        ocrWorker = await createOcrWorker();
        setMsg('OCRエンジン準備完了。セル解析を開始します...','warn');
        setMsg('OCRエンジン準備完了。セル解析を開始します...','warn');
        for(let r=0;r<9;r++){
          for(let c=0;c<9;c++){
            if(ocrCanceled) throw new Error('OCR_CANCELED');
            const cellCanvas = extractCell(canvas, x + c*cellSize, y + r*cellSize, cellSize);
            const {digit, confidence} = await recognizeDigit(ocrWorker, cellCanvas, r, c);
            if(digit >= 1 && digit <= 9){
              grid[r][c] = digit;
              if(Number.isFinite(confidence) && confidence < 60) lowConf.push([r,c]);
            }
            const idx = r*9 + c + 1;
            setMsg(`画像を解析中... ${idx}/81`,'warn');
          }
        }
        if(ocrWorker && typeof ocrWorker.terminate === 'function'){
          await ocrWorker.terminate();
          ocrWorker = null;
        }

        if(ocrCanceled) return;

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

        const note = lowConf.length ? `低信頼セル: ${lowConf.length}（オレンジ枠）` : '低信頼セルなし';
        setMsg(`画像取り込み完了。${note}`,'ok');
      }catch(err){
        if(err && err.message === 'OCR_CANCELED') return;
        const details = formatOcrError(err);
        setMsg(`画像の解析に失敗しました。${details}`,'err');
      }finally{
        if(ocrWorker && typeof ocrWorker.terminate === 'function'){
          await ocrWorker.terminate();
          ocrWorker = null;
        }
        setOcrBusy(false);
      }
    }

    function loadImage(file){
      return new Promise((resolve, reject)=>{
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = ()=>{
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = ()=> reject(new Error('IMAGE_LOAD_FAILED'));
        img.src = url;
      });
    }

    function preprocessImage(img){
      if(window.cv && cv.Mat){
        const res = preprocessWithOpenCv(img);
        if(res) return res;
      }
      const maxSide = 900;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      if(w < 200 || h < 200) return {error:'画像が小さすぎます。'};
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const hist = new Uint32Array(256);
      const gray = new Uint8Array(w*h);
      let idx = 0;
      for(let y0=0;y0<h;y0++){
        for(let x0=0;x0<w;x0++){
          const i = (y0*w + x0) * 4;
          const r = data[i], g = data[i+1], b = data[i+2];
          const lum = Math.round(0.299*r + 0.587*g + 0.114*b);
          gray[idx++] = lum;
          hist[lum]++;
        }
      }
      const thresh = otsuThreshold(hist, w*h);
      const black = new Uint8Array(w*h);
      idx = 0;
      for(let y0=0;y0<h;y0++){
        for(let x0=0;x0<w;x0++){
          const lum = gray[idx];
          const v = lum < thresh ? 0 : 255;
          const i = (y0*w + x0) * 4;
          data[i] = data[i+1] = data[i+2] = v;
          if(v === 0) black[idx] = 1;
          idx++;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      let best = findBestComponent(black, w, h, {densityMin:0.015, densityMax:0.25, minSideRatio:0.2});
      if(!best){
        best = findGridByEdges(gray, w, h);
      }
      if(!best) return {error:'盤面の枠が見つかりませんでした。'};

      const boxW = best.maxX - best.minX + 1;
      const boxH = best.maxY - best.minY + 1;
      const size = Math.max(boxW, boxH);
      let x = Math.round(best.minX + boxW/2 - size/2);
      let y = Math.round(best.minY + boxH/2 - size/2);
      const pad = Math.round(size * 0.02);
      x -= pad; y -= pad;
      const paddedSize = size + pad*2;
      const finalSize = Math.max(1, paddedSize);
      if(x < 0) x = 0;
      if(y < 0) y = 0;
      if(x + finalSize > w) x = w - finalSize;
      if(y + finalSize > h) y = h - finalSize;
      if(finalSize <= 0) return null;

      if(finalSize <= 0 || x < 0 || y < 0) return {error:'盤面の切り出しに失敗しました。'};
      return {canvas, x, y, size: finalSize};
    }

    function preprocessWithOpenCv(img){
      const maxSide = 1200;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      if(w < 200 || h < 200) return {error:'画像が小さすぎます。'};

      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = w;
      srcCanvas.height = h;
      const sctx = srcCanvas.getContext('2d');
      sctx.drawImage(img, 0, 0, w, h);

      let src, gray, blur, edges, contours, hierarchy;
      try{
        src = cv.imread(srcCanvas);
        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        blur = new cv.Mat();
        cv.GaussianBlur(gray, blur, new cv.Size(5,5), 0);
        edges = new cv.Mat();
        cv.Canny(blur, edges, 50, 150);

        contours = new cv.MatVector();
        hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        let bestQuad = null;
        let bestArea = 0;
        for(let i=0;i<contours.size();i++){
          const cnt = contours.get(i);
          const area = cv.contourArea(cnt);
          if(area < (w*h*0.05)) { cnt.delete(); continue; }
          const peri = cv.arcLength(cnt, true);
          const approx = new cv.Mat();
          cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
          if(approx.rows === 4 && cv.isContourConvex(approx)){
            if(area > bestArea){
              if(bestQuad) bestQuad.delete();
              bestQuad = approx;
              bestArea = area;
            }else{
              approx.delete();
            }
          }else{
            approx.delete();
          }
          cnt.delete();
        }
        if(!bestQuad){
          return null;
        }

        const pts = [];
        for(let i=0;i<4;i++){
          const x = bestQuad.intAt(i,0);
          const y = bestQuad.intAt(i,1);
          pts.push([x,y]);
        }
        bestQuad.delete();

        const ordered = orderQuadPoints(pts);
        const size = 900;
        const srcTri = cv.matFromArray(4,1,cv.CV_32FC2, [
          ordered[0][0], ordered[0][1],
          ordered[1][0], ordered[1][1],
          ordered[2][0], ordered[2][1],
          ordered[3][0], ordered[3][1]
        ]);
        const dstTri = cv.matFromArray(4,1,cv.CV_32FC2, [
          0,0, size-1,0, size-1,size-1, 0,size-1
        ]);
        const M = cv.getPerspectiveTransform(srcTri, dstTri);
        const dst = new cv.Mat();
        cv.warpPerspective(src, dst, M, new cv.Size(size, size), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(255,255,255,255));

        const outCanvas = document.createElement('canvas');
        outCanvas.width = size;
        outCanvas.height = size;
        cv.imshow(outCanvas, dst);

        srcTri.delete(); dstTri.delete(); M.delete(); dst.delete();
        return {canvas: outCanvas, x:0, y:0, size};
      }catch(err){
        return null;
      }finally{
        if(src) src.delete();
        if(gray) gray.delete();
        if(blur) blur.delete();
        if(edges) edges.delete();
        if(contours) contours.delete();
        if(hierarchy) hierarchy.delete();
      }
    }

    function orderQuadPoints(pts){
      const sum = pts.map(p=>p[0]+p[1]);
      const diff = pts.map(p=>p[0]-p[1]);
      const tl = pts[sum.indexOf(Math.min(...sum))];
      const br = pts[sum.indexOf(Math.max(...sum))];
      const tr = pts[diff.indexOf(Math.max(...diff))];
      const bl = pts[diff.indexOf(Math.min(...diff))];
      return [tl,tr,br,bl];
    }

    function waitForOpenCv(timeoutMs){
      if(window.cv && cv.Mat) return Promise.resolve(true);
      if(window.__cvWaitPromise) return window.__cvWaitPromise;
      window.__cvWaitPromise = new Promise(resolve=>{
        let done = false;
        const timer = setTimeout(()=>{ if(!done) resolve(false); }, timeoutMs || 4000);
        const finish = ()=>{
          if(done) return;
          done = true;
          clearTimeout(timer);
          resolve(true);
        };
        const hook = ()=>{
          if(window.cv && cv.Mat) finish();
        };
        if(window.cv && !cv.Mat){
          const prev = cv.onRuntimeInitialized;
          cv.onRuntimeInitialized = ()=>{
            if(typeof prev === 'function') prev();
            hook();
          };
        }else{
          const interval = setInterval(()=>{
            if(window.cv && cv.Mat){
              clearInterval(interval);
              finish();
            }
          }, 100);
        }
      });
      return window.__cvWaitPromise;
    }

    function findBestComponent(mask, w, h, opts){
      const visited = new Uint8Array(w*h);
      let best = null;
      const stack = [];
      const minSideLimit = Math.min(w, h) * (opts.minSideRatio || 0.2);
      const densityMin = opts.densityMin ?? 0.01;
      const densityMax = opts.densityMax ?? 0.2;
      for(let y0=0;y0<h;y0++){
        for(let x0=0;x0<w;x0++){
          const idx = y0*w + x0;
          if(!mask[idx] || visited[idx]) continue;
          let minX=x0, minY=y0, maxX=x0, maxY=y0, count=0;
          visited[idx] = 1;
          stack.push(idx);
          while(stack.length){
            const cur = stack.pop();
            const cy = Math.floor(cur / w);
            const cx = cur - cy * w;
            count++;
            if(cx < minX) minX = cx;
            if(cx > maxX) maxX = cx;
            if(cy < minY) minY = cy;
            if(cy > maxY) maxY = cy;

            const n1 = cur - 1, n2 = cur + 1, n3 = cur - w, n4 = cur + w;
            if(cx > 0 && mask[n1] && !visited[n1]){ visited[n1]=1; stack.push(n1); }
            if(cx + 1 < w && mask[n2] && !visited[n2]){ visited[n2]=1; stack.push(n2); }
            if(cy > 0 && mask[n3] && !visited[n3]){ visited[n3]=1; stack.push(n3); }
            if(cy + 1 < h && mask[n4] && !visited[n4]){ visited[n4]=1; stack.push(n4); }
          }
          const boxW = maxX - minX + 1;
          const boxH = maxY - minY + 1;
          const minSide = Math.min(boxW, boxH);
          if(minSide < minSideLimit) continue;
          const area = boxW * boxH;
          const aspect = boxW > boxH ? boxW / boxH : boxH / boxW;
          const density = count / area;
          const sizeScore = minSide / Math.max(w, h);
          const aspectScore = Math.max(0, 1.3 - aspect);
          const densityScore = (density >= densityMin && density <= densityMax) ? 1 : 0;
          const score = sizeScore * 2 + aspectScore + densityScore;
          if(!best || score > best.score){
            best = {minX, minY, maxX, maxY, count, score};
          }
        }
      }
      return best;
    }

    function findGridByEdges(gray, w, h){
      const mag = new Uint16Array(w*h);
      let sum = 0;
      let sum2 = 0;
      let count = 0;
      for(let y0=1;y0<h-1;y0++){
        for(let x0=1;x0<w-1;x0++){
          const i = y0*w + x0;
          const g00 = gray[i - w - 1], g01 = gray[i - w], g02 = gray[i - w + 1];
          const g10 = gray[i - 1],     g12 = gray[i + 1];
          const g20 = gray[i + w - 1], g21 = gray[i + w], g22 = gray[i + w + 1];
          const gx = -g00 - 2*g10 - g20 + g02 + 2*g12 + g22;
          const gy = -g00 - 2*g01 - g02 + g20 + 2*g21 + g22;
          const m = Math.abs(gx) + Math.abs(gy);
          mag[i] = m;
          sum += m;
          sum2 += m * m;
          count++;
        }
      }
      if(count === 0) return null;
      const mean = sum / count;
      const variance = Math.max(0, sum2 / count - mean * mean);
      const std = Math.sqrt(variance);
      const thr = Math.max(40, Math.min(200, mean + std * 0.8));
      const edge = new Uint8Array(w*h);
      for(let i=0;i<mag.length;i++){
        if(mag[i] > thr) edge[i] = 1;
      }
      return findBestComponent(edge, w, h, {densityMin:0.002, densityMax:0.08, minSideRatio:0.2});
    }

    function extractCell(canvas, x, y, size){
      const margin = Math.floor(size * 0.18);
      const srcSize = Math.max(1, size - margin*2);
      const cellCanvas = document.createElement('canvas');
      cellCanvas.width = 32;
      cellCanvas.height = 32;
      const ctx = cellCanvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 32, 32);
      ctx.drawImage(canvas, x + margin, y + margin, srcSize, srcSize, 0, 0, 32, 32);
      const imgData = ctx.getImageData(0, 0, 32, 32);
      const data = imgData.data;
      const hist = new Uint32Array(256);
      for(let i=0;i<data.length;i+=4){
        const lum = Math.round(0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2]);
        hist[lum]++;
      }
      const thresh = otsuThreshold(hist, 32*32);
      const rowBlack = new Uint16Array(32);
      const colBlack = new Uint16Array(32);
      for(let y0=0;y0<32;y0++){
        for(let x0=0;x0<32;x0++){
          const i = (y0*32 + x0) * 4;
          const lum = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
          const v = lum < thresh ? 0 : 255;
          data[i] = data[i+1] = data[i+2] = v;
          if(v === 0){
            rowBlack[y0]++;
            colBlack[x0]++;
          }
        }
      }
      for(let y0=0;y0<32;y0++){
        if(rowBlack[y0] > 24){
          for(let x0=0;x0<32;x0++){
            const i = (y0*32 + x0) * 4;
            data[i] = data[i+1] = data[i+2] = 255;
          }
        }
      }
      for(let x0=0;x0<32;x0++){
        if(colBlack[x0] > 24){
          for(let y0=0;y0<32;y0++){
            const i = (y0*32 + x0) * 4;
            data[i] = data[i+1] = data[i+2] = 255;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
      return cellCanvas;
    }

    function otsuThreshold(hist, total){
      let sum = 0;
      for(let t=0;t<256;t++) sum += t * hist[t];
      let sumB = 0;
      let wB = 0;
      let wF = 0;
      let varMax = 0;
      let threshold = 170;
      for(let t=0;t<256;t++){
        wB += hist[t];
        if(wB === 0) continue;
        wF = total - wB;
        if(wF === 0) break;
        sumB += t * hist[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const varBetween = wB * wF * (mB - mF) * (mB - mF);
        if(varBetween > varMax){
          varMax = varBetween;
          threshold = t;
        }
      }
      return Math.min(230, Math.max(90, threshold));
    }

    async function createOcrWorker(){
      const T = window.Tesseract;
      if(!T || typeof T.recognize !== 'function'){
        throw new Error('Tesseract.js が読み込めません。');
      }
      const params = { tessedit_char_whitelist: '123456789' };
      if(T.PSM && Number.isFinite(T.PSM.SINGLE_CHAR)){
        params.tessedit_pageseg_mode = T.PSM.SINGLE_CHAR;
      }

      if(typeof T.createWorker !== 'function'){
        return {
          recognize: canvas => T.recognize(canvas, 'eng', params)
        };
      }

      const worker = T.createWorker({
        logger: m=>{
          if(!ocrCanceled && m.status === 'recognizing text'){
            setMsg(`OCR解析中... ${Math.round((m.progress || 0) * 100)}%`,'warn');
          }
        }
      });
      if(typeof worker.loadLanguage !== 'function' || typeof worker.initialize !== 'function'){
        return {
          recognize: canvas => T.recognize(canvas, 'eng', params)
        };
      }
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      if(typeof worker.setParameters === 'function'){
        await worker.setParameters(params);
      }
      return worker;
    }

    async function recognizeDigit(worker, canvas, r, c){
      let data;
      try{
        ({ data } = await worker.recognize(canvas));
      }catch(err){
        const where = (Number.isFinite(r) && Number.isFinite(c)) ? `（r${r+1}c${c+1}）` : '';
        throw new Error(`OCR認識に失敗しました${where}: ${err && err.message ? err.message : 'unknown error'}`);
      }
      const text = (data.text || '').replace(/[^1-9]/g,'');
      const digit = text ? Number(text[0]) : 0;
      const confidence = Number.isFinite(data.confidence) ? data.confidence : 0;
      return {digit, confidence};
    }

    function formatOcrError(err){
      if(!err) return '詳細不明。';
      if(err.message && err.message !== 'OCR_CANCELED') return `原因: ${err.message}`;
      return '詳細不明。';
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
