import type { Language } from "./domain";

// Minimal i18n: a flat string map, English default with a Georgian toggle.
// Intentionally dependency-free — no i18n framework for the MVP.

export const STRINGS = {
  en: {
    "app.title": "Tbilisi Rental Concierge",
    "app.tagline":
      "Describe your ideal home in plain language — we match, rank, and link you to the real listings.",
    "nav.newSearch": "New search",
    "intake.heading": "What home are you looking for?",
    "intake.subheading":
      "Write freely in English or Georgian. For example: “2-bedroom furnished flat in Vera or Vake, under $800/month, pet-friendly, available from September.”",
    "intake.emailLabel": "Your email",
    "intake.emailPlaceholder": "you@example.com",
    "intake.queryLabel": "Describe what you want",
    "intake.queryPlaceholder":
      "2-bedroom furnished flat in Vera or Vake, under $800/month, pet-friendly, available from September…",
    "intake.submit": "Find matches",
    "intake.submitting": "Matching…",
    "intake.error": "Something went wrong. Please try again.",
    "intake.examplesHeading": "Try an example",
    "results.heading": "Your matches",
    "results.for": "Matches for",
    "results.count": "strong matches",
    "results.none": "No strong matches yet. Try widening your budget or districts.",
    "results.criteria": "We understood your request as",
    "results.rerun": "Re-run matching",
    "results.savedSearch": "This search is saved — we'll keep matching new listings.",
    "results.score": "Match",
    "results.why": "Why this matches",
    "results.viewSource": "View original listing",
    "results.newSearch": "Start a new search",
    "listing.month": "/mo",
    "listing.rooms": "rooms",
    "listing.bedrooms": "bd",
    "listing.sqm": "m²",
    "listing.floor": "floor",
    "listing.furnished": "Furnished",
    "listing.unfurnished": "Unfurnished",
    "listing.petsOk": "Pets OK",
    "listing.noPets": "No pets",
    "listing.heating": "heating",
    "listing.available": "Available",
    "listing.availableNow": "Available now",
    "criteria.type": "Type",
    "criteria.districts": "Districts",
    "criteria.budget": "Budget",
    "criteria.rooms": "Rooms",
    "criteria.bedrooms": "Bedrooms",
    "criteria.furnished": "Furnished",
    "criteria.heating": "Heating",
    "criteria.pets": "Pets",
    "criteria.availableFrom": "Available from",
    "criteria.any": "any",
    "common.rent": "rent",
    "common.sale": "sale",
    "common.yes": "yes",
    "common.no": "no",
    "footer.note":
      "We link to original listings; we never republish owners' personal data.",
  },
  ka: {
    "app.title": "თბილისის ქირავნობის კონსიერჟი",
    "app.tagline":
      "აღწერეთ თქვენი იდეალური სახლი მარტივი ენით — ჩვენ მოვძებნით, დავალაგებთ და დაგაკავშირებთ რეალურ განცხადებებთან.",
    "nav.newSearch": "ახალი ძებნა",
    "intake.heading": "როგორ სახლს ეძებთ?",
    "intake.subheading":
      "დაწერეთ თავისუფლად ინგლისურად ან ქართულად. მაგალითად: „ორ საძინებლიანი ავეჯით ბინა ვერაში ან ვაკეში, თვეში $800-მდე, ცხოველებით, სექტემბრიდან.“",
    "intake.emailLabel": "თქვენი ელფოსტა",
    "intake.emailPlaceholder": "you@example.com",
    "intake.queryLabel": "აღწერეთ რას ეძებთ",
    "intake.queryPlaceholder":
      "ორ საძინებლიანი ავეჯით ბინა ვერაში ან ვაკეში, თვეში $800-მდე, ცხოველებით, სექტემბრიდან…",
    "intake.submit": "მოძებნე",
    "intake.submitting": "მიმდინარეობს…",
    "intake.error": "დაფიქსირდა შეცდომა. სცადეთ თავიდან.",
    "intake.examplesHeading": "სცადეთ მაგალითი",
    "results.heading": "თქვენი შედეგები",
    "results.for": "შედეგები მოთხოვნისთვის",
    "results.count": "ძლიერი დამთხვევა",
    "results.none":
      "ძლიერი დამთხვევა ჯერ არ არის. სცადეთ ბიუჯეტის ან უბნების გაფართოება.",
    "results.criteria": "თქვენი მოთხოვნა გავიგეთ ასე",
    "results.rerun": "ხელახლა მოძებნა",
    "results.savedSearch":
      "ეს ძებნა შენახულია — ჩვენ გავაგრძელებთ ახალი განცხადებების შედარებას.",
    "results.score": "დამთხვევა",
    "results.why": "რატომ ემთხვევა",
    "results.viewSource": "ორიგინალი განცხადება",
    "results.newSearch": "ახალი ძებნის დაწყება",
    "listing.month": "/თვე",
    "listing.rooms": "ოთახი",
    "listing.bedrooms": "საძ.",
    "listing.sqm": "მ²",
    "listing.floor": "სართული",
    "listing.furnished": "ავეჯით",
    "listing.unfurnished": "ავეჯის გარეშე",
    "listing.petsOk": "ცხოველებით",
    "listing.noPets": "ცხოველების გარეშე",
    "listing.heating": "გათბობა",
    "listing.available": "ხელმისაწვდომია",
    "listing.availableNow": "ხელმისაწვდომია ახლა",
    "criteria.type": "ტიპი",
    "criteria.districts": "უბნები",
    "criteria.budget": "ბიუჯეტი",
    "criteria.rooms": "ოთახები",
    "criteria.bedrooms": "საძინებლები",
    "criteria.furnished": "ავეჯი",
    "criteria.heating": "გათბობა",
    "criteria.pets": "ცხოველები",
    "criteria.availableFrom": "ხელმისაწვდომია",
    "criteria.any": "ნებისმიერი",
    "common.rent": "ქირავდება",
    "common.sale": "იყიდება",
    "common.yes": "კი",
    "common.no": "არა",
    "footer.note":
      "ჩვენ ვუკავშირდებით ორიგინალ განცხადებებს; არასდროს ვაქვეყნებთ მფლობელების პერსონალურ მონაცემებს.",
  },
} as const;

export type StringKey = keyof (typeof STRINGS)["en"];

export function t(lang: Language, key: StringKey): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}
