const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 10000,
  pingTimeout: 20000,
});

const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '6208';
const STARTING_CASH = 1000000; // 100만 원

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/host', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

app.get('/api/qr', async (req, res) => {
  try {
    const targetUrl = req.query.url || `${req.protocol}://${req.get('host')}/`;
    const dataUrl = await QRCode.toDataURL(targetUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    res.json({ dataUrl, targetUrl });
  } catch (err) {
    res.status(500).json({ error: 'QR 생성 실패' });
  }
});

// ---------------------------------------------------------------------------
// 가상 상장 종목 (10개 업종/테마)
// ---------------------------------------------------------------------------
const STOCK_CATALOG = [
  {
    code: 'SEMI',
    name: '한빛반도체',
    sector: '반도체',
    emoji: '💾',
    initialPrice: 12000,
    volatility: 'HIGH',
    desc: 'AI 가속기용 HBM 및 파운드리 주력 기업. 글로벌 설비투자 및 수출 규제에 민감.',
  },
  {
    code: 'AUTO',
    name: '태극모터스',
    sector: '자동차',
    emoji: '🚗',
    initialPrice: 10000,
    volatility: 'MEDIUM',
    desc: '하이브리드·전기차 글로벌 완성차 제조사. 북미 판매량과 환율·관세 영향이 큼.',
  },
  {
    code: 'AIRL',
    name: '스카이항공',
    sector: '항공',
    emoji: '✈️',
    initialPrice: 8000,
    volatility: 'HIGH',
    desc: '국제선 여객 및 항공 화물 운송사. 국제 유가·환율·여행 수요에 따라 크게 등락.',
  },
  {
    code: 'FINC',
    name: '세이프금융',
    sector: '금융',
    emoji: '🏦',
    initialPrice: 10000,
    volatility: 'LOW',
    desc: '대형 금융지주. 금리 변동에 반응하며 매 라운드 장 마감 시 보유 평가액의 4% 배당 지급.',
  },
  {
    code: 'CONS',
    name: '데일리푸드',
    sector: '소비재',
    emoji: '🛒',
    initialPrice: 7000,
    volatility: 'LOW',
    desc: '필수 식음료·유통 기업. 경기 방어주 성격이 강하며 원재료 곡물가와 내수 소비에 연동.',
  },
  {
    code: 'COSM',
    name: '루나코스메틱',
    sector: '화장품',
    emoji: '💄',
    initialPrice: 9000,
    volatility: 'HIGH',
    desc: 'K-뷰티 글로벌 수출 및 면세점 주력 브랜드. 해외 직구·인바운드 관광객 증가 시 강세.',
  },
  {
    code: 'CHEM',
    name: '넥스트케미칼',
    sector: '석유화학',
    emoji: '🧪',
    initialPrice: 9000,
    volatility: 'MEDIUM',
    desc: '기초 유분 및 첨단 스페셜티 소재 기업. 국제 유가(나프타 원가)와 글로벌 경기 사이클 반영.',
  },
  {
    code: 'STEL',
    name: '대한철강',
    sector: '철강',
    emoji: '🏗️',
    initialPrice: 8000,
    volatility: 'MEDIUM',
    desc: '자동차강판·조선 후판 공급사. 건설 경기, 중국발 공급 과잉, 인프라 투자와 직결.',
  },
  {
    code: 'CNST',
    name: '에코건설',
    sector: '건설',
    emoji: '🏢',
    initialPrice: 8000,
    volatility: 'HIGH',
    desc: '국내외 플랜트·주택·SOC 시공 기업. 기준금리, 부동산 PF 리스크, 해외 수주에 민감.',
  },
  {
    code: 'BIOH',
    name: '넥스바이오',
    sector: '바이오',
    emoji: '🧬',
    initialPrice: 11000,
    volatility: 'HIGH',
    desc: '신약 파이프라인 및 바이오시밀러 개발사. 임상 결과 및 기술수출 공시에 따라 급등락.',
  },
];

// ---------------------------------------------------------------------------
// 라운드별 업종·테마·매출·실적·리스크 시나리오 덱 (20종)
// ---------------------------------------------------------------------------
const MARKET_NEWS_DECK = [
  {
    id: 'N01',
    category: '실적·매출',
    sector: '반도체',
    title: 'AI 데이터센터 증설 경쟁… 메모리 판가 25% 급등',
    summary: '한빛반도체 3분기 영업이익이 컨센서스를 40% 상회할 전망. HBM 물량 내년 상반기까지 완판.',
    impacts: { SEMI: 0.24, FINC: 0.02 },
    outcomeNote: 'AI 메모리 실적 서프라이즈로 한빛반도체가 강하게 상승했습니다.',
  },
  {
    id: 'N02',
    category: '리스크 경보',
    sector: '반도체',
    title: '주요국 첨단 반도체 장비 수출 규제 강화 검토',
    summary: '핵심 공정 장비 반입 지연 및 재고 조정 우려가 부각되며 단기 마진 압박 리스크 확대.',
    impacts: { SEMI: -0.20, AUTO: -0.04, FINC: 0.03 },
    outcomeNote: '수출 규제 리스크로 한빛반도체에서 차익 실현 매물이 쏟아졌습니다.',
  },
  {
    id: 'N03',
    category: '업종 전망',
    sector: '자동차 · 철강',
    title: '북미·유럽 하이브리드 차량 판매량 역대 최고치 경신',
    summary: '태극모터스 북미 점유율 12% 돌파 및 영업이익률 10%대 회복. 차체용 강판 수요도 동반 증가.',
    impacts: { AUTO: 0.21, STEL: 0.11 },
    outcomeNote: '글로벌 완성차 호조에 힘입어 태극모터스와 대한철강이 동반 상승했습니다.',
  },
  {
    id: 'N04',
    category: '리스크 경보',
    sector: '자동차',
    title: '수입산 자동차 관세 인상 및 현지 노조 파업 장기화',
    summary: '북미 수출 물량에 15% 추가 관세 부과 논의 및 국내 공장 가동률 하락으로 4분기 매출 타격 우려.',
    impacts: { AUTO: -0.19, STEL: -0.07 },
    outcomeNote: '관세·파업 리스크로 태극모터스가 약세를 면치 못했습니다.',
  },
  {
    id: 'N05',
    category: '거시·유가',
    sector: '항공 · 석유화학',
    title: '중동 지정학적 불안으로 국제 유가 배럴당 95달러 돌파',
    summary: '항공유 및 나프타 원가 급등으로 스카이항공과 넥스트케미칼의 수익성 악화 직격탄 우려.',
    impacts: { AIRL: -0.21, CHEM: -0.17, CNST: 0.06 },
    outcomeNote: '국제 유가 급등 여파로 항공과 석유화학 업종이 동반 하락했습니다.',
  },
  {
    id: 'N06',
    category: '거시·유가',
    sector: '항공 · 석유화학',
    title: '산유국 증산 합의… 국제 유가 70달러 선 급락',
    summary: '유류비 부담 대폭 완화와 여름철 해외여행 예약률 140% 급증. 석유화학 스프레드도 동반 개선 전망.',
    impacts: { AIRL: 0.24, CHEM: 0.16, COSM: 0.08 },
    outcomeNote: '유가 하락과 여객 수요 폭증으로 항공·화학·면세 화장품이 동반 랠리를 펼쳤습니다.',
  },
  {
    id: 'N07',
    category: '테마·수출',
    sector: '화장품 · 소비재',
    title: 'K-뷰티 북미·일본 온라인 몰 매출 전년 대비 +65% 폭증',
    summary: '루나코스메틱 주력 앰플이 아마존 뷰티 1위 달성. 외국인 관광객 입국 증가로 면세·유통 소비재도 수혜.',
    impacts: { COSM: 0.26, CONS: 0.10, AIRL: 0.06 },
    outcomeNote: '글로벌 K-뷰티 열풍으로 루나코스메틱이 급등했습니다.',
  },
  {
    id: 'N08',
    category: '리스크 경보',
    sector: '화장품 · 소비재',
    title: '해외 플랫폼 수수료 인상 및 현지 규제(위생허가) 강화',
    summary: '루나코스메틱 마케팅 비용 급증으로 영업이익률 하락 우려. 내수 소비 위축으로 소비재 판매도 둔화.',
    impacts: { COSM: -0.21, CONS: -0.09 },
    outcomeNote: '마케팅 비용 부담과 규제 우려로 화장품·소비재가 조정을 받았습니다.',
  },
  {
    id: 'N09',
    category: '거시·금리',
    sector: '건설 · 금융 · 바이오',
    title: '중앙은행 기준금리 0.5%p 전격 인하 발표',
    summary: '조달 금리 하락으로 건설(PF 부담 완화)과 바이오(성장주 할인율 축소) 급반등 기대. 반면 금융주는 예대마진 축소 우려.',
    impacts: { CNST: 0.22, BIOH: 0.18, SEMI: 0.10, FINC: -0.07 },
    outcomeNote: '금리 인하 수혜로 건설·바이오·반도체가 강세를 보였고 금융주는 소폭 하락했습니다.',
  },
  {
    id: 'N10',
    category: '거시·금리',
    sector: '금융 · 건설',
    title: '인플레이션 재점화… 고금리 장기화 및 부동산 PF 부실 경보',
    summary: '건설사 미분양 증가 및 자금 경색 리스크 부각. 반면 세이프금융은 견조한 이자수익과 자사주 소각으로 방어.',
    impacts: { CNST: -0.24, STEL: -0.10, FINC: 0.11, CONS: 0.05 },
    outcomeNote: '고금리·PF 리스크로 건설·철강이 하락한 반면 금융과 필수소비재가 방어력을 입증했습니다.',
  },
  {
    id: 'N11',
    category: '수주 공시',
    sector: '건설 · 철강',
    title: '정부 50조 원 규모 전국 광역철도·신도시 인프라 착공 발표',
    summary: '에코건설 대형 토목 수주잔고 급증 및 대한철강 H형강·후판 출하량 30% 확대 전망.',
    impacts: { CNST: 0.23, STEL: 0.18 },
    outcomeNote: '대형 SOC 인프라 투자 발표로 건설과 철강 섹터가 동반 급등했습니다.',
  },
  {
    id: 'N12',
    category: '업종 리스크',
    sector: '철강 · 석유화학',
    title: '중국발 저가 철강·화학 제품 대규모 밀어내기 수출',
    summary: '글로벌 공급 과잉 심화로 제품 판가 하락. 대한철강과 넥스트케미칼 4분기 적자 전환 리스크 제기.',
    impacts: { STEL: -0.20, CHEM: -0.18 },
    outcomeNote: '공급 과잉 여파로 철강과 석유화학 업종이 동반 약세를 보였습니다.',
  },
  {
    id: 'N13',
    category: '테마·임상',
    sector: '바이오',
    title: '넥스바이오, 표적항암제 글로벌 임상 3상 1차 지표 충족',
    summary: '미국 FDA 신속심사 지정 및 글로벌 빅파마와 2조 원 규모 기술이전(L/O) 계약 임박.',
    impacts: { BIOH: 0.30, COSM: 0.03 },
    outcomeNote: '임상 3상 성공 및 기술수출 기대감으로 넥스바이오가 폭등했습니다.',
  },
  {
    id: 'N14',
    category: '리스크 경보',
    sector: '바이오',
    title: '넥스바이오 대규모 유상증자 및 임상 보완 요구(CRL) 수령',
    summary: '주주가치 희석 우려와 신약 출시 1년 이상 지연 가능성에 투자심리 급랭.',
    impacts: { BIOH: -0.26, FINC: 0.03 },
    outcomeNote: '임상 지연 및 유상증자 악재로 넥스바이오가 급락했습니다.',
  },
  {
    id: 'N15',
    category: '실적·매출',
    sector: '소비재 · 석유화학',
    title: '국제 곡물가 안정 및 K-푸드 글로벌 수출 역대 최고',
    summary: '데일리푸드 원가율 4%p 개선 및 해외 법인 매출 28% 성장. 친환경 포장재 공급하는 넥스트케미칼도 수혜.',
    impacts: { CONS: 0.18, CHEM: 0.09 },
    outcomeNote: '원가 안정과 해외 수출 호조로 데일리푸드가 견조하게 상승했습니다.',
  },
  {
    id: 'N16',
    category: '환율·수출',
    sector: '자동차 · 반도체 · 항공',
    title: '원/달러 환율 1,420원 돌파 (고환율 쇼크)',
    summary: '수출 비중이 높은 반도체·자동차·화장품은 환차익 기대. 반면 외화부채·리스비가 큰 항공사는 손실 확대 우려.',
    impacts: { SEMI: 0.11, AUTO: 0.12, COSM: 0.10, AIRL: -0.16 },
    outcomeNote: '고환율 환경에서 수출주는 강세를, 외화 비용이 큰 항공주는 약세를 보였습니다.',
  },
  {
    id: 'N17',
    category: '테마·친환경',
    sector: '석유화학 · 자동차',
    title: '글로벌 친환경 배터리·스페셜티 소재 보조금 법안 통과',
    summary: '넥스트케미칼의 고부가 양극재 첨가제 및 태극모터스 전기차 라인업 대규모 세제 혜택 확정.',
    impacts: { CHEM: 0.19, AUTO: 0.14 },
    outcomeNote: '친환경 소재 보조금 수혜로 넥스트케미칼과 태극모터스가 동반 상승했습니다.',
  },
  {
    id: 'N18',
    category: '방어·배당',
    sector: '금융 · 소비재',
    title: '글로벌 증시 변동성 경계감 확산… 배당·방어주 자금 쏠림',
    summary: '실적 불확실성이 커지자 안정적인 현금흐름을 보유한 금융(세이프금융)과 필수소비재(데일리푸드)로 매수세 이동.',
    impacts: { FINC: 0.10, CONS: 0.11, SEMI: -0.06, BIOH: -0.07 },
    outcomeNote: '안전자산 선호 심리로 금융과 소비재가 상승하고 고변동성 성장주는 쉬어갔습니다.',
  },
];

// ---------------------------------------------------------------------------
// 게임 상태 저장소
// ---------------------------------------------------------------------------
const state = {
  phase: 'LOBBY', // LOBBY | TRADING | MARKET_CLOSE | GAME_OVER
  round: 0,
  totalRounds: 5,
  timer: 0,
  paused: false,
  phaseNonce: 0,
  players: new Map(),
  hostTokens: new Set(),
  stocks: {},
  usedNewsIds: new Set(),
  currentBriefings: [],
  roundSummaryLogs: [],
  chatHistory: [],
};

let timerInterval = null;

function generateToken() {
  return crypto.randomBytes(12).toString('hex');
}

function initStocks() {
  state.stocks = {};
  for (const item of STOCK_CATALOG) {
    state.stocks[item.code] = {
      ...item,
      price: item.initialPrice,
      prevPrice: item.initialPrice,
      pctChange: 0,
      history: [item.initialPrice],
    };
  }
}
initStocks();

function getPlayerBySocket(socketId) {
  for (const p of state.players.values()) {
    if (p.socketId === socketId) return p;
  }
  return null;
}

function isHostSocket(socket) {
  if (socket.data && socket.data.isHost) return true;
  if (socket.data && socket.data.hostToken && state.hostTokens.has(socket.data.hostToken)) {
    return true;
  }
  return false;
}

function cleanupDeadSockets() {
  let removed = 0;
  for (const [token, p] of state.players.entries()) {
    const activeSocket = p.socketId ? io.sockets.sockets.get(p.socketId) : null;
    if (!p.connected || !activeSocket || !activeSocket.connected) {
      state.players.delete(token);
      removed += 1;
    }
  }
  return removed;
}

function computePlayerPortfolioValue(p) {
  let stockValue = 0;
  for (const [code, pos] of Object.entries(p.holdings)) {
    const st = state.stocks[code];
    if (st && pos.qty > 0) {
      stockValue += pos.qty * st.price;
    }
  }
  const totalAsset = p.cash + stockValue;
  const returnPct = ((totalAsset - STARTING_CASH) / STARTING_CASH) * 100;
  return { stockValue, totalAsset, returnPct };
}

function getRankings() {
  const arr = Array.from(state.players.values()).map((p) => {
    const { stockValue, totalAsset, returnPct } = computePlayerPortfolioValue(p);
    return {
      token: p.token,
      nickname: p.nickname,
      cash: p.cash,
      stockValue,
      totalAsset,
      returnPct: Number(returnPct.toFixed(2)),
      tradeCount: p.tradeCount || 0,
    };
  });

  arr.sort((a, b) => {
    if (b.totalAsset !== a.totalAsset) return b.totalAsset - a.totalAsset;
    return b.cash - a.cash;
  });

  let rank = 1;
  arr.forEach((item, idx) => {
    if (idx > 0 && item.totalAsset < arr[idx - 1].totalAsset) {
      rank = idx + 1;
    }
    item.rank = rank;
  });
  return arr;
}

function getPublicPlayers() {
  return Array.from(state.players.values()).map((p) => {
    const { stockValue, totalAsset, returnPct } = computePlayerPortfolioValue(p);
    return {
      token: p.token,
      nickname: p.nickname,
      connected: p.connected,
      cash: p.cash,
      holdings: p.holdings,
      stockValue,
      totalAsset,
      returnPct: Number(returnPct.toFixed(2)),
    };
  });
}

function broadcastState() {
  io.emit('game:state', {
    phase: state.phase,
    round: state.round,
    totalRounds: state.totalRounds,
    timer: state.timer,
    paused: state.paused,
    phaseNonce: state.phaseNonce,
    stocks: Object.values(state.stocks),
    briefings: state.currentBriefings,
    roundSummaryLogs: state.roundSummaryLogs,
    players: getPublicPlayers(),
    rankings: (state.phase === 'MARKET_CLOSE' || state.phase === 'GAME_OVER') ? getRankings() : [],
  });
}

function startTimer(seconds, onExpire) {
  if (timerInterval) clearInterval(timerInterval);
  state.timer = seconds;
  state.paused = false;
  broadcastState();

  timerInterval = setInterval(() => {
    if (state.paused) return;
    state.timer -= 1;
    if (state.timer <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      state.timer = 0;
      onExpire();
    } else {
      io.emit('game:tick', { timer: state.timer, paused: state.paused });
    }
  }, 1000);
}

// ---------------------------------------------------------------------------
// 라운드 진행 로직
// ---------------------------------------------------------------------------
function drawRoundBriefings() {
  let pool = MARKET_NEWS_DECK.filter((n) => !state.usedNewsIds.has(n.id));
  if (pool.length < 4) {
    state.usedNewsIds.clear();
    pool = [...MARKET_NEWS_DECK];
  }
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, 4);
  picked.forEach((n) => state.usedNewsIds.add(n.id));
  return picked;
}

function startTradingPhase() {
  state.round += 1;
  state.phase = 'TRADING';
  state.phaseNonce += 1;
  state.roundSummaryLogs = [];
  state.currentBriefings = drawRoundBriefings();
  startTimer(90, closeMarketAndSettle);
}

function closeMarketAndSettle() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  state.phase = 'MARKET_CLOSE';
  state.phaseNonce += 1;

  const sectorDelta = {};
  Object.keys(state.stocks).forEach((code) => {
    sectorDelta[code] = 0;
  });

  const logs = [];
  for (const news of state.currentBriefings) {
    logs.push(`📰 [${news.category}] ${news.outcomeNote}`);
    for (const [code, delta] of Object.entries(news.impacts)) {
      if (sectorDelta[code] !== undefined) {
        sectorDelta[code] += delta;
      }
    }
  }

  for (const stock of Object.values(state.stocks)) {
    stock.prevPrice = stock.price;
    const noiseRange = stock.volatility === 'HIGH' ? 0.05 : stock.volatility === 'MEDIUM' ? 0.035 : 0.02;
    const noise = (Math.random() * 2 - 1) * noiseRange;
    const rawPct = sectorDelta[stock.code] + noise;
    const clampedPct = Math.max(-0.35, Math.min(0.45, rawPct));
    const newPrice = Math.max(1000, Math.round((stock.price * (1 + clampedPct)) / 100) * 100);
    stock.price = newPrice;
    stock.pctChange = Number((((newPrice - stock.prevPrice) / stock.prevPrice) * 100).toFixed(1));
    stock.history.push(newPrice);
  }

  // 세이프금융(FINC) 보유자 4% 배당금 지급
  let dividendReceivers = 0;
  for (const p of state.players.values()) {
    const finPos = p.holdings.FINC;
    if (finPos && finPos.qty > 0) {
      const divAmount = Math.round((finPos.qty * state.stocks.FINC.price * 0.04) / 100) * 100;
      if (divAmount > 0) {
        p.cash += divAmount;
        dividendReceivers += 1;
      }
    }
  }
  if (dividendReceivers > 0) {
    logs.push(`🏦 [배당 지급] 세이프금융(FINC) 보유자 ${dividendReceivers}명에게 평가액의 4% 현금 배당이 입금되었습니다.`);
  }

  state.roundSummaryLogs = logs;

  startTimer(18, () => {
    if (state.round >= state.totalRounds) {
      state.phase = 'GAME_OVER';
      state.phaseNonce += 1;
      broadcastState();
    } else {
      startTradingPhase();
    }
  });
}

function advancePhaseManually() {
  if (state.phase === 'TRADING') {
    closeMarketAndSettle();
  } else if (state.phase === 'MARKET_CLOSE') {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (state.round >= state.totalRounds) {
      state.phase = 'GAME_OVER';
      state.phaseNonce += 1;
      broadcastState();
    } else {
      startTradingPhase();
    }
  }
}

// ---------------------------------------------------------------------------
// Socket.io 이벤트 핸들러
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  socket.on('host:auth', ({ pin, hostToken }, callback) => {
    if (hostToken && state.hostTokens.has(hostToken)) {
      socket.data.isHost = true;
      socket.data.hostToken = hostToken;
      broadcastState();
      return callback?.({ ok: true, hostToken });
    }
    if (String(pin || '').trim() === ADMIN_PIN) {
      const newHostToken = generateToken();
      state.hostTokens.add(newHostToken);
      socket.data.isHost = true;
      socket.data.hostToken = newHostToken;
      broadcastState();
      return callback?.({ ok: true, hostToken: newHostToken });
    }
    return callback?.({ ok: false, error: '관리자 PIN이 올바르지 않습니다.' });
  });

  socket.on('player:join', ({ nickname, token }, callback) => {
    if (token && state.players.has(token)) {
      const existing = state.players.get(token);
      existing.socketId = socket.id;
      existing.connected = true;
      socket.data.playerToken = token;
      broadcastState();
      return callback?.({
        ok: true,
        token: existing.token,
        nickname: existing.nickname,
        chatHistory: state.chatHistory.slice(-40),
      });
    }

    const cleanName = String(nickname || '').trim().slice(0, 16);
    if (!cleanName) return callback?.({ ok: false, error: '닉네임을 입력해 주세요.' });
    if (state.phase !== 'LOBBY') {
      return callback?.({ ok: false, error: '이미 투자 게임이 진행 중입니다. 다음 판을 기다려 주세요.' });
    }
    if (state.players.size >= 35) {
      return callback?.({ ok: false, error: '최대 정원(35명)이 가득 찼습니다.' });
    }
    for (const p of state.players.values()) {
      if (p.nickname.toLowerCase() === cleanName.toLowerCase()) {
        return callback?.({ ok: false, error: '이미 사용 중인 닉네임입니다.' });
      }
    }

    const newToken = generateToken();
    const holdings = {};
    STOCK_CATALOG.forEach((s) => {
      holdings[s.code] = { qty: 0, avgCost: 0 };
    });

    state.players.set(newToken, {
      token: newToken,
      socketId: socket.id,
      nickname: cleanName,
      connected: true,
      cash: STARTING_CASH,
      holdings,
      tradeCount: 0,
    });
    socket.data.playerToken = newToken;
    broadcastState();
    return callback?.({
      ok: true,
      token: newToken,
      nickname: cleanName,
      chatHistory: state.chatHistory.slice(-40),
    });
  });

  socket.on('game:request_state', () => {
    broadcastState();
  });

  // 방장 게임 시작 (1~35명 지원: 혼자서도 시작 가능)
  socket.on('host:start_game', ({ totalRounds }, callback) => {
    if (!isHostSocket(socket)) return callback?.({ ok: false, error: '방장 권한이 없습니다.' });
    cleanupDeadSockets();

    if (state.players.size < 1) {
      return callback?.({ ok: false, error: '최소 1명 이상의 참가자가 필요합니다.' });
    }

    const roundsNum = Number(totalRounds);
    state.totalRounds = [4, 5, 6].includes(roundsNum) ? roundsNum : 5;
    state.round = 0;
    state.usedNewsIds.clear();
    state.chatHistory = [];
    initStocks();

    for (const p of state.players.values()) {
      p.cash = STARTING_CASH;
      p.tradeCount = 0;
      STOCK_CATALOG.forEach((s) => {
        p.holdings[s.code] = { qty: 0, avgCost: 0 };
      });
    }

    startTradingPhase();
    return callback?.({ ok: true });
  });

  socket.on('host:pause_resume', (_, callback) => {
    if (!isHostSocket(socket)) return callback?.({ ok: false });
    state.paused = !state.paused;
    io.emit('game:tick', { timer: state.timer, paused: state.paused });
    broadcastState();
    return callback?.({ ok: true, paused: state.paused });
  });

  socket.on('host:extend_time', ({ seconds = 30 }, callback) => {
    if (!isHostSocket(socket)) return callback?.({ ok: false });
    state.timer += Number(seconds) || 30;
    io.emit('game:tick', { timer: state.timer, paused: state.paused });
    return callback?.({ ok: true, timer: state.timer });
  });

  socket.on('host:next_phase', (_, callback) => {
    if (!isHostSocket(socket)) return callback?.({ ok: false });
    advancePhaseManually();
    return callback?.({ ok: true });
  });

  socket.on('host:kick_player', ({ targetToken }, callback) => {
    if (!isHostSocket(socket)) return callback?.({ ok: false });
    const target = state.players.get(targetToken);
    if (target) {
      if (target.socketId) io.to(target.socketId).emit('player:kicked');
      state.players.delete(targetToken);
      broadcastState();
    }
    return callback?.({ ok: true });
  });

  socket.on('host:reset_game', (_, callback) => {
    if (!isHostSocket(socket)) return callback?.({ ok: false });
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    cleanupDeadSockets();
    state.phase = 'LOBBY';
    state.round = 0;
    state.timer = 0;
    state.paused = false;
    state.phaseNonce += 1;
    state.currentBriefings = [];
    state.roundSummaryLogs = [];
    state.usedNewsIds.clear();
    initStocks();

    for (const p of state.players.values()) {
      p.cash = STARTING_CASH;
      p.tradeCount = 0;
      STOCK_CATALOG.forEach((s) => {
        p.holdings[s.code] = { qty: 0, avgCost: 0 };
      });
    }
    broadcastState();
    return callback?.({ ok: true });
  });

  socket.on('trade:order', ({ code, side, qty }, callback) => {
    const p = getPlayerBySocket(socket.id);
    if (!p) return callback?.({ ok: false, error: '참가자 정보를 찾을 수 없습니다.' });
    if (state.phase !== 'TRADING') {
      return callback?.({ ok: false, error: '현재 거래 시간이 아닙니다.' });
    }
    const stock = state.stocks[code];
    if (!stock) return callback?.({ ok: false, error: '존재하지 않는 종목입니다.' });

    const orderQty = Math.floor(Number(qty));
    if (!Number.isFinite(orderQty) || orderQty <= 0) {
      return callback?.({ ok: false, error: '유효한 수량을 입력해 주세요.' });
    }

    const pos = p.holdings[code];
    if (side === 'BUY') {
      const cost = orderQty * stock.price;
      if (cost > p.cash) {
        return callback?.({ ok: false, error: '보유 현금이 부족합니다.' });
      }
      const prevTotalCost = pos.qty * pos.avgCost;
      const newQty = pos.qty + orderQty;
      pos.avgCost = Math.round((prevTotalCost + cost) / newQty);
      pos.qty = newQty;
      p.cash -= cost;
      p.tradeCount += 1;
    } else if (side === 'SELL') {
      if (orderQty > pos.qty) {
        return callback?.({ ok: false, error: '보유 수량이 부족합니다.' });
      }
      const proceeds = orderQty * stock.price;
      pos.qty -= orderQty;
      if (pos.qty === 0) pos.avgCost = 0;
      p.cash += proceeds;
      p.tradeCount += 1;
    } else {
      return callback?.({ ok: false, error: '잘못된 주문 유형입니다.' });
    }

    broadcastState();
    return callback?.({
      ok: true,
      message: `${stock.name} ${orderQty}주 ${side === 'BUY' ? '매수' : '매도'} 체결 (${(orderQty * stock.price).toLocaleString()}원)`,
    });
  });

  socket.on('chat:send', ({ text }) => {
    const p = getPlayerBySocket(socket.id);
    const cleanText = String(text || '').trim().slice(0, 200);
    if (!cleanText) return;
    const sender = p ? p.nickname : (isHostSocket(socket) ? '진행자' : null);
    if (!sender) return;

    const msg = {
      id: generateToken().slice(0, 8),
      sender,
      text: cleanText,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };
    state.chatHistory.push(msg);
    if (state.chatHistory.length > 80) state.chatHistory.shift();
    io.emit('chat:message', msg);
  });

  socket.on('disconnect', () => {
    const p = getPlayerBySocket(socket.id);
    if (p) {
      p.connected = false;
      broadcastState();
    }
  });
});

server.listen(PORT, () => {
  console.log(`Stock Tycoon server running on port ${PORT}`);
});
