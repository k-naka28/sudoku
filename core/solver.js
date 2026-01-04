// window.SudokuCore: 解法と検証
(function(w){
  const boxIndex=(r,c)=>Math.floor(r/3)*3+Math.floor(c/3);
  const isRowValid=(g,r)=>{const s=new Set();for(let c=0;c<9;c++){const v=g[r][c];if(v){if(s.has(v))return false;s.add(v)}}return true};
  const isColValid=(g,c)=>{const s=new Set();for(let r=0;r<9;r++){const v=g[r][c];if(v){if(s.has(v))return false;s.add(v)}}return true};
  const isBoxValid=(g,b)=>{const s=new Set(),br=Math.floor(b/3)*3,bc=(b%3)*3;
    for(let dr=0;dr<3;dr++)for(let dc=0;dc<3;dc++){const v=g[br+dr][bc+dc];if(v){if(s.has(v))return false;s.add(v)}}return true};
  const validGrid=g=>{for(let i=0;i<9;i++){if(!isRowValid(g,i)||!isColValid(g,i)||!isBoxValid(g,i))return false}return true};

  function solve(grid){
    const g=grid.map(r=>r.slice()), rows=Array.from({length:9},()=>new Set()),
      cols=Array.from({length:9},()=>new Set()), boxes=Array.from({length:9},()=>new Set()),
      empties=[];
    for(let r=0;r<9;r++)for(let c=0;c<9;c++){const v=g[r][c]; if(v){rows[r].add(v);cols[c].add(v);boxes[boxIndex(r,c)].add(v)} else empties.push([r,c])}
    const cands=(r,c)=>{const a=[];for(let d=1;d<=9;d++) if(!rows[r].has(d)&&!cols[c].has(d)&&!boxes[boxIndex(r,c)].has(d)) a.push(d); return a};
    const pick=()=>{let bi=-1,bl=10,blist=null;for(let i=0;i<empties.length;i++){const[r,c]=empties[i];if(g[r][c]!==0)continue;const l=cands(r,c);if(l.length<bl){bi=i;bl=l.length;blist=l;if(bl<=1)break}}return{bi,blist}};
    const bt=()=>{for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(g[r][c]===0){const{bi,blist}=pick();if(bi===-1)return true;const[rr,cc]=empties[bi];const L=blist||cands(rr,cc);if(L.length===0)return false;for(const d of L){g[rr][cc]=d;rows[rr].add(d);cols[cc].add(d);boxes[boxIndex(rr,cc)].add(d);if(bt())return true;g[rr][cc]=0;rows[rr].delete(d);cols[cc].delete(d);boxes[boxIndex(rr,cc)].delete(d)}return false}return true};
    return bt()?{ok:true,grid:g}:{ok:false};
  }

  w.SudokuCore={boxIndex,isRowValid,isColValid,isBoxValid,validGrid,solve};
})(window);