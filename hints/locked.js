// window.SudokuHints.findLocked（Locked Candidates）
// ------------------------------------------------------------
// ■ 目的
//   Locked Candidates は「ブロックと行/列の組合せ」で候補を制限する手筋。
//   - Pointing: ブロック内で数字 d の候補が“同一行（または同一列）”にしか無い
//               → その行（列）の“他ブロック部分”から d を消去
//   - Claiming: 行（列）内で数字 d の候補が“同一ブロック”にしか無い
//               → そのブロックの“他行（列）”から d を消去
//
//   本実装は「消去の結果、新しい Naked single が生まれたら 1 手だけ提示」します。
// ------------------------------------------------------------
(function(w){
  const clone = cand => cand.map(row=>row.map(a=>a.slice()));
  const bix = (r,c)=>Math.floor(r/3)*3+Math.floor(c/3);
  const newSingle=(next,prev)=>{for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(prev[r][c].length!==1&&next[r][c].length===1)return{r,c,d:next[r][c][0]};return null};

  function findLocked(cand){
    // Pointing（箱→行/列）
    for(let b=0;b<9;b++){
      const br=Math.floor(b/3)*3,bc=(b%3)*3;
      for(let d=1;d<=9;d++){
        const pos=[]; for(let dr=0;dr<3;dr++)for(let dc=0;dc<3;dc++){const r=br+dr,c=bc+dc;if(cand[r][c].includes(d))pos.push([r,c])}
        if(pos.length<2) continue; // 2個以上ないと“同一直線”判断の旨味がない
        const sameRow=pos.every(([r])=>r===pos[0][0]), sameCol=pos.every(([,c])=>c===pos[0][1]);
        if(sameRow){
          const r=pos[0][0], next=clone(cand); let ch=false;
          for(let c=0;c<9;c++) if(c<bc||c>bc+2){const a=next[r][c];const i=a.indexOf(d); if(i>=0){a.splice(i,1); ch=true}}
          if(ch){const s=newSingle(next,cand); if(s) return {...s,kind:'locked-pointing-row',box:b,row:r,base:d} }
        }
        if(sameCol){
          const c=pos[0][1], next=clone(cand); let ch=false;
          for(let r=0;r<9;r++) if(r<br||r>br+2){const a=next[r][c];const i=a.indexOf(d); if(i>=0){a.splice(i,1); ch=true}}
          if(ch){const s=newSingle(next,cand); if(s) return {...s,kind:'locked-pointing-col',box:b,col:c,base:d} }
        }
      }
    }
    // Claiming（行/列→箱）
    for(let r=0;r<9;r++)for(let d=1;d<=9;d++){
      const pos=[]; for(let c=0;c<9;c++) if(cand[r][c].includes(d)) pos.push([r,c]);
      if(pos.length>=2){
        const b=bix(pos[0][0],pos[0][1]); // 最初のブロック
        if(pos.every(p=>bix(...p)===b)){
          const br=Math.floor(b/3)*3,bc=(b%3)*3,next=clone(cand);let ch=false;
          for(let dr=0;dr<3;dr++)for(let dc=0;dc<3;dc++){
            const rr=br+dr,cc=bc+dc;
            if(rr!==r){ const a=next[rr][cc]; const i=a.indexOf(d); if(i>=0){a.splice(i,1); ch=true} }
          }
          if(ch){const s=newSingle(next,cand); if(s) return {...s,kind:'locked-claiming-row',box:b,row:r,base:d} }
        }
      }
    }
    for(let c=0;c<9;c++)for(let d=1;d<=9;d++){
      const pos=[]; for(let r=0;r<9;r++) if(cand[r][c].includes(d)) pos.push([r,c]);
      if(pos.length>=2){
        const b=bix(pos[0][0],pos[0][1]);
        if(pos.every(p=>bix(...p)===b)){
          const br=Math.floor(b/3)*3,bc=(b%3)*3,next=clone(cand);let ch=false;
          for(let dr=0;dr<3;dr++)for(let dc=0;dc<3;dc++){
            const rr=br+dr,cc=bc+dc;
            if(cc!==c){ const a=next[rr][cc]; const i=a.indexOf(d); if(i>=0){a.splice(i,1); ch=true} }
          }
          if(ch){const s=newSingle(next,cand); if(s) return {...s,kind:'locked-claiming-col',box:b,col:c,base:d} }
        }
      }
    }
    return null;
  }

  w.SudokuHints = w.SudokuHints || {};
  w.SudokuHints.findLocked = findLocked;
})(window);