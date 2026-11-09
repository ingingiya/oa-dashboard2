// 상품 마진 표 헤더 클릭 정렬(오름차순 ↔ 내림차순). 헤더(th)에 data-sort="키"를 달면 클릭 대상이 된다.
// 값이 없는 행(원가 미설정 등)은 정렬 방향과 상관없이 맨 아래에 둔다.
// TableSort.create(table, cb)로 표마다 독립된 정렬 상태를 만든다. TableSort.init/sort/clear는 첫 번째 표용 단축형.
window.TableSort = (() => {
  const style = document.createElement('style');
  style.textContent = 'th[data-sort]{cursor:pointer;user-select:none;white-space:nowrap}th[data-sort]:hover{color:#2563eb}th[data-sort]::after{content:"↕";margin-left:4px;font-size:11px;opacity:.35}th[data-sort][aria-sort=ascending]::after{content:"▲";opacity:1;color:#2563eb}th[data-sort][aria-sort=descending]::after{content:"▼";opacity:1;color:#2563eb}';
  document.head.appendChild(style);
  function create(table, onChange) {
    let state = null;
    const paint = () => table.querySelectorAll('th[data-sort]').forEach(th => {
      if (state && state.key === th.dataset.sort) th.setAttribute('aria-sort', state.dir === 'asc' ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
    table.querySelector('thead').addEventListener('click', e => {
      if (e.target.closest('input,button,select')) return;
      const th = e.target.closest('th[data-sort]'); if (!th) return;
      const key = th.dataset.sort;
      state = state && state.key === key ? { key, dir: state.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
      paint(); onChange();
    });
    return {
      clear() { if (!state) return; state = null; paint(); },
      // rows를 헤더 정렬 상태로 정렬(정렬 상태가 없으면 false). getters: { 키: row => 값(없으면 null) }
      sort(rows, getters) {
        if (!state || !getters[state.key]) return false;
        const get = getters[state.key], dir = state.dir === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
          const x = get(a), y = get(b);
          const xn = x == null || x === '' || (typeof x === 'number' && !Number.isFinite(x));
          const yn = y == null || y === '' || (typeof y === 'number' && !Number.isFinite(y));
          if (xn || yn) return xn === yn ? 0 : xn ? 1 : -1;
          return (typeof x === 'string' ? x.localeCompare(y, 'ko') : x - y) * dir;
        });
        return true;
      },
    };
  }
  let main = null;
  return {
    create,
    init(table, cb) { main = create(table, cb); },
    clear() { main?.clear(); },
    sort(rows, getters) { return main ? main.sort(rows, getters) : false; },
  };
})();
