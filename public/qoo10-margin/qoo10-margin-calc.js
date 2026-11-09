// Qoo10 일본 역직구 마진 계산 — 사내 「큐텐(Qoo10)_일본역직구_마진계산기.xlsx」(2026.09.02) 로직을 그대로 옮긴 모듈.
// 브라우저(<script>)와 Node(require) 양쪽에서 쓸 수 있다. 환율은 앱 공통 규칙대로 "1엔당 원화"(엑셀의 100엔당 870 = 8.7).
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  if (typeof root !== 'undefined') root.Qoo10MarginCalc = mod;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  // KSE 해상 요율표 [무게 상한 kg, 배송비 JPY]. 0.1~15kg 표준화물 / 15.5~30kg 이형화물(해상).
  const KSE_SEA_RATES = [
    [0.1,450],[0.3,525],[0.5,590],[0.75,680],[1,720],[1.25,760],[1.5,810],[1.75,860],[2,910],[2.5,950],[3,1020],[3.5,1110],[4,1170],[4.5,1230],
    [5,1340],[5.5,1460],[6,1530],[6.5,1610],[7,1680],[7.5,1760],[8,1830],[8.5,1900],[9,1980],[9.5,2040],[10,2120],[10.5,2190],[11,2270],[11.5,2340],
    [12,2420],[12.5,2490],[13,2560],[13.5,2640],[14,2720],[14.5,2780],[15,2860],[15.5,2940],[16,3020],[16.5,3110],[17,3180],[17.5,3260],[18,3350],
    [18.5,3430],[19,3510],[19.5,3600],[20,3680],[20.5,1760],[21,3830],[21.5,3930],[22,3980],[22.5,4050],[23,4120],[23.5,4270],[24,4300],[24.5,4330],
    [25,4400],[25.5,4460],[26,4550],[26.5,4630],[27,4700],[27.5,4770],[28,4840],[28.5,4910],[29,4960],[29.5,4980],[30,5090],
  ];
  // 엑셀 원본의 20.5kg 구간(¥1,760)은 앞뒤(¥3,680 / ¥3,830) 대비 오타로 보이며 엑셀에도 경고가 달려 있다.
  // 무게가 늘면 요금이 줄어드는 구간이 생기면 마진이 부풀어 보이므로, 직전 구간보다 싼 값은 직전 구간 값으로 보정한다.
  const RATE_TABLE = KSE_SEA_RATES.reduce((acc, [kg, fee]) => { acc.push([kg, Math.max(fee, acc.length ? acc[acc.length - 1][1] : 0)]); return acc; }, []);

  const QOO10_MARGIN_CONFIG = {
    currency: 'JPY',
    exchangeRate: 8.7,              // KRW per 1 JPY (엑셀 기본 870/100엔)
    categoryFeePercent: 10,
    overseasSaleFeeApplied: true,   // +2%
    reservationFeeApplied: false,   // +2%
    externalAdFeeApplied: false,    // +1%
    megaDiscountFeeApplied: false,  // +1%
    vatApplied: false,              // 서비스수수료 합계의 10% (사업자등록 시 면제)
    domesticDeliveryPackagingKrw: 3000,
    exportDeclarationKrw: 0,
    targetMarginPercent: 40,
    advertisingPercent: 0,
    vatRefundEnabled: false,
    volumetricDivisor: 6000,
    customsApplied: true,
    customsThresholdJpy: 16666,
    customsRatePercent: 10,
    listingDiscountPercent: 30,
    salePriceRoundDigits: 0,
    // 메가와리(Co-funding 쿠폰) — 행사 시에만 쓴다. 판매가의 couponDiscountPercent% 쿠폰을 큐텐/셀러가 나눠 부담하고,
    // 셀러 부담분(판매가 × 할인율 × 셀러 부담비율)이 정산액에서 빠진다. 수수료·관세는 쿠폰 적용 전 판매가 기준으로 계산(보수적).
    megaCouponApplied: false,
    couponDiscountPercent: 20,
    couponSellerSharePercent: 50,
    couponMinDiscountJpy: 100,      // 쿠폰 할인액 하한(미만이면 쿠폰 미적용)
    couponMaxDiscountJpy: 10000,    // 쿠폰 할인액 상한
    shopCouponJpy: 0,               // SHOP 쿠폰(셀러 100% 부담) 할인액
    shopCouponMinPriceJpy: 0,       // SHOP 쿠폰 적용 최소 구매액(메가와리 쿠폰 적용가 기준)
  };

  const num = (v, d) => { if (v === null || v === undefined || v === '') return d === undefined ? 0 : d; const n = Number(v); return Number.isFinite(n) ? n : (d === undefined ? 0 : d); };
  const roundTo = (v, digits) => { const f = Math.pow(10, digits); return Math.round(v * f) / f; };

  function computeVolumetricWeightKg(w, l, h, divisor) {
    w = num(w); l = num(l); h = num(h);
    return (!w || !l || !h) ? 0 : (w * l * h) / num(divisor, 6000);
  }
  // 청구중량 이상인 첫 구간의 요금. 30kg 초과면 null(KSE 문의).
  function lookupKseSeaFee(chargeableKg) {
    const row = RATE_TABLE.find(([kg]) => kg >= chargeableKg);
    return row ? row[1] : null;
  }

  // input: { productCostKrw, actualWeightKg, widthCm, lengthCm, heightCm, actualSalePriceJpy, exchangeRate(KRW/JPY), ...QOO10_MARGIN_CONFIG 필드 }
  function computeQoo10Margin(input) {
    const c = Object.assign({}, QOO10_MARGIN_CONFIG);
    for (const k of Object.keys(QOO10_MARGIN_CONFIG)) if (input[k] !== undefined && input[k] !== null && input[k] !== '') c[k] = input[k];
    const rate = num(c.exchangeRate, QOO10_MARGIN_CONFIG.exchangeRate);
    const productCostKrw = num(input.productCostKrw);

    const volumetricWeightKg = computeVolumetricWeightKg(input.widthCm, input.lengthCm, input.heightCm, c.volumetricDivisor);
    const chargeableWeightKg = Math.max(num(input.actualWeightKg), volumetricWeightKg);
    const shippingJpy = lookupKseSeaFee(chargeableWeightKg);
    const shippingKrw = shippingJpy == null ? null : shippingJpy * rate;

    const feeBasePercent = num(c.categoryFeePercent) + (c.overseasSaleFeeApplied ? 2 : 0) + (c.reservationFeeApplied ? 2 : 0) + (c.externalAdFeeApplied ? 1 : 0) + (c.megaDiscountFeeApplied ? 1 : 0);
    const feeRate = feeBasePercent / 100 * (1 + (c.vatApplied ? 0.1 : 0));
    const adRate = num(c.advertisingPercent) / 100;
    const targetRate = num(c.targetMarginPercent) / 100;

    const vatRefundKrw = c.vatRefundEnabled ? productCostKrw / 11 : 0;
    const fixedCostKrw = productCostKrw - vatRefundKrw + num(c.domesticDeliveryPackagingKrw) + num(c.exportDeclarationKrw);
    const fixedCostJpy = rate ? fixedCostKrw / rate : 0;

    const denominator = 1 - feeRate - adRate - targetRate;
    let recommendedJpy = null, recommendedError = null;
    if (shippingJpy == null) recommendedError = '청구중량 30kg 초과 — KSE에 별도 문의 필요';
    else if (denominator <= 0) recommendedError = '수수료·광고비와 목표 마진율 합계가 100% 이상입니다';
    else recommendedJpy = (fixedCostJpy + shippingJpy) / denominator;
    const roundedRecommendedJpy = recommendedJpy != null ? roundTo(recommendedJpy, num(c.salePriceRoundDigits)) : null;

    const raw = Number(input.actualSalePriceJpy);
    const hasActual = input.actualSalePriceJpy != null && input.actualSalePriceJpy !== '' && Number.isFinite(raw) && raw > 0;
    const saleJpy = hasActual ? raw : roundedRecommendedJpy;

    let couponJpy = null, couponKrw = null, megaDiscountJpy = null, shopCouponAppliedJpy = null, couponPriceJpy = null, promoPriceJpy = null;
    let feeJpy = null, adJpy = null, customsJpy = null, settlementJpy = null, revenueKrw = null, profitKrw = null, marginRate = null, verdict = null;
    if (saleJpy != null && shippingJpy != null && rate) {
      feeJpy = saleJpy * feeRate;
      adJpy = saleJpy * adRate;
      customsJpy = (c.customsApplied && saleJpy > num(c.customsThresholdJpy)) ? saleJpy * num(c.customsRatePercent) / 100 : 0;
      // 메가와리 쿠폰: 판매가의 할인율%(상한/하한 적용). SHOP 쿠폰은 메가와리 적용가가 최소 구매액 이상일 때 추가로 빠진다.
      if (c.megaCouponApplied) {
        const rawDiscount = saleJpy * num(c.couponDiscountPercent) / 100;
        megaDiscountJpy = Math.min(rawDiscount, num(c.couponMaxDiscountJpy, 10000));
        if (megaDiscountJpy < num(c.couponMinDiscountJpy, 100)) megaDiscountJpy = 0;
      } else megaDiscountJpy = 0;
      couponPriceJpy = saleJpy - megaDiscountJpy;
      shopCouponAppliedJpy = (c.megaCouponApplied && num(c.shopCouponJpy) > 0 && couponPriceJpy >= num(c.shopCouponMinPriceJpy)) ? num(c.shopCouponJpy) : 0;
      promoPriceJpy = couponPriceJpy - shopCouponAppliedJpy;
      // 셀러 부담 = 메가와리 쿠폰의 셀러 분담분 + SHOP 쿠폰 전액
      couponJpy = megaDiscountJpy * num(c.couponSellerSharePercent) / 100 + shopCouponAppliedJpy;
      couponKrw = couponJpy * rate;
      settlementJpy = saleJpy - feeJpy - customsJpy - adJpy - couponJpy;
      revenueKrw = saleJpy * rate;
      profitKrw = settlementJpy * rate - fixedCostKrw - shippingKrw;
      marginRate = revenueKrw ? profitKrw / revenueKrw : null;
      if (marginRate != null) verdict = marginRate >= targetRate - 0.002 ? '목표 달성' : marginRate > 0 ? '목표 미달' : '적자';
    }
    const beDen = 1 - feeRate - adRate;
    const breakEvenJpy = (shippingJpy != null && beDen > 0) ? (fixedCostJpy + shippingJpy) / beDen : null;
    const listingDiscount = num(c.listingDiscountPercent) / 100;
    const listingPriceJpy = (recommendedJpy != null && listingDiscount < 1) ? recommendedJpy / (1 - listingDiscount) : null;

    return {
      volumetricWeightKg, chargeableWeightKg, shippingJpy, shippingKrw,
      feeBasePercent, feeRate, vatRefundKrw, fixedCostKrw, fixedCostJpy,
      recommendedJpy, roundedRecommendedJpy, recommendedError, listingPriceJpy,
      isUsingActualSalePrice: hasActual, saleJpy, feeJpy, adJpy, customsJpy, couponJpy, couponKrw, megaDiscountJpy, couponPriceJpy, shopCouponAppliedJpy, promoPriceJpy, settlementJpy,
      revenueKrw, profitKrw, marginRate, breakEvenJpy, verdict,
      feeKrw: feeJpy != null ? feeJpy * rate : null,
      adKrw: adJpy != null ? adJpy * rate : null,
      customsKrw: customsJpy != null ? customsJpy * rate : null,
      currency: 'JPY', exchangeRate: rate,
    };
  }

  // 큐텐 MD 특가 행사(TS1) — 특가가격으로 판매하고, 셀러가 Q포인트(1pt=1엔)를 소비자에게 지급한다.
  // 소비자체감가 = 특가가격 − Q포인트. 수수료·관세는 특가가격 기준, Q포인트는 셀러 100% 부담으로 보고 정산에서 차감한다.
  // 메가와리/SHOP 쿠폰은 중복 적용하지 않는다(megaCouponApplied 강제 해제). 한정수량 소진 후엔 backupPriceJpy로 일반 계산.
  // input: computeQoo10Margin 입력 + { specialPriceJpy, qPointJpy, limitedQty, backupPriceJpy }
  function computeQoo10EventMargin(input) {
    const special = num(input.specialPriceJpy);
    const qPoint = num(input.qPointJpy);
    const base = computeQoo10Margin(Object.assign({}, input, { actualSalePriceJpy: special, megaCouponApplied: false, shopCouponJpy: 0 }));
    const rate = base.exchangeRate;
    let eventProfitKrw = null, eventMarginRate = null, perUnitKrw = null, totalProfitKrw = null, verdict = null;
    if (base.profitKrw != null) {
      eventProfitKrw = base.profitKrw - qPoint * rate;
      eventMarginRate = base.revenueKrw ? eventProfitKrw / base.revenueKrw : null;
      perUnitKrw = eventProfitKrw;
      totalProfitKrw = eventProfitKrw * num(input.limitedQty);
      verdict = eventProfitKrw <= 0 ? '적자' : '흑자';
    }
    const backup = num(input.backupPriceJpy) > 0 ? computeQoo10Margin(Object.assign({}, input, { actualSalePriceJpy: num(input.backupPriceJpy), megaCouponApplied: false, shopCouponJpy: 0 })) : null;
    return {
      specialPriceJpy: special, qPointJpy: qPoint, consumerPriceJpy: special - qPoint,
      discountFromListPercent: num(input.listPriceJpy) > 0 ? (1 - (special - qPoint) / num(input.listPriceJpy)) * 100 : null,
      qPointKrw: qPoint * rate, settlementJpy: base.settlementJpy != null ? base.settlementJpy - qPoint : null,
      eventProfitKrw, eventMarginRate, perUnitKrw, totalProfitKrw, verdict,
      breakEvenSpecialJpy: base.breakEvenJpy != null ? base.breakEvenJpy + qPoint / (1 - base.feeRate - num(base.adJpy && base.saleJpy ? base.adJpy / base.saleJpy : 0)) : null,
      backup, base,
    };
  }

  return { QOO10_MARGIN_CONFIG, KSE_RATE_TABLE: RATE_TABLE, computeVolumetricWeightKg, lookupKseSeaFee, computeQoo10Margin, computeQoo10EventMargin };
});
