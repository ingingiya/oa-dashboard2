(() => {
  const CHANNELS = ['Qoo10', 'Rakuten', 'Amazon US', 'Shopee'];
  const nav = document.querySelector('.sidebar nav');
  const marginHref = channel => channel === 'Shopee' ? '/shopee-margins.html' : `/channel-margins.html?channel=${encodeURIComponent(channel)}`;
  const operationGroup = ({ name, letter }) => `<div class="channelNavGroup" data-operation-channel="${name}"><a href="/?salesChannel=${encodeURIComponent(name)}#work"><span>${letter}</span> ${name}</a><a class="onboardingLink" data-operation-sub="dashboard" href="/?salesChannel=${encodeURIComponent(name)}#work">대시보드</a><a class="onboardingLink" data-operation-sub="orders" href="/orders.html?channel=${encodeURIComponent(name)}">주문 관리</a><a class="onboardingLink" data-operation-sub="margin" href="${marginHref(name)}">상품 마진</a></div>`;
  const OPERATION_CHANNELS = [{ name: 'Qoo10', letter: 'Q' }, { name: 'Rakuten', letter: 'R' }, { name: 'Amazon US', letter: 'A' }, { name: 'Shopee', letter: 'S' }];
  if (!nav) return;

  const path = location.pathname;
  const activeClass = href => (path === href ? ' class="active"' : '');
  const isDetailApp = location.port === '3031';
  const detailPages = ['/thumbnail-overlay.html', '/promo-banner.html', '/translator.html', '/shopee-description.html', '/translation-glossary.html'];
  const detailLinks = `
    <a class="detailNavLink ${path === '/thumbnail-overlay.html' ? 'active' : ''}" href="/thumbnail-overlay.html"><span>◧</span><b>썸네일 오버레이 편집</b><small>뱃지·카피·띠 얹기 · 800px JPG</small></a>
    <a class="detailNavLink ${path === '/promo-banner.html' ? 'active' : ''}" href="/promo-banner.html"><span>▤</span><b>프로모션 배너 편집</b><small>큐텐 행사 배너 · 1MB JPG</small></a>
    <a class="detailNavLink ${path === '/translator.html' ? 'active' : ''}" href="/translator.html" target="_blank" rel="noopener"><span>文</span><b>이미지 상세페이지 번역</b><small>Qoo10 · Shopee · Rakuten · Amazon</small></a>
    <a class="detailNavLink ${path === '/shopee-description.html' ? 'active' : ''}" href="/shopee-description.html"><span>S</span><b>상품 설명문 작성</b><small>Shopee 상품 등록용</small></a>
    <a class="detailNavLink ${path === '/translation-glossary.html' ? 'active' : ''}" href="/translation-glossary.html"><span>가</span><b>회사 번역 사전</b><small>검수 확정 표현 관리</small></a>`;

  if (isDetailApp) {
    const brand = document.querySelector('.sidebar .brand');
    if (brand) {
      brand.href = '/thumbnail-overlay.html';
      brand.innerHTML = '<span>OS</span><strong>해외영업<br>상세페이지 제작</strong>';
    }
    const sideFoot = document.querySelector('.sidebar .sideFoot');
    if (sideFoot) sideFoot.innerHTML = '해외영업 상세페이지 제작<br><small>채널별 판매 콘텐츠 제작 도구</small>';
    nav.innerHTML = `<span class="navLabel navSectionLabel">해외영업 상세페이지 제작</span><div class="detailNav detailAppNav" aria-label="상세페이지 제작 도구">${detailLinks}</div>`;
    return;
  }

  // 통합 대시보드에는 운영 기능만 유지한다. 상세페이지 제작은 3031 전용 앱에서 제공한다.
  nav.innerHTML = `
    <span class="navLabel navSectionLabel">운영 대시보드</span>
    <a${activeClass('/')} href="/"><i>▦</i> 매출 현황</a>
    <a${activeClass('/orders.html')} href="/orders.html"><i>▤</i> 주문 관리</a>
    <button class="channelNavTitle" id="channelNavToggle" type="button" aria-expanded="false" aria-controls="channelNav"><i>◎</i><strong>해외채널 입점 프로세스</strong><span class="channelNavArrow">⌄</span></button>
    <div class="channelNav collapsed" id="channelNav" aria-label="판매채널 바로가기">
      <div class="channelNavGroup" data-channel-group="Qoo10"><a href="/?channel=Qoo10#work" data-channel-link="Qoo10"><span>Q</span> Qoo10</a><a class="onboardingLink" href="/?channel=Qoo10&view=onboarding#work">입점현황</a></div>
      <div class="channelNavGroup" data-channel-group="Rakuten"><a href="/?channel=Rakuten#work" data-channel-link="Rakuten"><span>R</span> Rakuten</a><a class="onboardingLink" href="/?channel=Rakuten&view=onboarding#work">입점현황</a></div>
      <div class="channelNavGroup" data-channel-group="Amazon US"><a href="/?channel=Amazon%20US#work" data-channel-link="Amazon US"><span>A</span> Amazon US</a><a class="onboardingLink" href="/?channel=Amazon%20US&view=onboarding#work">입점현황</a></div>
      <div class="channelNavGroup" data-channel-group="Shopee"><a href="/?channel=Shopee#work" data-channel-link="Shopee"><span>S</span> Shopee</a><a class="onboardingLink" href="/?channel=Shopee&view=onboarding#work">입점현황</a></div>
    </div>
    <button class="channelNavTitle" id="operationNavToggle" type="button" aria-expanded="false" aria-controls="operationNav"><i>↗</i><strong>해외 채널 운영 현황</strong><span class="channelNavArrow">⌄</span></button>
    <div class="channelNav collapsed" id="operationNav" aria-label="해외 채널 운영 현황">
${OPERATION_CHANNELS.map(operationGroup).join('')}
    </div>
    <a${activeClass('/products.html')} href="/products.html"><i>▣</i> 상품·인증서 관리</a>
    <span class="navLabel">준비 중</span>
    <a class="disabled" href="#"><i>⌁</i> 경쟁사 분석</a>`;

  const channelNavToggle = nav.querySelector('#channelNavToggle');
  const channelNav = nav.querySelector('#channelNav');
  const operationNavToggle = nav.querySelector('#operationNavToggle');
  const operationNav = nav.querySelector('#operationNav');
  const setExpanded = (toggle, list, expanded) => { list.classList.toggle('collapsed', !expanded); toggle.setAttribute('aria-expanded', String(expanded)); };
  channelNavToggle.addEventListener('click', () => setExpanded(channelNavToggle, channelNav, channelNavToggle.getAttribute('aria-expanded') !== 'true'));
  operationNavToggle.addEventListener('click', () => setExpanded(operationNavToggle, operationNav, operationNavToggle.getAttribute('aria-expanded') !== 'true'));

  const params = new URLSearchParams(location.search);
  const requestedOperationChannel = path === '/shopee-margins.html' ? 'Shopee' : (params.get('salesChannel') || params.get('channel'));
  if (CHANNELS.includes(requestedOperationChannel)) {
    setExpanded(operationNavToggle, operationNav, true);
    const group = nav.querySelector(`[data-operation-channel="${requestedOperationChannel}"]`);
    group?.classList.add('selected');
    group?.querySelector('a')?.classList.add('selected');
    const sub = path === '/orders.html' ? 'orders' : (path === '/shopee-margins.html' || path === '/channel-margins.html') ? 'margin' : 'dashboard';
    group?.querySelector(`[data-operation-sub="${sub}"]`)?.classList.add('selected');
  }
})();
