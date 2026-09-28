// Public study taxonomy only. Private records are joined in memory after Research unlocks.
export const SECTOR_LAYERS = [
  ['process', '공정·패키징'], ['chip', '칩·메모리'], ['system', '시스템·랙'],
  ['facility', '데이터센터'], ['compute', '컴퓨트'], ['model', 'AI 모델'], ['app', 'S/W·앱']
];
const node = (id, layer, name, examples, aliases, question, tickers = []) => ({ id, layer, name, examples, aliases, question, tickers });
export const SECTOR_NODES = [
  node('n3', 'process', 'TSMC N3', '3나노 공정', ['TSMC N3', '3나노', '3nm', 'N3E', 'N3P'], '어떤 칩이 이 공정을 채택하며 수율과 생산능력은 어떻게 변하는가?'),
  node('n2', 'process', 'TSMC N2', '2나노 공정', ['TSMC N2', '2나노', '2nm', 'N2P'], '제품별 채택 일정과 양산 진행 상황을 어떤 자료로 확인할 수 있는가?'),
  node('packaging', 'process', 'CoWoS 패키징', '로직·HBM 통합', ['CoWoS', '첨단 패키징', 'advanced packaging'], '칩과 HBM의 결합에 필요한 패키징 생산능력과 병목은 무엇인가?'),
  node('gpu', 'chip', 'GPU', 'NVIDIA · AMD', ['GPU', 'NVIDIA', 'NVDA', '엔비디아', 'Blackwell', '블랙웰', 'Rubin', '루빈', 'AMD'], 'GPU 세대별 성능·메모리·공정 차이와 실제 출하를 구분해 보자.'),
  node('asic', 'chip', '커스텀 ASIC', 'TPU · Trainium', ['ASIC', 'TPU', 'Trainium', '커스텀 반도체', '자체 설계 칩', 'Broadcom', '브로드컴', 'AVGO'], '어떤 고객의 어떤 워크로드를 겨냥하며 GPU와 어디서 경쟁하는가?'),
  node('cpu', 'chip', 'CPU', 'Vera · Grace · EPYC', ['CPU', 'Vera CPU', 'Grace CPU', 'EPYC', 'Xeon'], '호스트 CPU와 독립 CPU 시스템의 역할을 구분해 보자.'),
  node('hbm', 'chip', '메모리 HBM', 'HBM3E · HBM4', ['HBM', 'HBM3E', 'HBM4', '고대역폭 메모리'], '제품별 탑재량·대역폭·공급사 인증 상태는 어떻게 다른가?'),
  node('oem', 'system', '서버 OEM', 'DELL · HPE · SMCI', ['서버 OEM', 'DELL', 'HPE', 'SMCI', 'Supermicro', '슈퍼마이크로'], '누가 시스템을 제조·통합하며 수주와 매출 인식 시점은 어떻게 다른가?'),
  node('rack', 'system', 'NVIDIA 랙', 'GB200 · GB300 · Vera Rubin', ['NVDA 랙', 'NVIDIA 랙', 'GB200', 'GB300', 'NVL72', 'Vera Rubin', '베라 루빈'], '랙의 세대별 구성을 나누고 실제 설치·가동까지 필요한 조건을 확인하자.'),
  node('network', 'system', '네트워크·광통신', 'NVLink · Ethernet · 광연결', ['광통신', '광모듈', '네트워킹', 'NVLink', 'Ethernet', 'InfiniBand', '이더넷', 'CPO', 'ANET', 'LITE', 'COHR'], '랙 내부·랙 사이·데이터센터 사이 연결의 역할과 병목은 무엇인가?'),
  node('storage', 'system', '스토리지', 'NetApp · Everpure', ['스토리지', 'NetApp', 'NTAP', 'Everpure', 'Pure Storage', '퓨어스토리지', 'PSTG'], '학습 데이터와 추론 컨텍스트 저장에 어떤 성능·용량이 필요한가?', ['P']),
  node('power', 'facility', '전력·부지', '발전 · 전력망 · 입지', ['전력', '전력망', '데이터센터 부지', 'CEG', 'Constellation Energy'], '계약 전력과 실제 공급 가능한 전력, 계통 연결 일정을 구분해 보자.'),
  node('cooling', 'facility', '냉각·전력설비', '액체냉각 · 배전 · UPS', ['액체냉각', '액체 냉각', '수랭', 'liquid cooling', '냉각', '배전', 'UPS', 'VRT', 'Vertiv'], '랙 밀도 변화가 냉각·배전 설비와 가동 일정에 어떤 조건을 추가하는가?'),
  node('datacenter', 'facility', '데이터센터·클러스터', '서버 · 네트워크 · 시설 통합', ['데이터센터', 'data center', 'datacenter', '클러스터', 'AI factory'], '계획·건설·장비 반입·전력 공급·실제 가동 단계를 구분해 보자.'),
  node('hyperscaler', 'compute', '하이퍼스케일러', 'OCI · AWS · Azure · Google Cloud', ['하이퍼스케일러', 'hyperscaler', 'ORCL', 'Oracle', '오라클', 'OCI', 'AWS', 'Azure', 'Google Cloud'], '자체 사용과 외부 클라우드 판매를 나누면 투자·수익 구조가 어떻게 보이는가?'),
  node('neocloud', 'compute', '네오클라우드', 'CoreWeave · Nebius', ['네오클라우드', 'neocloud', 'CoreWeave', '코어위브', 'CRWV', 'Nebius', '네비우스', 'NBIS'], '계약 용량·가동 용량·가동률·자금 조달 조건을 함께 확인하자.'),
  node('models', 'model', 'AI 모델사', '모델 개발 · 학습 · 추론', ['AI 모델사', 'OpenAI', 'Anthropic', '앤트로픽', 'Mistral', '오픈AI', '오픈에이아이', 'xAI'], '학습·추론 수요가 어떤 공급 계약과 사용량으로 이어지는가?'),
  node('platform', 'app', 'S/W·플랫폼', 'PLTR · CRM · SNOW', ['S/W', 'SaaS', '소프트웨어', 'PLTR', 'Palantir', '팔란티어', 'CRM', 'Salesforce', '세일즈포스', 'SNOW', 'Snowflake', '스노우플레이크'], 'AI 기능이 실제 고객 도입·사용량·매출로 이어지는 근거는 무엇인가?'),
  node('security', 'app', '사이버보안', 'CRWD · OKTA · PANW', ['사이버보안', '사이버 보안', 'CRWD', 'CrowdStrike', '크라우드스트라이크', 'OKTA', '옥타', 'PANW', 'Palo Alto'], '보호하는 대상과 고객의 보안 예산, AI 도입에 따른 변화를 구분하자.'),
  node('entertainment', 'app', '엔터·게임', 'Unity · 제작 도구', ['Unity', '유니티', '게임', '엔터테인먼트'], 'AI 활용이 제작 비용·콘텐츠 공급·플랫폼 수익에 어떻게 연결되는가?', ['U'])
];
const tsmc = { label: 'TSMC · CoWoS', url: 'https://3dfabric.tsmc.com/english/dedicatedFoundry/technology/cowos.htm' };
const nvidia = { label: 'NVIDIA · Rubin 구성', url: 'https://developer.nvidia.com/blog/inside-nvidia-rubin-gpu-architecture-powering-the-era-of-agentic-ai/' };
const cloud = { label: 'NVIDIA · Vera Rubin 도입', url: 'https://blogs.nvidia.com/blog/vera-rubin/' };
const edge = (from, to, label, note, source = null) => ({ id: from + '-' + to, from, to, label, note, source, checkedAt: source ? '2026-09-28' : null, status: source ? '공식 설명' : '스터디 경로' });
export const SECTOR_RELATIONS = [
  edge('n3', 'gpu', '제품별 공정 확인', '공정과 GPU의 구체적인 채택 관계는 제품·세대별 근거가 필요합니다.'),
  edge('n2', 'cpu', '제품별 공정 확인', '모든 CPU에 N2를 적용한다는 뜻이 아닙니다. 채택 제품과 시점을 따로 확인합니다.'),
  edge('packaging', 'gpu', '로직·메모리 통합', 'CoWoS는 로직과 HBM을 통합하는 패키징 기술입니다. 개별 제품의 패키징 사양은 별도 확인이 필요합니다.', tsmc),
  edge('hbm', 'packaging', '메모리 결합', 'HBM과 로직 칩을 패키지 안에서 연결합니다.', tsmc),
  edge('gpu', 'rack', 'GPU 구성', 'Vera Rubin NVL72의 GPU 구성요소는 Rubin입니다.', nvidia),
  edge('cpu', 'rack', 'CPU 구성', 'Vera Rubin 플랫폼에서 Vera CPU와 Rubin GPU가 연결됩니다.', nvidia),
  edge('hbm', 'rack', 'GPU 메모리', 'Rubin GPU에는 HBM4 메모리가 통합됩니다. 메모리 규격은 제품 세대마다 구분합니다.', nvidia),
  edge('network', 'rack', '랙 내부 연결', 'NVLink가 GPU 사이의 통신을 연결합니다. 모든 광통신 제품이 랙 내부에 탑재되는 것은 아닙니다.', nvidia),
  edge('oem', 'rack', '제조·통합 확인', '제조사별 채택 플랫폼, 공급 대상과 계약 근거를 확인하는 경로입니다.'),
  edge('asic', 'datacenter', '별도 시스템 경로', '커스텀 ASIC의 시스템과 고객은 NVIDIA 랙과 구분해 조사합니다.'),
  edge('rack', 'datacenter', '클러스터 구성', '랙을 네트워크와 시설에 연결해 실제 가동하는 단계를 살펴봅니다.'),
  edge('network', 'datacenter', '랙·시설 간 연결', '네트워크 토폴로지와 광연결 수요를 확인합니다.'),
  edge('storage', 'datacenter', '데이터 저장', '데이터·컨텍스트 저장 구조와 실제 공급사를 확인합니다.'),
  edge('power', 'datacenter', '전력·입지 조건', '전력 계약, 계통 연결, 부지 확보를 구분합니다.'),
  edge('cooling', 'datacenter', '가동 기반', '냉각·배전 설비의 준비 상태와 설치 일정을 확인합니다.'),
  edge('datacenter', 'hyperscaler', '구축·운영 확인', '시설 소유·임차·운영 역할과 실제 계약을 확인합니다.'),
  edge('datacenter', 'neocloud', '구축·운영 확인', '시설 소유·임차·운영 역할과 실제 계약을 확인합니다.'),
  edge('rack', 'hyperscaler', '플랫폼 도입', 'NVIDIA 발표에는 OCI·Google Cloud·Microsoft Azure의 Vera Rubin 도입이 포함됩니다.', cloud),
  edge('rack', 'neocloud', '플랫폼 도입', 'NVIDIA 발표에는 CoreWeave·Nebius의 Vera Rubin 도입이 포함됩니다.', cloud),
  edge('hyperscaler', 'models', '컴퓨트 공급 확인', '모델사별 공급 계약과 자체 인프라 사용을 구분합니다.'),
  edge('neocloud', 'models', '컴퓨트 공급 확인', '모델사별 공급 계약과 용량·기간·조건을 확인합니다.'),
  edge('models', 'platform', '모델 활용 확인', '서비스별 자체 모델·외부 API 활용 근거를 확인합니다.'),
  edge('security', 'datacenter', '보호 대상 확인', '보안 제품이 보호하는 계층과 고객을 확인합니다. 특정 공급 계약을 뜻하지 않습니다.'),
  edge('models', 'entertainment', '제작·서비스 활용', 'AI 활용 사례와 비용·수익 효과를 구분해 조사합니다.')
];

const normal = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function matches(text, alias) {
  const word = normal(alias), content = normal(text);
  return /^[a-z0-9 /.-]+$/.test(word) ? new RegExp('(?:^|[^a-z0-9])' + escaped(word) + '(?=$|[^a-z0-9])', 'i').test(content) : content.includes(word);
}
function titleMatch(title, n) {
  return n.aliases.find(alias => matches(title, alias)) || n.tickers.find(t => new RegExp('^' + escaped(t) + '(?:\\s+US\\b|$|\\s+[·(（-])', 'i').test(String(title || '').trim()));
}
export function sectorProse(value) {
  return String(value || '').replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '')
    .replace(/<(script|style|pre|code|page|mention|file|pdf|video|audio)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/!\[[^\]]*\]\([^\n)]*\)/g, '').replace(/\[([^\]]+)\]\([^\n)]*\)/g, '$1')
    .replace(/^\s*\[[^\]]+\]:\s*https?:\/\/.*$/gm, '').replace(/https?:\/\/[^\s<>]+/gi, '')
    .replace(/<[^>]+>/g, '').replace(/[*_`#]/g, '').trim();
}
export function matchSectorRecords(records, nodes = SECTOR_NODES) {
  const result = new Map(nodes.map(n => [n.id, []]));
  for (const record of records) {
    const sections = record.loaded === false ? [] : record.sections.map(s => {
      const raw = s.markdown ?? [s.text, ...(s.items || [])].filter(Boolean).join('\n');
      return { id: s.id, text: sectorProse(raw), hasContent: !!raw.trim() };
    });
    // An image/PDF report is a nonempty record even when its text cannot be matched.
    const empty = record.loaded !== false && (record.state === '빈 페이지' || sections.every(s => !s.hasContent));
    for (const n of nodes) {
      const titleTerm = titleMatch(record.title, n), parentTitle = record.path.at(-1) || '';
      const parentTerm = titleMatch(parentTitle, n);
      let hit;
      for (const section of sections) {
        const line = section.text.split(/\n+/).find(p => n.aliases.some(alias => matches(p, alias)));
        if (line) { hit = { section: section.id, excerpt: line.slice(0, 260) }; break; }
      }
      if (titleTerm || parentTerm || hit) result.get(n.id).push({ record, basis: titleTerm ? 'title' : parentTerm ? 'path' : 'mention', term: titleTerm || (parentTerm ? parentTitle : ''), empty, pending: record.loaded === false, ...hit });
    }
  }
  const rank = {title:0,path:1,mention:2};
  for (const items of result.values()) items.sort((a, b) => rank[a.basis] - rank[b.basis] || (b.record.date.start || '').localeCompare(a.record.date.start || ''));
  return result;
}
export function sectorCoverage(items, pending) {
  const titles = items.filter(i => i.basis !== 'mention'), filled = titles.filter(i => !i.empty && !i.pending);
  if (filled.length) return { state: 'record', label: '관련 기록 ' + filled.length };
  if (titles.some(i => i.pending)) return { state: 'pending', label: '원문 확인 중' };
  if (titles.length) return { state: 'empty', label: '빈 페이지 ' + titles.length };
  const mentions = items.filter(i => i.basis === 'mention');
  if (mentions.length) return { state: 'mention', label: '본문 언급 ' + mentions.length };
  return { state: pending ? 'pending' : 'missing', label: pending ? '원문 확인 중' : '관련 기록 없음' };
}
