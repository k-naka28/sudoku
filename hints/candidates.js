// window.SudokuHints.buildCandidates
(function(w){
  function buildCandidates(g){
    const cand=Array.from({length:9},()=>Array(9).fill(null));
    for(let r=0;r<9;r++)for(let c=0;c<9;c++){
      if(g[r][c]){cand[r][c]=[];continue}
      const s=[];for(let d=1;d<=9;d++){
        let ok=true;
        for(let x=0;x<9;x++){ if(g[r][x]===d||g[x][c]===d){ok=false;break} }
        if(ok){const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;
          for(let dr=0;dr<3;dr++){for(let dc=0;dc<3;dc++){ if(g[br+dr][bc+dc]===d){ok=false;break} } if(!ok)break}
        }
        if(ok)s.push(d);
      }
      cand[r][c]=s;
    }
    return cand;
  }
  w.SudokuHints=w.SudokuHints||{}; w.SudokuHints.buildCandidates=buildCandidates;
})(window);