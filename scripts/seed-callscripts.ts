/**
 * 콜스크립트 32개 직접 DB 시드 스크립트
 * 실행: npx dotenvx run -- npx tsx scripts/seed-callscripts.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL not set — run: npx dotenvx run -- npx tsx scripts/seed-callscripts.ts');
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const SOURCE = '크루즈닷-6거장-v1';

const scripts = [
  // ── OPENING (4) ──────────────────────────────────────────────
  {
    type: 'OPENING', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'GENERAL', pasonaStage: 'P',
    title: '에너지 도입부 — 첫 통화',
    content: `안녕하세요, [상품명] 이벤트 신청해주신 [고객이름]님 맞으시죠~?
반갑습니다, [담당자이름]입니다.
딱 5분만 집.중.해.서. 통화 괜찮으시죠~?

[운전 중이면] → "지금 운전 중이시면 안전하게 마치신 후 제가 다시 전화드릴게요. 몇 시가 괜찮으실까요?"`,
  },
  {
    type: 'OPENING', scriptTab: 'CALL_SCRIPT', priority: 2,
    customerSegment: 'GENERAL', pasonaStage: 'P',
    title: 'Hook — 왜 이제 알았지?',
    content: `딱 한 가지만 여쭤볼게요.
크루즈 타고 나서 고객분들이 제일 많이 하시는 말이 뭔지 아세요?
(잠깐 멈춤) '왜 이걸 이제 알았지?'예요.

저도 처음엔 비싼 사람들이나 타는 거라고 생각했어요.
근데 어떤 분이 이러시더라고요.
'호텔은 짐 풀고 싸고 또 풀고 싸잖아요.
크루즈는 짐을 한 번만 풀어요. 자는 동안 다음 나라에 와 있어요.'
그 말 듣고 아, 이게 그냥 여행이 아니구나 싶었어요.`,
  },
  {
    type: 'OPENING', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'GENERAL', pasonaStage: 'P',
    title: '재통화 오프닝 — 에너지 리셋',
    content: `안녕하세요 [고객이름]님! [담당자이름]이에요.
[상품명] 말씀드렸던 거 기억하시죠?
오늘은 안내드릴 게 생겨서요 — [출발일] 출발 자리가 좀 줄었거든요.
[고객이름]님 자리 먼저 확인해드리려고요. 2분만 괜찮으세요?`,
  },
  {
    type: 'OPENING', scriptTab: 'CALL_SCRIPT', priority: 3,
    customerSegment: 'GENERAL', pasonaStage: 'P',
    title: '자료 요청 고객 전환',
    content: `자료 문의해주셔서 감사해요. 물론 보내드릴 수 있는데,
제가 먼저 한 가지 여쭤볼게요.
[기항지] 여행, 어떤 분이랑 가려고 하셨어요?

처음 크루즈여행인데 가격만 보고 가신 분들이 하나같이 '다신 안간다'고 하세요.
63빌딩 두 배 크기라 뭐가 어딨는지도 몰라서 제대로 못 즐기셨대요.
제대로 즐기고 싶으시다면 5분만 투자하시면 어떨까요?`,
  },

  // ── NEEDS (3) ────────────────────────────────────────────────
  {
    type: 'NEEDS', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'GENERAL', pasonaStage: 'P',
    title: '동행자 파악 — 니즈 증폭 준비',
    content: `[고객이름]님께서 원하시는 여행에 맞춰서 안내드려야 하니까 질문 몇 가지 먼저 드릴게요~

누구와 함께 가려고 하시는 건지 여쭤봐도 될까요?
(가족 구성원 구체적으로 파악 — 뒤에서 니즈 증폭에 활용)

해외여행 경험은 있으세요?
(패키지 vs 자유여행 파악)`,
  },
  {
    type: 'NEEDS', scriptTab: 'CALL_SCRIPT', priority: 2,
    customerSegment: 'GENERAL', pasonaStage: 'P',
    title: '사연 발굴 — 감정적 재연결',
    content: `[1층] 어떤 계기로 크루즈에 관심 갖게 되셨어요?
[2층] 같이 가고 싶은 분이 있으세요? 어떤 분이랑 가고 싶으세요?
[3층] 그분이랑 이런 여행 함께 하고 싶다는 게 특별한 이유가 있으세요?
       기념일이라든가, 오래 못 해줬다든가...

→ 사연이 나오면: (조용히) "...그 마음, 제가 다 느껴져요." [침묵 3초]`,
  },
  {
    type: 'NEEDS', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'REPURCHASE', pasonaStage: 'P',
    title: '재구매 고객 — 이전 경험 파악',
    content: `저번에 어디 다녀오셨어요?
[이전기항지] 어떠셨어요, 만족하셨어요?

(이전 경험 긍정적으로 받아준 후)
이번 [상품명]은 [기항지] 구성이 완전히 달라요.
저번에 아쉬웠던 부분이 있으셨어요, 혹시?
그 부분 이번에 달라요.`,
  },

  // ── REJECTION (8) ────────────────────────────────────────────
  {
    type: 'REJECTION', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'PRICE_SENSITIVE', psychology: '손실회피', pasonaStage: 'S',
    title: '비싸요 — 1박 분해법',
    content: `[상품명]이 [가격]이거든요. [박수]박이에요.
나누면 하루에 [1박단가]예요.

국내 호텔 좋은 데 하루 방값이 20~30만원인데,
[1박단가]에 방+밥+[기항지] 이동+인솔자까지 포함이에요.
항공권, 호텔, 식사를 따로 사시면 이 가격 절대 안 나와요.`,
  },
  {
    type: 'REJECTION', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'GENERAL', psychology: '손실회피', pasonaStage: 'N',
    title: '생각해볼게요 — 스케일 클로징',
    content: `1점에서 10점이면 [상품명] 여행 가고 싶은 마음이 몇 점이에요?

(7점) → 7점이면 이미 충분히 가고 싶은 거잖아요.
3점이 부족한 이유가 뭐예요?
그 3가지를 지금 같이 해결해드릴게요.

'비싸요' → 아직 전체 가치를 못 보신 거예요
'생각해볼게요' → 지금 확신이 없다는 신호예요, 제가 확신을 못 드린 거죠`,
  },
  {
    type: 'REJECTION', scriptTab: 'CALL_SCRIPT', priority: 2,
    customerSegment: 'GENERAL', pasonaStage: 'N',
    title: '배우자 상의 필요 — 함께 통화 제안',
    content: `당연히 같이 보셔야죠.
제일 좋은 방법이 두 분 같이 통화로 설명드리는 거예요. 5분이면 돼요.
지금 바로 연결해드릴까요?

아니면 정리해서 문자로 보내드릴게요.
보시고 같이 결정하신 다음에 연락 주시면 자리 잡아드릴게요.`,
  },
  {
    type: 'REJECTION', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'GENERAL', psychology: '손실회피', pasonaStage: 'N',
    title: '다음에 갈게요 — 기회비용',
    content: `[고객이름]님이 '나중에'를 선택하는 순간, 다른 누군가가 '지금'을 선택해요.

[출발일] 지나면 이 조건은 없어요.
크루즈 가격은 출발일에 가까워질수록 올라가거든요.
1년 후에 [기항지] 사진 보면서 '그때 갈 걸' 하는 것, 저는 그게 더 아깝다고 생각해요.`,
  },
  {
    type: 'REJECTION', scriptTab: 'CALL_SCRIPT', priority: 2,
    customerSegment: 'GENERAL', pasonaStage: 'S',
    title: '비행기 무서워요 — 대안 제시',
    content: `저도 그런 분들한테 배 크기부터 말씀드려요.
웬만한 크루즈가 5만 톤이에요. 건물이 떠다니는 거예요.
'전혀 못 느꼈다'는 분들이 대부분이에요.

비행기가 아예 없는 왕복 크루즈도 있어요.
부산에서 출발해서 부산으로 돌아오는 일정인데, 어떠세요?
비행기 없이 바로 크루즈를 탈 수 있는 일정으로 안내해드릴까요?`,
  },
  {
    type: 'REJECTION', scriptTab: 'CALL_SCRIPT', priority: 2,
    customerSegment: 'GENERAL', pasonaStage: 'S',
    title: '영어 못해요 — 인솔자 해결',
    content: `그래서 인솔자가 있는 거예요.
입국심사부터 배 체크인, 항구 투어까지 다 같이 해요.
혼자 영어 한 마디 안 해도 돼요.
오히려 영어 못하시는 분들이 저희 인솔자 투어 더 만족하세요.`,
  },
  {
    type: 'REJECTION', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'PRICE_SENSITIVE', pasonaStage: 'S',
    title: '왜 이렇게 싸요 — 신뢰 구축',
    content: `저희가 [선사명]과 직거래를 하거든요.
고객을 많이 보내드리니까 선사에서 저희한테 특가로 주는 거예요.
그래서 저희가 이 가격에 안내드릴 수 있는 거고요.

무조건 싼 여행도 조심하셔야 해요.
관광여행사로 국가에 등록된 업체인지,
크루즈 전문으로 얼마나 운영했는지 꼭 체크해보세요.`,
  },
  {
    type: 'REJECTION', scriptTab: 'CALL_SCRIPT', priority: 2,
    customerSegment: 'GENERAL', pasonaStage: 'S',
    title: '크루즈가 지루할 것 같아요 — 반전 스토리',
    content: `저도 처음엔 그렇게 생각했어요.
근데 배 안에 1500명 들어가는 대극장이 있어요.
매일 밤 서커스, 오페라, 뮤지컬이 무료예요.
공연 끝나면 메인 홀에서 파티, 바에서 칵테일.
아이스링크, 수영장, 워터파크도 있어요.
지루할 틈이 없어요. 오히려 시간이 부족해요.`,
  },

  // ── RECONTACT (3) ────────────────────────────────────────────
  {
    type: 'RECONTACT', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'GENERAL', psychology: '희소성', pasonaStage: 'N',
    title: '재통화 — 자리 줄었어요',
    content: `안녕하세요 [고객이름]님, [담당자이름]이에요.
[출발일] 출발 [상품명] 자리가 아까보다 더 줄었어요.
지금 [잔여석]석 남은 상황이에요.
[고객이름]님 자리 먼저 잡아드리고 싶어서 연락드렸어요.`,
  },
  {
    type: 'RECONTACT', scriptTab: 'CALL_SCRIPT', priority: 2,
    customerSegment: 'GENERAL', pasonaStage: 'P',
    title: '재통화 — 진짜 이유 파악',
    content: `혹시 [상품명]을 안 가시기로 한 이유가 따로 있으세요?
편하게 말씀해주셔도 괜찮아요.

(고객 변명 경청 후)
음... 그 부분 말씀해주셔서 감사해요.
사실 그 부분은 [해결방법]으로 해결이 되거든요.
그게 원인이셨다면 이번에 가실 수 있을 것 같은데, 어떠세요?`,
  },
  {
    type: 'RECONTACT', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'GENERAL', psychology: '손실회피', pasonaStage: 'N',
    title: '재통화 — 마감 D-3 최종',
    content: `[고객이름]님, 솔직하게 말씀드릴게요.
[출발일] 출발이 [D-day]일 남았어요.
이 가격 [가격]은 이번이 마지막이에요.
크루즈 가격은 출발일에 가까워질수록 올라가거든요.
이 기회 지나면 동일한 조건으로 다시 나올 가능성은 낮아요.`,
  },

  // ── CLOSING (5) ──────────────────────────────────────────────
  {
    type: 'CLOSING', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'GENERAL', pasonaStage: 'A',
    title: '자리 확보 클로징 — 행동 축소',
    content: `지금 바로 결정 안 하셔도 되는데요,
일단 자리 확인을 먼저 해드릴게요.
이름이랑 연락처만 주시면 제가 우선 Hold 해드릴게요.
결정은 그다음에 하셔도 돼요.`,
  },
  {
    type: 'CLOSING', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'GENERAL', pasonaStage: 'O',
    title: '가치 스택 — 가격 제시 직전 필수',
    content: `잠깐 같이 계산해볼게요.
항공권, 호텔 [박수]박, 식사, 이동비 따로 하면 [비교가] 나와요.
[상품명]이 [가격]인데, 방금 말씀드린 것 전부 포함이에요.
거기다 수영장·공연·피트니스는 따로 사실 수도 없는 거고요.

숫자만 봐도 이미 이득인데,
진짜 가치는 [기항지]에서 [고객이름]님 얼굴에 생기는 표정이에요.
그건 제가 가격을 못 매겨요.`,
  },
  {
    type: 'CLOSING', scriptTab: 'CALL_SCRIPT', priority: 2,
    customerSegment: 'GENERAL', pasonaStage: 'A',
    title: '이분법 제거 — 객실 선택 유도',
    content: `[출발일] [상품명]으로 가실 수 있도록 제가 도와드리면 될까요?
창문 없는 인사이드, 창문 있는 오션뷰, 발코니 나가는 발코니 중 어떤 걸로 안내해드릴까요?

오션뷰는 인사이드보다 하루에 1만 2천원 차이인데,
매일 아침 바다가 보여요. 어떤 게 더 끌리세요?`,
  },
  {
    type: 'CLOSING', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'GENERAL', pasonaStage: 'A',
    title: '결제 링크 전달 — 마지막 안내',
    content: `결제 링크 문자로 보내드릴게요.
거기서 확인하시고 진행하시면 되는데 2~3분이면 돼요.
[출발일] 맞으시죠? 지금 바로 보내드릴게요.

결제 후 본사에서 계약서 보내드릴 거고,
출발 2주 전에 단톡방 만들어서 여행 준비 자료 다 보내드릴게요.`,
  },
  {
    type: 'CLOSING', scriptTab: 'CALL_SCRIPT', priority: 2,
    customerSegment: 'GENERAL', pasonaStage: 'A',
    title: '재터치 예약 잡기',
    content: `그럼 [고객이름]님, 제가 [N일] 뒤 [날짜] [시간]에 다시 연락드릴게요.
그 사이에 함께 가시는 분들과 상의해보시고,
그전에라도 저에게 연락 주셔야 해요~
그러면 제가 예약확인서까지 챙겨드릴 수 있어요.`,
  },

  // ── PERSONA (6) ──────────────────────────────────────────────
  {
    type: 'PERSONA', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'FILIAL_DUTY', psychology: '손실회피',
    title: '효도여행 — 라포+니즈+클로징',
    content: `[라포] 부모님이랑 마지막으로 여행 다녀오신 게 언제예요?
부모님 연세가 어떻게 되세요?

[니즈증폭] 저도 그런 마음 알아요.
'나중에 가야지' 하는데 나중이 언제인지 모르잖아요.
몸 건강하실 때, 걸어다니실 수 있을 때 같이 가시는 게 맞아요.
[상품명]은 이동이 없어요. 배 안에서 자고 일어나면 [기항지]예요.
어르신들이 제일 힘드신 장거리 이동이 없어요.

[클로징] 부모님한테 [상품명] 해드린다고 하시면
고생 없이 좋은 데 데려가드리는 거잖아요.
자리 먼저 잡아놓고 말씀드리는 분들도 많아요. 깜짝 선물로요.`,
  },
  {
    type: 'PERSONA', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'NEWLYWEDS', psychology: '욕망증폭',
    title: '신혼/연인 — 감정설계 완전판',
    content: `[라포] 둘이 가시는 거예요? 혹시 기념일이라든가 특별한 일정 있으세요?

[욕망증폭] 상대방이 [기항지] 보면서 어떤 반응 할 것 같아요?
그 얼굴 보고 싶지 않으세요?
신혼여행은 행사예요. 이건 두 분이 그냥 '우리끼리' 하는 거예요.
[출발일]에 딱 두 분만의 시간이에요.
나중에 사진 보면 '이때가 최고였다' 나오는 여행이에요.

[클로징] 결혼식에 그것보다 훨씬 많이 쓰셨잖아요.
평생 가는 기억이 [가격]이에요. 싼 거예요.`,
  },
  {
    type: 'PERSONA', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'FAMILY', psychology: '사회적증거',
    title: '어린자녀 가족 — 안전+편의 강조',
    content: `[라포] 아이가 몇 살이에요? 여행 처음이에요 아이는?

[니즈증폭] 그 나이에 배 타본 애들이 몇이나 돼요?
학교 가서 '나 크루즈 탔어' 하면 얼마나 특별한 경험이에요.
워터파크 한 번 가면 20~30만원인데 크루즈에선 매일 무료예요.
수영장 바로 옆이 뷔페라서 아이들 수영하는 거 구경하면서 밥 먹어도 돼요.
영어쌤이 놀아주는 키즈프로그램도 있어요.

[클로징] [상품명]은 아이 있는 가족이 가장 편한 구조예요.
[출발일] 아이 포함해서 자리 확인해드릴게요.`,
  },
  {
    type: 'PERSONA', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'FRIEND_GROUP', psychology: '사회적증거',
    title: '친구모임 — 모두 만족 구조 강조',
    content: `[라포] 몇 분이서 가시는 거예요?
이번에 [고객이름]님이 알아보고 계신 거예요?

[니즈증폭] 여럿이 가면 각자 원하는 게 다를 수 있잖아요.
[상품명]은 쇼핑 좋아하는 분은 [기항지] 쇼핑,
경치 원하는 분은 갑판에서 바다,
쉬고 싶은 분은 객실.
파티 싫은 분은 공연, 술 좋아하는 분은 바.
모두를 만족시킬 수 있는 게 크루즈예요.

[클로징] [출발일] [인원]명 자리 지금 확인해드릴게요.`,
  },
  {
    type: 'PERSONA', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'PRICE_SENSITIVE', psychology: '손실회피',
    title: '가성비민감 — 비교 계산 완전판',
    content: `[라포] 혹시 여행 예산 어느 정도로 보고 계세요?
크루즈 처음 알아보시는 거예요?

[비교 계산] 항공권 왕복 [항공비교가],
호텔 [박수]박 [호텔비교가],
식사 하루 세 끼 [식사비교가] 곱하기 [박수]일,
이동비까지 더하면 [합산비교가] 나와요.
[상품명]이 [가격]인데 이게 전부 포함이에요.
포함 안 된 것도 제가 다 말씀드렸어요.

[클로징] [가격]에 이게 다 포함이면 따로 따로보다 무조건 낫습니다.`,
  },
  {
    type: 'PERSONA', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'REPURCHASE', psychology: '욕망증폭',
    title: '재구매 — 업셀링 전용',
    content: `[진입] 저번에 어디 다녀오셨어요?
[이전기항지] 어떠셨어요?

[차이 강조] 이번 [상품명]은 저번이랑 [기항지] 구성이 완전히 달라요.
저번에 아쉬웠던 [포인트], 이번엔 다르게 되어 있어요.

[업셀] 이번엔 [상위객실/추가구성]도 선택 가능한데, 한 번 보여드릴까요?
저번 만족하셨으면 이번엔 더 만족하실 거예요.
[출발일] 잡아드릴게요.`,
  },

  // ── SUCCESS_CASE (2) ─────────────────────────────────────────
  {
    type: 'SUCCESS_CASE', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'GENERAL',
    title: '인솔자 없이 객실에만 있었던 사례',
    content: `고객분 중에 혼자 크루즈 예약하신 분이 계셨어요.
배는 탔는데 [기항지]에서 뭘 해야 할지 모르는 거예요.
결국 배 안에만 계셨대요. 세 개 항구를.
나중에 저한테 전화 오셨는데...
'[기항지] 가서 아무것도 못 봤어요' 하시더라고요.

저희는 인솔자가 같이 들어가요.
[기항지]에서 뭘 봐야 하는지, 어디서 먹어야 하는지,
몇 시까지 돌아와야 하는지 옆에서 다 같이 움직여요.`,
  },
  {
    type: 'SUCCESS_CASE', scriptTab: 'CALL_SCRIPT', priority: 2,
    customerSegment: 'GENERAL',
    title: '다른 여행사 고객이 저희 데스크 찾아온 사례',
    content: `저희 크루즈 타면 다른 여행사 손님들도 저희 안내데스크에 와서 막 질문을 해요.
'여긴 어딘데 손님들을 이렇게 잘 챙겨주나~?' 물어봐요.
인솔 퀄리티 자체가 달라요.

변기 고장, 난방 문제, 문 안 열림 —
직접 외국 승무원한테 말씀하시기 어렵잖아요.
그런 거 저희 인솔자가 다 해결해드려요.`,
  },

  // ── FORBIDDEN (1) ────────────────────────────────────────────
  {
    type: 'FORBIDDEN', scriptTab: 'CALL_SCRIPT', priority: 1,
    customerSegment: 'GENERAL',
    title: '절대 하지 말 것 — 금지어 가이드',
    content: `❌ '서두르세요/빨리 결정하세요' → ✅ '구조상 좌석이 한정돼 있어요'
❌ 고객 침묵 시 즉시 채우기 → ✅ 3~5초 기다리기, 침묵은 황금
❌ '저희 상품이 좋습니다' 자랑 → ✅ '고객님은 신경 안 쓰셔도 돼요'

[침묵 후 올바른 반응]
3~5초 기다린다. 고객이 말하면 끝까지 듣는다.
계속 침묵하면:
→ '어떤 부분이 마음에 걸리세요?'
→ '자리 확인만 먼저 해드릴게요. 이름만 알려주세요.'`,
  },
];

async function main() {
  console.log('📋 콜스크립트 시드 시작...');

  // 중복 확인
  const existing = await prisma.salesPlaybook.count({
    where: { source: SOURCE },
  });

  if (existing >= 50) {
    console.log(`✅ 이미 ${existing}개 존재 — 스킵`);
    return;
  }

  if (existing > 0 && existing < 50) {
    console.log(`⚠️  부분 데이터 ${existing}개 발견 — 삭제 후 재삽입`);
    await prisma.salesPlaybook.deleteMany({ where: { source: SOURCE } });
  }

  const result = await prisma.salesPlaybook.createMany({
    data: scripts.map((s) => ({
      ...s,
      isActive: true,
      source: SOURCE,
      sectionOrder: 0,
      productCode: 'ALL',
    })),
    skipDuplicates: true,
  });

  console.log(`✅ ${result.count}개 콜스크립트 삽입 완료`);
  console.log('─────────────────────────────');
  const byType = scripts.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  Object.entries(byType).forEach(([t, c]) => console.log(`  ${t}: ${c}개`));
}

main()
  .catch((e) => { console.error('❌ 오류:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
