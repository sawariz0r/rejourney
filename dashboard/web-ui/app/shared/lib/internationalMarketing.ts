export type MarketingLocaleCode =
  | "en"
  | "ar"
  | "es"
  | "tr"
  | "pt-br"
  | "de"
  | "fr"
  | "hi"
  | "id"
  | "ja"
  | "ko"
  | "zh-cn";

export type MarketingFeatureCopy = {
  title: string;
  highlight: string;
  badge: string;
};

export type MarketingLocale = {
  code: MarketingLocaleCode;
  slug: string;
  path: string;
  label: string;
  nativeLabel: string;
  languageTag: string;
  ogLocale: string;
  dir: "ltr" | "rtl";
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  mainAriaLabel: string;
  hero: {
    headlinePrimary: string;
    headlineSecondary: string;
    primaryCta: string;
    secondaryCta: string;
  };
  featuresHeading: string;
  featuresEyebrow: string;
  features: MarketingFeatureCopy[];
};

const SITE_URL = "https://rejourney.co";

const englishFeatures: MarketingFeatureCopy[] = [
  { title: "Session", highlight: "Replay", badge: "Replay" },
  { title: "Incident", highlight: "Stream", badge: "Live" },
  { title: "Crash", highlight: "Detection", badge: "ANR" },
  { title: "Journey", highlight: "Maps", badge: "Flows" },
  { title: "Touch", highlight: "Heatmaps", badge: "Taps" },
  { title: "Global", highlight: "Stability", badge: "Geo" },
  { title: "Growth", highlight: "Loops", badge: "Retention" },
  { title: "Team", highlight: "Alerts", badge: "Teams" },
];

export const MARKETING_LOCALES: Record<MarketingLocaleCode, MarketingLocale> = {
  en: {
    code: "en",
    slug: "",
    path: "/",
    label: "English",
    nativeLabel: "English",
    languageTag: "en-US",
    ogLocale: "en_US",
    dir: "ltr",
    metaTitle: "Rejourney: Open Source Mobile Analytics, Session Replay & Observability",
    metaDescription:
      "Open-source mobile analytics for iOS, Android, Expo, and React Native apps with replay, crashes, heatmaps, journeys, and a light SDK.",
    keywords: [
      "open source mobile analytics",
      "mobile session replay",
      "mobile observability",
      "mobile heatmaps",
      "crash reporting",
      "Expo analytics",
      "Swift iOS analytics",
      "self-hosted analytics",
    ],
    mainAriaLabel: "Rejourney - Open Source Mobile App Analytics",
    hero: {
      headlinePrimary: "Creative analytics.",
      headlineSecondary: "Light SDK.",
      primaryCta: "Get started free",
      secondaryCta: "Self-host instead",
    },
    featuresHeading: "Mobile stack.",
    featuresEyebrow: "Eight signals",
    features: englishFeatures,
  },
  ar: {
    code: "ar",
    slug: "ar",
    path: "/ar",
    label: "Arabic",
    nativeLabel: "العربية",
    languageTag: "ar",
    ogLocale: "ar_AR",
    dir: "rtl",
    metaTitle: "Rejourney: تحليلات جوال مفتوحة المصدر وإعادة تشغيل الجلسات",
    metaDescription:
      "تحليلات ومراقبة مفتوحة المصدر لتطبيقات iOS وAndroid وExpo وReact Native مع إعادة تشغيل الجلسات، الأعطال، الخرائط الحرارية، ورحلات المستخدم.",
    keywords: [
      "تحليلات تطبيقات الجوال مفتوحة المصدر",
      "إعادة تشغيل جلسات الجوال",
      "مراقبة تطبيقات الجوال",
      "خرائط حرارية للجوال",
      "تقارير الأعطال",
      "تحليلات React Native",
      "تحليلات Expo",
      "استضافة ذاتية للتحليلات",
    ],
    mainAriaLabel: "Rejourney - تحليلات تطبيقات الجوال مفتوحة المصدر",
    hero: {
      headlinePrimary: "تحليلات إبداعية.",
      headlineSecondary: "SDK خفيف.",
      primaryCta: "ابدأ مجانًا",
      secondaryCta: "استضافة ذاتية",
    },
    featuresHeading: "منصة الجوال.",
    featuresEyebrow: "ثماني إشارات",
    features: [
      { title: "إعادة", highlight: "الجلسات", badge: "إعادة" },
      { title: "تدفق", highlight: "الحوادث", badge: "مباشر" },
      { title: "كشف", highlight: "الأعطال", badge: "ANR" },
      { title: "خرائط", highlight: "الرحلة", badge: "مسارات" },
      { title: "خرائط", highlight: "اللمس", badge: "نقرات" },
      { title: "استقرار", highlight: "عالمي", badge: "جغرافي" },
      { title: "حلقات", highlight: "النمو", badge: "احتفاظ" },
      { title: "تنبيهات", highlight: "الفريق", badge: "فرق" },
    ],
  },
  es: {
    code: "es",
    slug: "es",
    path: "/es",
    label: "Spanish",
    nativeLabel: "Español",
    languageTag: "es",
    ogLocale: "es_ES",
    dir: "ltr",
    metaTitle: "Rejourney: Analítica móvil open source, replay de sesiones y observabilidad",
    metaDescription:
      "Analítica móvil open source para iOS, Android, Expo y React Native con replay de sesiones, crashes, mapas de calor, journeys y un SDK ligero.",
    keywords: [
      "analítica móvil open source",
      "replay de sesiones móviles",
      "observabilidad móvil",
      "mapas de calor móviles",
      "reporte de crashes",
      "analítica React Native",
      "analítica Expo",
      "analítica self-hosted",
    ],
    mainAriaLabel: "Rejourney - Analítica móvil open source",
    hero: {
      headlinePrimary: "Analítica creativa.",
      headlineSecondary: "SDK ligero.",
      primaryCta: "Empieza gratis",
      secondaryCta: "Autohospedar",
    },
    featuresHeading: "Stack móvil.",
    featuresEyebrow: "Ocho señales",
    features: [
      { title: "Replay", highlight: "de sesión", badge: "Replay" },
      { title: "Flujo", highlight: "de incidentes", badge: "En vivo" },
      { title: "Detección", highlight: "de crashes", badge: "ANR" },
      { title: "Mapas", highlight: "de journey", badge: "Flujos" },
      { title: "Mapas", highlight: "de calor", badge: "Taps" },
      { title: "Estabilidad", highlight: "global", badge: "Geo" },
      { title: "Bucles", highlight: "de crecimiento", badge: "Retención" },
      { title: "Alertas", highlight: "de equipo", badge: "Equipos" },
    ],
  },
  tr: {
    code: "tr",
    slug: "tr",
    path: "/tr",
    label: "Turkish",
    nativeLabel: "Türkçe",
    languageTag: "tr",
    ogLocale: "tr_TR",
    dir: "ltr",
    metaTitle: "Rejourney: Açık kaynak mobil analitik, oturum kaydı ve gözlemlenebilirlik",
    metaDescription:
      "iOS, Android, Expo ve React Native uygulamaları için oturum yeniden oynatma, çökme izleme, ısı haritaları, kullanıcı yolculukları ve hafif SDK.",
    keywords: [
      "açık kaynak mobil analitik",
      "mobil oturum yeniden oynatma",
      "mobil gözlemlenebilirlik",
      "mobil ısı haritaları",
      "çökme raporlama",
      "React Native analitik",
      "Expo analitik",
      "self-hosted analitik",
    ],
    mainAriaLabel: "Rejourney - Açık kaynak mobil uygulama analitiği",
    hero: {
      headlinePrimary: "Yaratıcı analitik.",
      headlineSecondary: "Hafif SDK.",
      primaryCta: "Ücretsiz başla",
      secondaryCta: "Kendin barındır",
    },
    featuresHeading: "Mobil stack.",
    featuresEyebrow: "Sekiz sinyal",
    features: [
      { title: "Oturum", highlight: "Replay", badge: "Replay" },
      { title: "Olay", highlight: "Akışı", badge: "Canlı" },
      { title: "Çökme", highlight: "Algılama", badge: "ANR" },
      { title: "Yolculuk", highlight: "Haritası", badge: "Akışlar" },
      { title: "Dokunma", highlight: "Isı Haritası", badge: "Tap" },
      { title: "Küresel", highlight: "Stabilite", badge: "Geo" },
      { title: "Büyüme", highlight: "Döngüleri", badge: "Tutma" },
      { title: "Ekip", highlight: "Uyarıları", badge: "Ekipler" },
    ],
  },
  "pt-br": {
    code: "pt-br",
    slug: "pt-br",
    path: "/pt-br",
    label: "Portuguese",
    nativeLabel: "Português do Brasil",
    languageTag: "pt-BR",
    ogLocale: "pt_BR",
    dir: "ltr",
    metaTitle: "Rejourney: Analytics mobile open source, replay de sessão e observabilidade",
    metaDescription:
      "Analytics mobile open source para iOS, Android, Expo e React Native com replay de sessão, crashes, mapas de calor, jornadas e SDK leve.",
    keywords: [
      "analytics mobile open source",
      "replay de sessão mobile",
      "observabilidade mobile",
      "mapas de calor mobile",
      "relatório de crashes",
      "analytics React Native",
      "analytics Expo",
      "analytics self-hosted",
    ],
    mainAriaLabel: "Rejourney - Analytics mobile open source",
    hero: {
      headlinePrimary: "Analytics criativo.",
      headlineSecondary: "SDK leve.",
      primaryCta: "Comece grátis",
      secondaryCta: "Hospede você mesmo",
    },
    featuresHeading: "Stack mobile.",
    featuresEyebrow: "Oito sinais",
    features: [
      { title: "Replay", highlight: "de sessão", badge: "Replay" },
      { title: "Fluxo", highlight: "de incidentes", badge: "Ao vivo" },
      { title: "Detecção", highlight: "de crashes", badge: "ANR" },
      { title: "Mapas", highlight: "de jornada", badge: "Fluxos" },
      { title: "Mapas", highlight: "de calor", badge: "Toques" },
      { title: "Estabilidade", highlight: "global", badge: "Geo" },
      { title: "Loops", highlight: "de crescimento", badge: "Retenção" },
      { title: "Alertas", highlight: "de equipe", badge: "Times" },
    ],
  },
  de: {
    code: "de",
    slug: "de",
    path: "/de",
    label: "German",
    nativeLabel: "Deutsch",
    languageTag: "de",
    ogLocale: "de_DE",
    dir: "ltr",
    metaTitle: "Rejourney: Open-Source-Mobile-Analytics, Session Replay und Observability",
    metaDescription:
      "Open-Source-Mobile-Analytics für iOS, Android, Expo und React Native mit Session Replay, Crash-Reporting, Heatmaps, Journeys und leichtem SDK.",
    keywords: [
      "Open Source Mobile Analytics",
      "Mobile Session Replay",
      "Mobile Observability",
      "Mobile Heatmaps",
      "Crash Reporting",
      "React Native Analytics",
      "Expo Analytics",
      "Self-Hosted Analytics",
    ],
    mainAriaLabel: "Rejourney - Open-Source-Mobile-App-Analytics",
    hero: {
      headlinePrimary: "Kreative Analytics.",
      headlineSecondary: "Leichtes SDK.",
      primaryCta: "Kostenlos starten",
      secondaryCta: "Selbst hosten",
    },
    featuresHeading: "Mobile Stack.",
    featuresEyebrow: "Acht Signale",
    features: [
      { title: "Session", highlight: "Replay", badge: "Replay" },
      { title: "Incident", highlight: "Stream", badge: "Live" },
      { title: "Crash", highlight: "Erkennung", badge: "ANR" },
      { title: "Journey", highlight: "Maps", badge: "Flows" },
      { title: "Touch", highlight: "Heatmaps", badge: "Taps" },
      { title: "Globale", highlight: "Stabilität", badge: "Geo" },
      { title: "Growth", highlight: "Loops", badge: "Retention" },
      { title: "Team", highlight: "Alerts", badge: "Teams" },
    ],
  },
  fr: {
    code: "fr",
    slug: "fr",
    path: "/fr",
    label: "French",
    nativeLabel: "Français",
    languageTag: "fr",
    ogLocale: "fr_FR",
    dir: "ltr",
    metaTitle: "Rejourney: Analytics mobile open source, replay de session et observabilité",
    metaDescription:
      "Analytics mobile open source pour iOS, Android, Expo et React Native avec replay de session, crashs, heatmaps, parcours utilisateur et SDK léger.",
    keywords: [
      "analytics mobile open source",
      "replay de session mobile",
      "observabilité mobile",
      "heatmaps mobile",
      "rapport de crash",
      "analytics React Native",
      "analytics Expo",
      "analytics self-hosted",
    ],
    mainAriaLabel: "Rejourney - Analytics mobile open source",
    hero: {
      headlinePrimary: "Analytics créative.",
      headlineSecondary: "SDK léger.",
      primaryCta: "Démarrer gratuitement",
      secondaryCta: "Auto-héberger",
    },
    featuresHeading: "Stack mobile.",
    featuresEyebrow: "Huit signaux",
    features: [
      { title: "Replay", highlight: "de session", badge: "Replay" },
      { title: "Flux", highlight: "d'incidents", badge: "Live" },
      { title: "Détection", highlight: "de crash", badge: "ANR" },
      { title: "Cartes", highlight: "de parcours", badge: "Flux" },
      { title: "Heatmaps", highlight: "tactiles", badge: "Taps" },
      { title: "Stabilité", highlight: "globale", badge: "Géo" },
      { title: "Boucles", highlight: "de croissance", badge: "Rétention" },
      { title: "Alertes", highlight: "d'équipe", badge: "Équipes" },
    ],
  },
  hi: {
    code: "hi",
    slug: "hi",
    path: "/hi",
    label: "Hindi",
    nativeLabel: "हिन्दी",
    languageTag: "hi",
    ogLocale: "hi_IN",
    dir: "ltr",
    metaTitle: "Rejourney: ओपन-सोर्स मोबाइल एनालिटिक्स, सेशन रीप्ले और ऑब्जर्वेबिलिटी",
    metaDescription:
      "iOS, Android, Expo और React Native ऐप्स के लिए ओपन-सोर्स मोबाइल एनालिटिक्स: सेशन रीप्ले, क्रैश, हीटमैप, यूजर जर्नी और हल्का SDK.",
    keywords: [
      "ओपन सोर्स मोबाइल एनालिटिक्स",
      "मोबाइल सेशन रीप्ले",
      "मोबाइल ऑब्जर्वेबिलिटी",
      "मोबाइल हीटमैप",
      "क्रैश रिपोर्टिंग",
      "React Native analytics",
      "Expo analytics",
      "self-hosted analytics",
    ],
    mainAriaLabel: "Rejourney - ओपन-सोर्स मोबाइल ऐप एनालिटिक्स",
    hero: {
      headlinePrimary: "क्रिएटिव एनालिटिक्स.",
      headlineSecondary: "हल्का SDK.",
      primaryCta: "मुफ्त शुरू करें",
      secondaryCta: "स्वयं होस्ट करें",
    },
    featuresHeading: "मोबाइल स्टैक.",
    featuresEyebrow: "आठ संकेत",
    features: [
      { title: "सेशन", highlight: "रीप्ले", badge: "रीप्ले" },
      { title: "इंसिडेंट", highlight: "स्ट्रीम", badge: "लाइव" },
      { title: "क्रैश", highlight: "डिटेक्शन", badge: "ANR" },
      { title: "जर्नी", highlight: "मैप्स", badge: "फ्लो" },
      { title: "टच", highlight: "हीटमैप", badge: "टैप" },
      { title: "ग्लोबल", highlight: "स्टेबिलिटी", badge: "Geo" },
      { title: "ग्रोथ", highlight: "लूप्स", badge: "रिटेंशन" },
      { title: "टीम", highlight: "अलर्ट", badge: "टीम" },
    ],
  },
  id: {
    code: "id",
    slug: "id",
    path: "/id",
    label: "Indonesian",
    nativeLabel: "Bahasa Indonesia",
    languageTag: "id",
    ogLocale: "id_ID",
    dir: "ltr",
    metaTitle: "Rejourney: Analitik mobile open source, session replay, dan observability",
    metaDescription:
      "Analitik mobile open source untuk iOS, Android, Expo, dan React Native dengan session replay, crash, heatmap, journey, dan SDK ringan.",
    keywords: [
      "analitik mobile open source",
      "session replay mobile",
      "observability mobile",
      "heatmap mobile",
      "crash reporting",
      "analitik React Native",
      "analitik Expo",
      "self-hosted analytics",
    ],
    mainAriaLabel: "Rejourney - Analitik aplikasi mobile open source",
    hero: {
      headlinePrimary: "Analitik kreatif.",
      headlineSecondary: "SDK ringan.",
      primaryCta: "Mulai gratis",
      secondaryCta: "Self-host",
    },
    featuresHeading: "Stack mobile.",
    featuresEyebrow: "Delapan sinyal",
    features: [
      { title: "Session", highlight: "Replay", badge: "Replay" },
      { title: "Incident", highlight: "Stream", badge: "Live" },
      { title: "Crash", highlight: "Detection", badge: "ANR" },
      { title: "Journey", highlight: "Maps", badge: "Flows" },
      { title: "Touch", highlight: "Heatmap", badge: "Tap" },
      { title: "Stabilitas", highlight: "Global", badge: "Geo" },
      { title: "Growth", highlight: "Loops", badge: "Retensi" },
      { title: "Team", highlight: "Alerts", badge: "Tim" },
    ],
  },
  ja: {
    code: "ja",
    slug: "ja",
    path: "/ja",
    label: "Japanese",
    nativeLabel: "日本語",
    languageTag: "ja",
    ogLocale: "ja_JP",
    dir: "ltr",
    metaTitle: "Rejourney: オープンソースのモバイル分析、セッションリプレイ、Observability",
    metaDescription:
      "iOS、Android、Expo、React Native向けの軽量SDKで、セッションリプレイ、クラッシュ、ヒートマップ、ジャーニーを扱うオープンソースのモバイル分析基盤。",
    keywords: [
      "オープンソース モバイル分析",
      "モバイル セッションリプレイ",
      "モバイル Observability",
      "モバイル ヒートマップ",
      "クラッシュレポート",
      "React Native analytics",
      "Expo analytics",
      "self-hosted analytics",
    ],
    mainAriaLabel: "Rejourney - オープンソースのモバイルアプリ分析",
    hero: {
      headlinePrimary: "創造的な分析。",
      headlineSecondary: "軽量SDK。",
      primaryCta: "無料で始める",
      secondaryCta: "セルフホスト",
    },
    featuresHeading: "モバイル基盤。",
    featuresEyebrow: "8つのシグナル",
    features: [
      { title: "セッション", highlight: "リプレイ", badge: "Replay" },
      { title: "インシデント", highlight: "ストリーム", badge: "Live" },
      { title: "クラッシュ", highlight: "検知", badge: "ANR" },
      { title: "ジャーニー", highlight: "マップ", badge: "Flows" },
      { title: "タッチ", highlight: "ヒートマップ", badge: "Taps" },
      { title: "グローバル", highlight: "安定性", badge: "Geo" },
      { title: "成長", highlight: "ループ", badge: "Retention" },
      { title: "チーム", highlight: "アラート", badge: "Teams" },
    ],
  },
  ko: {
    code: "ko",
    slug: "ko",
    path: "/ko",
    label: "Korean",
    nativeLabel: "한국어",
    languageTag: "ko",
    ogLocale: "ko_KR",
    dir: "ltr",
    metaTitle: "Rejourney: 오픈소스 모바일 분석, 세션 리플레이, 옵저버빌리티",
    metaDescription:
      "iOS, Android, Expo, React Native 앱을 위한 오픈소스 모바일 분석. 세션 리플레이, 크래시, 히트맵, 사용자 여정, 가벼운 SDK를 제공합니다.",
    keywords: [
      "오픈소스 모바일 분석",
      "모바일 세션 리플레이",
      "모바일 옵저버빌리티",
      "모바일 히트맵",
      "크래시 리포팅",
      "React Native analytics",
      "Expo analytics",
      "self-hosted analytics",
    ],
    mainAriaLabel: "Rejourney - 오픈소스 모바일 앱 분석",
    hero: {
      headlinePrimary: "창의적인 분석.",
      headlineSecondary: "가벼운 SDK.",
      primaryCta: "무료로 시작",
      secondaryCta: "셀프 호스팅",
    },
    featuresHeading: "모바일 스택.",
    featuresEyebrow: "8가지 신호",
    features: [
      { title: "세션", highlight: "리플레이", badge: "Replay" },
      { title: "인시던트", highlight: "스트림", badge: "Live" },
      { title: "크래시", highlight: "감지", badge: "ANR" },
      { title: "여정", highlight: "맵", badge: "Flows" },
      { title: "터치", highlight: "히트맵", badge: "Taps" },
      { title: "글로벌", highlight: "안정성", badge: "Geo" },
      { title: "성장", highlight: "루프", badge: "Retention" },
      { title: "팀", highlight: "알림", badge: "Teams" },
    ],
  },
  "zh-cn": {
    code: "zh-cn",
    slug: "zh-cn",
    path: "/zh-cn",
    label: "Chinese",
    nativeLabel: "简体中文",
    languageTag: "zh-CN",
    ogLocale: "zh_CN",
    dir: "ltr",
    metaTitle: "Rejourney：开源移动分析、会话回放与可观测性",
    metaDescription:
      "面向 iOS、Android、Expo 和 React Native 应用的开源移动分析，包含会话回放、崩溃、热力图、用户旅程和轻量 SDK。",
    keywords: [
      "开源移动分析",
      "移动端会话回放",
      "移动应用可观测性",
      "移动热力图",
      "崩溃报告",
      "React Native analytics",
      "Expo analytics",
      "self-hosted analytics",
    ],
    mainAriaLabel: "Rejourney - 开源移动应用分析",
    hero: {
      headlinePrimary: "创意分析。",
      headlineSecondary: "轻量 SDK。",
      primaryCta: "免费开始",
      secondaryCta: "自托管",
    },
    featuresHeading: "移动端技术栈。",
    featuresEyebrow: "八个信号",
    features: [
      { title: "会话", highlight: "回放", badge: "Replay" },
      { title: "事件", highlight: "流", badge: "Live" },
      { title: "崩溃", highlight: "检测", badge: "ANR" },
      { title: "旅程", highlight: "地图", badge: "Flows" },
      { title: "触控", highlight: "热力图", badge: "Taps" },
      { title: "全球", highlight: "稳定性", badge: "Geo" },
      { title: "增长", highlight: "循环", badge: "Retention" },
      { title: "团队", highlight: "告警", badge: "Teams" },
    ],
  },
};

export const MARKETING_LOCALE_ORDER: MarketingLocaleCode[] = [
  "en",
  "ar",
  "es",
  "tr",
  "pt-br",
  "de",
  "fr",
  "hi",
  "id",
  "ja",
  "ko",
  "zh-cn",
];

export const MARKETING_LOCALE_SLUGS = MARKETING_LOCALE_ORDER
  .map((code) => MARKETING_LOCALES[code].slug)
  .filter((slug): slug is Exclude<MarketingLocale["slug"], ""> => slug.length > 0);

export const MARKETING_AVAILABLE_LANGUAGES = MARKETING_LOCALE_ORDER.map((code) => ({
  "@type": "Language",
  name: MARKETING_LOCALES[code].label,
  alternateName: MARKETING_LOCALES[code].nativeLabel,
}));

export function getMarketingLocaleFromPathname(pathname: string): MarketingLocale {
  const firstSegment = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  const locale = MARKETING_LOCALE_ORDER.find((code) => MARKETING_LOCALES[code].slug === firstSegment);
  return MARKETING_LOCALES[locale ?? "en"];
}

export function getMarketingLocaleUrl(locale: MarketingLocale): string {
  return `${SITE_URL}${locale.path}`;
}

export function getMarketingAlternateLinks() {
  return [
    ...MARKETING_LOCALE_ORDER.map((code) => {
      const locale = MARKETING_LOCALES[code];
      return {
        hrefLang: locale.languageTag,
        href: getMarketingLocaleUrl(locale),
      };
    }),
    {
      hrefLang: "x-default",
      href: `${SITE_URL}/`,
    },
  ];
}
