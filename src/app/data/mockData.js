export const mockTransactions = [
  { id: 1, date: '26/03/10', account: '미래에셋 연금저축', stock: 'KODEX 미국배당커버드콜액티브', type: '매수', quantity: 233, price: 12845, amount: 2992885, stockCode: '458730' },
  { id: 2, date: '26/03/09', account: '미래에셋 DC', stock: 'KODEX 미국배당커버드콜액티브', type: '매수', quantity: 781, price: 12815, amount: 10008515, stockCode: '458730' },
  { id: 3, date: '26/03/09', account: '미래에셋 DC', stock: 'PLUS 고배당주', type: '매수', quantity: 407, price: 24540, amount: 9987780, stockCode: '161510' },
  { id: 4, date: '26/03/09', account: '미래에셋 DC', stock: 'RISE 머니마켓액티브', type: '매도', quantity: 366, price: 54625, amount: 19992750, stockCode: '452280' },
  { id: 5, date: '26/03/09', account: '미래에셋 IRP', stock: 'KODEX TDF2050액티브', type: '매수', quantity: 1, price: 16275, amount: 16275, stockCode: '433040' },
  { id: 6, date: '26/03/09', account: '미래에셋 연금저축', stock: 'KODEX 미국배당커버드콜액티브', type: '매수', quantity: 9, price: 12890, amount: 116010, stockCode: '458730' },
  { id: 7, date: '26/03/09', account: '미래에셋 IRP', stock: 'TIGER 미국배당다우존스', type: '매수', quantity: 6, price: 14470, amount: 86820, stockCode: '458730' },
  { id: 8, date: '26/03/09', account: '미래에셋 연금저축', stock: 'TIGER 미국배당다우존스', type: '매수', quantity: 7, price: 14465, amount: 101255, stockCode: '458730' },
  // Adding more data to reach 305 items (31 pages)
  ...Array.from({ length: 297 }, (_, i) => ({
    id: i + 9,
    date: `25/${(Math.floor(i/28)%12 + 1).toString().padStart(2, '0')}/${(i % 28 + 1).toString().padStart(2, '0')}`,
    account: ['미래에셋 연금저축', '미래에셋 DC', '미래에셋 IRP', '신한은행 DC'][i % 4],
    stock: ['KODEX 미국배당커버드콜액티브', 'PLUS 고배당주', 'RISE 머니마켓액티브', 'TIGER 미국배당다우존스'][i % 4],
    type: i % 5 === 0 ? '매도' : '매수',
    quantity: 10 + i,
    price: 15000 + (i * 100),
    amount: (10 + i) * (15000 + (i * 100)),
    stockCode: ['458730', '161510', '452280', '458730'][i % 4]
  }))
];

export const mockTrendData = [
  // 월별 데이터 (기존)
  { date: '2025-09-23', buy: 420000000, value: 430000000, rate: 2.38 },
  { date: '2025-10-08', buy: 480000000, value: 495000000, rate: 3.12 },
  { date: '2025-10-24', buy: 485000000, value: 510000000, rate: 5.15 },
  { date: '2025-11-09', buy: 490000000, value: 505000000, rate: 3.06 },
  { date: '2025-11-25', buy: 495000000, value: 520000000, rate: 5.05 },
  { date: '2025-12-11', buy: 500000000, value: 535000000, rate: 7.00 },
  { date: '2025-12-27', buy: 505000000, value: 530000000, rate: 4.95 },
  { date: '2026-01-12', buy: 510000000, value: 545000000, rate: 6.86 },
  { date: '2026-01-27', buy: 515000000, value: 560000000, rate: 8.74 },
  { date: '2026-02-11', buy: 520000000, value: 590000000, rate: 13.46 },
  { date: '2026-02-26', buy: 525000000, value: 605000000, rate: 15.24 },
  { date: '2026-03-13', buy: 528880643, value: 610214875, rate: 15.38 },
];

export const mockDailyTrendData = [
  // 최근 3개월 일별 데이터
  { date: '2025-12-15', buy: 502000000, value: 532000000, rate: 5.98 },
  { date: '2025-12-16', buy: 502500000, value: 535000000, rate: 6.47 },
  { date: '2025-12-17', buy: 503000000, value: 531000000, rate: 5.56 },
  { date: '2025-12-18', buy: 503500000, value: 538000000, rate: 6.87 },
  { date: '2025-12-19', buy: 504000000, value: 541000000, rate: 7.34 },
  { date: '2025-12-22', buy: 504500000, value: 539000000, rate: 6.83 },
  { date: '2025-12-23', buy: 505000000, value: 542000000, rate: 7.33 },
  { date: '2025-12-24', buy: 505000000, value: 537000000, rate: 6.34 },
  { date: '2025-12-26', buy: 505000000, value: 530000000, rate: 4.95 },
  { date: '2025-12-29', buy: 506000000, value: 540000000, rate: 6.72 },
  { date: '2025-12-30', buy: 506500000, value: 545000000, rate: 7.60 },
  { date: '2025-12-31', buy: 507000000, value: 548000000, rate: 8.09 },
  
  // 2026년 1월
  { date: '2026-01-02', buy: 507500000, value: 546000000, rate: 7.54 },
  { date: '2026-01-05', buy: 508000000, value: 551000000, rate: 8.46 },
  { date: '2026-01-06', buy: 508500000, value: 549000000, rate: 7.97 },
  { date: '2026-01-07', buy: 509000000, value: 553000000, rate: 8.64 },
  { date: '2026-01-08', buy: 509500000, value: 556000000, rate: 9.12 },
  { date: '2026-01-09', buy: 510000000, value: 552000000, rate: 8.24 },
  { date: '2026-01-12', buy: 510000000, value: 545000000, rate: 6.86 },
  { date: '2026-01-13', buy: 510500000, value: 558000000, rate: 9.30 },
  { date: '2026-01-14', buy: 511000000, value: 560000000, rate: 9.59 },
  { date: '2026-01-15', buy: 511500000, value: 557000000, rate: 8.90 },
  { date: '2026-01-16', buy: 512000000, value: 562000000, rate: 9.77 },
  { date: '2026-01-19', buy: 512500000, value: 565000000, rate: 10.24 },
  { date: '2026-01-20', buy: 513000000, value: 561000000, rate: 9.36 },
  { date: '2026-01-21', buy: 513500000, value: 568000000, rate: 10.66 },
  { date: '2026-01-22', buy: 514000000, value: 571000000, rate: 11.07 },
  { date: '2026-01-23', buy: 514500000, value: 567000000, rate: 10.20 },
  { date: '2026-01-26', buy: 515000000, value: 574000000, rate: 11.46 },
  { date: '2026-01-27', buy: 515000000, value: 560000000, rate: 8.74 },
  { date: '2026-01-28', buy: 515500000, value: 577000000, rate: 11.92 },
  { date: '2026-01-29', buy: 516000000, value: 580000000, rate: 12.40 },
  { date: '2026-01-30', buy: 516500000, value: 576000000, rate: 11.53 },
  
  // 2026년 2월
  { date: '2026-02-02', buy: 517000000, value: 583000000, rate: 12.77 },
  { date: '2026-02-03', buy: 517500000, value: 586000000, rate: 13.16 },
  { date: '2026-02-04', buy: 518000000, value: 580000000, rate: 11.97 },
  { date: '2026-02-05', buy: 518500000, value: 589000000, rate: 13.55 },
  { date: '2026-02-06', buy: 519000000, value: 592000000, rate: 14.07 },
  { date: '2026-02-09', buy: 519500000, value: 585000000, rate: 12.61 },
  { date: '2026-02-10', buy: 520000000, value: 595000000, rate: 14.42 },
  { date: '2026-02-11', buy: 520000000, value: 590000000, rate: 13.46 },
  { date: '2026-02-12', buy: 520500000, value: 598000000, rate: 14.89 },
  { date: '2026-02-13', buy: 521000000, value: 601000000, rate: 15.35 },
  { date: '2026-02-16', buy: 521500000, value: 596000000, rate: 14.29 },
  { date: '2026-02-17', buy: 522000000, value: 604000000, rate: 15.71 },
  { date: '2026-02-18', buy: 522500000, value: 607000000, rate: 16.19 },
  { date: '2026-02-19', buy: 523000000, value: 602000000, rate: 15.11 },
  { date: '2026-02-20', buy: 523500000, value: 610000000, rate: 16.53 },
  { date: '2026-02-23', buy: 524000000, value: 613000000, rate: 16.98 },
  { date: '2026-02-24', buy: 524500000, value: 608000000, rate: 15.92 },
  { date: '2026-02-25', buy: 525000000, value: 615000000, rate: 17.14 },
  { date: '2026-02-26', buy: 525000000, value: 605000000, rate: 15.24 },
  { date: '2026-02-27', buy: 525500000, value: 618000000, rate: 17.69 },
  
  // 2026년 3월
  { date: '2026-03-02', buy: 526000000, value: 612000000, rate: 16.35 },
  { date: '2026-03-03', buy: 526500000, value: 620000000, rate: 17.80 },
  { date: '2026-03-04', buy: 527000000, value: 616000000, rate: 16.89 },
  { date: '2026-03-05', buy: 527500000, value: 623000000, rate: 18.10 },
  { date: '2026-03-06', buy: 528000000, value: 619000000, rate: 17.23 },
  { date: '2026-03-09', buy: 528500000, value: 626000000, rate: 18.45 },
  { date: '2026-03-10', buy: 529000000, value: 622000000, rate: 17.58 },
  { date: '2026-03-11', buy: 529500000, value: 628000000, rate: 18.62 },
  { date: '2026-03-12', buy: 530000000, value: 624000000, rate: 17.74 },
  { date: '2026-03-13', buy: 528880643, value: 610214875, rate: 15.38 },
];

export const mockDividendData = [
  { month: '24/01', amount: 120000 },
  { month: '24/02', amount: 350000 },
  { month: '24/03', amount: 280000 },
  { month: '24/04', amount: 410000 },
  { month: '24/05', amount: 390000 },
  { month: '24/06', amount: 304731 },
  { month: '24/07', amount: 450000 },
  { month: '24/08', amount: 520000 },
  { month: '24/09', amount: 480000 },
  { month: '24/10', amount: 550000 },
  { month: '24/11', amount: 620000 },
  { month: '24/12', amount: 580000 },
  { month: '25/01', amount: 650000 },
  { month: '25/02', amount: 590000 },
  { month: '25/03', amount: 720000 },
  { month: '25/04', amount: 680000 },
  { month: '25/05', amount: 750000 },
  { month: '25/06', amount: 820000 },
  { month: '25/07', amount: 790000 },
  { month: '25/08', amount: 950000 },
  { month: '25/09', amount: 880000 },
  { month: '25/10', amount: 1200000 },
  { month: '25/11', amount: 2400000 },
  { month: '25/12', amount: 1500000 },
  { month: '26/01', amount: 1900000 },
  { month: '26/02', amount: 2100000 },
  { month: '26/03', amount: 852150 },
];

export const mockHoldingsData = [
  {
    name: 'PLUS 고배당주',
    symbol: '161510',
    price: 26175,
    change: -0.60,
    totalQuantity: 5702,
    avgPrice: 20188,
    totalBuy: 115107780,
    totalValue: 149249850,
    profit: 34052070,
    profitRate: 29.58,
    dividend: 2202810,
    accounts: [
      { name: '김철수 미래에셋 DC', quantity: 5702, avgPrice: 20188, buy: 115107780, value: 149249850, profit: 34052070, profitRate: 29.58, dividend: 2202810 }
    ]
  },
  {
    name: 'TIGER 미국배당다우존스',
    symbol: '458730',
    price: 14425,
    change: -0.60,
    totalQuantity: 8233,
    avgPrice: 11235,
    totalBuy: 92500119,
    totalValue: 118761025,
    profit: 26260906,
    profitRate: 28.39,
    dividend: 6346667,
    accounts: [
      { name: '미래에셋 연금저축', quantity: 2342, avgPrice: 11406, buy: 26897234, value: 24610550, profit: -1662506, profitRate: -25.43, dividend: 1752357 },
      { name: '미래에셋 IRP', quantity: 2288, avgPrice: 12559, buy: 28147180, value: 32715300, profit: 9283720, profitRate: 33.52, dividend: 2055135 },
      { name: '미래에셋 연금저축', quantity: 2886, avgPrice: 11777, buy: 33938159, value: 43000500, profit: 13910344, profitRate: 33.65, dividend: 1855271 }
    ]
  },
  {
    name: 'KODEX TDF2050액티브',
    symbol: '433040',
    price: 16455,
    change: -0.60,
    totalQuantity: 6484,
    avgPrice: 15295,
    totalBuy: 99174321,
    totalValue: 106694220,
    profit: 7519899,
    profitRate: 7.58,
    dividend: 959224,
    accounts: [
      { name: '미래에셋 IRP', quantity: 857, avgPrice: 12028, buy: 10203114, value: 14101235, profit: 3755026, profitRate: 33.80, dividend: 201225 },
      { name: '미래에셋 DC', quantity: 4581, avgPrice: 15728, buy: 72053530, textDecoration: 'red', value: 75324750, profit: 3085116, profitRate: 4.19, dividend: 615550 }
    ]
  }
];
