(() => {
  const nav = document.querySelector('.sidebar nav');
  // The dedicated detail-page app owns its complete navigation. Do not run
  // the legacy translation-menu enhancer there, or it inserts duplicate links.
  if (location.port === '3031' || nav?.querySelector('.detailAppNav')) return;
  // Navigation is now rendered centrally by sidebar-nav.js. Keep this file
  // harmless for legacy pages that still load it.
  if (nav?.querySelector('#detailNavToggle')) return;
  const translator = nav?.querySelector('a[href^="/translator.html"]');
  if (!nav || !translator || document.querySelector('#localizationNavToggle')) return;

  const duplicate = nav.querySelector('a[href="/shopee-description.html"]');
  if (duplicate) duplicate.remove();

  const current = location.pathname;
  const expanded = current === '/shopee-description.html' || current === '/translator.html';
  const wrapper = document.createElement('div');
  wrapper.className = 'localizationMenu';
  wrapper.innerHTML = `
    <button class="localizationNavTitle" id="localizationNavToggle" type="button" aria-expanded="${expanded}">
      <i>文</i><strong>상세페이지 번역</strong><span class="localizationArrow">⌄</span>
    </button>
    <div class="localizationNav ${expanded ? '' : 'collapsed'}" id="localizationNav">
      <a class="localizationUnifiedLink ${current === '/translator.html' ? 'active' : ''}" href="/translator.html" target="_blank" rel="noopener">이미지 상세페이지 번역 <small>Qoo10 · Shopee · Rakuten · Amazon</small></a>
      <a class="localizationUnifiedLink shopeeDescription ${current === '/shopee-description.html' ? 'active' : ''}" href="/shopee-description.html">상품 설명문 <small>Shopee 필수</small></a>
    </div>`;

  translator.replaceWith(wrapper);
  const toggle = wrapper.querySelector('#localizationNavToggle');
  const list = wrapper.querySelector('#localizationNav');
  toggle.onclick = () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    list.classList.toggle('collapsed', !open);
  };
})();
