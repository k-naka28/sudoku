// window.SudokuHints.findHidden（行→列→ブロック）
(function(w){
  function findHidden(cand){
    // row
    for(let r=0;r<9;r++){
      const cnt=Array(10).fill(0), last=Array(10).fill(null);
      for(let c=0;c<9;c++) for(const d of cand[r][c]){cnt[d]++;last[d]=[r,c]}
      for(let d=1;d<=9;d++) if(cnt[d]===1){const[rr,cc]=last[d]; return {r:rr,c:cc,d,kind:'hidden-row',unit:r}}
    }
    // col
    for(let c=0;c<9;c++){
      const cnt=Array(10).fill(0), last=Array(10).fill(null);
      for(let r=0;r<9;r++) for(const d of cand[r][c]){cnt[d]++;last[d]=[r,c]}
      for(let d=1;d<=9;d++) if(cnt[d]===1){const[rr,cc]=last[d]; return {r:rr,c:cc,d,kind:'hidden-col',unit:c}}
    }
    // box
    for(let b=0;b<9;b++){
      const br=Math.floor(b/3)*3, bc=(b%3)*3, cnt=Array(10).fill(0), last=Array(10).fill(null);
      for(let dr=0;dr<3;dr++) for(let dc=0;dc<3;dc++){ const r=br+dr,c=bc+dc; for(const d of cand[r][c]){cnt[d]++;last[d]=[r,c]} }
      for(let d=1;d<=9;d++) if(cnt[d]===1){const[rr,cc]=last[d]; return {r:rr,c:cc,d,kind:'hidden-box',unit:b}}
    }
    return null;
  }
  w.SudokuHints=w.SudokuHints||{}; w.SudokuHints.findHidden=findHidden;
})(window);