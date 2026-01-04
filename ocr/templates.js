// ocr/templates.js
// window.SudokuTemplateOCR: テンプレートマッチで数字推定
(function(w){
  const TEMPLATE_SIZE = 32;
  const DIGIT_SIZE = 24;
  const MIN_BLACK = 18;
  const templates = buildTemplates();

  function buildTemplates(){
    const fonts = [
      '900 28px serif',
      '900 28px sans-serif',
      '900 28px monospace',
      '900 28px "Times New Roman"',
      '900 28px "Arial Black"'
    ];
    const sizes = [24, 26, 28];
    const list = [];
    for(let d=1; d<=9; d++){
      for(const fontBase of fonts){
        for(const size of sizes){
          const font = fontBase.replace(/\d+px/, `${size}px`);
          const canvas = renderDigit(d, font);
          const vec = canvasToVector(canvas);
          list.push({d, vec});
        }
      }
    }
    return list;
  }

  function renderDigit(d, font){
    const canvas = document.createElement('canvas');
    canvas.width = TEMPLATE_SIZE;
    canvas.height = TEMPLATE_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
    ctx.fillStyle = '#000';
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(d), TEMPLATE_SIZE/2, TEMPLATE_SIZE/2 + 1);
    return normalizeDigit(canvas);
  }

  function normalizeDigit(canvas){
    const data = canvas.getContext('2d').getImageData(0,0,TEMPLATE_SIZE,TEMPLATE_SIZE).data;
    let minX=TEMPLATE_SIZE, minY=TEMPLATE_SIZE, maxX=0, maxY=0, count=0;
    for(let y=0;y<TEMPLATE_SIZE;y++){
      for(let x=0;x<TEMPLATE_SIZE;x++){
        const i = (y*TEMPLATE_SIZE + x) * 4;
        const lum = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
        if(lum < 200){
          count++;
          if(x < minX) minX = x;
          if(x > maxX) maxX = x;
          if(y < minY) minY = y;
          if(y > maxY) maxY = y;
        }
      }
    }
    if(count === 0) return canvas;
    const w = Math.max(1, maxX - minX + 1);
    const h = Math.max(1, maxY - minY + 1);
    const crop = document.createElement('canvas');
    crop.width = DIGIT_SIZE;
    crop.height = DIGIT_SIZE;
    const ctx = crop.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,DIGIT_SIZE,DIGIT_SIZE);
    ctx.drawImage(canvas, minX, minY, w, h, 0, 0, DIGIT_SIZE, DIGIT_SIZE);

    const out = document.createElement('canvas');
    out.width = TEMPLATE_SIZE;
    out.height = TEMPLATE_SIZE;
    const octx = out.getContext('2d');
    octx.fillStyle = '#fff';
    octx.fillRect(0,0,TEMPLATE_SIZE,TEMPLATE_SIZE);
    const offset = Math.floor((TEMPLATE_SIZE - DIGIT_SIZE)/2);
    octx.drawImage(crop, offset, offset);
    return out;
  }

  function canvasToVector(canvas){
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0,0,TEMPLATE_SIZE,TEMPLATE_SIZE).data;
    const vec = new Float32Array(TEMPLATE_SIZE*TEMPLATE_SIZE);
    let k = 0;
    let blackCount = 0;
    for(let i=0;i<data.length;i+=4){
      const lum = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
      const v = lum < 200 ? 1 : 0;
      vec[k++] = v;
      if(v) blackCount++;
    }
    return {vec, blackCount};
  }

  function prepareCell(cellCanvas){
    const ctx = cellCanvas.getContext('2d');
    const data = ctx.getImageData(0,0,TEMPLATE_SIZE,TEMPLATE_SIZE).data;
    const hist = new Uint32Array(256);
    for(let i=0;i<data.length;i+=4){
      const lum = Math.round(0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2]);
      hist[lum]++;
    }
    const thresh = otsuThreshold(hist, TEMPLATE_SIZE*TEMPLATE_SIZE);

    let minX=TEMPLATE_SIZE, minY=TEMPLATE_SIZE, maxX=0, maxY=0, black=0;
    const bin = new Uint8Array(TEMPLATE_SIZE*TEMPLATE_SIZE);
    let idx=0;
    for(let y=0;y<TEMPLATE_SIZE;y++){
      for(let x=0;x<TEMPLATE_SIZE;x++){
        const i = (y*TEMPLATE_SIZE + x) * 4;
        const lum = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
        const v = lum < thresh ? 1 : 0;
        bin[idx++] = v;
        if(v){
          black++;
          if(x < minX) minX = x;
          if(x > maxX) maxX = x;
          if(y < minY) minY = y;
          if(y > maxY) maxY = y;
        }
      }
    }
    if(black < MIN_BLACK) return {vec:null, blackCount:black};

    const w = Math.max(1, maxX - minX + 1);
    const h = Math.max(1, maxY - minY + 1);
    const crop = document.createElement('canvas');
    crop.width = DIGIT_SIZE;
    crop.height = DIGIT_SIZE;
    const cctx = crop.getContext('2d');
    cctx.fillStyle = '#fff';
    cctx.fillRect(0,0,DIGIT_SIZE,DIGIT_SIZE);
    cctx.drawImage(cellCanvas, minX, minY, w, h, 0, 0, DIGIT_SIZE, DIGIT_SIZE);

    const norm = document.createElement('canvas');
    norm.width = TEMPLATE_SIZE;
    norm.height = TEMPLATE_SIZE;
    const nctx = norm.getContext('2d');
    nctx.fillStyle = '#fff';
    nctx.fillRect(0,0,TEMPLATE_SIZE,TEMPLATE_SIZE);
    const offset = Math.floor((TEMPLATE_SIZE - DIGIT_SIZE)/2);
    nctx.drawImage(crop, offset, offset);

    return canvasToVector(norm);
  }

  function cosineSimilarity(a, b){
    let dot=0, na=0, nb=0;
    for(let i=0;i<a.length;i++){
      const av = a[i];
      const bv = b[i];
      dot += av * bv;
      na += av * av;
      nb += bv * bv;
    }
    if(na === 0 || nb === 0) return 0;
    return dot / Math.sqrt(na * nb);
  }

  function matchDigit(cellCanvas){
    const prep = prepareCell(cellCanvas);
    if(!prep.vec) return {digit:0, score:0};

    let best = {digit:0, score:0};
    for(const t of templates){
      const score = cosineSimilarity(prep.vec, t.vec.vec);
      if(score > best.score){
        best = {digit: t.d, score};
      }
    }
    return best;
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

  w.SudokuTemplateOCR = {matchDigit};
})(window);
