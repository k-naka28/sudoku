// ocr/index.js
// window.SudokuOCR: UIと画像処理の統合
(function(w){
  function init(opts){
    const ocrBtn = document.getElementById(opts.buttonId || 'ocr');
    const ocrCancel = document.getElementById(opts.cancelId || 'ocrCancel');
    const ocrFile = document.getElementById(opts.fileId || 'ocrFile');
    if(!ocrBtn || !ocrFile) return;

    let canceled = false;
    ocrBtn.addEventListener('click', ()=> ocrFile.click());
    ocrFile.addEventListener('change', async ()=>{
      const file = ocrFile.files && ocrFile.files[0];
      ocrFile.value = '';
      if(!file) return;
      await run(file);
    });

    if(ocrCancel){
      ocrCancel.addEventListener('click', ()=>{
        canceled = true;
        setBusy(false);
        opts.setMsg('OCRを中止しました。','warn');
      });
    }

    function setBusy(busy){
      ocrBtn.disabled = busy;
      if(ocrCancel) ocrCancel.hidden = !busy;
    }

    async function run(file){
      canceled = false;
      setBusy(true);
      opts.setMsg('画像を読み込み中...','warn');
      try{
        const img = await loadImage(file);
        const cvReady = await w.SudokuOcrScan.waitForOpenCv(5000);
        if(!cvReady){
          opts.setMsg('OpenCVの読み込みに失敗しました。','err');
          return;
        }
        opts.setMsg('盤面を検出中...','warn');
        const prep = w.SudokuOcrScan.extractGridCanvas(img);
        if(prep.error){
          opts.setMsg(`画像の解析に失敗しました。${prep.error}`,'err');
          return;
        }
        if(!prep.canvas){
          opts.setMsg('画像の解析に失敗しました。盤面が見つかりません。','err');
          return;
        }
        const size = prep.size || prep.canvas.width;
        const cellSize = Math.floor(size / 9);
        if(cellSize < 8){
          opts.setMsg('盤面が小さすぎて解析できません。','err');
          return;
        }

        const grid = Array.from({length:9},()=>Array(9).fill(0));
        const lowConf = [];
        for(let r=0;r<9;r++){
          for(let c=0;c<9;c++){
            if(canceled) return;
            const cellCanvas = w.SudokuOcrScan.extractCell(prep.canvas, r, c, size);
            const res = w.SudokuTemplateOCR.matchDigit(cellCanvas);
            if(res.digit){
              grid[r][c] = res.digit;
              if(res.score < 0.55) lowConf.push([r,c]);
            }
            opts.setMsg(`画像を解析中... ${r*9 + c + 1}/81`,'warn');
          }
        }

        const note = lowConf.length ? `低信頼セル: ${lowConf.length}（オレンジ枠）` : '低信頼セルなし';
        opts.onApply(grid, lowConf);
        opts.setMsg(`画像取り込み完了。${note}`,'ok');
      }catch(err){
        opts.setMsg(`画像の解析に失敗しました。原因: ${err && err.message ? err.message : '不明'}`,'err');
      }finally{
        setBusy(false);
      }
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

  w.SudokuOCR = {init};
})(window);
