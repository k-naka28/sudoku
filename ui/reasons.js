// ui/reasons.js
(function(w){
  const rowLabel = r => String(r+1);
  const colLabel = c => String.fromCharCode(65+c);
  const rc = (r,c)=>`${colLabel(c)}${rowLabel(r)}`;
  const rcTag = (r,c)=>`<code>${rc(r,c)}</code>`;
  const boxName = b => `ブロック${b+1}`;
  const listRC = (cells, max=6)=>{
    if(!cells || cells.length===0) return 'なし';
    const arr = cells.map(([r,c])=>rcTag(r,c));
    if(arr.length > max) return `${arr.slice(0,max).join('、')} など（全${arr.length}マス）`;
    return arr.join('、');
  };
  const resultLine = h => h.action === 'eliminate'
    ? '<li><b>結果：</b> 候補を削除できる。</li>'
    : `<li><b>結果：</b> ${rcTag(h.r,h.c)} = <b>${h.d}</b>。</li>`;

  const Reasons = {
    hidden: h => {
      const where = h.kind==='hidden-row' ? `行${rowLabel(h.unit)}` :
                    h.kind==='hidden-col' ? `列${colLabel(h.unit)}` : `ブロック${h.unit+1}`;
      return `
        <div><strong>Hidden Single（${where}）</strong></div>
        <ol>
          <li><b>観察：</b> ${where} で数字 <b>${h.d}</b> を候補に持つのは ${rcTag(h.r,h.c)} <b>だけ</b>。</li>
          <li><b>理由：</b> 単位内では各数字は 1 回のみ。</li>
          <li><b>結論：</b> ${rcTag(h.r,h.c)} = <b>${h.d}</b> が確定。</li>
        </ol>`;
    },
    naked: h => `
      <div><strong>Naked Single</strong></div>
      <ol>
        <li><b>観察：</b> ${rcTag(h.r,h.c)} の候補が <b>${h.d}</b> のみ。</li>
        <li><b>理由：</b> 行・列・ブロック制約で他は矛盾。</li>
        <li><b>結論：</b> ${rcTag(h.r,h.c)} = <b>${h.d}</b>。</li>
      </ol>`,
    pairs: h => {
      const P = `{${h.pair[0]},${h.pair[1]}}`;
      const p1 = h.pairCells ? rcTag(h.pairCells[0][0], h.pairCells[0][1]) : '';
      const p2 = h.pairCells ? rcTag(h.pairCells[1][0], h.pairCells[1][1]) : '';
      if (h.kind === 'naked-pair-row')
        return `
          <div><strong>Naked Pair（行${rowLabel(h.row)}）</strong></div>
          <ol>
            <li><b>観察：</b> ${P} は ${p1} と ${p2} の <b>2マスだけ</b>。</li>
            <li><b>操作：</b> 行${rowLabel(h.row)} の他マスから ${P} を削除。</li>
            ${resultLine(h)}
          </ol>`;
      if (h.kind === 'naked-pair-col')
        return `
          <div><strong>Naked Pair（列${colLabel(h.col)}）</strong></div>
          <ol>
            <li><b>観察：</b> ${P} は ${p1} と ${p2} の 2マスだけ。</li>
            <li><b>操作：</b> 列${colLabel(h.col)} の他マスから ${P} を削除。</li>
            ${resultLine(h)}
          </ol>`;
      if (h.kind === 'naked-pair-box')
        return `
          <div><strong>Naked Pair（${boxName(h.box)}）</strong></div>
          <ol>
            <li><b>観察：</b> ${P} は ${p1} と ${p2} の 2マスだけ。</li>
            <li><b>操作：</b> 同ブロックの他マスから ${P} を削除。</li>
            ${resultLine(h)}
          </ol>`;
      const where = h.kind==='hidden-pair-row' ? `行${rowLabel(h.row)}` :
                    h.kind==='hidden-pair-col' ? `列${colLabel(h.col)}` : boxName(h.box);
      return `
        <div><strong>Hidden Pair（${where}）</strong></div>
        <ol>
          <li><b>観察：</b> 数字 ${P} を置けるのは ${p1} と ${p2} の <b>2マスのみ</b>。</li>
          <li><b>操作：</b> その 2 マスから ${P} 以外を削除（${P} 専用化）。</li>
          ${resultLine(h)}
        </ol>`;
    },
    triples: h => {
      const T = `{${h.triple.join(',')}}`;
      const cells = h.tripleCells.map(([r,c])=>rcTag(r,c)).join('／');
      const where = h.kind.includes('-row') ? `行${rowLabel(h.row)}` :
                    h.kind.includes('-col') ? `列${colLabel(h.col)}` : boxName(h.box);
      if (h.kind.startsWith('naked'))
        return `
          <div><strong>Naked Triple（${where}）</strong></div>
          <ol>
            <li><b>観察：</b> ${cells} の候補合併が <b>${T}</b> の 3 種。</li>
            <li><b>操作：</b> ${where} の他マスから ${T} を削除。</li>
            ${resultLine(h)}
          </ol>`;
      return `
        <div><strong>Hidden Triple（${where}）</strong></div>
        <ol>
          <li><b>観察：</b> ${T} の出現可能位置の和集合が <b>3マス（${cells}）</b>。</li>
          <li><b>操作：</b> その 3 マスから ${T} 以外を削除。</li>
          ${resultLine(h)}
        </ol>`;
    },
    xwing: h => {
      const rows = `${rowLabel(h.rows[0])}・${rowLabel(h.rows[1])}`;
      const cols = `${colLabel(h.cols[0])}・${colLabel(h.cols[1])}`;
      const elim = h.eliminated ? h.eliminated.map(([r,c])=>rcTag(r,c)).slice(0,6).join('、') + (h.eliminated.length>6?` など（全${h.eliminated.length}マス）`:'') : '—';
      if (h.kind==='xwing-row')
        return `
          <div><strong>X-Wing（行基準／数字 ${h.d}）</strong></div>
          <ol>
          <li><b>観察：</b> 行 ${rows} の ${h.d} 候補が 2 列 <b>${cols}</b> に揃う。</li>
          <li><b>操作：</b> その 2 列の他行から ${h.d} を削除（例：${elim}）。</li>
            ${resultLine(h)}
          </ol>`;
      return `
        <div><strong>X-Wing（列基準／数字 ${h.d}）</strong></div>
        <ol>
          <li><b>観察：</b> 列 ${cols} の ${h.d} 候補が 2 行 <b>${rows}</b> に揃う。</li>
          <li><b>操作：</b> その 2 行の他列から ${h.d} を削除（例：${elim}）。</li>
          ${resultLine(h)}
        </ol>`;
    },
    ywing: h => {
      const P = rcTag(h.pivot[0],h.pivot[1]);
      const A = rcTag(h.p1[0],h.p1[1]);
      const B = rcTag(h.p2[0],h.p2[1]);
      const elim = h.eliminated ? h.eliminated.map(([r,c])=>rcTag(r,c)).slice(0,6).join('、') + (h.eliminated.length>6?` など（全${h.eliminated.length}マス）`:'') : '—';
      return `
        <div><strong>Y-Wing（XY-Wing）</strong></div>
        <ol>
          <li><b>観察：</b> ピボット ${P}={${h.x},${h.y}}、ピンサー ${A}={${h.x},${h.z}} と ${B}={${h.y},${h.z}}。</li>
          <li><b>論理：</b> ${P} が ${h.x} なら ${A} は <b>${h.z}</b>、${P} が ${h.y} なら ${B} は <b>${h.z}</b> → A/B どちらかは必ず <b>${h.z}</b>。</li>
          <li><b>操作：</b> A と B の両方から見えるマスから <b>${h.z}</b> を削除（例：${elim}）。</li>
          ${resultLine(h)}
        </ol>`;
    },
    locked: h => {
      const box = boxName(h.box);
      const baseCells = listRC(h.baseCells, 6);
      const elimCells = listRC(h.eliminated, 6);
      if (h.kind === 'locked-pointing-row')
        return `
          <div><strong>Locked Candidates – Pointing（${box} → 行${rowLabel(h.row)}）</strong></div>
          <ol>
            <li><b>観察：</b> ${box} 内の <b>${h.base}</b> 候補が <b>行${rowLabel(h.row)}</b> にだけ存在（${baseCells}）。</li>
            <li><b>理由：</b> ${box} で ${h.base} を置けるのはその行だけ → 同じ行の他ブロックには置けない。</li>
            <li><b>操作：</b> 行${rowLabel(h.row)} の他ブロックから <b>${h.base}</b> を削除（例：${elimCells}）。</li>
            ${resultLine(h)}
          </ol>`;
      if (h.kind === 'locked-pointing-col')
        return `
          <div><strong>Locked Candidates – Pointing（${box} → 列${colLabel(h.col)}）</strong></div>
          <ol>
            <li><b>観察：</b> ${box} 内の <b>${h.base}</b> 候補が <b>列${colLabel(h.col)}</b> にだけ存在（${baseCells}）。</li>
            <li><b>理由：</b> ${box} で ${h.base} を置けるのはその列だけ → 同じ列の他ブロックには置けない。</li>
            <li><b>操作：</b> 列${colLabel(h.col)} の他ブロックから <b>${h.base}</b> を削除（例：${elimCells}）。</li>
            ${resultLine(h)}
          </ol>`;
      if (h.kind === 'locked-claiming-row')
        return `
          <div><strong>Locked Candidates – Claiming（行${rowLabel(h.row)} → ${box}）</strong></div>
          <ol>
            <li><b>観察：</b> 行${rowLabel(h.row)} の <b>${h.base}</b> 候補が ${box} のみ（${baseCells}）。</li>
            <li><b>理由：</b> 行で ${h.base} を置けるのは ${box} だけ → ${box} の他行には置けない。</li>
            <li><b>操作：</b> ${box} の他行から <b>${h.base}</b> を削除（例：${elimCells}）。</li>
            ${resultLine(h)}
          </ol>`;
      return `
        <div><strong>Locked Candidates – Claiming（列${colLabel(h.col)} → ${box}）</strong></div>
        <ol>
          <li><b>観察：</b> 列${colLabel(h.col)} の <b>${h.base}</b> 候補が ${box} のみ（${baseCells}）。</li>
          <li><b>理由：</b> 列で ${h.base} を置けるのは ${box} だけ → ${box} の他列には置けない。</li>
          <li><b>操作：</b> ${box} の他列から <b>${h.base}</b> を削除（例：${elimCells}）。</li>
          ${resultLine(h)}
        </ol>`;
    },
    // ★ 追加：Swordfish（X-Wing の 3 本版）
    swordfish: h => {
      const rows = h.rows.map(r=>rowLabel(r)).join('・');
      const cols = h.cols.map(c=>colLabel(c)).join('・');
      const elim = h.eliminated ? h.eliminated.map(([r,c])=>rcTag(r,c)).slice(0,6).join('、') + (h.eliminated.length>6?` など（全${h.eliminated.length}マス）`:'') : '—';
      if(h.kind==='swordfish-row')
        return `
          <div><strong>Swordfish（行基準／数字 ${h.d}）</strong></div>
          <ol>
            <li><b>観察：</b> 3 行（${rows}）で ${h.d} の候補列が同じ 3 列（<b>${cols}</b>）に限定。</li>
            <li><b>操作：</b> その 3 列の <b>他の行</b>から ${h.d} を削除（例：${elim}）。</li>
            ${resultLine(h)}
          </ol>`;
      // 列基準
      return `
        <div><strong>Swordfish（列基準／数字 ${h.d}）</strong></div>
        <ol>
          <li><b>観察：</b> 3 列（${cols}）で ${h.d} の候補行が同じ 3 行（<b>${rows}</b>）に限定。</li>
          <li><b>操作：</b> その 3 行の <b>他の列</b>から ${h.d} を削除（例：${elim}）。</li>
          ${resultLine(h)}
        </ol>`;
    },
    jellyfish: h => {
      const rows = h.rows.map(r=>rowLabel(r)).join('・');
      const cols = h.cols.map(c=>colLabel(c)).join('・');
      const elim = h.eliminated ? h.eliminated.map(([r,c])=>rcTag(r,c)).slice(0,6).join('、') + (h.eliminated.length>6?` など（全${h.eliminated.length}マス）`:'') : '—';
      if(h.kind==='jellyfish-row')
        return `
          <div><strong>Jellyfish（行基準／数字 ${h.d}）</strong></div>
          <ol>
            <li><b>観察：</b> 4 行（${rows}）で ${h.d} の候補列が同じ 4 列（<b>${cols}</b>）に限定。</li>
            <li><b>操作：</b> その 4 列の <b>他の行</b>から ${h.d} を削除（例：${elim}）。</li>
            ${resultLine(h)}
          </ol>`;
      return `
        <div><strong>Jellyfish（列基準／数字 ${h.d}）</strong></div>
        <ol>
          <li><b>観察：</b> 4 列（${cols}）で ${h.d} の候補行が同じ 4 行（<b>${rows}</b>）に限定。</li>
          <li><b>操作：</b> その 4 行の <b>他の列</b>から ${h.d} を削除（例：${elim}）。</li>
          ${resultLine(h)}
        </ol>`;
    },
    skyscraper: h => {
      const base = listRC(h.baseCells, 4);
      const roof = listRC(h.roofCells, 4);
      const elim = listRC(h.eliminated, 6);
      if(h.kind==='skyscraper-row')
        return `
          <div><strong>Skyscraper（行基準／数字 ${h.d}）</strong></div>
          <ol>
            <li><b>観察：</b> 2 行の ${h.d} 候補が「共有列＋屋根2マス」の形（ベース：${base}／屋根：${roof}）。</li>
            <li><b>理由：</b> 共有列に ${h.d} が入らないなら、屋根のどちらかに必ず入る。</li>
            <li><b>操作：</b> 屋根2マスの両方から見えるマスから <b>${h.d}</b> を削除（例：${elim}）。</li>
            ${resultLine(h)}
          </ol>`;
      return `
        <div><strong>Skyscraper（列基準／数字 ${h.d}）</strong></div>
        <ol>
          <li><b>観察：</b> 2 列の ${h.d} 候補が「共有行＋屋根2マス」の形（ベース：${base}／屋根：${roof}）。</li>
          <li><b>理由：</b> 共有行に ${h.d} が入らないなら、屋根のどちらかに必ず入る。</li>
          <li><b>操作：</b> 屋根2マスの両方から見えるマスから <b>${h.d}</b> を削除（例：${elim}）。</li>
          ${resultLine(h)}
        </ol>`;
    },
    kite: h => {
      const base = listRC(h.baseCells, 4);
      const roof = listRC(h.roofCells, 4);
      const elim = listRC(h.eliminated, 6);
      return `
        <div><strong>Two-String Kite（数字 ${h.d}）</strong></div>
        <ol>
          <li><b>観察：</b> 行${rowLabel(h.row)} と列${colLabel(h.col)} は ${h.d} 候補が2つずつ。うち 2 マスが同一ブロック内（ベース：${base}）。</li>
          <li><b>理由：</b> ベースのどちらかに ${h.d} が入らないなら、屋根（${roof}）のどちらかに必ず入る。</li>
          <li><b>操作：</b> 屋根2マスの両方から見えるマスから <b>${h.d}</b> を削除（例：${elim}）。</li>
          ${resultLine(h)}
        </ol>`;
    },
    xyzwing: h => {
      const P = rcTag(h.pivot[0],h.pivot[1]);
      const A = rcTag(h.p1[0],h.p1[1]);
      const B = rcTag(h.p2[0],h.p2[1]);
      const elim = listRC(h.eliminated, 6);
      return `
        <div><strong>XYZ-Wing</strong></div>
        <ol>
          <li><b>観察：</b> ピボット ${P}={${h.x},${h.y},${h.z}}、ピンサー ${A}={${h.x},${h.z}} と ${B}={${h.y},${h.z}} がピボットから見える。</li>
          <li><b>論理：</b> ピボットが ${h.x}/${h.y} なら、どちらかのピンサーが必ず <b>${h.z}</b>。</li>
          <li><b>操作：</b> ピンサー2マスの両方から見えるマスから <b>${h.z}</b> を削除（例：${elim}）。</li>
          ${resultLine(h)}
        </ol>`;
    },
    // ★ 追加：Quads（Naked/Hidden）
    quads: h => {
      const Q = `{${h.quad.join(',')}}`;
      const cells = h.quadCells.map(([r,c])=>rcTag(r,c)).join('／');
      const where = h.kind.includes('-row') ? `行${rowLabel(h.row)}` :
                    h.kind.includes('-col') ? `列${colLabel(h.col)}` : boxName(h.box);
      if(h.kind.startsWith('naked'))
        return `
          <div><strong>Naked Quad（${where}）</strong></div>
          <ol>
            <li><b>観察：</b> ${cells} の候補合併が <b>${Q}</b> の 4 種に限定。</li>
            <li><b>操作：</b> ${where} の他マスから ${Q} を削除。</li>
            ${resultLine(h)}
          </ol>`;
      return `
        <div><strong>Hidden Quad（${where}）</strong></div>
        <ol>
          <li><b>観察：</b> ${Q} の出現可能位置の和集合が <b>4マス（${cells}）</b>。</li>
          <li><b>操作：</b> その 4 マスから ${Q} 以外を削除。</li>
          ${resultLine(h)}
        </ol>`;
    }
  };

  w.Reasons = Reasons;
})(window);
