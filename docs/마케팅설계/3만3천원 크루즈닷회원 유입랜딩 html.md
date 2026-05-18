<meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>크루즈닷 골드회원</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&amp;display=swap" rel="stylesheet">
    <script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.1/kakao.min.js"></script>
    <style>
        :root {
            --bg-dark: #0d0d0d;
            --bg-card: #1a1a1a;
            --bg-light: #252525;
            --gold: #f0c854;
            --gold-bg: rgba(240,200,84,0.2);
            --white: #ffffff;
            --gray: #b0b0b0;
            --light: #e8e8e8;
            --red: #e63946;
            --highlight: rgba(240,200,84,0.35);
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Noto Sans KR', -apple-system, sans-serif;
            background: var(--bg-dark);
            color: var(--white);
            font-size: 18px;
            line-height: 1.8;
            -webkit-font-smoothing: antialiased;
            letter-spacing: -0.01em;
            text-align: center;
            word-break: keep-all;
        }
        
        /* ========== 형광펜 & 강조 스타일 ========== */
        .marker {
            background: linear-gradient(transparent 60%, rgba(240,200,84,0.5) 60%);
            padding: 0 4px;
        }
        
        .marker-strong {
            background: linear-gradient(transparent 50%, rgba(240,200,84,0.6) 50%);
            padding: 0 6px;
            font-weight: 700;
        }
        
        .box-highlight {
            background: rgba(240,200,84,0.15);
            border-left: 4px solid var(--gold);
            padding: 15px 20px;
            border-radius: 0 12px 12px 0;
            margin: 15px 0;
        }
        
        .pulse-gold {
            animation: pulseGold 2s ease-in-out infinite;
        }
        
        @keyframes pulseGold {
            0%, 100% { box-shadow: 0 0 0 0 rgba(240,200,84,0.4); }
            50% { box-shadow: 0 0 20px 5px rgba(240,200,84,0.3); }
        }
        
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .pulse-red {
            animation: pulseRed 1.5s ease-in-out infinite;
        }
        
        @keyframes pulseRed {
            0%, 100% { box-shadow: 0 0 0 0 rgba(255,107,107,0.5); }
            50% { box-shadow: 0 0 25px 8px rgba(255,107,107,0.4); }
        }
        
        /* ========== 5060~70대 가독성 최적화 ========== */
        /* 일반 섹션 - 콘텐츠만 가운데 */
        .section {
            padding: 70px 24px;
            text-align: center;
        }
        
        .section-inner {
            max-width: 500px;
            margin: 0 auto;
        }
        
        /* 레일/갤러리 - 전체 너비 사용 */
        .review-rail, .video-review-rail-section, .dopamine-section, .dest-section {
            max-width: 100% !important;
            width: 100%;
        }
        
        p, li, span {
            line-height: 1.8;
        }
        
        /* 전역 버튼 - 텍스트 가운데 정렬 */
        button, .btn, .top-cta, .hero-cta, .mid-cta-form button, .final-btn, .floating-cta, .consult-btn {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            line-height: 1.3;
            box-sizing: border-box;
            margin-left: auto;
            margin-right: auto;
        }
        
        .hl {
            background: linear-gradient(transparent 50%, var(--highlight) 50%);
            padding: 0 4px;
        }
        
        .gold { color: var(--gold); }
        .bold { font-weight: 700; }
        
        /* ========== 상단 바 ========== */
        .top-bar {
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 100;
            padding: 16px 20px;
            background: rgba(13,13,13,0.95);
            backdrop-filter: blur(10px);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .top-bar img { height: 30px; }
        
        .top-btns {
            display: flex;
            gap: 12px;
            align-items: center;
        }
        
        .kakao-share {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            background: #FEE500;
            color: #3b1e1e;
            font-size: 0.9rem;
            font-weight: 700;
            padding: 12px 18px;
            border-radius: 25px;
            border: none;
            cursor: pointer;
        }
        
        .kakao-share svg,
        .kakao-share span {
            pointer-events: none;
        }
        
        .top-cta {
            background: var(--gold);
            color: #000;
            font-size: 1rem;
            font-weight: 700;
            padding: 16px 28px;
            border-radius: 30px;
            text-decoration: none;
            cursor: pointer;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        /* ========== 히어로 ========== */
        .hero {
            padding-top: 80px;
            background: var(--bg-dark);
        }
        
        .hero-video {
            width: 100%;
            padding: 0 20px;
            margin-bottom: 40px;
            max-width: 500px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .hero-video iframe {
            width: 100%;
            aspect-ratio: 16/9;
            border-radius: 16px;
            display: block;
        }
        
        .hero-content {
            padding: 0 24px 60px;
            text-align: center;
        }
        
        .hero h1 {
            font-size: 2.6rem;
            font-weight: 900;
            line-height: 1.4;
            margin-bottom: 25px;
        }
        
        .hero-sub {
            font-size: 1.25rem;
            color: var(--light);
            margin-bottom: 35px;
            line-height: 1.8;
        }
        
        .hero-pills {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 10px;
            margin-bottom: 50px;
        }
        
        .hero-pill {
            background: var(--gold-bg);
            border: 1px solid var(--gold);
            color: var(--gold);
            font-size: 0.95rem;
            font-weight: 600;
            padding: 12px 16px;
            border-radius: 24px;
        }
        
        .hero-cta {
            display: flex;
            align-items: center;
            justify-content: center;
            width: fit-content;
            background: var(--gold);
            color: #000;
            font-size: 1.5rem;
            font-weight: 800;
            padding: 26px 80px;
            border-radius: 50px;
            text-decoration: none;
            box-shadow: 0 15px 50px rgba(240,200,84,0.4);
            cursor: pointer;
            border: none;
            margin: 0 auto;
            text-align: center;
            line-height: 1.2;
        }
        
        .hero-micro {
            margin-top: 30px;
            font-size: 1.1rem;
            color: var(--gray);
        }
        
        /* ========== 프리미엄 배지 ========== */
        .premium-badge {
            display: inline-block;
            background: var(--gold);
            color: #000;
            font-size: 1rem;
            font-weight: 700;
            padding: 12px 24px;
            border-radius: 30px;
            margin-bottom: 30px;
            box-shadow: 0 8px 30px rgba(240,200,84,0.4);
            white-space: nowrap;
        }
        
        /* ========== 골드 카운터 배너 ========== */
        .gold-counter-banner {
            background: linear-gradient(135deg, #f0c854 0%, #d4a847 100%);
            padding: 35px 24px;
            text-align: center;
        }
        
        .gold-counter-banner .gold-mini-icon {
            width: 60px;
            height: 60px;
            object-fit: contain;
            display: block;
            margin: 0 auto 15px;
            animation: goldPulse 1.5s ease-in-out infinite;
        }
        
        .gold-counter-banner .gold-text {
            font-size: 1.3rem;
            font-weight: 700;
            color: #000;
            margin-bottom: 8px;
        }
        
        .gold-counter-banner .gold-count-line {
            font-size: 1.6rem;
            font-weight: 900;
            color: #8B0000;
        }
        
        .gold-counter-banner .gold-count {
            font-size: 2rem;
            transition: transform 0.3s, color 0.3s;
            display: inline-block;
        }
        
        .gold-counter-content {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .gold-deadline {
            font-size: 1rem;
            font-weight: 700;
            color: #8B0000;
            margin-top: 5px;
        }
        
        .gold-mini-icon-sm {
            width: 40px;
            height: 40px;
            object-fit: contain;
        }
        
        @keyframes goldPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        /* ========== 간단 가격 미리보기 ========== */
        .price-preview {
            background: linear-gradient(180deg, var(--bg-dark) 0%, var(--bg-card) 100%);
            padding: 60px 24px;
            text-align: center;
        }
        
        .preview-title {
            font-size: 1.8rem;
            font-weight: 800;
            margin-bottom: 35px;
            color: var(--white);
        }
        
        .preview-cards {
            display: flex;
            flex-direction: column;
            gap: 18px;
            max-width: 400px;
            margin: 0 auto;
        }
        
        .preview-card {
            background: var(--bg-light);
            border-radius: 20px;
            padding: 25px 20px;
            position: relative;
            border: 2px solid transparent;
            transition: 0.3s;
        }
        
        .preview-card.featured {
            border-color: var(--gold);
            background: linear-gradient(135deg, rgba(240,200,84,0.1) 0%, var(--bg-light) 100%);
        }
        
        .preview-badge {
            position: absolute;
            top: -12px;
            right: 20px;
            background: var(--gold);
            color: #000;
            font-size: 0.85rem;
            font-weight: 800;
            padding: 6px 14px;
            border-radius: 20px;
        }
        
        .preview-price {
            font-size: 1.6rem;
            font-weight: 900;
            color: var(--gold);
            margin-bottom: 8px;
        }
        
        .preview-dest {
            font-size: 1.2rem;
            font-weight: 600;
            color: var(--white);
            margin-bottom: 8px;
        }
        
        .preview-label {
            font-size: 1rem;
            color: var(--gray);
        }
        
        .preview-hint {
            margin-top: 35px;
            font-size: 1.2rem;
            color: var(--light);
            animation: bounce 2s ease-in-out infinite;
        }
        
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
        }
        
        /* ========== 후기 레일 (문장+별점) ========== */
        .review-rail {
            padding: 60px 0;
            overflow: hidden;
            background: var(--bg-card);
        }
        
        .social-proof-badge {
            text-align: center;
            padding: 0 24px;
            margin-bottom: 20px;
        }
        
        .social-proof-badge .proof-number {
            font-size: 1.8rem;
            font-weight: 900;
            color: var(--gold);
        }
        
        .review-rail-title {
            text-align: center;
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 40px;
            padding: 0 24px;
            line-height: 1.8;
        }
        
        .review-track {
            display: flex;
            gap: 20px;
            animation: reviewScroll 30s linear infinite;
            will-change: transform;
        }
        
        @keyframes reviewScroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(calc(-320px * 8)); }
        }
        
        .review-card {
            flex: 0 0 300px;
            background: var(--bg-light);
            border-radius: 20px;
            overflow: hidden;
        }
        
        .review-card .image {
            height: 180px;
            overflow: hidden;
        }
        
        .review-card .image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .review-card .content {
            padding: 20px;
        }
        
        .review-card .stars {
            color: var(--gold);
            font-size: 1.2rem;
            margin-bottom: 12px;
        }
        
        .review-card .text {
            font-size: 1.1rem;
            color: var(--light);
            line-height: 1.8;
        }
        
        .review-card .location {
            font-size: 1rem;
            color: var(--gray);
            margin-top: 8px;
        }
        
        .review-card .reviewer {
            font-size: 0.95rem;
            color: var(--gold);
            margin-top: 12px;
            font-weight: 600;
        }
        
        /* ========== 여행지 갤러리 ========== */
        .dest-section {
            padding: 80px 24px;
            background: var(--bg-dark);
        }
        
        .section-title {
            font-size: 2.4rem;
            font-weight: 800;
            text-align: center;
            margin-bottom: 30px;
            line-height: 1.5;
        }
        
        .section-sub {
            text-align: center;
            color: var(--gray);
            font-size: 1.2rem;
            margin-bottom: 25px;
            line-height: 1.8;
        }
        
        .section-sub2 {
            text-align: center;
            color: var(--gold);
            font-size: 1.15rem;
            margin-bottom: 40px;
            font-weight: 600;
            line-height: 1.7;
        }
        
        .escort-gallery {
            display: flex;
            flex-direction: column;
            gap: 25px;
            max-width: 500px;
            margin: 0 auto;
            padding: 0 24px;
        }
        
        .escort-img {
            border-radius: 20px;
            overflow: hidden;
            background: var(--bg-card);
        }
        
        .escort-img img {
            width: 100%;
            height: 250px;
            object-fit: cover;
        }
        
        .escort-img .caption {
            text-align: center;
            padding: 18px;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--light);
            line-height: 1.6;
        }
        
        .dest-category {
            margin-bottom: 50px;
        }
        
        .dest-category h3 {
            font-size: 1.3rem;
            color: var(--gold);
            margin-bottom: 25px;
            text-align: center;
            font-weight: 700;
        }
        
        .dest-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
        }
        
        .dest-item {
            aspect-ratio: 1;
            border-radius: 18px;
            overflow: hidden;
            position: relative;
        }
        
        .dest-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .dest-item .name {
            position: absolute;
            bottom: 0; left: 0; right: 0;
            padding: 16px 12px;
            background: linear-gradient(transparent, rgba(0,0,0,0.85));
            font-size: 1.1rem;
            font-weight: 600;
            text-align: center;
        }
        
        /* ========== 영상 2개 (동남아 + 지중해) ========== */
        .video-section {
            padding: 80px 24px;
            background: var(--bg-card);
        }
        
        .video-box {
            margin-bottom: 50px;
        }
        
        .video-box:last-child {
            margin-bottom: 0;
        }
        
        .video-label {
            text-align: center;
            font-size: 1.3rem;
            font-weight: 700;
            margin-bottom: 20px;
            color: var(--gold);
        }
        
        .video-wrap {
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        
        .video-wrap iframe {
            width: 100%;
            aspect-ratio: 16/9;
            display: block;
        }
        
        /* ========== 포함 내역 ========== */
        .section {
            padding: 80px 24px;
        }
        
        .bg-dark { background: var(--bg-dark); }
        .bg-card { background: var(--bg-card); }
        
        .include-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 18px;
            max-width: 500px;
            margin: 0 auto;
        }
        
        .include-item {
            background: var(--bg-light);
            border-radius: 20px;
            padding: 35px 18px;
            text-align: center;
        }
        
        .include-item .icon {
            font-size: 3rem;
            margin-bottom: 18px;
        }
        
        .include-item .name {
            font-size: 1.3rem;
            font-weight: 600;
            margin-bottom: 12px;
        }
        
        .include-item .check {
            font-size: 1.15rem;
            color: var(--gold);
            font-weight: 600;
        }
        
        /* ========== 신한은행 신뢰 ========== */
        .trust-section {
            padding: 80px 24px;
            text-align: center;
            background: var(--bg-card);
        }
        
        .trust-logo {
            width: 320px;
            max-width: 85%;
            margin-bottom: 40px;
        }
        
        .trust-section h3 {
            font-size: 1.9rem;
            margin-bottom: 25px;
            line-height: 1.6;
        }
        
        .trust-section p {
            font-size: 1.2rem;
            color: var(--gray);
            line-height: 2.2;
        }
        
        /* ========== 고통 해결 ========== */
        .solve-card {
            background: var(--bg-light);
            border-radius: 22px;
            padding: 40px 28px;
            margin-bottom: 25px;
            max-width: 500px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .solve-card .pain {
            font-size: 1.35rem;
            color: var(--gray);
            text-decoration: line-through;
            margin-bottom: 22px;
            line-height: 1.8;
        }
        
        .solve-card .answer {
            font-size: 1.4rem;
            font-weight: 600;
            line-height: 2.1;
        }
        
        .solve-card .answer .sub {
            display: block;
            font-size: 1.1rem;
            color: var(--gray);
            margin-top: 10px;
            font-weight: 500;
        }
        
        /* ========== 중간 CTA ========== */
        .mid-cta-section {
            background: var(--bg-card);
            padding: 80px 24px;
            text-align: center;
            display: block;
        }
        
        .mid-cta-section h3 {
            font-size: 1.8rem;
            margin-bottom: 50px;
            line-height: 1.8;
            display: block;
        }
        
        .mid-cta-form {
            max-width: 400px;
            margin: 0 auto;
            display: block;
        }
        
        .mid-cta-form input {
            width: 100%;
            padding: 26px 30px;
            background: var(--bg-light);
            border: 2px solid transparent;
            border-radius: 20px;
            color: #fff;
            font-size: 1.3rem;
            margin-bottom: 20px;
            outline: none;
            display: block;
        }
        
        .mid-cta-form input:focus {
            border-color: var(--gold);
        }
        
        .mid-cta-form input::placeholder {
            color: var(--gray);
        }
        
        .mid-cta-form button {
            width: 100%;
            padding: 28px;
            background: var(--gold);
            color: #000;
            font-size: 1.5rem;
            font-weight: 800;
            border: none;
            border-radius: 40px;
            cursor: pointer;
            margin-top: 20px;
            display: block;
            text-align: center;
        }
        
        .mid-cta-form .note {
            margin-top: 30px;
            font-size: 1.15rem;
            color: var(--gray);
            display: block;
        }
        
        .mid-cta-form .note {
            margin-top: 25px;
            font-size: 1.05rem;
            color: var(--gray);
        }
        
        /* ========== 혜택 섹션 (크루즈닷 x 더좋은라이프) ========== */
        .benefit-header {
            text-align: center;
            padding: 60px 24px 40px;
            background: var(--bg-dark);
        }
        
        .benefit-logos {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
        
        .benefit-logos img {
            height: 35px;
        }
        
        .benefit-logos .x {
            font-size: 1.3rem;
            color: var(--gold);
            font-weight: 700;
        }
        
        .benefit-header h2 {
            font-size: 1.6rem;
            margin-bottom: 20px;
            line-height: 1.7;
        }
        
        .benefit-header .bank-trust {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            margin-top: 30px;
            padding: 20px;
            background: var(--bg-card);
            border-radius: 16px;
            max-width: 400px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .benefit-header .bank-trust img {
            height: 40px;
        }
        
        .benefit-header .bank-trust p {
            font-size: 1rem;
            color: var(--gray);
        }
        
        /* 혜택 한눈에 요약 */
        .benefit-summary {
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-width: 380px;
            margin: 0 auto 30px;
            padding: 25px;
            background: var(--bg-card);
            border-radius: 20px;
            border: 2px solid rgba(240,200,84,0.2);
        }
        
        .benefit-sum-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
            background: var(--bg-light);
            border-radius: 12px;
        }
        
        .benefit-sum-item.gold-item {
            background: linear-gradient(135deg, rgba(240,200,84,0.2) 0%, rgba(240,200,84,0.05) 100%);
            border: 2px solid var(--gold);
        }
        
        .sum-icon {
            font-size: 1.5rem;
        }
        
        .sum-text {
            flex: 1;
            font-size: 1.1rem;
            font-weight: 600;
        }
        
        .sum-value {
            font-size: 0.95rem;
            color: var(--gold);
            font-weight: 700;
            white-space: nowrap;
        }
        
        /* 골드바 특별 스타일 */
        .goldbar-special {
            flex-direction: row;
            padding: 18px 20px !important;
            gap: 16px;
        }
        
        .goldbar-thumb {
            width: 70px;
            height: 70px;
            object-fit: contain;
            border-radius: 12px;
            background: rgba(255,255,255,0.1);
        }
        
        .goldbar-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
        }
        
        .goldbar-title {
            font-size: 1.2rem;
            font-weight: 800;
            color: var(--gold);
        }
        
        .goldbar-sub {
            font-size: 0.95rem;
            color: var(--light);
        }
        
        @media (min-width: 400px) {
            .goldbar-thumb {
                width: 90px;
                height: 90px;
            }
        }
        
        .benefit-section {
            padding: 60px 24px;
        }
        
        .benefit-label {
            text-align: center;
            font-size: 1.2rem;
            color: var(--gold);
            font-weight: 700;
            margin-bottom: 30px;
            padding: 15px;
            background: var(--gold-bg);
            border-radius: 12px;
            max-width: 350px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .benefit-grid {
            display: grid;
            gap: 25px;
            max-width: 500px;
            margin: 0 auto;
        }
        
        .benefit-card {
            background: var(--bg-light);
            border-radius: 22px;
            overflow: hidden;
        }
        
        .benefit-card .image {
            height: 200px;
            overflow: hidden;
        }
        
        .benefit-card .image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .benefit-card .content {
            padding: 28px;
        }
        
        .benefit-card h4 {
            font-size: 1.45rem;
            margin-bottom: 20px;
            line-height: 1.6;
        }
        
        .benefit-card p {
            font-size: 1.25rem;
            color: var(--gray);
            line-height: 2.1;
        }
        
        .benefit-card .value {
            margin-top: 20px;
            color: var(--gold);
            font-weight: 700;
            font-size: 1.25rem;
        }
        
        /* ========== 크루즈닷톡 ========== */
        .cruisetalk-card {
            background: linear-gradient(135deg, var(--gold-bg) 0%, var(--bg-light) 100%);
            border: 2px solid var(--gold);
        }
        
        /* ========== 골드바 (크게) ========== */
        .goldbar-section {
            background: linear-gradient(180deg, var(--bg-card) 0%, var(--bg-dark) 100%);
            text-align: center;
            padding: 100px 24px;
        }
        
        .goldbar-img {
            width: 300px;
            max-width: 85%;
            border-radius: 22px;
            margin-bottom: 45px;
            box-shadow: 0 30px 80px rgba(240,200,84,0.4);
        }
        
        .goldbar-section h3 {
            font-size: 2.2rem;
            margin-bottom: 40px;
            line-height: 1.6;
        }
        
        .goldbar-section p {
            font-size: 1.4rem;
            color: var(--gray);
            line-height: 2.5;
        }
        
        .goldbar-section .highlight-box {
            display: inline-block;
            margin-top: 45px;
            background: var(--gold-bg);
            border: 2px solid var(--gold);
            color: var(--gold);
            padding: 22px 45px;
            border-radius: 40px;
            font-weight: 700;
            font-size: 1.3rem;
        }
        
        /* ========== 의심 반박 ========== */
        .doubt-card {
            background: var(--bg-light);
            border-radius: 22px;
            padding: 35px 24px;
            margin-bottom: 25px;
            max-width: 450px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .doubt-card .q {
            font-size: 1.3rem;
            color: var(--gray);
            margin-bottom: 18px;
            font-style: italic;
            line-height: 1.6;
        }
        
        .doubt-card .a {
            font-size: 1.2rem;
            font-weight: 600;
            color: var(--light);
            line-height: 1.8;
        }
        
        .doubt-card .reg-num {
            font-size: 1rem;
            color: var(--gold);
            margin-top: 15px;
            line-height: 1.6;
        }
        
        .doubt-card .doubt-img {
            width: 100%;
            max-width: 280px;
            border-radius: 12px;
            margin-top: 20px;
        }
        
        .doubt-card .doubt-img-logo {
            height: 120px;
            margin-top: 20px;
        }
        
        /* ========== 증거 그리드 (동일 크기) ========== */
        .proof-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            max-width: 500px;
            margin: 0 auto;
        }
        
        .proof-card {
            background: var(--bg-light);
            border-radius: 20px;
            padding: 35px 20px;
            text-align: center;
            height: 240px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        
        .proof-card img {
            width: 100%;
            max-height: 70px;
            object-fit: contain;
            margin-bottom: 20px;
        }
        
        .proof-card .bank-logo {
            width: 180px;
            max-width: 90%;
            max-height: 55px;
        }
        
        .proof-card .title {
            font-size: 1.3rem;
            font-weight: 700;
        }
        
        .proof-card .desc {
            font-size: 1.15rem;
            color: var(--gray);
            margin-top: 10px;
        }
        
        /* ========== 손해 ========== */
        .loss-section {
            background: var(--bg-card);
            text-align: center;
            padding: 100px 24px;
        }
        
        .loss-section h2 {
            font-size: 2rem;
            font-weight: 800;
            margin-bottom: 50px;
            line-height: 1.7;
        }
        
        .loss-list {
            max-width: 460px;
            margin: 0 auto;
            text-align: left;
        }
        
        .loss-item {
            font-size: 1.4rem;
            margin-bottom: 35px;
            padding-left: 50px;
            position: relative;
            color: var(--light);
            line-height: 2.1;
        }
        
        .loss-item::before {
            content: '✓';
            position: absolute;
            left: 0;
            color: var(--gold);
            font-weight: 700;
            font-size: 1.5rem;
        }
        
        /* ========== FOMO ========== */
        .fomo-section {
            text-align: center;
            padding: 100px 24px;
            background: var(--bg-dark);
        }
        
        /* 롤링 카운터 */
        .rolling-counter {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 0;
            font-size: 4.5rem;
            font-weight: 900;
            color: var(--gold);
            line-height: 1;
        }
        
        .rolling-counter .digit {
            display: inline-block;
            width: 0.65em;
            text-align: center;
            transition: transform 0.3s, color 0.3s;
        }
        
        .rolling-counter .digit.bump {
            transform: scale(1.3);
            color: #ff6666;
        }
        
        .rolling-counter .comma {
            width: 0.3em;
        }
        
        .fomo-text {
            font-size: 1.5rem;
            margin: 25px 0 18px;
        }
        
        .fomo-sub {
            font-size: 1.1rem;
            color: var(--gray);
        }
        
        .deadline-badge {
            display: inline-block;
            margin-top: 30px;
            padding: 18px 30px;
            background: rgba(255,100,100,0.15);
            border: 2px solid rgba(255,100,100,0.4);
            border-radius: 40px;
            font-size: 1.2rem;
            font-weight: 600;
            color: var(--light);
        }
        
        /* ========== 긴급성 배너 ========== */
        .urgency-banner {
            background: var(--red);
            padding: 35px 24px;
            text-align: center;
        }
        
        .urgency-banner .urgency-title {
            font-size: 1.3rem;
            font-weight: 700;
            line-height: 1.8;
            margin-bottom: 20px;
        }
        
        .urgency-banner .gold-counter-text {
            display: block;
            text-align: center;
        }
        
        .urgency-banner .gold-mini-icon-sm {
            display: block;
            width: 50px;
            height: 50px;
            margin: 0 auto 10px;
        }
        
        .urgency-banner .gold-count {
            font-size: 1.8rem;
            font-weight: 900;
            color: var(--gold);
            transition: transform 0.3s, color 0.3s;
            display: inline-block;
        }
        
        .urgency-banner .gold-counter-text .gold-count {
            font-size: 1.8rem;
            font-weight: 900;
        }
        
        .urgency-banner p {
            font-size: 1.25rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 14px;
        }
        
        .urgency-dot {
            width: 14px;
            height: 14px;
            background: #fff;
            border-radius: 50%;
            animation: blink 1s infinite;
        }
        
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        
        /* ========== 가격표 ========== */
        .price-card {
            background: var(--bg-light);
            border: 2px solid rgba(255,255,255,0.1);
            border-radius: 28px;
            padding: 45px 32px;
            margin-bottom: 30px;
            max-width: 450px;
            margin-left: auto;
            margin-right: auto;
            position: relative;
        }
        
        .price-card.featured {
            border: 3px solid var(--gold);
            background: linear-gradient(180deg, rgba(240,200,84,0.1) 0%, var(--bg-light) 100%);
        }
        
        .price-card .badge {
            position: absolute;
            top: -18px; left: 50%;
            transform: translateX(-50%);
            background: var(--gold);
            color: #000;
            font-size: 1.05rem;
            font-weight: 700;
            padding: 12px 30px;
            border-radius: 22px;
        }
        
        .price-card .plan {
            font-size: 1.25rem;
            color: var(--gray);
            margin-bottom: 22px;
            text-align: center;
        }
        
        .price-card .price {
            font-size: 3rem;
            font-weight: 900;
            color: var(--gold);
            text-align: center;
            white-space: nowrap;
        }
        
        .price-card .price span {
            font-size: 1.2rem;
            font-weight: 400;
            color: var(--gray);
        }
        
        .price-card .daily {
            font-size: 1.35rem;
            color: var(--gold);
            margin-bottom: 38px;
            text-align: center;
            font-weight: 700;
            background: linear-gradient(transparent 50%, rgba(240,200,84,0.4) 50%);
            display: inline-block;
            padding: 0 8px;
        }
        
        .price-card .features {
            margin-bottom: 42px;
        }
        
        .price-card .feature {
            font-size: 1.3rem;
            color: var(--light);
            margin-bottom: 20px;
            padding-left: 42px;
            position: relative;
            line-height: 1.9;
        }
        
        .price-card .feature::before {
            content: '✓';
            position: absolute;
            left: 0;
            color: var(--gold);
            font-weight: 700;
        }
        
        .price-card .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            padding: 24px;
            background: transparent;
            border: 3px solid var(--gold);
            color: var(--gold);
            font-size: 1.35rem;
            font-weight: 700;
            border-radius: 38px;
            text-decoration: none;
            text-align: center;
            cursor: pointer;
        }
        
        .price-card.featured .btn {
            background: var(--gold);
            color: #000;
        }
        
        /* ========== 영상 후기 ========== */
        .video-review-section {
            padding: 80px 24px;
        }
        
        .video-review-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
            max-width: 500px;
            margin: 0 auto;
        }
        
        .video-review-item {
            aspect-ratio: 16/9;
            border-radius: 16px;
            overflow: hidden;
            background: var(--bg-card);
        }
        
        .video-review-item iframe {
            width: 100%;
            height: 100%;
        }
        
        /* ========== 100% 환불 보장 ========== */
        .refund-guarantee-section {
            padding: 60px 24px;
            background: linear-gradient(135deg, rgba(76,175,80,0.1) 0%, rgba(76,175,80,0.05) 100%);
        }
        
        .refund-box {
            text-align: center;
            max-width: 400px;
            margin: 0 auto;
        }
        
        .refund-title {
            font-size: 1.3rem;
            color: var(--gray);
            margin-bottom: 15px;
        }
        
        .refund-main {
            font-size: 2.5rem;
            font-weight: 900;
            margin-bottom: 20px;
        }
        
        .refund-desc {
            font-size: 1.1rem;
            color: var(--gray);
            line-height: 1.8;
        }
        
        /* ========== 스탭 소개 ========== */
        .staff-section {
            padding: 80px 24px;
            background: var(--bg-dark);
            text-align: center;
        }
        
        .staff-box {
            max-width: 400px;
            margin: 40px auto 0;
        }
        
        .staff-photo {
            width: 100%;
            border-radius: 20px;
            margin-bottom: 25px;
        }
        
        .staff-desc {
            font-size: 1.2rem;
            line-height: 1.8;
            color: var(--light);
        }
        
        /* ========== 친구 공유 ========== */
        .share-invite-section {
            padding: 80px 24px;
            background: var(--bg-card);
            text-align: center;
        }
        
        .share-title {
            font-size: 1.8rem;
            font-weight: 800;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        
        .share-desc {
            font-size: 1.1rem;
            color: var(--gray);
            line-height: 1.8;
            margin-bottom: 35px;
        }
        
        .share-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            max-width: 320px;
            margin: 0 auto 15px;
            padding: 20px;
            background: #FEE500;
            color: #3b1e1e;
            font-size: 1.1rem;
            font-weight: 700;
            border: none;
            border-radius: 30px;
            cursor: pointer;
        }
        
        .copy-link-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            max-width: 320px;
            margin: 0 auto;
            padding: 18px;
            background: var(--bg-light);
            color: var(--light);
            font-size: 1rem;
            font-weight: 600;
            border: 2px solid var(--gray);
            border-radius: 30px;
            cursor: pointer;
        }
        
        /* ========== 더좋은라이프 설명 (끝쪽) ========== */
        .partner-section {
            background: var(--bg-card);
            text-align: center;
            padding: 80px 24px;
        }
        
        .partner-box {
            background: var(--bg-light);
            border: 2px solid rgba(240,200,84,0.3);
            border-radius: 22px;
            padding: 40px 28px;
            max-width: 500px;
            margin: 0 auto;
        }
        
        .partner-box p {
            font-size: 1.15rem;
            color: var(--gray);
            line-height: 2.2;
        }
        
        /* ========== 최종 CTA ========== */
        .final-cta {
            background: var(--bg-dark);
            text-align: center;
            padding: 100px 24px 170px;
            display: block;
        }
        
        .final-cta h2 {
            font-size: 2.2rem;
            font-weight: 800;
            margin-bottom: 30px;
            line-height: 1.8;
            display: block;
        }
        
        .final-cta .sub {
            font-size: 1.3rem;
            color: var(--gray);
            margin-bottom: 55px;
            display: block;
        }
        
        .final-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--gold);
            color: #000;
            font-size: 1.5rem;
            font-weight: 800;
            padding: 28px 50px;
            border-radius: 50px;
            text-decoration: none;
            box-shadow: 0 20px 60px rgba(240,200,84,0.4);
            cursor: pointer;
            border: none;
            text-align: center;
            max-width: calc(100% - 48px);
            box-sizing: border-box;
            margin: 0 auto;
            line-height: 1.2;
        }
        
        .final-micro {
            margin-top: 40px;
            font-size: 1.2rem;
            color: var(--gray);
            display: block;
        }
        
        .final-trust-box {
            margin-top: 40px;
            padding: 25px 20px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            max-width: 350px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .final-trust-box p {
            font-size: 1.1rem;
            color: var(--light);
            margin: 10px 0;
            line-height: 1.6;
        }
        
        /* ========== 플로팅 버튼 ========== */
        .floating-cta {
            position: fixed;
            bottom: 25px;
            left: 24px;
            right: 24px;
            z-index: 90;
            background: var(--gold);
            color: #000;
            font-size: 1.35rem;
            font-weight: 800;
            padding: 26px;
            border-radius: 50px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            cursor: pointer;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            animation: slideUp 0.5s ease 2s both;
            line-height: 1.2;
        }
        
        .floating-cta .small {
            font-size: 0.95rem;
            font-weight: 500;
            opacity: 0.8;
        }
        
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(60px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        /* ========== 푸터 ========== */
        footer {
            background: #080808;
            padding: 50px 24px 160px;
            text-align: center;
        }
        
        footer img {
            height: 28px;
            margin-bottom: 25px;
            opacity: 0.6;
        }
        
        footer p {
            font-size: 0.8rem;
            color: #666;
            line-height: 1.8;
        }
        
        /* ========== 모달 ========== */
        .modal-simple {
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.92);
            z-index: 1000;
            padding: 24px;
            align-items: center;
            justify-content: center;
        }
        
        .modal-simple.active {
            display: flex;
        }
        
        .modal-simple-content {
            background: var(--bg-card);
            border-radius: 30px;
            width: 100%;
            max-width: 450px;
            padding: 55px 38px;
            position: relative;
            text-align: center;
        }
        
        .modal-close {
            position: absolute;
            top: 22px; right: 22px;
            width: 54px; height: 54px;
            background: rgba(255,255,255,0.1);
            border: none;
            border-radius: 50%;
            color: #fff;
            font-size: 2rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .modal-simple-content h2 {
            font-size: 1.9rem;
            margin-bottom: 18px;
        }
        
        .modal-simple-content .sub {
            color: var(--gray);
            margin-bottom: 45px;
            font-size: 1.15rem;
        }
        
        .modal-simple-content input {
            width: 100%;
            padding: 24px 28px;
            background: var(--bg-light);
            border: 2px solid transparent;
            border-radius: 20px;
            color: #fff;
            font-size: 1.25rem;
            margin-bottom: 20px;
            outline: none;
        }
        
        .modal-simple-content input:focus {
            border-color: var(--gold);
        }
        
        .modal-simple-content button[type="submit"] {
            width: 100%;
            padding: 26px;
            background: var(--gold);
            color: #000;
            font-size: 1.5rem;
            font-weight: 800;
            border: none;
            border-radius: 38px;
            cursor: pointer;
            margin-top: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        /* ========== 전체 설문 모달 ========== */
        .modal-full {
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.92);
            z-index: 1000;
            overflow-y: auto;
            padding: 24px;
        }
        
        .modal-full.active {
            display: flex;
            align-items: flex-start;
            justify-content: center;
        }
        
        .modal-full-content {
            background: var(--bg-card);
            border-radius: 30px;
            width: 100%;
            max-width: 500px;
            margin: 60px auto;
            overflow: hidden;
            position: relative;
        }
        
        .modal-header {
            padding: 35px 24px 25px;
            text-align: center;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        
        .modal-header h2 {
            font-size: 1.6rem;
            font-weight: 800;
            margin-bottom: 10px;
        }
        
        .modal-header p {
            color: var(--gray);
            font-size: 1.05rem;
        }
        
        .modal-body {
            padding: 30px 24px;
        }
        
        .form-step {
            display: none;
        }
        
        .form-step.active {
            display: block;
        }
        
        .step-indicator {
            display: flex;
            justify-content: center;
            gap: 12px;
            margin-bottom: 25px;
        }
        
        .step-dot {
            width: 12px;
            height: 12px;
            background: var(--bg-light);
            border-radius: 50%;
        }
        
        .step-dot.active {
            background: var(--gold);
        }
        
        .form-label {
            font-size: 1.4rem;
            font-weight: 600;
            margin-bottom: 20px;
            display: block;
            text-align: center;
            line-height: 1.5;
        }
        
        .form-input {
            width: 100%;
            padding: 18px 20px;
            background: var(--bg-light);
            border: 2px solid transparent;
            border-radius: 16px;
            color: #fff;
            font-size: 1.2rem;
            margin-bottom: 12px;
            outline: none;
        }
        
        .form-input:focus {
            border-color: var(--gold);
        }
        
        .option-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
            margin-bottom: 25px;
        }
        
        .option-item {
            background: var(--bg-light);
            border: 3px solid transparent;
            border-radius: 16px;
            padding: 20px 16px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .option-item:hover {
            border-color: rgba(240,200,84,0.5);
        }
        
        .option-item.selected {
            border-color: var(--gold);
            background: var(--gold-bg);
        }
        
        .option-item .icon {
            font-size: 2.5rem;
            margin-bottom: 12px;
        }
        
        .option-item .text {
            font-size: 1.15rem;
            font-weight: 600;
        }
        
        .option-item.with-image {
            padding: 0;
            overflow: hidden;
        }
        
        .option-item.with-image img {
            width: 100%;
            height: 90px;
            object-fit: cover;
        }
        
        .option-item.with-image .text {
            padding: 14px;
        }
        
        .promo-banner {
            background: linear-gradient(135deg, var(--gold-bg) 0%, rgba(240,200,84,0.05) 100%);
            border: 2px solid var(--gold);
            border-radius: 16px;
            padding: 18px;
            display: flex;
            align-items: center;
            gap: 16px;
        }
        
        .promo-banner img {
            width: 65px;
            height: 65px;
            object-fit: cover;
            border-radius: 12px;
        }
        
        .promo-banner .text h4 {
            font-size: 1.05rem;
            color: var(--gold);
            margin-bottom: 6px;
        }
        
        .promo-banner .text p {
            font-size: 0.95rem;
            color: var(--gray);
        }
        
        .form-btn {
            width: 100%;
            padding: 20px;
            background: var(--gold);
            color: #000;
            font-size: 1.3rem;
            font-weight: 800;
            border: none;
            border-radius: 30px;
            cursor: pointer;
            margin-top: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        /* ========== 개인정보 동의 ========== */
        .privacy-check {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 8px 0;
            font-size: 0.9rem;
            color: var(--gray);
            cursor: pointer;
        }
        
        .privacy-check input[type="checkbox"] {
            width: 20px;
            height: 20px;
            accent-color: var(--gold);
            cursor: pointer;
        }
        
        .privacy-check span {
            flex: 1;
        }
        
        /* ========== 도파민 갤러리 ========== */
        .dopamine-section {
            padding: 80px 24px;
            background: var(--bg-card);
        }
        
        .dopamine-label {
            font-size: 1.3rem;
            font-weight: 700;
            color: var(--gold);
            margin: 40px 0 20px;
            text-align: center;
        }
        
        .dopamine-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            max-width: 500px;
            margin: 0 auto;
        }
        
        .dopamine-card {
            border-radius: 16px;
            overflow: hidden;
            background: var(--bg-light);
        }
        
        .dopamine-card img {
            width: 100%;
            height: 140px;
            object-fit: cover;
        }
        
        .dopamine-card p {
            padding: 14px;
            font-size: 1rem;
            font-weight: 600;
            text-align: center;
        }
        
        /* ========== 상담 명분 섹션 ========== */
        .consult-reason-section {
            padding: 80px 24px;
            background: linear-gradient(180deg, var(--bg-card) 0%, #0d1a0d 100%);
            text-align: center;
        }
        
        .consult-title {
            font-size: 1.8rem;
            font-weight: 800;
            line-height: 1.6;
            margin-bottom: 40px;
        }
        
        .consult-cards {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            max-width: 400px;
            margin: 0 auto 40px;
        }
        
        .consult-card {
            background: rgba(240,200,84,0.08);
            border: 2px solid rgba(240,200,84,0.3);
            border-radius: 20px;
            padding: 25px 15px;
            text-align: center;
        }
        
        .consult-icon {
            font-size: 2.2rem;
            margin-bottom: 12px;
        }
        
        .consult-name {
            font-size: 1.1rem;
            font-weight: 800;
            color: var(--gold);
            margin-bottom: 8px;
        }
        
        .consult-desc {
            font-size: 0.95rem;
            color: var(--gray);
            line-height: 1.5;
        }
        
        .consult-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            max-width: 350px;
            padding: 26px;
            background: var(--gold);
            color: #000;
            font-size: 1.4rem;
            font-weight: 900;
            border: none;
            border-radius: 40px;
            cursor: pointer;
            box-shadow: 0 15px 40px rgba(240,200,84,0.4);
            animation: pulse 2s ease-in-out infinite;
            margin: 0 auto;
            line-height: 1.2;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.03); }
        }
        
        .consult-micro {
            margin-top: 20px;
            font-size: 1.1rem;
            color: var(--gray);
        }
        
        /* ========== 데스크탑 ========== */
        @media (min-width: 768px) {
            body {
                font-size: 18px;
            }
            .hero {
                max-width: 700px;
                margin: 0 auto;
            }
            .hero h1 { font-size: 3.2rem; }
            .hero-include-grid { max-width: 450px; }
            .hero-know-text { max-width: 450px; }
            .section { 
                padding: 80px 40px; 
            }
            .section-title { font-size: 2.4rem; }
            .include-grid { grid-template-columns: repeat(4, 1fr); max-width: 550px; margin: 0 auto; }
            .dest-grid { grid-template-columns: repeat(4, 1fr); }
            .proof-grid { grid-template-columns: repeat(2, 1fr); max-width: 500px; margin: 0 auto; }
            .floating-cta { left: 50%; right: auto; transform: translateX(-50%); width: auto; padding: 22px 80px; }
            .price-card { max-width: 450px; margin-left: auto; margin-right: auto; }
            .doubt-card { max-width: 450px; margin-left: auto; margin-right: auto; }
            .solve-card { max-width: 450px; margin-left: auto; margin-right: auto; }
            /* 레일은 전체 너비 */
            .review-rail, .video-review-rail-section { max-width: 100% !important; }
        }
        
        /* ========== 히어로 충격 배지 ========== */
        .shock-badge {
            display: inline-block;
            background: linear-gradient(135deg, #ff6b6b 0%, #ff4757 100%);
            color: #fff;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 700;
            margin-bottom: 15px;
            animation: pulse 2s infinite;
        }
        
        /* ========== 골드 러쉬 CTA ========== */
        .gold-rush-cta {
            background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
            padding: 60px 24px;
            text-align: center;
            border-top: 3px solid #FFD700;
            border-bottom: 3px solid #FFD700;
        }
        .gold-rush-inner {
            max-width: 400px;
            margin: 0 auto;
        }
        .gold-rush-badge {
            display: inline-block;
            background: linear-gradient(135deg, #ff6b6b 0%, #ff4757 100%);
            color: #fff;
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 700;
            margin-bottom: 20px;
            animation: pulse 2s infinite;
        }
        .gold-rush-img {
            width: 120px;
            margin-bottom: 20px;
            filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.5));
            animation: float 3s ease-in-out infinite;
        }
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        .gold-rush-cta h3 {
            font-size: 1.8rem;
            color: #fff;
            margin-bottom: 15px;
            line-height: 1.4;
        }
        .gold-rush-sub {
            color: #aaa;
            font-size: 1rem;
            margin-bottom: 25px;
            line-height: 1.6;
        }
        .gold-rush-btn {
            display: block;
            width: 100%;
            max-width: 320px;
            margin: 0 auto 15px;
            padding: 20px 40px;
            background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
            color: #000;
            font-size: 1.3rem;
            font-weight: 800;
            border: none;
            border-radius: 16px;
            cursor: pointer;
            box-shadow: 0 8px 30px rgba(255, 215, 0, 0.4);
            transition: all 0.3s;
        }
        .gold-rush-btn:active {
            transform: scale(0.98);
        }
        .gold-rush-micro {
            color: #888;
            font-size: 0.85rem;
        }
        
        /* ========== FOMO 강화 ========== */
        .fomo-live-badge {
            display: inline-block;
            background: #ff4757;
            color: #fff;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 700;
            margin-bottom: 15px;
            animation: pulse 1.5s infinite;
        }
        .fomo-urgency {
            margin: 20px 0;
        }
        .fomo-urgency p {
            color: #fff;
            font-size: 1.1rem;
            margin: 8px 0;
            line-height: 1.6;
        }
        
        /* ========== 히어로 포함 그리드 ========== */
        .hero-include-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin: 25px auto;
            max-width: 380px;
        }
        .hero-include-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            background: rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 12px 6px;
            text-align: center;
        }
        .hero-include-item .icon {
            font-size: 1.5rem;
            margin-bottom: 6px;
        }
        .hero-include-item .label {
            font-size: 0.75rem;
            color: #fff;
            line-height: 1.3;
            font-weight: 500;
        }
        .hero-include-item .tag {
            font-size: 0.7rem;
            color: var(--gold);
            font-weight: 700;
            margin-top: 4px;
        }
        .hero-know-text {
            font-size: 1.1rem;
            color: #fff;
            text-align: center;
            line-height: 1.7;
            margin: 30px auto;
            padding: 20px 24px;
            background: rgba(255,255,255,0.05);
            border-radius: 16px;
            border-left: 4px solid var(--gold);
            max-width: 380px;
        }
        
        /* ========== 영상 후기 1줄 레일 (자동 스크롤) ========== */
        .video-review-rail-section {
            padding: 50px 0;
            background: #0a0a14;
            overflow: hidden;
            max-width: 100%;
        }
        .video-rail-track {
            display: flex;
            gap: 15px;
            padding: 0 24px 20px;
            animation: videoRailScroll 25s linear infinite;
            width: max-content;
        }
        @keyframes videoRailScroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
        }
        .video-rail-track:hover {
            animation-play-state: paused;
        }
        .video-rail-item {
            flex: 0 0 220px;
            position: relative;
            border-radius: 16px;
            overflow: hidden;
            cursor: pointer;
            transition: transform 0.3s;
        }
        .video-rail-item:active { transform: scale(0.98); }
        .video-rail-item img {
            width: 100%;
            height: 140px;
            object-fit: cover;
        }
        .video-rail-item .play-icon {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -70%);
            width: 50px;
            height: 50px;
            background: rgba(255,255,255,0.9);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            color: #000;
        }
        .video-rail-item .video-label {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(transparent, rgba(0,0,0,0.8));
            padding: 20px 10px 10px;
            font-size: 0.85rem;
            color: #fff;
            text-align: center;
        }
        
        /* ========== 영상 모달 ========== */
        .video-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.95);
            z-index: 10000;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .video-modal.active { display: flex; }
        .video-modal-content {
            width: 100%;
            max-width: 800px;
            position: relative;
        }
        .video-modal-close {
            position: absolute;
            top: -50px;
            right: 0;
            background: none;
            border: none;
            color: #fff;
            font-size: 2.5rem;
            cursor: pointer;
            z-index: 10001;
        }
        .video-modal-frame {
            position: relative;
            padding-bottom: 56.25%;
            height: 0;
            border-radius: 12px;
            overflow: hidden;
        }
        .video-modal-frame iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
        
        /* ========== 이탈 방지 팝업 ========== */
        .exit-popup {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.9);
            z-index: 10002;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .exit-popup.active { display: flex; }
        .exit-popup-content {
            background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
            border-radius: 20px;
            padding: 40px 30px;
            text-align: center;
            max-width: 360px;
            width: 100%;
            border: 2px solid var(--gold);
            animation: popIn 0.3s ease;
        }
        @keyframes popIn {
            from { transform: scale(0.8); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .exit-popup-goldbar {
            width: 100px;
            margin-bottom: 20px;
            filter: drop-shadow(0 0 20px rgba(255,215,0,0.5));
        }
        .exit-popup h3 {
            font-size: 1.5rem;
            color: #fff;
            margin-bottom: 15px;
            line-height: 1.4;
        }
        .exit-popup p {
            color: #aaa;
            font-size: 1rem;
            margin-bottom: 25px;
            line-height: 1.6;
        }
        .exit-popup-cta {
            display: block;
            width: 100%;
            padding: 18px;
            background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
            color: #000;
            font-size: 1.2rem;
            font-weight: 700;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            margin-bottom: 15px;
        }
        .exit-popup-close {
            background: none;
            border: none;
            color: #666;
            font-size: 0.9rem;
            cursor: pointer;
            text-decoration: underline;
        }
        
        /* ========== 최종 CTA 골드바 배지 ========== */
        .final-goldbar-badge {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background: linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,165,0,0.2) 100%);
            border: 2px solid #FFD700;
            padding: 10px 20px;
            border-radius: 30px;
            margin-bottom: 20px;
        }
        .final-goldbar-badge span {
            color: #FFD700;
            font-weight: 700;
            font-size: 1rem;
        }
    </style>


    <!-- 상단 바 -->
    <div class="top-bar">
        <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773473793_4604.png" alt="크루즈닷">
        <div class="top-btns">
            <button class="kakao-share" onclick="shareKakao()">
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none"><path d="M16 4C9.373 4 4 8.818 4 14.73C4 18.842 6.69 22.454 10.636 24.536C10.136 26.173 8.273 28 8.273 28C8.273 28 10.636 27.09 12.318 25.863C13.5 26.045 14.727 26.136 16 26.136C22.627 26.136 28 21.318 28 15.409C28 9.499 22.627 4 16 4Z" fill="currentColor"></path></svg>
                <span>카톡 공유</span>
            </button>
            <button class="top-cta" onclick="openSimpleModal('top')">상담 신청</button>
        </div>
    </div>
    
    <!-- 히어로 -->
    <section class="hero">
        <div class="hero-video"><img src="https://leadgeny.kr/data/file/smarteditor2/2026-03-26/178db278e902feb4c5cf695b3df2058b_1774512553_2624.gif" title="178db278e902feb4c5cf695b3df2058b_1774512553_2624.gif" width="100%"><br style="clear:both;"><br style="clear:both;"><br></div><div class="hero-video">
            <iframe src="https://www.youtube.com/embed/OVvtsAZGoxo?autoplay=1&amp;mute=1&amp;loop=1&amp;playlist=OVvtsAZGoxo&amp;controls=0&amp;showinfo=0&amp;rel=0&amp;modestbranding=1&amp;playsinline=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen=""></iframe>
        </div>
        
        <div class="hero-content">
            <h1>
                월 <span class="gold marker-strong">33,000원</span><br>
                크루즈 탑니다
            </h1>
            
            <p class="hero-sub">
                월 <span class="marker">33,000원</span> · <span class="hl">3,000명+</span> 이미 다녀옴
            </p>
            
            <div class="hero-include-grid">
                <div class="hero-include-item">
                    <span class="icon">✈️</span>
                    <span class="label">왕복 항공</span>
                    <span class="tag">포함</span>
                </div>
                <div class="hero-include-item">
                    <span class="icon">🚢</span>
                    <span class="label">크루즈 선실</span>
                    <span class="tag">포함</span>
                </div>
                <div class="hero-include-item">
                    <span class="icon">🏨</span>
                    <span class="label">기항지 숙박</span>
                    <span class="tag">포함</span>
                </div>
                <div class="hero-include-item">
                    <span class="icon">🍽️</span>
                    <span class="label">식사</span>
                    <span class="tag">포함</span>
                </div>
                <div class="hero-include-item">
                    <span class="icon">🗺️</span>
                    <span class="label">기항지 관광</span>
                    <span class="tag">포함</span>
                </div>
                <div class="hero-include-item">
                    <span class="icon">🛡️</span>
                    <span class="label">여행자 보험</span>
                    <span class="tag">포함</span>
                </div>
                <div class="hero-include-item">
                    <span class="icon">👨‍✈️</span>
                    <span class="label">전문 인솔자</span>
                    <span class="tag">포함</span>
                </div>
                <div class="hero-include-item">
                    <span class="icon">📸</span>
                    <span class="label">사진 촬영</span>
                    <span class="tag">포함</span>
                </div>
            </div>
            
            <p class="hero-know-text">
                아는 분들은 <span class="gold">크루즈닷</span>에서<br>
                프리미엄 패키지 크루즈 여행 합니다.
            </p>
            
            <button class="hero-cta" onclick="openSimpleModal('hero')">
                30초 상담신청
            </button>
            
            <p class="hero-micro">상담 ≠ 가입 · 궁금한 것만 물어보세요</p>
        </div>
    </section>
    
    <!-- 후기 레일 (문장+별점) -->
    <section class="review-rail">
        <div class="social-proof-badge">
            <span class="proof-number">3,000+</span>명 다녀왔어요 · 만족도 <span class="gold">4.8점</span>
        </div>
        
        <h2 class="review-rail-title">
            <span class="gold">실제 고객님들</span>이<br>
            다녀온 후기예요
        </h2>
        
        <div class="review-track">
            <div class="review-card">
                <div class="image"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773472342_1201.png" alt=""></div>
                <div class="content">
                    <div class="stars">★★★★★</div>
                    <p class="text">"영어 걱정 없이 편하게 다녀왔어요"</p>
                    <p class="reviewer">김○자님 (63세)</p>
                    <p class="location">🇬🇷 산토리니</p>
                </div>
            </div>
            <div class="review-card">
                <div class="image"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773472617_6317.png" alt=""></div>
                <div class="content">
                    <div class="stars">★★★★★</div>
                    <p class="text">"인솔자님이 사진 예쁘게 찍어주셨어요"</p>
                    <p class="reviewer">이○희님 (58세)</p>
                    <p class="location">🇮🇹 베니스</p>
                </div>
            </div>
            <div class="review-card">
                <div class="image"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773477757_0009.png" alt=""></div>
                <div class="content">
                    <div class="stars">★★★★★</div>
                    <p class="text">"예약부터 여행까지 다 해주셔서 편했어요"</p>
                    <p class="reviewer">박○수님 (67세)</p>
                    <p class="location">🇺🇸 미국</p>
                </div>
            </div>
            <div class="review-card">
                <div class="image"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773477814_8668.png" alt=""></div>
                <div class="content">
                    <div class="stars">★★★★★</div>
                    <p class="text">"짐 한 번 풀고 여러 나라 가서 좋았어요"</p>
                    <p class="reviewer">최○영님 (61세)</p>
                    <p class="location">🏔️ 알래스카</p>
                </div>
            </div>
            <div class="review-card">
                <div class="image"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773472655_7293.png" alt=""></div>
                <div class="content">
                    <div class="stars">★★★★★</div>
                    <p class="text">"발코니룸에서 보는 바다가 최고예요"</p>
                    <p class="reviewer">정○미님 (55세)</p>
                    <p class="location">발코니룸</p>
                </div>
            </div>
            <div class="review-card">
                <div class="image"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773472310_2797.png" alt=""></div>
                <div class="content">
                    <div class="stars">★★★★★</div>
                    <p class="text">"정찬 코스요리가 정말 맛있었어요"</p>
                    <p class="reviewer">한○숙님 (69세)</p>
                    <p class="location">정찬 디너</p>
                </div>
            </div>
            <div class="review-card">
                <div class="image"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773477559_4169.png" alt=""></div>
                <div class="content">
                    <div class="stars">★★★★★</div>
                    <p class="text">"이 가격에 이 퀄리티 말이 안 돼요"</p>
                    <p class="reviewer">오○진님 (52세)</p>
                    <p class="location">🇸🇬 싱가포르</p>
                </div>
            </div>
            <div class="review-card">
                <div class="image"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773477576_2209.png" alt=""></div>
                <div class="content">
                    <div class="stars">★★★★★</div>
                    <p class="text">"가전도 받고 여행도 가고 일석이조"</p>
                    <p class="reviewer">강○희님 (60세)</p>
                    <p class="location">🇲🇾 말레이시아</p>
                </div>
            </div>
            <!-- 복제 -->
            <div class="review-card">
                <div class="image"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773472342_1201.png" alt=""></div>
                <div class="content">
                    <div class="stars">★★★★★</div>
                    <p class="text">"영어 걱정 없이 편하게 다녀왔어요"</p>
                    <p class="reviewer">김○자님 (63세)</p>
                    <p class="location">🇬🇷 산토리니</p>
                </div>
            </div>
            <div class="review-card">
                <div class="image"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773472617_6317.png" alt=""></div>
                <div class="content">
                    <div class="stars">★★★★★</div>
                    <p class="text">"인솔자님이 사진 예쁘게 찍어주셨어요"</p>
                    <p class="reviewer">이○희님 (58세)</p>
                    <p class="location">🇮🇹 베니스</p>
                </div>
            </div>
            <div class="review-card">
                <div class="image"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773477757_0009.png" alt=""></div>
                <div class="content">
                    <div class="stars">★★★★★</div>
                    <p class="text">"예약부터 여행까지 다 해주셔서 편했어요"</p>
                    <p class="reviewer">박○수님 (67세)</p>
                    <p class="location">🇺🇸 미국</p>
                </div>
            </div>
            <div class="review-card">
                <div class="image"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773477814_8668.png" alt=""></div>
                <div class="content">
                    <div class="stars">★★★★★</div>
                    <p class="text">"짐 한 번 풀고 여러 나라 가서 좋았어요"</p>
                    <p class="reviewer">최○영님 (61세)</p>
                    <p class="location">🏔️ 알래스카</p>
                </div>
            </div>
            <div class="review-card">
                <div class="image"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773472655_7293.png" alt=""></div>
                <div class="content">
                    <div class="stars">★★★★★</div>
                    <p class="text">"발코니룸에서 보는 바다가 최고예요"</p>
                    <p class="reviewer">정○미님 (55세)</p>
                    <p class="location">발코니룸</p>
                </div>
            </div>
            <div class="review-card">
                <div class="image"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773472310_2797.png" alt=""></div>
                <div class="content">
                    <div class="stars">★★★★★</div>
                    <p class="text">"정찬 코스요리가 정말 맛있었어요"</p>
                    <p class="reviewer">한○숙님 (69세)</p>
                    <p class="location">정찬 디너</p>
                </div>
            </div>
            <div class="review-card">
                <div class="image"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773477559_4169.png" alt=""></div>
                <div class="content">
                    <div class="stars">★★★★★</div>
                    <p class="text">"이 가격에 이 퀄리티 말이 안 돼요"</p>
                    <p class="reviewer">오○진님 (52세)</p>
                    <p class="location">🇸🇬 싱가포르</p>
                </div>
            </div>
            <div class="review-card">
                <div class="image"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773477576_2209.png" alt=""></div>
                <div class="content">
                    <div class="stars">★★★★★</div>
                    <p class="text">"가전도 받고 여행도 가고 일석이조"</p>
                    <p class="reviewer">강○희님 (60세)</p>
                    <p class="location">🇲🇾 말레이시아</p>
                </div>
            </div>
        </div>
    </section>
    
    <!-- 여행지 갤러리 -->
    <section class="dest-section">
        <h2 class="section-title">
            어디로<br>
            <span class="gold">떠나볼까요?</span>
        </h2>
        
        <div class="dest-category">
            <h3>🗾 일본 / 중국 / 대만 / 동남아</h3>
            <div class="dest-grid">
                <div class="dest-item"><img src="https://leadgeny.kr/data/file/smarteditor2/2026-03-06/ef928014880102caf4347ef7e9cc84f7_1772775526_349.png" alt=""><span class="name">도쿄</span></div>
                <div class="dest-item"><img src="https://leadgeny.kr/data/file/smarteditor2/2026-03-06/ef928014880102caf4347ef7e9cc84f7_1772775527_9384.png" alt=""><span class="name">대만</span></div>
                <div class="dest-item"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773477559_4169.png" alt=""><span class="name">싱가포르</span></div>
                <div class="dest-item"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773477576_2209.png" alt=""><span class="name">말레이시아</span></div>
            </div>
        </div>
        
        <div class="dest-category">
            <h3>🌍 지중해 / 유럽</h3>
            <div class="dest-grid">
                <div class="dest-item"><img src="https://leadgeny.kr/data/file/smarteditor2/2026-02-21/57d5e08d787d5ee7f5b85c3a1ea61125_1771662697_167.jpg" alt=""><span class="name">산토리니</span></div>
                <div class="dest-item"><img src="https://leadgeny.kr/data/file/smarteditor2/2026-02-21/57d5e08d787d5ee7f5b85c3a1ea61125_1771662685_689.jpg" alt=""><span class="name">미코노스</span></div>
                <div class="dest-item"><img src="https://leadgeny.kr/data/file/smarteditor2/2026-02-21/57d5e08d787d5ee7f5b85c3a1ea61125_1771662702_9777.png" alt=""><span class="name">아테네</span></div>
                <div class="dest-item"><img src="https://leadgeny.kr/data/file/smarteditor2/2026-02-21/57d5e08d787d5ee7f5b85c3a1ea61125_1771662676_0791.png" alt=""><span class="name">로도스</span></div>
            </div>
        </div>
        
        <div class="dest-category">
            <h3>🇺🇸 미국 / 알래스카</h3>
            <div class="dest-grid">
                <div class="dest-item"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773477757_0009.png" alt=""><span class="name">미국</span></div>
                <div class="dest-item"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773477782_5028.png" alt=""><span class="name">미국</span></div>
                <div class="dest-item"><img src="https://leadgeny.kr/data/file/smarteditor2/2026-02-21/57d5e08d787d5ee7f5b85c3a1ea61125_1771662719_5008.png" alt=""><span class="name">알래스카</span></div>
                <div class="dest-item"><img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773477814_8668.png" alt=""><span class="name">알래스카</span></div>
            </div>
        </div>
    </section>
    
    <!-- 영상 2개 (동남아 + 지중해 자동재생) -->
    <section class="video-section">
        <h2 class="section-title" style="margin-bottom: 50px;">
            <span class="gold">이런 여행</span>입니다
        </h2>
        
        <div class="video-box">
            <p class="video-label">🌴 동남아 크루즈</p>
            <div class="video-wrap">
                <iframe src="https://www.youtube.com/embed/OVvtsAZGoxo?autoplay=1&amp;mute=1&amp;loop=1&amp;playlist=OVvtsAZGoxo&amp;controls=0&amp;playsinline=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen=""></iframe>
            </div>
        </div>
        
        <div class="video-box">
            <p class="video-label">🇬🇷 지중해 크루즈</p>
            <div class="video-wrap">
                <iframe src="https://www.youtube.com/embed/nnYYts13rSk?autoplay=1&amp;mute=1&amp;loop=1&amp;playlist=nnYYts13rSk&amp;controls=0&amp;playsinline=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen=""></iframe>
            </div>
        </div>
    </section>
    
    <!-- 🔥 도파민 갤러리 (음식/럭셔리/액티비티) -->
    <section class="dopamine-section">
        <h2 class="section-title" style="font-size: 1.8rem;">
            크루즈에서<br>
            <span class="gold">이렇게 즐겨요</span>
        </h2>
        
        <!-- 음식 -->
        <p class="dopamine-label">🍽️ 매일 먹는 호텔급 식사</p>
        <div class="dopamine-grid">
            <div class="dopamine-card">
                <img src="https://leadgeny.kr/data/file/smarteditor2/2025-10-27/54a2965554025e10bfc57b0ad56b4fb6_1761545986_0648.jpg" alt="랍스터">
                <p>랍스터 정찬</p>
            </div>
            <div class="dopamine-card">
                <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773484019_0096.jpg" alt="스테이크">
                <p>프리미엄 스테이크</p>
            </div>
            <div class="dopamine-card">
                <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773484014_9307.jpg" alt="뷔페">
                <p>무제한 뷔페</p>
            </div>
            <div class="dopamine-card">
                <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773484015_5047.jpg" alt="디저트">
                <p>디저트 천국</p>
            </div>
        </div>
        
        <!-- 럭셔리 -->
        <p class="dopamine-label">✨ 5성급 호텔급 시설</p>
        <div class="dopamine-grid">
            <div class="dopamine-card">
                <img src="https://leadgeny.kr/data/file/smarteditor2/2025-10-16/367385125f90c22fea73c62c2a7f18d2_1760604503_259.jpg" alt="발코니">
                <p>오션뷰 발코니</p>
            </div>
            <div class="dopamine-card">
                <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773484017_8162.jpg" alt="자쿠지">
                <p>루프탑 자쿠지</p>
            </div>
            <div class="dopamine-card">
                <img src="https://leadgeny.kr/data/file/smarteditor2/2025-10-27/54a2965554025e10bfc57b0ad56b4fb6_1761546043_1838.jpg" alt="칵테일">
                <p>선셋 칵테일</p>
            </div>
            <div class="dopamine-card">
                <img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-02/2aaf4aa2aa0950f4d179e35f99934319_1754125460_5572.png" alt="스파">
                <p>프리미엄 스파</p>
            </div>
        </div>
        
        <!-- 액티비티 -->
        <p class="dopamine-label">🎢 온가족 즐기는 액티비티</p>
        <div class="dopamine-grid">
            <div class="dopamine-card">
                <img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-02/2aaf4aa2aa0950f4d179e35f99934319_1754121314_9975.png" alt="워터파크">
                <p>워터 슬라이드</p>
            </div>
            <div class="dopamine-card">
                <img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-02/2aaf4aa2aa0950f4d179e35f99934319_1754127848_6114.png" alt="공연">
                <p>브로드웨이 공연</p>
            </div>
            <div class="dopamine-card">
                <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773484016_793.jpg" alt="LED돔">
                <p>LED 돔 쇼</p>
            </div>
            <div class="dopamine-card">
                <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773484018_3133.jpg" alt="키즈">
                <p>키즈 워터파크</p>
            </div>
        </div>
    </section>
    
    <!-- 🔥 도파민 직후 가격표 (감정 피크에서 가격 노출) -->
    <section class="section bg-dark" id="pricing" style="padding-top: 60px;">
        <h2 class="section-title"><img src="https://leadgeny.kr/data/file/smarteditor2/2026-04-02/45e971946fa94ef414ab10dfc6de1b28_1775107799_2649.png" title="45e971946fa94ef414ab10dfc6de1b28_1775107799_2649.png" width="100%"><br style="clear:both;"><br></h2><h2 class="section-title">
            지금 보신 <span class="gold">모든 것</span><br>
            월 33,000원부터
        </h2>
        
        <p class="section-sub" style="margin-bottom: 35px;">커피값으로 크루즈 타세요</p>
        
        <div class="price-card">
            <div class="cruise-img-box" style="margin: -20px -20px 20px -20px; border-radius: 20px 20px 0 0; overflow: hidden;">
                <img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-02/2aaf4aa2aa0950f4d179e35f99934319_1754120286_6061.png" alt="MSC 벨리시마" style="width: 100%; height: 180px; object-fit: cover;">
                <p style="background: rgba(0,0,0,0.8); color: #fff; font-size: 1rem; padding: 10px; text-align: center; margin: 0; font-weight: 600;">🚢 MSC 벨리시마</p>
            </div>
            <p class="plan">A 플랜 · 근거리</p>
            <p class="price">33,000<span>원/월</span></p>
            <p class="daily">하루 1,100원</p>
            <div class="features">
                <p class="feature">일본/동남아 4박5일</p>
                <p class="feature">프리미엄 가전 제공</p>
                <p class="feature">🏥 강남세브란스 VIP</p>
                <p class="feature">🏨 국내숙박 이용권</p>
            </div>
            <button class="btn" onclick="openSimpleModal('A플랜')">상담 신청</button>
        </div>
        
        <div class="price-card featured">
            <span class="badge">인기</span>
            <div class="cruise-img-box" style="margin: -20px -20px 20px -20px; border-radius: 20px 20px 0 0; overflow: hidden;">
                <img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-02/2aaf4aa2aa0950f4d179e35f99934319_1754122767_2326.png" alt="로얄캐리비안 아이콘" style="width: 100%; height: 180px; object-fit: cover;">
                <p style="background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%); color: #fff; font-size: 1rem; padding: 10px; text-align: center; margin: 0; font-weight: 700;">🚢 로얄캐리비안 · 인기 1위</p>
            </div>
            <p class="plan">B 플랜 · 동남아 프리미엄</p>
            <p class="price">66,000<span>원/월</span></p>
            <p class="daily">하루 2,200원</p>
            <div class="features">
                <p class="feature">5성급 동남아 패키지</p>
                <p class="feature">삼성 가전 풀세트</p>
                <p class="feature">🏥 강남세브란스 VIP</p>
                <p class="feature">🏆 4명 단체 시 골드바</p>
            </div>
            <button class="btn" onclick="openSimpleModal('B플랜')">상담 신청</button>
        </div>
        
        <div class="price-card">
            <div class="cruise-img-box" style="margin: -20px -20px 20px -20px; border-radius: 20px 20px 0 0; overflow: hidden;">
                <img src="https://leadgeny.kr/data/file/smarteditor2/2025-08-02/2aaf4aa2aa0950f4d179e35f99934319_1754120106_898.png" alt="MSC 씨사이드" style="width: 100%; height: 180px; object-fit: cover;">
                <p style="background: rgba(0,0,0,0.8); color: #fff; font-size: 1rem; padding: 10px; text-align: center; margin: 0; font-weight: 600;">🚢 MSC 씨사이드 · 럭셔리</p>
            </div>
            <p class="plan">C 플랜 · 지중해/유럽</p>
            <p class="price">99,000<span>원/월</span></p>
            <p class="daily">하루 3,300원</p>
            <div class="features">
                <p class="feature">지중해/알래스카 7박8일</p>
                <p class="feature">삼성 프리미엄 가전</p>
                <p class="feature">🏥 강남세브란스 VIP</p>
                <p class="feature">🏆 4명 단체 시 골드바</p>
            </div>
            <button class="btn" onclick="openSimpleModal('C플랜')">상담 신청</button>
        </div>
        
        <div class="price-trust-box pulse-gold" style="background: rgba(240,200,84,0.15); border: 2px solid var(--gold); border-radius: 16px; padding: 25px; margin-top: 30px; max-width: 400px; margin-left: auto; margin-right: auto;">
            <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773473086_621.png" alt="신한은행" style="height: 100px; margin-bottom: 18px;">
            <p style="font-size: 1.2rem; line-height: 1.9; font-weight: 700;">
                <span class="marker-strong">✓ 신한은행</span> 안전 보장<br>
                <span class="marker-strong">✓ 100% 환불</span> 여행 안 가면
            </p>
        </div>
    </section>
    
    <!-- 🔥 골드바 이벤트 (도파민 강화) -->
    <section class="goldbar-event-section" style="background: linear-gradient(135deg, #1a1a2e 0%, #0d0d15 100%); padding: 50px 24px; text-align: center;">
        <div style="max-width: 420px; margin: 0 auto;">
            <p style="font-size: 1.1rem; color: var(--gold); margin-bottom: 15px; letter-spacing: 2px;">🏆 LIMITED EVENT</p>
            
            <h2 style="font-size: 2rem; color: #fff; line-height: 1.6; margin-bottom: 30px;">
                <span class="marker">4명 단체</span> 신청 시<br>
                <span class="gold marker-strong" style="font-size: 2.4rem;">순금 골드바</span><br>
                <span style="font-size: 1.8rem;">각 1개씩 증정</span>
            </h2>
            
            <!-- 골드바 이미지 블럭 1 -->
            <div style="background: rgba(212,175,55,0.1); border: 2px solid var(--gold); border-radius: 16px; padding: 20px; margin-bottom: 20px;">
                <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773470235_2635.png" alt="골드바" style="width: 100%; max-width: 280px; border-radius: 12px; margin-bottom: 12px;">
                <p style="font-size: 1.1rem; color: var(--gold); font-weight: 600;">순금 0.1g ~ 0.3g</p>
                <p style="font-size: 0.95rem; color: var(--gray);">플랜별 중량 상이</p>
            </div>
            
            <!-- 골드바 이미지 블럭 2 -->
            <div style="background: rgba(212,175,55,0.1); border: 2px solid var(--gold); border-radius: 16px; padding: 20px; margin-bottom: 30px;">
                <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773470235_3585.png" alt="골드바 패키지" style="width: 100%; max-width: 280px; border-radius: 12px; margin-bottom: 12px;">
                <p style="font-size: 1.1rem; color: var(--gold); font-weight: 600;">4명 전원 증정</p>
                <p style="font-size: 0.95rem; color: var(--gray);">친구, 가족, 동호회 함께!</p>
            </div>
            
            <p style="font-size: 1.2rem; color: #fff; line-height: 1.8; margin-bottom: 25px; font-weight: 600;">
                <span class="gold">불경기에 순금까지!</span><br>
                여행도 가고, 금도 받고 🏆
            </p>
            
            <button class="btn" onclick="openFullModal('goldbar')" style="background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%); font-size: 1.2rem; padding: 18px 50px; width: 100%; max-width: 320px;">
                골드바 이벤트 상담받기
            </button>
            
            <p style="font-size: 0.95rem; color: var(--gray); margin-top: 15px;">
                B플랜/C플랜 · 선착순 마감
            </p>
        </div>
    </section>
    
    <!-- 실제 인솔 이미지 (도파민 유지) -->
    <section class="section bg-dark escort-section">
        <h2 class="section-title">
            당신의 여행을<br>
            <span class="gold">프리미엄급</span>으로
        </h2>
        
        <p class="section-sub">실제 이렇게 즐기게 됩니다</p>
        <p class="section-sub2">11년 경력 인솔자가 함께합니다</p>
        
        <div class="escort-gallery">
            <div class="escort-img">
                <img src="https://leadgeny.kr/data/file/smarteditor2/2025-09-12/77e030891f0e61cdcb9d7d749405b536_1757607688_3325.jpg" alt="크루즈닷 전용 스탭">
                <p class="caption">📸 크루즈닷 전용 스탭 영상, 사진 촬영</p>
            </div>
            <div class="escort-img">
                <img src="https://leadgeny.kr/data/file/smarteditor2/2025-09-12/77e030891f0e61cdcb9d7d749405b536_1757609165_4821.jpg" alt="이벤트 행사">
                <p class="caption">✨ 크루즈닷 만의 이벤트 행사 지원</p>
            </div>
            <div class="escort-img">
                <img src="https://leadgeny.kr/data/file/smarteditor2/2025-09-12/77e030891f0e61cdcb9d7d749405b536_1757608164_2358.jpg" alt="쉽투어 코스">
                <p class="caption">🚢 크루즈 쉽투어 코스 안내</p>
            </div>
        </div>
    </section>
    
    <!-- 의심 반박 (이미지 포함) -->
    <section class="section bg-card">
        <h2 class="section-title">
            혹시<br>
            <span class="gold">이런 생각</span>?
        </h2>
        
        <p class="section-sub">다 대답해드릴게요</p>
        
        <div class="doubt-card">
            <p class="q">"여행사 맞나요?"</p>
            <p class="a">
                <span class="gold marker-strong">네, 맞습니다.</span><br><br>
                크루즈 전문 여행사와 꼭 함께 하세요.<br>
                <span class="marker">11년 전문</span>크루즈 여행<br><br>
                보증보험까지 완료 안전하게<br>
                크루즈닷은 <span class="marker">정식 관광사업자</span>예요.
            </p>
            <p class="reg-num">📋 관광사업자 등록번호: 2025-000004호</p>
            
            <div class="proof-docs" style="margin-top: 20px;">
                <p style="font-size: 0.95rem; color: var(--gray); margin-bottom: 12px;">〈크루즈닷 관광사업 등록증〉</p>
                <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-15/ed72e289fd0e0f0e81ff43b3f963e182_1773500655_154.jpg" alt="관광사업등록증" class="doubt-img" style="margin-bottom: 20px;">
                
                <p style="font-size: 0.95rem; color: var(--gray); margin-bottom: 12px;">〈크루즈닷 인허가보증보험 증권〉</p>
                <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-15/ed72e289fd0e0f0e81ff43b3f963e182_1773500803_1931.jpg" alt="인허가보증보험증권" class="doubt-img">
            </div>
            
            <div class="safety-badge" style="background: linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(184,134,11,0.1) 100%); border: 2px solid var(--gold); border-radius: 16px; padding: 20px; margin-top: 25px; text-align: center;">
                <p style="font-size: 1.2rem; font-weight: 700; color: var(--gold); margin-bottom: 8px;">
                    🛡️ 합법 · 안전 · 보증보험 완비
                </p>
                <p style="font-size: 1rem; color: var(--light); line-height: 1.6;">
                    관광사업 등록 + 인허가보증보험<br>
                    <span class="marker-strong">법적으로 보호받는 안전한 여행사</span>
                </p>
            </div>
        </div>
        
        <div class="doubt-card">
            <p class="q">"가전선물? 혹시 렌탈?"</p>
            <p class="a">
                빌리는 상품이 아닙니다.<br>크루즈닷만의 <span class="marker">나의 상품</span>이에요.<br>
            </p>
            <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773471376_3007.png" alt="프리미엄 가전" class="doubt-img">
        </div>
        
        <div class="doubt-card">
            <p class="q">"돈 날리는 거 아니야?"</p>
            <p class="a">
                ❌ 아닙니다.<br>
                <span class="marker-strong">신한은행</span>이 보장해요.
            </p>
            <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773473086_621.png" alt="신한은행" class="doubt-img-logo">
        </div>
        
        <div class="doubt-card">
            <p class="q">"상담만 받아도 되나요?"</p>
            <p class="a">
                <span class="gold marker-strong">당연하죠!</span><br>
                전화 5분이면 끝나요.<br>
                궁금한 것만 물어보세요.<br><br>
                <span class="marker-strong" style="font-size: 1.3rem;">상담 ≠ 가입</span>
            </p>
            
            <!-- 전문성 티업 -->
            <div class="expert-box" style="background: rgba(240,200,84,0.1); border-radius: 16px; padding: 20px; margin-top: 25px; text-align: left;">
                <p style="font-size: 1.15rem; color: var(--gold); font-weight: 700; margin-bottom: 15px; text-align: center;">👨‍✈️ 전문 매니저가 직접 상담</p>
                <p style="font-size: 1.1rem; color: var(--light); line-height: 2;">
                    <span class="marker">✓ 크루즈 최소 3회 이상</span> 직접 경험<br>
                    <span class="marker">✓ 10년+ 승무원 출신</span> 현장 전문가<br>
                    <span class="marker">✓ 11년 인솔자 교육</span>으로 다져진 팀
                </p>
                <p style="font-size: 1rem; color: var(--gray); margin-top: 15px; text-align: center;">
                    영업사원 ❌ → <span class="gold">크루즈 전문가</span>가 답해드려요
                </p>
            </div>
            
            <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773490111_2195.png" alt="크루즈닷 스탭" class="doubt-img">
        </div>
    </section>
    
    <!-- 신한은행 신뢰 -->
    <section class="trust-section">
        <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773473086_621.png" alt="신한은행" class="trust-logo">
        
        <h3>
            <span class="gold marker-strong">신한은행</span>이<br>
            보장합니다
        </h3>
        
        <p>
            준비금은 신한은행에서<br>
            <span class="marker">안전하게 보관</span>됩니다
        </p>
    </section>
    
    <!-- 100% 환불 보장 (신뢰 직후) -->
    <section class="refund-guarantee-section">
        <div class="refund-box pulse-gold">
            <p class="refund-title">💰 여행 안 가시면?</p>
            <p class="refund-main"><span class="gold marker-strong">100% 환불</span></p>
            <p class="refund-desc">
                준비금은 <span class="marker">신한은행</span>이 보장합니다<br>
                여행에 쓰지 않으면 전액 돌려드려요
            </p>
        </div>
    </section>
    
    <!-- 영상 후기 (1줄 레일 - 자동 스크롤) -->
    <section class="video-review-rail-section">
        <h2 class="section-title" style="padding: 0 24px;">
            <span class="gold">실제 고객</span> 영상 후기
        </h2>
        <p class="section-sub" style="padding: 0 24px; margin-bottom: 20px;">터치하면 영상 재생</p>
        
        <div class="video-rail-track">
            <!-- 원본 -->
            <div class="video-rail-item" onclick="openVideoModal('acYl4x4E6uw')">
                <img src="https://img.youtube.com/vi/acYl4x4E6uw/mqdefault.jpg" alt="후기1">
                <div class="play-icon">▶</div>
                <p class="video-label">지중해 7박8일</p>
            </div>
            <div class="video-rail-item" onclick="openVideoModal('kpORmwnhyIw')">
                <img src="https://img.youtube.com/vi/kpORmwnhyIw/mqdefault.jpg" alt="후기2">
                <div class="play-icon">▶</div>
                <p class="video-label">동남아 크루즈</p>
            </div>
            <div class="video-rail-item" onclick="openVideoModal('aYecqJNONZI')">
                <img src="https://img.youtube.com/vi/aYecqJNONZI/mqdefault.jpg" alt="후기3">
                <div class="play-icon">▶</div>
                <p class="video-label">알래스카 여행</p>
            </div>
            <div class="video-rail-item" onclick="openVideoModal('BIsNfX0-5UI')">
                <img src="https://img.youtube.com/vi/BIsNfX0-5UI/mqdefault.jpg" alt="후기4">
                <div class="play-icon">▶</div>
                <p class="video-label">가족 크루즈</p>
            </div>
            <div class="video-rail-item" onclick="openVideoModal('QcTTmP5Ldt4')">
                <img src="https://img.youtube.com/vi/QcTTmP5Ldt4/mqdefault.jpg" alt="후기5">
                <div class="play-icon">▶</div>
                <p class="video-label">신혼 크루즈</p>
            </div>
            <div class="video-rail-item" onclick="openVideoModal('QkC4Ymf7CR8')">
                <img src="https://img.youtube.com/vi/QkC4Ymf7CR8/mqdefault.jpg" alt="후기6">
                <div class="play-icon">▶</div>
                <p class="video-label">프리미엄 여행</p>
            </div>
            <!-- 복제 (무한 스크롤용) -->
            <div class="video-rail-item" onclick="openVideoModal('acYl4x4E6uw')">
                <img src="https://img.youtube.com/vi/acYl4x4E6uw/mqdefault.jpg" alt="후기1">
                <div class="play-icon">▶</div>
                <p class="video-label">지중해 7박8일</p>
            </div>
            <div class="video-rail-item" onclick="openVideoModal('kpORmwnhyIw')">
                <img src="https://img.youtube.com/vi/kpORmwnhyIw/mqdefault.jpg" alt="후기2">
                <div class="play-icon">▶</div>
                <p class="video-label">동남아 크루즈</p>
            </div>
            <div class="video-rail-item" onclick="openVideoModal('aYecqJNONZI')">
                <img src="https://img.youtube.com/vi/aYecqJNONZI/mqdefault.jpg" alt="후기3">
                <div class="play-icon">▶</div>
                <p class="video-label">알래스카 여행</p>
            </div>
            <div class="video-rail-item" onclick="openVideoModal('BIsNfX0-5UI')">
                <img src="https://img.youtube.com/vi/BIsNfX0-5UI/mqdefault.jpg" alt="후기4">
                <div class="play-icon">▶</div>
                <p class="video-label">가족 크루즈</p>
            </div>
            <div class="video-rail-item" onclick="openVideoModal('QcTTmP5Ldt4')">
                <img src="https://img.youtube.com/vi/QcTTmP5Ldt4/mqdefault.jpg" alt="후기5">
                <div class="play-icon">▶</div>
                <p class="video-label">신혼 크루즈</p>
            </div>
            <div class="video-rail-item" onclick="openVideoModal('QkC4Ymf7CR8')">
                <img src="https://img.youtube.com/vi/QkC4Ymf7CR8/mqdefault.jpg" alt="후기6">
                <div class="play-icon">▶</div>
                <p class="video-label">프리미엄 여행</p>
            </div>
        </div>
    </section>
    
    <!-- 영상 모달 -->
    <div class="video-modal" id="video-modal" onclick="closeVideoModal()">
        <div class="video-modal-content" onclick="event.stopPropagation()">
            <button class="video-modal-close" onclick="closeVideoModal()">×</button>
            <div class="video-modal-frame">
                <iframe id="video-iframe" src="" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen=""></iframe>
            </div>
        </div>
    </div>
    
    <!-- 🎁 상담만 해도 이득 섹션 -->
    <section class="bonus-section" style="background: linear-gradient(135deg, #1a1a2e 0%, #0d0d15 100%); padding: 60px 24px; text-align: center;">
        <div style="max-width: 420px; margin: 0 auto;">
            <p style="font-size: 1rem; color: var(--gold); margin-bottom: 15px; letter-spacing: 2px;">🎁 상담 신청 특별 혜택</p>
            
            <h2 style="font-size: 1.8rem; color: #fff; line-height: 1.6; margin-bottom: 30px;">
                상담 신청만 해도<br>
                <span class="marker-strong" style="font-size: 2.4rem; color: var(--gold);">100만원 상당</span><br>
                할인 정보 드려요
            </h2>
            
            <!-- 받는 것들 -->
            <div style="background: rgba(240,200,84,0.12); border: 2px solid var(--gold); border-radius: 20px; padding: 30px 25px; margin-bottom: 30px; text-align: left;">
                <p style="font-size: 1.15rem; color: var(--gold); font-weight: 700; margin-bottom: 20px; text-align: center;">📋 상담 신청하면 받는 것</p>
                
                <div style="margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid rgba(240,200,84,0.2);">
                    <p style="font-size: 1.2rem; color: #fff; font-weight: 700; margin-bottom: 5px;">
                        🚢 5성급 럭셔리 크루즈 상품 정보
                    </p>
                    <p style="font-size: 1rem; color: var(--gray);">로얄캐리비안, MSC, 코스타 전 라인업</p>
                </div>
                
                <div style="margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid rgba(240,200,84,0.2);">
                    <p style="font-size: 1.2rem; color: #fff; font-weight: 700; margin-bottom: 5px;">
                        💰 100만원 상당 할인 정보
                    </p>
                    <p style="font-size: 1rem; color: var(--gray);">시즌별 특가 + 단체 할인 + 얼리버드</p>
                </div>
                
                <div style="margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid rgba(240,200,84,0.2);">
                    <p style="font-size: 1.2rem; color: #fff; font-weight: 700; margin-bottom: 5px;">
                        📱 크루즈닷 유튜브 &amp; 카톡방 초대
                    </p>
                    <p style="font-size: 1rem; color: var(--gray);">실시간 후기 + 꿀팁 + 동행 모집</p>
                </div>
                
                <div>
                    <p style="font-size: 1.2rem; color: #fff; font-weight: 700; margin-bottom: 5px;">
                        👨‍✈️ 10년+ 전문가 1:1 상담
                    </p>
                    <p style="font-size: 1rem; color: var(--gray);">크루즈 3회+ 경험 매니저가 직접</p>
                </div>
            </div>
            
            <!-- 강조 -->
            <div style="background: rgba(240,200,84,0.2); border-radius: 12px; padding: 15px; margin-bottom: 25px;">
                <p style="font-size: 1.15rem; color: #fff; font-weight: 700;">
                    🎯 상담 받고 <span class="marker-strong">가입 안 해도</span> 다 드려요
                </p>
            </div>
            
            <button class="btn pulse-gold" onclick="openFullModal('bonus')" style="background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%); font-size: 1.3rem; padding: 20px 50px; width: 100%; max-width: 350px; border: none; color: #fff; border-radius: 50px; font-weight: 700; cursor: pointer;">
                🎁 무료 상담 신청하기
            </button>
            
            <p style="font-size: 1rem; color: var(--gray); margin-top: 15px;">
                전화 5분 · 부담 제로 · <span style="color: var(--gold);">상담 ≠ 가입</span>
            </p>
        </div>
    </section>
    
    <!-- 최종 CTA -->
    <section class="final-cta" id="contact">
        <h2>
            하루 <span class="gold marker-strong">1,100원</span><br>
            크루즈 여행
        </h2>
        
        <p class="sub">
            <span class="marker">3,000명+</span>가 이미 다녀왔어요<br>
            상담만 먼저 받아보세요
        </p>
        
        <button class="final-btn pulse-gold" onclick="openFullModal('final')">
            30초 상담신청
        </button>
        
        <div class="final-trust-box">
            <p>✓ 전화 5분이면 끝</p>
            <p>✓ 부담 없이 궁금한 것만</p>
            <p>✓ <span class="marker-strong">상담 ≠ 가입</span></p>
        </div>
    </section>
    
    <!-- 푸터 -->
    <footer>
        <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773473793_4604.png" alt="크루즈닷">
        <p>
            상호: 크루즈닷 | 대표: 배연성 | 주소: 경기 화성시 효행로 1068 (리더스프라자) 603-A60호<br>
            대표번호: 010-3289-3800 | 이메일: jmonica@cruisedot.co.kr<br>
            사업자등록번호: 714-57-00419 | 통신판매업신고: 제 2025-화성동부-0320 호<br>
            관광사업자등록: 2025-000004호 | 개인정보보호책임자: 전혜선
        </p>
    </footer>
    
    <!-- 플로팅 버튼 -->
    <button class="floating-cta" onclick="openSimpleModal('floating')">
        📞 30초 상담신청 <span class="small">· <span id="apply-count">142</span>명 신청중</span>
    </button>
    
    <!-- 이탈 방지 팝업 -->
    <div class="exit-popup" id="exit-popup">
        <div class="exit-popup-content">
            <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773470235_2635.png" alt="골드바" class="exit-popup-goldbar">
            <h3>
                잠깐! 🏆<br>
                <span style="color:#FFD700;">골드바 이벤트</span> 안내 받으셨나요?
            </h3>
            <p>
                친구/가족과 함께 신청하시면<br>
                <strong style="color:#FFD700;">순금 골드바</strong>를 드려요!<br><br>
                상담 시 자세한 조건 안내드릴게요
            </p>
            <button class="exit-popup-cta" onclick="closeExitPopup(); openSimpleModal('exit-gold');">
                🏆 골드바 이벤트 알아보기
            </button>
            <button class="exit-popup-close" onclick="closeExitPopup()">
                다음에 볼게요
            </button>
        </div>
    </div>
    
    <!-- 간단 모달 -->
    <div class="modal-simple" id="modal-simple">
        <div class="modal-simple-content">
            <button class="modal-close" onclick="closeSimpleModal()">×</button>
            
            <h2><span class="gold">30초</span> 상담신청</h2>
            <p class="sub">간단한 정보만 입력해주세요</p>
            
            <form onsubmit="submitSimpleModalForm(event)">
                <input type="text" id="simple-name" placeholder="이름" required="">
                <input type="tel" id="simple-phone" placeholder="휴대폰 번호" required="">
                <input type="hidden" id="simple-cta" value="">
                <label class="privacy-check">
                    <input type="checkbox" checked="">
                    <span>개인정보 수집 및 이용 동의</span>
                </label>
                <label class="privacy-check">
                    <input type="checkbox" checked="">
                    <span>마케팅 정보 수신 동의 (선택)</span>
                </label>
                <button type="submit">상담 신청</button>
            </form>
        </div>
    </div>
    
    <!-- 전체 설문 모달 -->
    <div class="modal-full" id="modal-full">
        <div class="modal-full-content">
            <button class="modal-close" onclick="closeFullModal()">×</button>
            
            <div class="modal-header">
                <h2><span class="gold">30초</span> 상담신청</h2>
                <p>간단한 정보만 입력해주세요</p>
            </div>
            
            <div class="modal-body">
                <div class="form-step active" id="step1">
                    <div class="step-indicator">
                        <span class="step-dot active"></span>
                        <span class="step-dot"></span>
                        <span class="step-dot"></span>
                        <span class="step-dot"></span>
                    </div>
                    
                    <label class="form-label">연락처를 알려주세요</label>
                    
                    <input type="text" class="form-input" id="input-name" placeholder="이름">
                    <input type="tel" class="form-input" id="input-phone" placeholder="휴대폰 번호 (숫자만)">
                    
                    <div style="margin: 12px 0 5px;">
                        <label class="privacy-check" style="margin: 6px 0;">
                            <input type="checkbox" checked="">
                            <span>개인정보 수집·이용 동의</span>
                        </label>
                        <label class="privacy-check" style="margin: 6px 0;">
                            <input type="checkbox" checked="">
                            <span>마케팅 수신 동의 (선택)</span>
                        </label>
                    </div>
                    
                    <button class="form-btn" onclick="goToStep2()">다음</button>
                </div>
                
                <div class="form-step" id="step2">
                    <div class="step-indicator">
                        <span class="step-dot active"></span>
                        <span class="step-dot active"></span>
                        <span class="step-dot"></span>
                        <span class="step-dot"></span>
                    </div>
                    
                    <label class="form-label">누구와 함께 가시나요?</label>
                    
                    <div class="option-grid">
                        <div class="option-item" onclick="selectAndNext(this, 'group', '혼자', 3)">
                            <div class="icon">🧍</div>
                            <div class="text">혼자</div>
                        </div>
                        <div class="option-item" onclick="selectAndNext(this, 'group', '신혼', 3)">
                            <div class="icon">💑</div>
                            <div class="text">신혼</div>
                        </div>
                        <div class="option-item" onclick="selectAndNext(this, 'group', '가족', 3)">
                            <div class="icon">👨‍👩‍👧‍👦</div>
                            <div class="text">가족</div>
                        </div>
                        <div class="option-item" onclick="selectAndNext(this, 'group', '친구', 3)">
                            <div class="icon">👯</div>
                            <div class="text">친구</div>
                        </div>
                    </div>
                    
                    <div class="promo-banner">
                        <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773470235_2635.png" alt="골드바">
                        <div class="text">
                            <h4>🎁 4명 단체 신청 시 골드바!</h4>
                            <p>B플랜 0.1g / C플랜 0.3g 증정</p>
                        </div>
                    </div>
                </div>
                
                <div class="form-step" id="step3">
                    <div class="step-indicator">
                        <span class="step-dot active"></span>
                        <span class="step-dot active"></span>
                        <span class="step-dot active"></span>
                        <span class="step-dot"></span>
                    </div>
                    
                    <label class="form-label">어디로 가고 싶으세요?</label>
                    
                    <div class="option-grid">
                        <div class="option-item with-image" onclick="selectAndNext(this, 'destination', '일본/동남아', 4)">
                            <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773477559_4169.png" alt="동남아">
                            <div class="text">🌴 일본/동남아</div>
                        </div>
                        <div class="option-item with-image" onclick="selectAndNext(this, 'destination', '유럽/지중해', 4)">
                            <img src="https://leadgeny.kr/data/file/smarteditor2/2026-02-21/57d5e08d787d5ee7f5b85c3a1ea61125_1771662697_167.jpg" alt="유럽">
                            <div class="text">🇬🇷 유럽/지중해</div>
                        </div>
                        <div class="option-item with-image" onclick="selectAndNext(this, 'destination', '미국', 4)">
                            <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773477757_0009.png" alt="미국">
                            <div class="text">🇺🇸 미국</div>
                        </div>
                        <div class="option-item with-image" onclick="selectAndNext(this, 'destination', '알래스카', 4)">
                            <img src="https://www.leadgeny.kr/data/file/smarteditor2/2026-03-14/ed72e289fd0e0f0e81ff43b3f963e182_1773477814_8668.png" alt="알래스카">
                            <div class="text">🏔️ 알래스카</div>
                        </div>
                    </div>
                </div>
                
                <div class="form-step" id="step4">
                    <div class="step-indicator">
                        <span class="step-dot active"></span>
                        <span class="step-dot active"></span>
                        <span class="step-dot active"></span>
                        <span class="step-dot active"></span>
                    </div>
                    
                    <label class="form-label">언제쯤 가고 싶으세요?</label>
                    
                    <div class="option-grid">
                        <div class="option-item" onclick="selectAndSubmit(this, 'season', '봄(3~5월)')">
                            <div class="icon">🌸</div>
                            <div class="text">봄 (3~5월)</div>
                        </div>
                        <div class="option-item" onclick="selectAndSubmit(this, 'season', '여름(6~8월)')">
                            <div class="icon">☀️</div>
                            <div class="text">여름 (6~8월)</div>
                        </div>
                        <div class="option-item" onclick="selectAndSubmit(this, 'season', '가을(9~11월)')">
                            <div class="icon">🍂</div>
                            <div class="text">가을 (9~11월)</div>
                        </div>
                        <div class="option-item" onclick="selectAndSubmit(this, 'season', '겨울(12~2월)')">
                            <div class="icon">❄️</div>
                            <div class="text">겨울 (12~2월)</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        var GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyO4jIE2HVBkEq5ofiPpuAgbyllJvRgNcA2eN_qDTPtq6IConz0vwPZYkgr8bEP5bedNg/exec';
        
        // 카카오톡 공유 - 잘 되는 소스에서 복사
        function shareKakao() {
            hasSubmitted = true; // 카톡 공유 시 이탈 팝업 방지
            if (window.Kakao && !Kakao.isInitialized()) { 
                Kakao.init('e4d764f905271796dccf37c55a5b84d7'); 
            }
            Kakao.Share.sendDefault({ 
                objectType: 'feed', 
                content: { 
                    title: '하루 1,100원 크루즈 여행 - 크루즈닷', 
                    description: '월 33,000원으로 크루즈 타는 방법! 지금 확인하세요', 
                    imageUrl: 'https://leadgeny.kr/data/file/smarteditor2/2026-02-21/bc71916ae426fcaaa77fcccc81bb6193_1771637255_9043.gif', 
                    link: { mobileWebUrl: window.location.href, webUrl: window.location.href } 
                }, 
                buttons: [{ 
                    title: '지금 확인하기', 
                    link: { mobileWebUrl: window.location.href, webUrl: window.location.href } 
                }] 
            });
        }
        
        function copyToClipboard() {
            var url = window.location.href;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(function() {
                    alert('링크가 복사되었습니다!');
                }).catch(function() {
                    prompt('아래 링크를 복사해주세요:', url);
                });
            } else {
                prompt('아래 링크를 복사해주세요:', url);
            }
        }
        
        var formData = {
            cta: '',
            name: '',
            phone: '',
            group: '',
            destination: '',
            season: '',
            ip: ''
        };
        
        // IP 가져오기 (실패해도 무시)
        try {
            fetch('https://api.ipify.org?format=json')
                .then(function(r) { return r.json(); })
                .then(function(data) { formData.ip = data.ip; })
                .catch(function() { formData.ip = 'unknown'; });
        } catch(e) {
            formData.ip = 'unknown';
        }
        
        function openSimpleModal(cta) {
            formData.cta = cta;
            var ctaInput = document.getElementById('simple-cta');
            var modal = document.getElementById('modal-simple');
            if (ctaInput) ctaInput.value = cta;
            if (modal) modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        
        function closeSimpleModal() {
            var modal = document.getElementById('modal-simple');
            if (modal) modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        
        async function submitSimpleModalForm(e) {
            e.preventDefault();
            var name = document.getElementById('simple-name').value.trim();
            var phone = document.getElementById('simple-phone').value.trim();
            var cta = document.getElementById('simple-cta').value;
            
            if (!validatePhone(phone)) {
                alert('올바른 휴대폰 번호를 입력해주세요');
                return;
            }
            
            await sendToGoogleSheets(name, phone, cta, '', '', '');
            submitToLeadgeny(name, phone, cta);
        }
        
        async function submitSimpleForm(e, id) {
            e.preventDefault();
            var name = document.getElementById(id + '-name').value.trim();
            var phone = document.getElementById(id + '-phone').value.trim();
            
            if (!validatePhone(phone)) {
                alert('올바른 휴대폰 번호를 입력해주세요');
                return;
            }
            
           await sendToGoogleSheets(name, phone, id, '', '', '');
            submitToLeadgeny(name, phone, id);
        }
        
        function openFullModal(cta) {
            formData.cta = cta;
            document.getElementById('modal-full').classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        
        function closeFullModal() {
            document.getElementById('modal-full').classList.remove('active');
            document.body.style.overflow = '';
            resetFullForm();
        }
        
        function resetFullForm() {
            formData = { cta: formData.cta, name: '', phone: '', group: '', destination: '', season: '', ip: formData.ip };
            var steps = document.querySelectorAll('.form-step');
            for (var i = 0; i < steps.length; i++) {
                steps[i].classList.toggle('active', i === 0);
            }
            var options = document.querySelectorAll('.option-item');
            for (var j = 0; j < options.length; j++) {
                options[j].classList.remove('selected');
            }
            var inputs = document.querySelectorAll('.form-input');
            for (var k = 0; k < inputs.length; k++) {
                inputs[k].value = '';
            }
        }
        
        function goToStep2() {
            var name = document.getElementById('input-name').value.trim();
            var phone = document.getElementById('input-phone').value.trim();
            
            if (!name) { alert('이름을 입력해주세요'); return; }
            if (!validatePhone(phone)) {
                alert('올바른 휴대폰 번호를 입력해주세요');
                return;
            }
            
            formData.name = name;
            formData.phone = phone;
            showStep(2);
        }
        
        function showStep(step) {
            var allSteps = document.querySelectorAll('.form-step');
            for (var i = 0; i < allSteps.length; i++) {
                allSteps[i].classList.remove('active');
            }
            document.getElementById('step' + step).classList.add('active');
        }
        
        function selectAndNext(el, field, value, nextStep) {
            var siblings = el.parentElement.querySelectorAll('.option-item');
            for (var i = 0; i < siblings.length; i++) {
                siblings[i].classList.remove('selected');
            }
            el.classList.add('selected');
            formData[field] = value;
            
            setTimeout(function() { showStep(nextStep); }, 300);
        }
        
        function selectAndSubmit(el, field, value) {
            var siblings = el.parentElement.querySelectorAll('.option-item');
            for (var i = 0; i < siblings.length; i++) {
                siblings[i].classList.remove('selected');
            }
            el.classList.add('selected');
            formData[field] = value;
            
            setTimeout(function() { submitFullForm(); }, 300);
        }
        
        async function submitFullForm() {
           await sendToGoogleSheets(
                formData.name,
                formData.phone,
                formData.cta,
                formData.group,
                formData.destination,
                formData.season
            );
            
            submitToLeadgeny(formData.name, formData.phone, formData.cta);
        }
        
       async function sendToGoogleSheets(name, phone, cta, group, destination, season) {
            var params = new URLSearchParams({
                name: name,
                phone: phone,
                cta: cta,
                group: group || '',
                destination: destination || '',
                season: season || '',
                ip: formData.ip || ''
            });
            
            // GET 방식으로 변경 (CORS 우회)
            var url = GOOGLE_SCRIPT_URL + '?' + params.toString();
            
            await fetch(url, {
                method: 'GET',
                mode: 'no-cors'
            }).catch(function(e) { console.log('Google Sheets error:', e); });
        }
        
        function validatePhone(phone) {
            var cleaned = phone.replace(/-/g, '');
            return /^01[0-9]{8,9}$/.test(cleaned);
        }
        
        function submitToLeadgeny(name, phone, cta) {
            var form = document.createElement('form');
            form.method = 'POST';
            form.action = 'https://www.leadgeny.kr/check/';
            form.style.display = 'none';
            
            var fields = {
                'seq': '4e7a41304e6a593d',
                'result_url': 'https://leadgeny.kr/i/A2k',
                'nm': name,
                'hp': phone
            };
            
            var keys = Object.keys(fields);
            for (var i = 0; i < keys.length; i++) {
                var input = document.createElement('input');
                input.type = 'hidden';
                input.name = keys[i];
                input.value = fields[keys[i]];
                form.appendChild(input);
            }
            
            document.body.appendChild(form);
            form.submit();
        }
        
        // 골드바 카운터 - 30초마다 10개씩 감소
        var goldCount = 300;
        
        // 시작 시 첫 10개 감소
        setTimeout(function() {
            goldCount = 290;
            updateGoldDisplay();
        }, 1000);
        
        function updateGoldDisplay() {
            var counters = document.querySelectorAll('.gold-count');
            for (var i = 0; i < counters.length; i++) {
                counters[i].textContent = goldCount;
                counters[i].style.transform = 'scale(1.3)';
                counters[i].style.color = '#ff4444';
                (function(el) {
                    setTimeout(function() {
                        el.style.transform = 'scale(1)';
                        el.style.color = '';
                    }, 300);
                })(counters[i]);
            }
        }
        
        function decreaseGoldCount() {
            var decrease = Math.floor(Math.random() * 4) + 10;
            goldCount = Math.max(goldCount - decrease, 50);
            updateGoldDisplay();
        }
        
        // 20초마다 10~13개씩 랜덤 감소
        setInterval(decreaseGoldCount, 20000);
        
        // 신청중 카운터 - 3초마다 14명씩 증가
        var applyCount = 142;
        
        function updateApplyCount() {
            applyCount += 14;
            var counter = document.getElementById('apply-count');
            if (counter) {
                counter.textContent = applyCount;
            }
        }
        
        // 3초마다 실행
        setInterval(updateApplyCount, 3000);
        
        // ========== 카운터 및 애니메이션 ==========
        document.addEventListener('DOMContentLoaded', function() {
            // 카카오 SDK 초기화
            if (window.Kakao && !Kakao.isInitialized()) {
                try {
                    Kakao.init('e4d764f905271796dccf37c55a5b84d7');
                } catch(e) {}
            }
            
            // FOMO 카운터
            var fomoCount = 2847;
            
            function updateFomoDisplay() {
                var str = fomoCount.toLocaleString();
                var container = document.getElementById('fomo-counter');
                if (!container) return;
                
                // 새로운 숫자로 HTML 재구성
                var html = '';
                for (var i = 0; i < str.length; i++) {
                    if (str[i] === ',') {
                        html += '<span class="comma">,</span>';
                    } else {
                        html += '<span class="digit">' + str[i] + '</span>';
                    }
                }
                container.innerHTML = html;
                
                // 마지막 숫자에 bump 효과
                var digits = container.querySelectorAll('.digit');
                if (digits.length > 0) {
                    var lastDigit = digits[digits.length - 1];
                    lastDigit.classList.add('bump');
                    setTimeout(function() { lastDigit.classList.remove('bump'); }, 300);
                }
            }
            
            function incrementFomo() {
                fomoCount += Math.floor(Math.random() * 3) + 1;
                updateFomoDisplay();
            }
            
            // 골드바 카운터
            var goldRemaining = 300;
            
            function updateGoldDisplay2() {
                var counters = document.querySelectorAll('.gold-count');
                for (var i = 0; i < counters.length; i++) {
                    counters[i].textContent = goldRemaining;
                    counters[i].style.transform = 'scale(1.2)';
                    counters[i].style.color = '#ff4444';
                    (function(el) {
                        setTimeout(function() {
                            el.style.transform = 'scale(1)';
                            el.style.color = '';
                        }, 300);
                    })(counters[i]);
                }
            }
            
            function decrementGold() {
                goldRemaining = Math.max(goldRemaining - Math.floor(Math.random() * 2) - 1, 50);
                updateGoldDisplay2();
            }
            
            // 초기 표시
            updateFomoDisplay();
            
            // 인터벌 시작
            setInterval(incrementFomo, 4000);  // 4초마다 신청자 증가
            setInterval(decrementGold, 12000); // 12초마다 골드바 감소
        });
        
        // ========== 영상 모달 ==========
        function openVideoModal(videoId) {
            var modal = document.getElementById('video-modal');
            var iframe = document.getElementById('video-iframe');
            iframe.src = 'https://www.youtube.com/embed/' + videoId + '?autoplay=1&rel=0';
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        
        function closeVideoModal() {
            var modal = document.getElementById('video-modal');
            var iframe = document.getElementById('video-iframe');
            iframe.src = '';
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        
        // ========== 이탈 감지 (골드 이벤트 팝업) ==========
        var exitPopupShown = false;
        var hasSubmitted = false;
        var lastScrollY = 0;
        var scrollUpCount = 0;
        
        // 마우스가 화면 상단으로 이동 시 (데스크탑)
        document.addEventListener('mouseleave', function(e) {
            if (e.clientY < 10 && !exitPopupShown && !hasSubmitted) {
                showExitPopup();
            }
        });
        
        // 📱 스마트폰: 30초 후 자동 팝업
        setTimeout(function() {
            if (!exitPopupShown && !hasSubmitted) {
                showExitPopup();
            }
        }, 30000);
        
        // 📱 스마트폰: 빠르게 위로 스크롤하면 이탈 의도로 간주
        window.addEventListener('scroll', function() {
            var currentScrollY = window.scrollY;
            
            // 위로 200px 이상 빠르게 스크롤하면
            if (lastScrollY - currentScrollY > 200 && currentScrollY < 500) {
                scrollUpCount++;
                if (scrollUpCount >= 2 && !exitPopupShown && !hasSubmitted) {
                    showExitPopup();
                }
            }
            
            lastScrollY = currentScrollY;
        });
        
        // 뒤로가기 감지 (모바일)
        history.pushState(null, null, location.href);
        window.addEventListener('popstate', function(e) {
            if (!exitPopupShown && !hasSubmitted) {
                history.pushState(null, null, location.href);
                showExitPopup();
            }
        });
        
        // ❌ beforeunload 제거 - 카톡 공유/폼 제출 시 브라우저 경고 방지
        // (자체 이탈 팝업으로 대체)
        
        function showExitPopup() {
            exitPopupShown = true;
            document.getElementById('exit-popup').classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        
        function closeExitPopup() {
            document.getElementById('exit-popup').classList.remove('active');
            document.body.style.overflow = '';
        }
        
        // 제출 완료 시 플래그
        function markAsSubmitted() {
            hasSubmitted = true;
        }
    </script>

