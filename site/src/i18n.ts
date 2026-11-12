import type { Card, Section } from "./card";
import type { Character } from "./characters";

/** The site speaks English (the original) and Russian (translations made with the translate-character skill). */
export type Lang = "en" | "ru";
/** Languages the visitor can switch to. Russian is hidden until the translations are polished; add "ru" back to show the switch. */
export const LANGS: Lang[] = ["en"];

const UI = {
	en: {
		nav: { characters: "Characters", how: "How it works" },
		github: "GitHub",
		install: "Install",
		openCard: (his: string) => `Open ${his} card`,
		hearVoice: (his: string) => `Hear ${his} voice`,
		stop: "Stop",
		download: "Download",
		soundOn: "Sound on",
		soundOff: "Sound off",
		close: "Close card",
		prev: "Previous character",
		next: "Next character",
		disclaimer:
			"Fictional characters made with AI. Any resemblance to real people is coincidental; details may be inaccurate.",
		medium: {
			advertising: "Ad",
			game: "Game",
			film: "Film",
			book: "Book",
			animation: "Animation",
			comics: "Comics",
			tabletop: "Tabletop",
		} as Record<string, string>,
	},
	ru: {
		nav: { characters: "Персонажи", how: "Как это работает" },
		github: "GitHub",
		install: "Установить",
		openCard: () => "Открыть карточку",
		hearVoice: () => "Услышать голос",
		stop: "Стоп",
		download: "Скачать",
		soundOn: "Включить звук",
		soundOff: "Выключить звук",
		close: "Закрыть карточку",
		prev: "Предыдущий персонаж",
		next: "Следующий персонаж",
		disclaimer:
			"Персонажи вымышлены и созданы с помощью ИИ. Любое сходство с реальными людьми случайно; детали могут быть неточны.",
		medium: {
			advertising: "Реклама",
			game: "Игра",
			film: "Кино",
			book: "Книга",
			animation: "Анимация",
			comics: "Комикс",
			tabletop: "Настолка",
		} as Record<string, string>,
	},
};
export const ui = (lang: Lang) => UI[lang];

/** Fixed labels of the card sections (the card's own text comes translated in card.<lang>.json). */
const RU: Record<string, string> = {
	Core: "Ядро",
	Goals: "Цели",
	Identification: "Сопереживание",
	Psychology: "Психология",
	Description: "Описание",
	Fears: "Страхи",
	Uniqueness: "Уникальность",
	"Story & world": "История и мир",
	Traits: "Черты",
	Destiny: "Судьба",
	Look: "Облик",
	"One causal chain": "Одна причинная цепь",
	"Everything grows from one wound": "Всё растёт из одной раны",
	"Want vs need": "Хочет или нужно",
	"Want and need": "Желание и потребность",
	"Why we care": "Почему мы сопереживаем",
	"How the audience bonds": "Чем цепляет зрителя",
	Inside: "Внутри",
	"Inside the head": "В голове",
	"First impression": "Первое впечатление",
	"Fear & courage": "Страх и смелость",
	"What holds her back": "Что её держит",
	"What holds him back": "Что его держит",
	"What holds them back": "Что их держит",
	Backstory: "Предыстория",
	"Where it all comes from": "Откуда всё началось",
	"Best & worst": "Лучшее и худшее",
	"One wound, two faces": "Одна рана, два лица",
	"The arc": "Арка",
	"Where the story leads": "Куда ведёт история",
	Wound: "Рана",
	Lie: "Ложь",
	Fear: "Страх",
	"Defense / Gift": "Защита / Дар",
	Truth: "Истина",
	"The question the story answers": "Вопрос, на который отвечает история",
	Want: "Хочет",
	Need: "Нужно",
	Motivation: "Мотивация",
	Conflict: "Конфликт",
	Superpower: "Суперсила",
	Vulnerability: "Уязвимость",
	"Sympathy hook": "Крючок сочувствия",
	"First appearance": "Первое появление",
	Jeopardy: "Угроза",
	Flaws: "Недостатки",
	"Inner monologue": "Внутренний голос",
	Baseline: "Базовое состояние",
	Insecurity: "Неуверенность",
	Trigger: "Триггер",
	Name: "Имя",
	Age: "Возраст",
	Background: "Происхождение",
	Build: "Телосложение",
	Face: "Лицо",
	Hair: "Волосы",
	Speech: "Речь",
	"Pet words": "Словечки",
	"In their own words": "Своими словами",
	"Secret dream": "Тайная мечта",
	Missing: "Чего не хватает",
	Mask: "Маска",
	Courage: "Смелость",
	Quirks: "Причуды",
	"Stress relief": "Как снимает стресс",
	"Who rules": "Кто правит",
	Boundaries: "Границы",
	"Good & bad": "Добро и зло",
	"Worth living for": "Ради чего жить",
	"Key locations": "Ключевые места",
	Contradictions: "Противоречия",
	"Best trait": "Лучшая черта",
	"Worst trait": "Худшая черта",
	"Other traits": "Другие черты",
	"Born with": "С чем родился",
	Born: "От рождения",
	Now: "Сейчас",
	"In life": "Какой в жизни",
	Lineage: "Родословная",
	Extraversion: "Общительность",
	Neuroticism: "Тревожность",
	Agreeableness: "Уступчивость",
	Conscientiousness: "Собранность",
	Openness: "Открытость",
	Sensitivity: "Чувствительность",
	"What others say": "Что о нём говорят",
	"Ordinary world": "Обычный мир",
	"The void": "Пустота",
	Threshold: "Порог",
	Ordeal: "Испытание",
	Transformation: "Перемена",
	Ending: "Финал",
	"Reads in 3 seconds": "Читается за 3 секунды",
	"Signature item": "Главная вещь",
	Shape: "Форма",
	Silhouette: "Силуэт",
	Marks: "Отметины",
	Gait: "Походка",
	Idle: "В покое",
	"Outfit · inner → outer": "Одежда · изнутри наружу",
};
const tr = (lang: Lang, s: string | undefined) =>
	lang === "en" || s === undefined
		? s
		: (RU[s] ?? s.replace(" · unconscious", " · неосознанный"));

export function localizeSections(list: Section[], lang: Lang): Section[] {
	if (lang === "en") return list;
	return list.map((s) => ({
		...s,
		nav: tr(lang, s.nav)!,
		kicker: tr(lang, s.kicker)!,
		title: tr(lang, s.title),
		blocks: s.blocks.map((b) => {
			switch (b.type) {
				case "chain":
					return {
						...b,
						steps: b.steps.map((x) => ({ ...x, label: tr(lang, x.label)! })),
					};
				case "question":
					return { ...b, label: tr(lang, b.label)! };
				case "rows":
					return {
						...b,
						rows: b.rows.map(([l, v]) => [tr(lang, l)!, v] as [string, string]),
					};
				case "cards":
					return {
						...b,
						items: b.items.map((x) => ({ ...x, label: tr(lang, x.label)! })),
					};
				case "radar":
					return {
						...b,
						title: tr(lang, b.title),
						axes: b.axes.map((x) => ({ ...x, label: tr(lang, x.label)! })),
						legend: {
							born: tr(lang, b.legend.born)!,
							now: tr(lang, b.legend.now)!,
						},
					};
				case "timeline":
					return {
						...b,
						title: tr(lang, b.title),
						items: b.items.map((x) => ({ ...x, lead: tr(lang, x.lead)! })),
					};
				case "list":
					return {
						...b,
						title: tr(lang, b.title),
						items: b.items.map((x) => ({ ...x, lead: tr(lang, x.lead) })),
					};
				case "quotes":
				case "prose":
					return { ...b, title: tr(lang, b.title) };
				default:
					return b;
			}
		}),
	}));
}

/** One character as the visitor sees them in a language: the translated card, texts and voice if they exist. */
export function inLang(
	c: Character,
	lang: Lang,
): {
	card: Card;
	kicker: string;
	blurb: string;
	voice?: string;
} {
	const t = lang === "en" ? undefined : c.i18n?.[lang];
	const card = lang === "ru" && c.cardRu ? c.cardRu : c.card;
	return {
		card,
		kicker: t?.kicker ?? c.kicker,
		blurb: t?.blurb ?? c.blurb,
		voice: lang === "ru" ? (c.files.voiceRu ?? c.files.voice) : c.files.voice,
	};
}
