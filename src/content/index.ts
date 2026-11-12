import type { Memory, MediaItem, Milestone, Note, Photo, Profile, StoryBlock } from "./types";

/*
  The family's content. Replace placeholder entries with real material as it arrives;
  the design adapts to whatever is here. Nothing below is a fact about Rosa unless
  it is marked otherwise; every personal slot is a placeholder.
*/

export const profile: Profile = {
  name: { he: "סבתא רוזה", ru: "Бабушка Роза" },
  kicker: { he: "לזכרה של", ru: "В память о" },
  dedication: { he: "שנתנה לכולנו כל כך הרבה אהבה", ru: "которая подарила всем нам столько любви" },
  intro: {
    he: "מקום אחד לכל מה שאנחנו זוכרים ממנה. תמונות, סרטונים, סיפורים ומתכונים. כל אחד מוסיף משהו, ויחד מתגלה סיפור החיים שלה.",
    ru: "Одно место для всего, что мы о ней помним. Фотографии, видео, истории и рецепты. Каждый добавляет что-то своё, и вместе складывается история её жизни.",
  },
  portraitId: "portrait",
  secondaryPortraitId: "portrait-2",
  closing: { he: "לנצח בלב שלנו", ru: "Навсегда в наших сердцах" },
};

const P = (he: string, ru: string) => ({ he, ru });

export const photos: Photo[] = [
  { id: "portrait", people: ["rosa"], ratio: 4 / 5, placeholder: true, alt: P("דיוקן של סבתא רוזה", "Портрет бабушки Розы"), caption: P("דיוקן מהאלבום המשפחתי", "Портрет из семейного альбома") },
  { id: "portrait-2", people: ["rosa"], ratio: 1, placeholder: true, alt: P("תמונה נוספת של רוזה", "Ещё одна фотография Розы") },
  { id: "roots-1", people: ["rosa", "sib-1", "sib-2"], ratio: 3 / 4, placeholder: true, category: "childhood", size: "tall", alt: P("תמונה מימי הילדות", "Фотография из детства"), caption: P("מימי הילדות", "Из детства") },
  { id: "home-1", people: ["rosa", "husband", "c1", "c2", "c3"], ratio: 3 / 2, placeholder: true, category: "family", size: "wide", alt: P("תמונה משפחתית בבית", "Семейная фотография дома"), caption: P("בבית, עם המשפחה", "Дома, с семьёй") },
  { id: "table-1", people: ["rosa", "husband", "c1", "c2", "c3", "g1", "g3", "g4"], ratio: 16 / 9, placeholder: true, category: "celebrations", size: "feature", alt: P("רגע משפחתי גדול", "Большой семейный момент"), caption: P("רגע משפחתי", "Семейный момент") },
  { id: "legacy-1", people: ["rosa", "g1", "g2"], ratio: 4 / 5, placeholder: true, category: "grandchildren", size: "standard", alt: P("רוזה עם הנכדים", "Роза с внуками"), caption: P("עם הנכדים", "С внуками") },
  { id: "legacy-2", people: ["rosa", "gg1"], ratio: 1, placeholder: true, category: "moments", size: "standard", alt: P("רגע מיוחד", "Особый момент"), caption: P("רגע מיוחד", "Особый момент") },
  { id: "g-1", people: ["rosa", "husband"], ratio: 2 / 3, placeholder: true, category: "family", size: "tall", alt: P("תמונה מהאלבום", "Фотография из альбома"), caption: P("מהאלבום המשפחתי", "Из семейного альбома") },
  { id: "g-2", people: ["rosa", "c1"], ratio: 4 / 3, placeholder: true, category: "travel", size: "standard", alt: P("תמונה מטיול", "Фотография из поездки"), caption: P("בטיול", "В поездке") },
  { id: "g-3", people: ["rosa", "husband", "p-mother"], ratio: 3 / 2, placeholder: true, category: "celebrations", size: "wide", alt: P("תמונה מחגיגה", "Фотография с праздника"), caption: P("חגיגה משפחתית", "Семейный праздник") },
  { id: "g-4", people: ["rosa", "p-mother", "p-father"], ratio: 4 / 5, placeholder: true, category: "childhood", size: "standard", alt: P("תמונה ישנה", "Старая фотография"), caption: P("תמונה ישנה", "Старая фотография") },
  { id: "g-5", people: ["rosa", "g4", "g5"], ratio: 1, placeholder: true, category: "grandchildren", size: "standard", alt: P("עם הנכדים", "С внуками"), caption: P("עם הנכדים", "С внуками") },
  { id: "g-6", people: ["rosa", "c2"], ratio: 3 / 4, placeholder: true, category: "moments", size: "tall", alt: P("רגע יומיומי", "Повседневный момент"), caption: P("רגע יומיומי", "Повседневный момент") },
  { id: "g-7", people: ["g1", "g1-p"], ratio: 16 / 10, placeholder: true, category: "travel", size: "wide", alt: P("נוף ממקום שאהבה", "Место, которое она любила"), caption: P("מקום שאהבה", "Место, которое она любила") },
  { id: "video-1", ratio: 16 / 9, placeholder: true, alt: P("תמונת פתיחה לסרטון", "Обложка видео") },
];

export const story: StoryBlock[] = [
  {
    kind: "chapter",
    id: "roots",
    number: 1,
    kicker: P("פרק ראשון", "Глава первая"),
    title: P("שורשים", "Корни"),
    body: [
      P("כאן יסופר מאיפה רוזה באה: הבית שבו גדלה, ההורים, האחים והמקום. הפרק ייכתב מתוך הסיפורים והתמונות שהמשפחה תשתף.", "Здесь будет рассказано, откуда Роза родом: дом, в котором она росла, родители, братья и сёстры, место. Глава сложится из историй и фотографий, которыми поделится семья."),
    ],
    photoIds: ["roots-1"],
    side: "start",
    placeholder: true,
  },
  { kind: "quote", id: "q-1", text: P("משפט שלה, במילים שלה, יופיע כאן", "Здесь появится её фраза, её словами"), attribution: P("רוזה", "Роза"), placeholder: true },
  {
    kind: "chapter",
    id: "home",
    number: 2,
    kicker: P("פרק שני", "Глава вторая"),
    title: P("בית ומשפחה", "Дом и семья"),
    body: [
      P("הבית שבנתה, האנשים שאהבה והדרך שבה דאגה לכולם. מקום לסיפורים של הילדים על השנים האלה.", "Дом, который она создала, люди, которых она любила, и то, как она заботилась обо всех. Место для рассказов детей об этих годах."),
    ],
    photoIds: ["home-1"],
    side: "end",
    placeholder: true,
  },
  { kind: "photo", id: "full-1", photoId: "table-1", placeholder: true },
  {
    kind: "chapter",
    id: "legacy",
    number: 3,
    kicker: P("פרק שלישי", "Глава третья"),
    title: P("מה שהשאירה לנו", "Что она нам оставила"),
    body: [
      P("הנכדים, הנינים, המתכונים, המשפטים והמנהגים שממשיכים איתנו. כאן נאסוף את מה שעבר ממנה הלאה.", "Внуки, правнуки, рецепты, слова и привычки, которые остаются с нами. Здесь мы соберём то, что она передала дальше."),
    ],
    photoIds: ["legacy-1", "legacy-2"],
    side: "start",
    placeholder: true,
  },
];

export const milestones: Milestone[] = [
  { id: "m-childhood", title: P("ילדות", "Детство"), summary: P("השנים הראשונות, הבית והמשפחה שבה גדלה.", "Первые годы, дом и семья, в которой она росла."), details: [P("הפרטים, השנים והמקומות יתווספו מתוך עדויות המשפחה.", "Подробности, годы и места добавятся из рассказов семьи.")], photoIds: ["roots-1", "g-4"], placeholder: true },
  { id: "m-youth", title: P("נעורים", "Юность"), summary: P("החברים, הלימודים והחלומות.", "Друзья, учёба и мечты."), photoIds: [], placeholder: true },
  { id: "m-marriage", title: P("נישואים", "Замужество"), summary: P("ההתחלה של המשפחה שלה.", "Начало её собственной семьи."), details: [P("כשיהיו תמונות עם תאריך שמור בקובץ, השנה תופיע כאן אוטומטית.", "Когда появятся фотографии с датой в файле, год появится здесь автоматически.")], photoIds: ["g-3"], placeholder: true },
  { id: "m-children", title: P("ילדים", "Дети"), summary: P("הבית מתמלא.", "Дом наполняется."), photoIds: ["home-1"], placeholder: true },
  { id: "m-grandchildren", title: P("נכדים ונינים", "Внуки и правнуки"), summary: P("הדורות שאחריה.", "Следующие поколения."), photoIds: ["legacy-1", "g-5"], placeholder: true },
  { id: "m-legacy", title: P("מורשת", "Наследие"), summary: P("מה שממשיך איתנו.", "То, что остаётся с нами."), photoIds: [], placeholder: true },
];

export const memories: Memory[] = [
  { id: "mem-1", author: "שם בן המשפחה", relation: "נכדה", title: "זיכרון ראשון", body: "כאן יופיע זיכרון שבן משפחה שיתף: רגע, ריח, משפט שלה. זיכרון יכול להיות קצר כמו שורה אחת.", lang: "he", translation: "Здесь появится воспоминание, которым поделился кто-то из семьи: момент, запах, её фраза. Воспоминание может быть коротким, как одна строка.", createdAt: "2026-11-12", placeholder: true },
  { id: "mem-2", author: "Имя родственника", relation: "сын", body: "Воспоминания можно писать по-русски. Они будут показаны с переводом на иврит, а оригинал всегда останется рядом.", lang: "ru", translation: "אפשר לכתוב זיכרונות ברוסית. הם יוצגו עם תרגום לעברית, והמקור תמיד יישאר לידם.", photoId: "g-6", createdAt: "2026-11-12", placeholder: true },
  { id: "mem-3", author: "שם בן המשפחה", relation: "בת", title: "עם תמונה", body: "זיכרון יכול לבוא עם תמונה, סרטון או הקלטה.", lang: "he", translation: "Воспоминание может сопровождаться фотографией, видео или записью.", photoId: "g-2", createdAt: "2026-11-12", placeholder: true },
  { id: "mem-4", author: "שם בן המשפחה", relation: "נכד", body: "כל זיכרון נבדק לפני שהוא מתפרסם כאן.", lang: "he", translation: "Каждое воспоминание проверяется перед публикацией.", mediaKind: "audio", createdAt: "2026-11-12", placeholder: true },
];

export const notes: Note[] = [
  { id: "n-quote", kind: "quote", text: P("משפט שסבתא נהגה לומר", "Фраза, которую бабушка любила повторять"), from: P("רוזה", "Роза"), placeholder: true },
  { id: "n-letter", kind: "letter", text: P("קטע ממכתב שכתבה או שנכתב אליה. מכתבים סרוקים יוצגו כאן עם תמלול שאפשר לקרוא.", "Отрывок из письма, которое она написала или которое написали ей. Отсканированные письма появятся здесь с расшифровкой."), from: P("מכתב מהארכיון המשפחתי", "Письмо из семейного архива"), placeholder: true },
  { id: "n-note", kind: "note", text: P("כמה מילים אישיות אליה", "Несколько личных слов ей"), from: P("מבן משפחה", "От родного человека"), placeholder: true },
  { id: "n-message", kind: "quote", text: P("ברכה או מסר מהמשפחה", "Пожелание или слова от семьи"), from: P("המשפחה", "Семья"), placeholder: true },
];

export const media: MediaItem[] = [
  {
    id: "v-1",
    kind: "video",
    title: P("סרטון משפחתי", "Семейное видео"),
    description: P("כל סרטון מתומלל אוטומטית. שנים, מקומות ואנשים שמוזכרים בו מוצעים לציר החיים ומחכים לאישור המשפחה.", "Каждое видео расшифровывается автоматически. Упомянутые годы, места и люди предлагаются для жизненного пути и ждут подтверждения семьи."),
    posterId: "video-1",
    transcript: [
      { at: 0, text: P("כאן יופיע התמלול של הסרטון,", "Здесь появится расшифровка видео,") },
      { at: 6, text: P("שורה אחרי שורה, מסונכרן עם הצפייה.", "строка за строкой, синхронно с просмотром.") },
      { at: 12, text: P("לחיצה על שורה קופצת לרגע הזה.", "Нажатие на строку переносит к этому моменту.") },
    ],
    findings: [
      { kind: "year", label: P("שנה שהוזכרה", "Упомянутый год") },
      { kind: "place", label: P("מקום", "Место") },
      { kind: "people", label: P("אנשים", "Люди") },
    ],
    placeholder: true,
  },
  { id: "a-1", kind: "audio", title: P("הקלטה קולית", "Аудиозапись"), description: P("הקלטה של הקול שלה, אם קיימת במשפחה.", "Запись её голоса, если она есть в семье."), placeholder: true },
  { id: "a-2", kind: "audio", title: P("ראיון משפחתי", "Семейное интервью"), description: P("שיחה שבה מישהו מהמשפחה מספר עליה.", "Разговор, в котором кто-то из семьи рассказывает о ней."), placeholder: true },
];

export const photoById = (id?: string) => photos.find((p) => p.id === id);
