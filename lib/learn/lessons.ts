import type { Locale } from "@/lib/i18n/strings";

// The written lessons on /learn. Each pairs a short screen recording
// (public/tutorials/<slug>.mp4, silent, captions burnt in) with the same
// flow as numbered steps, so the page works before a video exists and for
// anyone who prefers reading.
export interface Lesson {
  slug: string;
  title: string;
  intro: string;
  steps: string[];
}

const ka: Lesson[] = [
  {
    slug: "assets-add",
    title: "აქტივის დამატება და სტატუსები",
    intro:
      "ერთი ღილაკი ყველა ტიპისთვის — ბინა, მანქანა, შემოსავალი თუ კრიპტო. კატეგორიას ირჩევ და საჭირო ველები თავად ჩნდება.",
    steps: [
      "გახსენი „აქტივები\" და დააჭირე „ახალი აქტივი\".",
      "აირჩიე კატეგორია — მაგალითად „უძრავი ქონება\".",
      "შეავსე სახელი, უბანი, ფართობი და შეფასებული ღირებულება.",
      "შეინახე — აქტივი სიაში ბარათად გამოჩნდება.",
      "სტატუსს („გაქირავებული\", „თავისუფალი\"...) ბარათიდანვე შეცვლი; განცხადების ბმულს ჩასვამ და პლატფორმას თავად იცნობს.",
    ],
  },
  {
    slug: "calendar-ical",
    title: "კალენდარი და iCal სინქრონი",
    intro:
      "ყველა ერთეული ერთ ბადეზე: სტრიქონი ერთეულია, სვეტი — დღე, ფერი — ჯავშნის წყარო. Airbnb და Booking.com თავად სინქრონდება.",
    steps: [
      "გახსენი „გაქირავება\" → „კალენდარი\" — მთელი თვე ერთ ეკრანზეა.",
      "ფერები წყაროს აჩვენებს: Airbnb, Booking.com, პირდაპირი, იჯარა; გადაფარვა წითლად ანათებს.",
      "ერთეულის დასაკავშირებლად გახსენი ის „ერთეულებიდან\" და ჩასვი iCal ბმულები Airbnb/Booking-იდან.",
      "ცალკეულ აქტივზე კალენდარში დღეებზე თითის გადასმით მონიშნავ პერიოდს და პირდაპირ ხელშეკრულებად შეინახავ.",
      "„თავისუფალი ფანჯრები\" ქვემოთ ჩანს — შეტყობინებაც ავტომატურად მოვა.",
    ],
  },
  {
    slug: "digital",
    title: "ციფრული აქტივები",
    intro:
      "კრიპტო, აქციები და ძვირფასი ლითონები ცოცხალი ფასებით. საშუალო შესყიდვის ფასი შენი გარიგებებიდან ავტომატურად ითვლება.",
    steps: [
      "„აქტივებში\" ჩადი „ციფრული აქტივების\" სექციამდე.",
      "დაამატე ჰოლდინგი „ახალი აქტივით\" — აირჩიე კრიპტო, აქცია ან ლითონი და მიუთითე რაოდენობა და ფასი.",
      "სიაში ხედავ მიმდინარე ფასს, ღირებულებას და მოგება/ზარალს ლარსა და პროცენტში.",
      "ყიდვა/გაყიდვას აქტივის გვერდზე Buy/Sell ფორმებით აფიქსირებ.",
      "საშუალო ფასი და P/L ყოველ გარიგებაზე თავად გადაითვლება.",
    ],
  },
  {
    slug: "calc-plans",
    title: "კალკულატორები და პაკეტები",
    intro:
      "სამი უფასო კალკულატორი — გასაქირავებელი ბინა, მანქანა/ტაქსი და ფლიპი — და სიღრმისეული PRO ანალიზი ფასიან პაკეტში.",
    steps: [
      "გახსენი „საინვესტიციო კალკულატორი\" — ანგარიში არ სჭირდება.",
      "„უძრავი ქონება\": ფასი, რემონტი, მოსალოდნელი ქირა — მიიღებ სარგებელს, ამოგების ვადას და დეპოზიტთან შედარებას.",
      "„ავტომობილი\": გაქირავება ან ტაქსის რეჟიმი — ცვეთის ჩათვლით, გვერდიგვერდ შედარებით.",
      "„ფლიპი\": ყიდვა-რემონტი-გაყიდვა წლიურ განაკვეთში და წაუგებელი ფასი.",
      "პაკეტს „პაკეტის განახლებიდან\" შეიძენ — პირველი თვე ისედაც უფასოა, სრული წვდომით.",
    ],
  },
];

const en: Lesson[] = [
  {
    slug: "assets-add",
    title: "Adding assets and statuses",
    intro:
      "One button for every type — a flat, a car, an income stream or crypto. Pick a category and the right fields appear.",
    steps: [
      "Open “Assets” and press “New Asset”.",
      "Pick a category — say, “Real estate”.",
      "Fill in the name, district, area and estimated value.",
      "Save — the asset appears in the list as a card.",
      "Change its status (rented, vacant…) right on the card; paste a listing URL and the platform is detected automatically.",
    ],
  },
  {
    slug: "calendar-ical",
    title: "Calendar and iCal sync",
    intro:
      "Every unit on one grid: a row is a unit, a column is a day, colour is the booking source. Airbnb and Booking.com sync in by themselves.",
    steps: [
      "Open “Rentals” → “Calendar” — the whole month on one screen.",
      "Colours show the source: Airbnb, Booking.com, direct, lease; overlaps glow red.",
      "To connect a unit, open it under “Units” and paste its Airbnb/Booking iCal links.",
      "On a single asset's calendar, drag across days to select a range and save it straight to a contract.",
      "Vacancy gaps are listed below — and raised as alerts automatically.",
    ],
  },
  {
    slug: "digital",
    title: "Digital assets",
    intro:
      "Crypto, stocks and precious metals at live prices. The average buy price is computed from your trades automatically.",
    steps: [
      "In “Assets”, scroll to the “Digital assets” section.",
      "Add a holding with “New Asset” — choose crypto, a stock or a metal, then quantity and price.",
      "The list shows the live price, current value and P/L in GEL and percent.",
      "Record buys and sells with the Buy/Sell forms on the asset's page.",
      "The average price and P/L recompute on every trade.",
    ],
  },
  {
    slug: "calc-plans",
    title: "Calculators and plans",
    intro:
      "Three free calculators — buy-to-let, vehicle or taxi, and flips — plus the deep PRO analysis on a paid plan.",
    steps: [
      "Open the “Investment Calculator” — no account needed.",
      "“Real estate”: price, renovation, expected rent — you get the yield, payback and a deposit comparison.",
      "“Vehicle”: rental or taxi mode — depreciation included, compared side by side.",
      "“Flip”: buy-renovate-sell as an annualized rate, plus the break-even price.",
      "Buy a plan from “Upgrade Plan” — the first month is free with full access anyway.",
    ],
  },
];

export const LESSONS: Record<Locale, Lesson[]> = { en, ka };
