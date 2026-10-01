import type { Locale } from "@/lib/i18n/strings";

// The written lessons on /learn. Each pairs a short screen recording
// (public/tutorials/<slug>.mp4, silent, captions burnt in) with the same
// flow as numbered steps, so the page works before a video exists and for
// anyone who prefers reading.
/**
 * Lessons whose recording shows an old design. The four videos recorded on
 * 2026-08-24 predate the Ice redesign — a purple button, plain cards, other
 * figures — so they were taken out of public/ (they were still served) and
 * /learn says once that the videos are being re-recorded; the written steps
 * stay. Put a new recording in public/tutorials/<slug>.mp4 and take its
 * slug out of this set (see the release checklist in README.md).
 */
export const OUTDATED_VIDEOS: ReadonlySet<string> = new Set([
  "assets-add",
  "calendar-ical",
  "digital",
  "calc-plans",
]);

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
      "გახსენი „აქტივები\" და დააჭირე „აქტივის დამატება\".",
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
      "გახსენი „გაქირავება\" › „კალენდარი\" — მთელი თვე ერთ ეკრანზეა.",
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
      "დაამატე ჰოლდინგი ღილაკით „აქტივის დამატება\" — აირჩიე კრიპტო, აქცია ან ლითონი და მიუთითე რაოდენობა და ფასი (დოლარში ან ლარში).",
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
  {
    slug: "fleet",
    title: "მანქანების გაქირავება: გადახდები და შეტყობინებები",
    intro:
      "თითო მანქანას თავისი გაქირავების სერვისი აქვს: ვინ მართავს, რა პერიოდით იხდის, რამდენი დღით აგვიანებს და რა შეტყობინება წავა მძღოლთან.",
    steps: [
      "„ავტოპარკში\" დააჭირე „მანქანის დამატება\" — ერთ ფორმაში ჩაწერე ნომერი, მძღოლი, ტელეფონი, პერიოდი (დღე, კვირა, თვე) და თანხა.",
      "შენახვის შემდეგ მანქანის „გადახდები\" იხსნება: აქ ჩანს, რამდენია გადასახდელი და რამდენი დღით აგვიანებს.",
      "ფული რომ მოვა, „გადახდის აღრიცხვით\" ჩაწერე — დაგვიანება თავისით დაიხურება; მთავარ გვერდზე ბარათის მარჯვნივ გასმაც იგივეს აკეთებს და დაბრუნებაც შეიძლება.",
      "„შეტყობინებებში\" ხედავ, რა წავა მძღოლთან (თქვენობით, შენი სახელით და ნომრით); ღილაკი „WhatsApp-ით გაგზავნა\" გახსნის WhatsApp-ს და შეტყობინებას გაგზავნილად მონიშნავს.",
      "შეღავათიანი ვადა თუ ამოიწურა, მთავარ გვერდზე „დაბრუნების მოთხოვნის უფლება ძალაშია\" გამოჩნდება — ეს ხელშეკრულებით შენი უფლებაა, Activo თავად არავის ურეკავს.",
    ],
  },
  {
    slug: "gps",
    title: "GPS ტრეკერი და წითელი ხაზები",
    intro:
      "ტრეკერი თავისით ვერ დაიწყებს გაგზავნას: ინსტალატორი ან თვალთვალის სერვისი მას Activo-ს მისამართზე აწყობს. მერე წითელი ხაზის გადაკვეთისას შენ და მძღოლს შეტყობინება მოგდით.",
    steps: [
      "მანქანის გვერდზე გახსენი „GPS\" › „პარამეტრები\" და „მოწყობილობის მიბმაში\" ჩაწერე ტრეკერის ნომერი (IMEI ან ID).",
      "დააკოპირე „მისამართი\" და გაუგზავნე ინსტალატორს ან თვალთვალის სერვისს — ის ტრეკერს ამ მისამართზე გააგზავნინებს მდებარეობას (Traccar/OsmAnd ფორმატიც მიიღება).",
      "სანამ პირველი სიგნალი არ მოვა, გვერდი წერს „სიგნალი ჯერ არ მოსულა\"; მოსვლისთანავე ბოლო მდებარეობა და დრო გამოჩნდება.",
      "„ახალი წითელი ხაზით\" დახაზე საზღვარი — სწრაფი არჩევანით (მაგ. „თბილისი 30 კმ\") ან წრით/წერტილებით — და მიუთითე, რამდენი კმ-ით ადრე გაგაფრთხილოს.",
      "ხელშეკრულებაში მძღოლს წინასწარ აცნობე, რომ მანქანას GPS აქვს და ხაზის გადაკვეთისას გაქვს უფლება, ნომერი 112-ს გადასცე; ტრეკერი თუ 30 წუთზე მეტხანს დადუმდება, ესეც გეცნობება.",
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
      "Open “Assets” and press “Add Asset”.",
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
      "Open “Rentals” › “Calendar” — the whole month on one screen.",
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
      "Add a holding with “Add Asset” — choose crypto, a stock or a metal, then quantity and price (in USD or GEL).",
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
  {
    slug: "fleet",
    title: "Renting out cars: payments and messages",
    intro:
      "Every car has its own rental service: who drives it, how often they pay, how many days late they are and what message goes to the driver.",
    steps: [
      "In “Fleet” press “Add a car” — the plate, driver, phone, period (day, week, month) and amount in one form.",
      "After saving, the car's “Payments” open: what is owed and how many days late.",
      "When money comes in, “Record Payment” — the delay closes by itself; swiping the card right on Home does the same, with an undo.",
      "“Messages” shows what goes to the driver (formal, with your name and number); “Send on WhatsApp” opens WhatsApp and marks it sent.",
      "When the grace period is over, Home shows “Repossession right live” — your right under the contract; Activo itself never calls anyone.",
    ],
  },
  {
    slug: "gps",
    title: "GPS tracker and red lines",
    intro:
      "A tracker cannot start sending by itself: the installer or the tracking service points it at Activo's address. Then you and the driver are told when a red line is crossed.",
    steps: [
      "On the car's page open “GPS” › “Settings” and enter the tracker's number (IMEI or ID) under “Connect Device”.",
      "Copy the “Ping Address” and send it to the installer or tracking service — they make the tracker send its position there (Traccar/OsmAnd format works too).",
      "Until the first signal arrives, the page says it has not come yet; then the last position and time appear.",
      "Draw the boundary with “New red line” — a quick choice (e.g. “Tbilisi 30 km”) or a circle/points — and say how many km ahead to warn.",
      "Tell the driver in the contract that the car has GPS and that crossing the line gives you the right to pass the plate to 112; a tracker silent for over 30 minutes is reported too.",
    ],
  },
];

export const LESSONS: Record<Locale, Lesson[]> = { en, ka };
