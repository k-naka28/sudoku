// ocr/scan.js
// window.SudokuOcrScan: 画像から盤面キャンバスを抽出
(function(w){
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
      if(window.cv && !cv.Mat){
        const prev = cv.onRuntimeInitialized;
        cv.onRuntimeInitialized = ()=>{
          if(typeof prev === 'function') prev();
          finish();
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

  function extractGridCanvas(img){
    if(!window.cv || !cv.Mat) return {error:'OpenCVが利用できません。'};
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    if(w < 200 || h < 200) return {error:'画像が小さすぎます。'};

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = w;
    srcCanvas.height = h;
    const sctx = srcCanvas.getContext('2d');
    sctx.drawImage(img, 0, 0, w, h);

    let src, gray, blur, bin, contours, hierarchy, kernel, dilated;
    try{
      src = cv.imread(srcCanvas);
      gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
      blur = new cv.Mat();
      cv.GaussianBlur(gray, blur, new cv.Size(5,5), 0);
      bin = new cv.Mat();
      cv.adaptiveThreshold(blur, bin, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
      kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3,3));
      dilated = new cv.Mat();
      cv.dilate(bin, dilated, kernel);

      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

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
        return {error:'盤面の枠が見つかりませんでした。'};
      }

      const pts = [];
      for(let i=0;i<4;i++){
        pts.push([bestQuad.intAt(i,0), bestQuad.intAt(i,1)]);
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

      const cleanedCanvas = cleanGrid(dst, size);

      srcTri.delete(); dstTri.delete(); M.delete(); dst.delete();
      return {canvas: outCanvas, cleanedCanvas, size};
    }catch(err){
      return {error:'OpenCV解析に失敗しました。'};
    }finally{
      if(src) src.delete();
      if(gray) gray.delete();
      if(blur) blur.delete();
      if(bin) bin.delete();
      if(kernel) kernel.delete();
      if(dilated) dilated.delete();
      if(contours) contours.delete();
      if(hierarchy) hierarchy.delete();
    }
  }

  function cleanGrid(warped, size){
    let gray, bin, hKernel, vKernel, hLines, vLines, gridLines, digits, cleaned;
    try{
      gray = new cv.Mat();
      cv.cvtColor(warped, gray, cv.COLOR_RGBA2GRAY, 0);
      bin = new cv.Mat();
      cv.adaptiveThreshold(gray, bin, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);

      hKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(25,1));
      vKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1,25));
      hLines = new cv.Mat();
      vLines = new cv.Mat();
      cv.morphologyEx(bin, hLines, cv.MORPH_OPEN, hKernel);
      cv.morphologyEx(bin, vLines, cv.MORPH_OPEN, vKernel);

      gridLines = new cv.Mat();
      cv.add(hLines, vLines, gridLines);
      digits = new cv.Mat();
      cv.subtract(bin, gridLines, digits);
      cleaned = new cv.Mat();
      cv.bitwise_not(digits, cleaned);

      const out = document.createElement('canvas');
      out.width = size;
      out.height = size;
      cv.imshow(out, cleaned);
      return out;
    }catch(err){
      return null;
    }finally{
      if(gray) gray.delete();
      if(bin) bin.delete();
      if(hKernel) hKernel.delete();
      if(vKernel) vKernel.delete();
      if(hLines) hLines.delete();
      if(vLines) vLines.delete();
      if(gridLines) gridLines.delete();
      if(digits) digits.delete();
      if(cleaned) cleaned.delete();
    }
  }

  function extractCell(gridCanvas, r, c, size){
    const cellSize = Math.floor(size / 9);
    const margin = Math.floor(cellSize * 0.18);
    const srcSize = Math.max(1, cellSize - margin * 2);
    const cellCanvas = document.createElement('canvas');
    cellCanvas.width = 32;
    cellCanvas.height = 32;
    const ctx = cellCanvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,32,32);
    ctx.drawImage(
      gridCanvas,
      c * cellSize + margin,
      r * cellSize + margin,
      srcSize,
      srcSize,
      0, 0, 32, 32
    );
    return stripLines(cellCanvas);
  }

  function stripLines(cellCanvas){
    const ctx = cellCanvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, 32, 32);
    const data = imgData.data;
    const rowBlack = new Uint16Array(32);
    const colBlack = new Uint16Array(32);
    for(let y=0;y<32;y++){
      for(let x=0;x<32;x++){
        const i = (y*32 + x) * 4;
        const lum = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
        if(lum < 150){
          rowBlack[y]++;
          colBlack[x]++;
        }
      }
    }
    for(let y=0;y<32;y++){
      if(rowBlack[y] > 24){
        for(let x=0;x<32;x++){
          const i = (y*32 + x) * 4;
          data[i] = data[i+1] = data[i+2] = 255;
        }
      }
    }
    for(let x=0;x<32;x++){
      if(colBlack[x] > 24){
        for(let y=0;y<32;y++){
          const i = (y*32 + x) * 4;
          data[i] = data[i+1] = data[i+2] = 255;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return cellCanvas;
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

  w.SudokuOcrScan = {waitForOpenCv, extractGridCanvas, extractCell};
})(window);
