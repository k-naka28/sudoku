// window.SudokuHints.findTriples（Naked/Hidden Triple）
// ------------------------------------------------------------
// ■ 目的
//   Triple（3 つ組）で候補を除去し、新しく生じた Naked single を 1 手ヒントとして返す。
//   - Naked Triple: 3 マスの候補の合併がちょうど 3 数字（各セルは候補 2〜3 個）
//                  → 単位内の他セルからその 3 数字を除去
//   - Hidden Triple: 3 数字 {a,b,c} の“出現可能なセル”がちょうど 3 マスに限定
//                  → その 3 マスから {a,b,c} 以外を除去
//
// ■ 厳密条件（Hidden Triple）
//   - 各数字 a,b,c が単位内で少なくとも 1 回は候補に現れる
//   - pos[a]・pos[b]・pos[c] の和集合が“ちょうど 3 セル”
//     （その 3 セル以外には a,b,c は置けない → 他候補を消せる）
// ------------------------------------------------------------
(function(w){
  const clone = cand => cand.map(row=>row.map(a=>a.slice()));
  const newSingle=(next,prev)=>{
    for(let r=0;r<9;r++)for(let c=0;c<9;c++)
      if(prev[r][c].length!==1 && next[r][c].length===1) return {r,c,d:next[r][c][0]};
    return null;
  };

  // 単位ユーティリティ
  const rowCells = r => Array.from({length:9},(_,c)=>[r,c]);
  const colCells = c => Array.from({length:9},(_,r)=>[r,c]);
  const boxCells = b => {
    const br=Math.floor(b/3)*3, bc=(b%3)*3;
    return Array.from({length:9},(_,i)=>[br+Math.floor(i/3), bc+(i%3)]);
  };

  // ---- Naked Triple ----
  function tryNakedInUnit(getCells, label){
    return function(cand){
      for(let u=0; u<9; u++){
        const cells = getCells(u).filter(([r,c])=>cand[r][c].length>=2 && cand[r][c].length<=3);
        for(let i=0;i<cells.length;i++){
          for(let j=i+1;j<cells.length;j++){
            for(let k=j+1;k<cells.length;k++){
              const cc=[cells[i],cells[j],cells[k]];
              const digSet = new Set();
              for(const [r,c] of cc) cand[r][c].forEach(d=>digSet.add(d));
              if(digSet.size!==3) continue; // 合併が 3 種でない
              const digs=[...digSet].sort((a,b)=>a-b);

              const next=clone(cand); let changed=false;
              const keep = new Set(cc.map(([r,c])=>`${r},${c}`));
              for(const [r,c] of getCells(u)){
                if(keep.has(`${r},${c}`)) continue;
                for(const d of digs){
                  const arr=next[r][c]; const ix=arr.indexOf(d);
                  if(ix>=0){ arr.splice(ix,1); changed=true; }
                }
              }
              if(!changed) continue;
              const s=newSingle(next,cand);
              if(s){
                const payload={ triple:digs, tripleCells:cc };
                if(label==='row') return {...s,kind:'naked-triple-row',row:u,...payload};
                if(label==='col') return {...s,kind:'naked-triple-col',col:u,...payload};
                return {...s,kind:'naked-triple-box',box:u,...payload};
              }
            }
          }
        }
      }
      return null;
    };
  }

  // ---- Hidden Triple（厳密版）----
  function tryHiddenInUnit(getCells, label){
    return function(cand){
      for(let u=0; u<9; u++){
        const cells = getCells(u);
        const pos = Array.from({length:10},()=>[]);
        for(const [r,c] of cells) for(const d of cand[r][c]) pos[d].push([r,c]);

        // 3 数字 a<b<c の全列挙
        for(let a=1; a<=7; a++){
          for(let b=a+1; b<=8; b++){
            for(let c=b+1; c<=9; c++){
              const A=pos[a], B=pos[b], C=pos[c];
              if(A.length===0 || B.length===0 || C.length===0) continue; // 各数字が 1 回以上出現
              const unionKey = new Set([...A,...B,...C].map(([r,cc])=>`${r},${cc}`));
              if(unionKey.size!==3) continue; // 和集合がちょうど 3 セル
              const union = [...unionKey].map(s=>s.split(',').map(Number));

              const next=clone(cand); let changed=false;
              for(const [r,cc] of union){
                const filtered = next[r][cc].filter(x=>x===a||x===b||x===c);
                if(filtered.length !== next[r][cc].length){ next[r][cc]=filtered; changed=true; }
              }
              if(!changed) continue;

              const s=newSingle(next,cand);
              if(s){
                const payload={ triple:[a,b,c], tripleCells:union };
                if(label==='row') return {...s,kind:'hidden-triple-row',row:u,...payload};
                if(label==='col') return {...s,kind:'hidden-triple-col',col:u,...payload};
                return {...s,kind:'hidden-triple-box',box:u,...payload};
              }
            }
          }
        }
      }
      return null;
    };
  }

  function findTriples(cand){
    return tryNakedInUnit(rowCells,'row')(cand) || tryNakedInUnit(colCells,'col')(cand) || tryNakedInUnit(boxCells,'box')(cand)
        || tryHiddenInUnit(rowCells,'row')(cand) || tryHiddenInUnit(colCells,'col')(cand) || tryHiddenInUnit(boxCells,'box')(cand)
        || null;
  }

  w.SudokuHints = w.SudokuHints || {};
  w.SudokuHints.findTriples = findTriples;
})(window);