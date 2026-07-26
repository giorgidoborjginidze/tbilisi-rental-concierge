# Activo — სრული აღწერა დიზაინის ბრიფისთვის

> ეს დოკუმენტი ორ ნაწილადაა: **ქართული ვერსია** (შენთვის, წასაკითხად და შესასწორებლად)
> და **English version** (AI-სთვის ჩასაწერად — ინგლისურად უკეთეს შედეგს იძლევა).

---

# ნაწილი 1 — ქართული ვერსია

## 1. რა არის Activo

**Activo** არის ქართული SaaS პლატფორმა ქონებისა და აქტივების მართვისთვის.
ერთ დაფაზე კრებს ყველაფერს, რაც ადამიანს ან კომპანიას ეკუთვნის: უძრავი ქონება,
ავტომობილები, გაქირავება, შემოსავალი და ციფრული ინვესტიციები.

- **დომეინი:** activo.world
- **ენები:** ქართული და ინგლისური (რუსული დაგეგმილია)
- **ვალუტა:** ლარი (GEL); ციფრული აქტივები დოლარში, კურსით ლარად გადაყვანით
- **ბაზარი:** ჯერ საქართველო, შემდეგ გლობალურად
- **პლატფორმა:** ვებ-აპლიკაცია, მობაილზე მაქსიმალურად მორგებული (mobile-first)

**პოზიციონირება:** მშვიდი, სანდო, პროფესიონალური ინსტრუმენტი — არა „სტარტაპულად ჭრელი".
მომხმარებელი ერთი შეხედვით უნდა ხვდებოდეს: რა აქვს, რამდენს გამოიმუშავებს, რას სჭირდება ყურადღება.

## 2. ვისთვისაა (მომხმარებლის ტიპები)

რეგისტრაციისას მომხმარებელი ირჩევს **ანგარიშის ტიპს** და **პროფილს**:

**ანგარიშის ტიპი:**
- `personal` — ფიზიკური პირი (1 მომხმარებელი)
- `business` — კომპანია (გუნდი, რამდენიმე წევრი)

**სამუშაო პროფილი** (განსაზღვრავს რა გამოჩნდეს დაფაზე და ნავიგაციაში):
- `personal` — კერძო მფლობელი (1–5 ბინა, მანქანა, ინვესტიციები)
- `hotel` — დღიური გაქირავება / აპარტ ჰოტელი (Airbnb, Booking)
- `brokerage` — უძრავი ქონების სააგენტო
- `car_rental` — ავტო-გაქირავება

## 3. სრული ფუნქციონალი (გვერდების მიხედვით)

### 3.1 Landing (მთავარი — გამოსული მომხმარებლისთვის)
- Splash-ეკრანი: საიტზე შესვლისას ჯერ მხოლოდ ლოგო ჩნდება, ხელის დაჭერით იხსნება
- სათაური: „All Your Property — One Dashboard"
- 2 ღილაკი: „Create Free Account" და „Try the Free Calculator"
- დემო-ანგარიშის ბლოკი (test@activo.world / test1234) — „Open the Demo"
- 4 ფერადი ბარათი (ხაზოვანი SVG აიქონებით):
  1. **Everything in One Place** — უძრავი ქონება, ავტომობილები, შემოსავალი
  2. **Automatic Booking Sync** — Airbnb და Booking ერთ კალენდარში
  3. **Georgia first, then everywhere** — myhome.ge, ss.ge, myauto.ge, ლარი, WhatsApp
  4. **Invest with Numbers** — უფასო კალკულატორი
- ფასის ხაზი: „პირველი თვე უფასოა — შემდეგ 15₾/თვე-დან"

### 3.2 Dashboard (მთავარი — შესული მომხმარებლისთვის)
- მისალმება: „გამარჯობა, {სახელი}" + პროფილის ქვესათაური
- KPI ბარათები (პროფილის მიხედვით იცვლება):
  - სასტუმროსთვის: Occupancy %, ADR, RevPAR, შემოსავალი, „დაკავებული ახლა" (X / Y)
  - კერძო/სააგენტოსთვის: აქტივების რაოდენობა, ღირებულება, თვიური შემოსავალი
- „ამ თვის" ცხრილები: მიმდინარე ჯავშნები, იწურება ხელშეკრულებები
- სწრაფი ბმულები (chips): Assets, ახალი აქტივი, Alerts…

### 3.3 Assets (აქტივები) — ბირთვი
ერთი ღილაკი „New Asset", კატეგორია ჯერ ირჩევა, შემდეგ ველები ჩნდება.

**კატეგორიები და სეგმენტები (ჩამოსაშლელი ფილტრით):**
1. **Real Estate** — ბინა, სახლი, კომერციული ფართი, მიწა, ავტოფარეხი
   - ველები: სახელი, უბანი, მისამართი, ფართობი (მ²), შეფასებული ღირებულება
   - სტატუსი: `rented` / `vacant` / `personal_use` / `listed`
   - გაქირავების რეჟიმი: გრძელვადიანი ან დღიური (დღიურს აქვს ბაზისური ტარიფი + უიქენდის/დღესასწაულის დანამატი %)
   - **საბაზრო ქირის შეფასება** — უბნისა და ფართობის მიხედვით; თუ ფაქტობრივი ქირა 15%-ით დაბალია, ჩნდება ნიშანი „Below market"
   - **განცხადებების ბმულები** — ერთი ჭკვიანი ველი: აგდებ URL-ს, სისტემა თავად ცნობს პლატფორმას (myhome.ge, ss.ge, myauto.ge, Airbnb, Booking) და აჩენს მის ლოგოს
   - **ციფრული კარის კოდი (Door Key)** — გენერირდება და იგზავნება WhatsApp-ით დამქირავებელთან
   - **ხელშეკრულებები** — თარიღები, ქირა, დამქირავებელი, ტელეფონი
   - **დაკავებულობის კალენდარი** — თითო აქტივზე; თითებით „გადაატარებ" დღეებზე და მონიშნავ პერიოდს, შემდეგ ინახება ხელშეკრულებად
2. **Vehicles** — მანქანა, მოტოციკლი, სატვირთო
3. **Digital Assets** — სამი ქვე-ცხრილი, ცოცხალი ფასებით:
   - **კრიპტო** (CoinGecko)
   - **აქციები** (Finnhub → Stooq სარეზერვოდ)
   - **ძვირფასი ლითონები** — ოქრო, ვერცხლი, პლატინა, პალადიუმი
   - თითოეულზე: რაოდენობა, საშუალო შესყიდვის ფასი (ავტომატურად ითვლება ყიდვა/გაყიდვის ისტორიიდან), მიმდინარე ფასი, ღირებულება, მოგება/ზარალი (₾ და %)
   - Buy / Sell ღილაკები
4. **Income Sources** — ხელფასი, დივიდენდი და სხვა მუდმივი შემოსავალი

### 3.4 Rentals (დღიური გაქირავება — sub-nav: Units / Calendar / Pricing / Analytics)
- **Units** — ერთეულების სია: ბაზისური ტარიფი, ჯავშნები, iCal ფიდები
- **Calendar** — ერთი დიდი ბადე: სტრიქონი = ერთეული, სვეტი = თვის დღე.
  ფერები ჯავშნის წყაროს მიხედვით: Airbnb (ვარდისფერი), Booking (ცისფერი),
  პირდაპირი (მწვანე), იჯარა (იისფერი), გადაფარვა (წითელი), თავისუფალი (ნაცრისფერი).
  ქვემოთ — „Vacancy Gaps" (თავისუფალი ფანჯრები)
- **Pricing** — ფასის რეკომენდაციები
- **Analytics** — Occupancy, ADR, RevPAR თვეების და ერთეულების ჭრილში
- **iCal სინქრონი** — Airbnb-ისა და Booking.com-ის კალენდრები ავტომატურად შემოდის

### 3.5 Alerts (შეტყობინებები)
ავტომატურად ჩნდება 4 ტიპი, თითოეულს აქვს „რეკომენდებული ქმედება":
- `vacancy_gap` — თავისუფალი ფანჯარა კალენდარში
- `lease_expiry` / `contract_expiry` — ხელშეკრულება იწურება
- `underpriced` — ფასი ბაზარზე დაბალია

### 3.6 Investment Calculator (საინვესტიციო კალკულატორი) — უფასო, ანგარიშის გარეშე
- ორი ჩანართი: **უძრავი ქონება** და **ავტომობილი**
- ითვლის: წლიურ სარგებელს (yield), ამოგების ვადას (payback)
- **PRO Analysis** — 5-წლიანი სრული ანალიზი („ღირს თუ არა?"), ფასიან პაკეტში

### 3.7 Settings (პარამეტრები)
- **Account** — კომპანიის/მფლობელის სახელი, ელფოსტა, მიმდინარე პაკეტი
- **Team** (ბიზნეს-ანგარიშებისთვის) — წევრები, მოწვევები, ლიმიტები
- **Interface** — ენა (KA/EN), თემა (ღია/მუქი)

### 3.8 Upgrade Plan (`/billing`)
- ლიმიტების მრიცხველები: Assets 14/50, Units 12/30, Members
- საცდელი პერიოდის ინდიკატორი
- პაკეტების ბარათები Subscribe ღილაკებით

### 3.9 About Us / Contact / Privacy
- **About** — მისია, რას აკეთებს, საქართველოსთვის, ვისთვისაა
- **Contact** — ელფოსტა და WhatsApp
- **Privacy** — 5 სექცია მონაცემთა დაცვაზე

### 3.10 საფორთ ბოტი (ყველა გვერდზე)
- მოლივლივე მრგვალი ღილაკი ქვედა-მარჯვენა კუთხეში, ოპერატორის (ყურსასმენის) აიქონით
- პასუხობს ხშირ კითხვებს თავისით (ფასი, სინქრონი, გადახდა, უსაფრთხოება)
- საჭიროებისას გადაამისამართებს ოპერატორთან WhatsApp-ით

## 4. ტარიფები

| პაკეტი | ფასი | აქტივები | ერთეულები | წევრები | PRO ანალიზი |
|---|---|---|---|---|---|
| Starter | 15₾/თვე | 5 | 3 | 1 | არა |
| Standard | 29₾/თვე | 20 | 10 | 1 | კი |
| Pro | 49₾/თვე | 50 | 30 | 1 | კი |
| Business S | 99₾/თვე | 100 | 60 | 5 | კი |
| Business M | 199₾/თვე | 300 | 200 | 15 | კი |

- პირველი **30 დღე უფასოა**, სრული წვდომით
- გადახდა: **Flitt** (ბარათი, Apple Pay, Google Pay)

## 5. ნავიგაციის სტრუქტურა

**ზედა ზოლი:**
- მარცხნივ: მხოლოდ **Activo ლოგო**
- მარჯვნივ ყველაფერი: `Dashboard · Rentals · Assets · Investment Calculator · Alerts · About Us · Contact` შემდეგ `☀ თემა` · `EN/KA` · `ექაუნთის ღილაკი ▾`
- **გამოსული** მომხმარებლისთვის Dashboard არ ჩანს; ჩანს `Sign In`
- **ექაუნთის მენიუ** (Claude-ის სტილში): ავატარი + „Username · Plan" ლათინურად,
  ჩამოშლისას: Settings · Upgrade Plan · Sign Out
- **მობაილზე:** ყველა ბმული ერთ ჩამოსაშლელ მენიუში (მარჯვენა ზედა კუთხე)

**ფუთერი:** ლოგო + Privacy & Confidentiality

## 6. მიმდინარე დიზაინ-სისტემა (ბაზისი, რომლის დახვეწაც გვინდა)

**ფერები (ღია თემა):**
- Primary: `#4f46e5` (იისფერ-ლურჯი) · hover `#4338ca`
- ფონი: `#fafafb` · ბარათი: `#ffffff` · ზედაპირი: `#f4f5f9`
- ჩარჩო: `#e8eaf1` · ტექსტი: `#191c28` · მკრთალი ტექსტი: `#666d81`

**ფერები (მუქი თემა):**
- Primary: `#8f97ff` · ფონი: `#0e1015` · ბარათი: `#151822` · ზედაპირი: `#1c2030`
- ჩარჩო: `#262b3b` · ტექსტი: `#eceef5` · მკრთალი: `#969db2`

**სტატუსების ფერები:** გაქირავებული (მწვანე), თავისუფალი (ყვითელი),
დღიური (ცისფერი), განთავსებული (იისფერი), პირადი (ნაცრისფერი), საფრთხე (წითელი)

**ფორმა და ტიპოგრაფია:**
- რადიუსები: 6 / 10 / 16px · რბილი ჩრდილი ბარათებზე
- შრიფტი: Noto Sans Georgian + Geist Sans (ქართული და ლათინური ერთად კარგად უნდა გამოიყურებოდეს)
- ბაზისური ტექსტი 14px, სათაური 25px
- კონტენტის მაქს. სიგანე 1080px

## 7. რა გვინდა დიზაინერისგან (AI-სგან)

1. **სრული ვიზუალური სისტემა** — ფერები, ტიპოგრაფია, დაშორებები, ბარათები, ღილაკები, ფორმები, ცხრილები, badge-ები
2. **ძირითადი ეკრანების მაკეტები:** Landing, Dashboard, Assets (სია + ბარათი), Asset-ის დეტალები კალენდრით, Rentals Calendar, Investment Calculator, Settings, Upgrade Plan
3. **მობაილის ვერსია აუცილებელია** — ჩვენი მომხმარებლების უმეტესობა ტელეფონიდან შემოდის
4. **ღია და მუქი თემა ორივე**
5. **მონაცემებით მკვრივი ეკრანების გადაწყვეტა** — ცხრილები, კალენდრები, KPI-ები ისე, რომ არ იყოს გადატვირთული
6. **სიმეტრია და მოწესრიგებულობა კრიტიკულია** — განსაკუთრებით მობაილზე, სადაც ცხრილები ბარათებად იქცევა

## 8. შეზღუდვები

- ქართული და ინგლისური ტექსტი სიგრძით განსხვავდება — ლეიაუტი ორივეს უნდა უძლებდეს
- ქართულ ასოებს არ აქვს დიდი/პატარა — `text-transform: uppercase` არ მუშაობს
- ემოჯი აიქონები **არ გვინდა** — მხოლოდ პროფესიონალური ხაზოვანი (stroke) SVG
- ტექნოლოგია: Next.js (App Router) + CSS ცვლადები; დიზაინი ამაზე უნდა გადმოვიდეს

---
---

# PART 2 — English version (paste this to the design AI)

## Brief: design system + UI for **Activo**

### What it is

**Activo** is a Georgian SaaS platform for property and asset management, live at
**activo.world**. It brings everything a person or company owns into one dashboard:
real estate, vehicles, rentals, income streams and digital investments.

- **Languages:** Georgian + English (Russian planned)
- **Currency:** GEL (₾); digital assets priced in USD, converted to GEL
- **Market:** Georgia first, then worldwide
- **Platform:** Web app, mobile-first (most users are on phones)

**Positioning:** calm, trustworthy, professional. Not a loud startup look.
A user should see at a glance: what they own, what it earns, what needs attention.

### Who uses it

Account type: `personal` (single user) or `business` (team with seats).
Workspace profile, which shapes the dashboard and nav:
- `personal` — private owner (a few apartments, a car, investments)
- `hotel` — short-term rental host / aparthotel (Airbnb, Booking.com)
- `brokerage` — real-estate agency
- `car_rental` — vehicle rental business

### Screens & features

**1. Landing (signed out)**
- Splash screen on every visit: logo only, tap to enter
- Headline "All Your Property — One Dashboard", two CTAs
  (Create Free Account / Try the Free Calculator)
- Demo-account block with credentials
- Four colourful feature cards with line-style SVG icons:
  Everything in One Place · Automatic Booking Sync ·
  Georgia first, then everywhere · Invest with Numbers
- Price line: first month free, then from 15₾/month

**2. Dashboard (signed in)**
- Greeting "Hello, {name}" + profile subtitle
- KPI cards, varying by profile:
  hotels → Occupancy %, ADR, RevPAR, revenue, "occupied now (X / Y)";
  private/agency → asset count, portfolio value, monthly income
- Tables: current bookings, contracts expiring soon
- Quick-action chips

**3. Assets — the core screen**
One "New Asset" button; category is chosen first, then the relevant fields appear.
Segments with a dropdown filter:
- **Real Estate** — apartment, house, commercial, land, garage.
  Fields: name, district, address, area (m²), estimated value.
  Status: rented / vacant / personal use / listed.
  Rental mode: long-term or daily (daily has a base rate plus weekend and
  holiday premiums in %).
  **Market-rent estimate** from district + area; a "Below market" badge appears
  when actual rent is >15% under the benchmark.
  **Smart listing links:** paste any URL and the platform is auto-detected
  (myhome.ge, ss.ge, myauto.ge, Airbnb, Booking) and shown with its logo.
  **Digital door key:** generated code, shared with the tenant over WhatsApp.
  **Contracts:** dates, rent, tenant name and phone.
  **Occupancy calendar per asset:** drag across days to select a range, then
  save it as a contract.
- **Vehicles** — car, motorcycle, truck
- **Digital Assets** — three sub-tables with live prices:
  crypto (CoinGecko), stocks (Finnhub, Stooq fallback), precious metals
  (gold, silver, platinum, palladium). Each row: quantity, auto-computed
  average buy price from the trade history, current price, value,
  profit/loss in ₾ and %. Buy / Sell actions.
- **Income Sources** — salary, dividends, other recurring income

**4. Rentals** (sub-nav: Units / Calendar / Pricing / Analytics)
- Units list: base rate, booking count, iCal feeds
- **Calendar:** one dense grid — row = unit, column = day of month.
  Cell colour by booking source: Airbnb pink, Booking blue, direct green,
  lease purple, overlap red, vacant grey. "Vacancy Gaps" listed below.
- Pricing suggestions; Analytics with occupancy, ADR, RevPAR by month and unit
- Automatic iCal sync from Airbnb and Booking.com

**5. Alerts** — auto-generated, each with a suggested action:
vacancy gap · lease expiring · contract expiring · underpriced

**6. Investment Calculator** — free, no account needed.
Two tabs (real estate / vehicle), computes annual yield and payback period.
A **PRO Analysis** ("Is it worth it?", 5-year underwriting) sits behind a paid plan.

**7. Settings** — Account (name, email, current plan), Team (members and
invites, business accounts), Interface (language, theme)

**8. Upgrade Plan** — usage meters (assets / units / members against the plan
limits), trial indicator, plan cards with Subscribe buttons

**9. About Us / Contact / Privacy** — simple content pages

**10. Support bot** — floating round button, bottom-right, headset (operator)
icon. Answers common questions itself, hands off to a human on WhatsApp.

### Pricing

| Plan | Price | Assets | Units | Seats | PRO analysis |
|---|---|---|---|---|---|
| Starter | 15₾/mo | 5 | 3 | 1 | no |
| Standard | 29₾/mo | 20 | 10 | 1 | yes |
| Pro | 49₾/mo | 50 | 30 | 1 | yes |
| Business S | 99₾/mo | 100 | 60 | 5 | yes |
| Business M | 199₾/mo | 300 | 200 | 15 | yes |

30-day full-access free trial. Payments via Flitt (card, Apple Pay, Google Pay).

### Navigation

- Top bar: **logo alone on the left**; everything else on the right —
  `Dashboard · Rentals · Assets · Investment Calculator · Alerts · About Us · Contact`,
  then theme toggle, language toggle (EN/KA) and the account button.
- Signed out: no Dashboard link; a `Sign In` button instead.
- Account menu (Claude-style): avatar + "Username · Plan" always in Latin;
  dropdown with Settings · Upgrade Plan · Sign Out.
- Mobile: every link collapses into one top-right dropdown menu.
- Footer: logo + "Privacy & Confidentiality".

### Current design tokens (the baseline to refine)

Light theme — primary `#4f46e5` (hover `#4338ca`), page `#fafafb`,
card `#ffffff`, surface `#f4f5f9`, border `#e8eaf1`, text `#191c28`,
muted text `#666d81`.

Dark theme — primary `#8f97ff`, page `#0e1015`, card `#151822`,
surface `#1c2030`, border `#262b3b`, text `#eceef5`, muted `#969db2`.

Status colours: rented green, vacant amber, short-term-rental blue,
listed purple, personal grey, danger red.

Shape and type: radii 6 / 10 / 16px, soft card shadow,
Noto Sans Georgian + Geist Sans, base text 14px, h1 25px,
content max-width 1080px.

### What I want from you

1. A **complete visual system**: colour, typography, spacing scale, cards,
   buttons, form fields, tables, badges, empty states.
2. **Mockups of the key screens:** Landing, Dashboard, Assets (list + single
   card), Asset detail with its calendar, Rentals calendar, Investment
   Calculator, Settings, Upgrade Plan.
3. **Mobile layouts are essential** — most users arrive on a phone.
4. **Both light and dark themes.**
5. A convincing answer for **data-dense screens** — tables, month-grid
   calendars and KPI rows that stay readable and uncluttered.
6. **Symmetry and alignment matter a great deal**, especially on mobile where
   tables collapse into cards.

### Constraints

- Georgian and English strings differ a lot in length — the layout must absorb both.
- Georgian script has no upper/lower case: `text-transform: uppercase` does nothing.
- **No emoji icons** — professional stroke-style SVG icons only.
- Built with Next.js (App Router) and CSS custom properties, so the design
  needs to translate into those.
