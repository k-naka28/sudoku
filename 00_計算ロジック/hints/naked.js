// hints/naked.js
// Naked Single：候補が 1 個のセルを 1 手として返す
(function(w){
  // cand[r][c] は候補配列（buildCandidates の出力）
  function findNaked(cand){
    for(let r=0;r<9;r++){
      for(let c=0;c<9;c++){
        if(cand[r][c].length === 1){
          const d = cand[r][c][0];
          // app.js の理由分岐に合わせて kind を 'naked-single' に統一
          return { r, c, d, kind: 'naked-single' };
        }
      }
    }
    return null;
  }

  w.SudokuHints = w.SudokuHints || {};
  w.SudokuHints.findNaked = findNaked;
})(window);