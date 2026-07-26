# Activo — კონცეფცია, აშენებული ფუნქციონალი და საბოლოო ხედვა

> ეს დოკუმენტი პასუხია სტრატეგიულ მიმოხილვაზე, რომელმაც პროდუქტის ბირთვი
> ვერ დაინახა. ორ ენაზეა: ქართული (შენთვის) და English (გასაგზავნად).
>
> **პრინციპი:** ყველგან მკაფიოდ არის გამიჯნული **[აშენებულია]** და
> **[დაგეგმილია]**. გაზვიადება არ არის — დოკუმენტი კრიტიკოსს ეგზავნება.

---

# ნაწილი 1 — ქართული ვერსია

## 1. ცენტრალური თეზისი

არსებული პროგრამები ქონებას **ოპერაციულად** უყურებენ: ჯავშანი, კალენდარი,
დამლაგებელი, ანგარიშფაქტურა. ან **პასიურად**: „აი შენი წმინდა ღირებულება".

Activo სხვა კითხვაზე პასუხობს — იმაზე, რომელსაც დღეს **არავინ პასუხობს ზუსტად**:

> **რა მაქვს, რა ღირს, რამდენს მაძლევს და რამდენად სტაბილურად?**

ეს ოთხი კითხვა ერთმანეთისგან განუყოფელია, მაგრამ ბაზარზე ოთხ სხვადასხვა
ინსტრუმენტშია გაფანტული. ადამიანს, რომელსაც აქვს ორი ბინა (ერთი დღიურად,
ერთი გრძელვადიანად), ტაქსზე გაშვებული მანქანა და ცოტა კრიპტო, **დღეს არ აქვს
არცერთი ადგილი, სადაც ეს ერთად ჩანს.** ის Excel-ში წერს. ან არსად არ წერს.

**მთავარი ინოვაცია არაა კალენდარი და არაა კრიპტოს ფასი.** მთავარია, რომ
ყველა აქტივი და ყველა შემოსავალი **ერთ მოდელშია** — და ამიტომ შესაძლებელი
ხდება კითხვები, რომლებიც ცალკეულ ინსტრუმენტს არ შეუძლია:

- ჩემი ქონების **რეალური** ღირებულება დღეს რამდენია?
- ჩემი შემოსავალი **სტაბილურია** თუ სეზონურია?
- რომელი აქტივი მაძლევს ყველაზე ცოტას იმ ფულთან შედარებით, რაც მასშია ჩადებული?
- თუ ბინას გავყიდი და ორ მანქანას ვიყიდი ტაქსისთვის — მოვიგებ თუ წავაგებ?

## 2. რატომ საქართველო — ოთხი რეალური ქცევა

მიმოხილვამ ბაზარი „Airbnb-ის მასპინძლებამდე" დაიყვანა. ეს არასწორია.
საქართველოში ერთი და იგივე ადამიანი **ერთდროულად** აკეთებს რამდენიმეს:

**1. დღიური გაქირავება — მათ შორის მცირე, 20 კვ.მ ფართების**
ეს არაა მხოლოდ ბათუმის აპარტ-ჰოტელები. ეს ჩვეულებრივი ადამიანია, რომელსაც
ერთი პატარა სტუდიო აქვს და დღიურად აქირავებს. მისთვის Hostaway-ის
$125/თვე აზრი არ აქვს — მაგრამ ორმაგი ჯავშანი ისეთივე ტკივილია.

**2. გრძელვადიანი გაქირავება**
5% ფიქსირებული გადასახადი, წელიწადში ერთხელ დეკლარაცია, 1%-იან რეჟიმში
**არ ჯდება**. ეს ცოდნა თითქმის არავის აქვს სისტემურად.

**3. ფლიპი — ყიდვა, რემონტი, გაყიდვა**
ძალიან გავრცელებული. აქ სულ სხვა კითხვებია: რამდენი ჩავდე ჯამში? რამდენ
ხანს მეჭირა? წლიურ გამოსახულებაში რამდენი გამოვიდა? დღეს ეს Excel-შია
ან თავში.

**4. ტაქსი და მანქანის გაქირავება**
ტაქსზე შემოსავალი საშუალო ხელფასზე მაღალია — ამიტომ ტრენდია. ადამიანები
მანქანას **ინვესტიციად** ყიდულობენ. მაგრამ არავინ ითვლის ზუსტად: ამორტიზაცია,
დაზღვევა, სერვისი, უქმე დღეები. „კარგად გამომდის" — ეს არაა ციფრი.

**გასაღები:** ეს ოთხი ერთი და იმავე ადამიანის ქცევაა, არა ოთხი სეგმენტი.
სწორედ ამიტომ **ვერ** გაიყოფა პროდუქტი „ოპერატორად" და „მესაკუთრედ".
საქართველოში ეს ერთი ადამიანია.

## 3. რა არის უკვე აშენებული

### 3.1 აქტივების ერთიანი მოდელი **[აშენებულია]**
ერთი `Asset` ცხრილი, რომელიც მოიცავს:
- **უძრავი ქონება** — ბინა, სახლი, კომერციული ფართი, მიწა, ავტოფარეხი
- **ტრანსპორტი** — მანქანა, მოტოციკლი, სატვირთო
- **შემოსავლის წყარო** — ხელფასი, დივიდენდი, სხვა მუდმივი
- **ციფრული აქტივები** — კრიპტო, აქციები, ძვირფასი ლითონები

თითოეულს აქვს: სტატუსი (გაქირავებული / თავისუფალი / პირადი / განთავსებული),
შეფასებული ღირებულება, ვალუტა, უბანი, მისამართი, ფართობი.

**ეს არის ის ბირთვი, რომელსაც მიმოხილვა „ორ სხვადასხვა პროდუქტს" უწოდებს.
სინამდვილეში ეს ერთი ცხრილია, ერთი ფორმით, ერთი სიით.**

### 3.2 გაქირავების ორივე რეჟიმი ერთსა და იმავე აქტივზე **[აშენებულია]**
- **გრძელვადიანი** — `RentalContract`: თარიღები, ქირა, დამქირავებელი, ტელეფონი
- **დღიური** — ბაზისური ტარიფი + უიქენდის და დღესასწაულის დანამატი (%)
- **დაკავებულობის კალენდარი თითო აქტივზე** — თითით გადაატარებ დღეებზე,
  მონიშნავ პერიოდს და პირდაპირ ხელშეკრულებად ინახავს

### 3.3 არხების სინქრონიზაცია **[აშენებულია]**
- iCal ფიდები Airbnb-იდან და Booking.com-იდან
- დუბლიკატების ამოცნობა `(unitId, source, externalId)`-ით
- „დაბლოკილი" დღეების გაფილტვრა — ისინი ჯავშნად და შემოსავლად არ ითვლება
- გადაფარვების (double booking) ამოცნობა
- **[დაგეგმილია]** ორმხრივი API-ინტეგრაცია (Channex) — ფასების და
  ხელმისაწვდომობის **გაგზავნა** არხებში; დღეს მხოლოდ შემოტანაა

### 3.4 ანალიტიკა — ინდუსტრიული სტანდარტით **[აშენებულია]**
წმინდა, ტესტირებული მოდული:
- **Occupancy** — გადაფარული პერიოდები გაერთიანებულია, ამიტომ ორმაგად
  დაჯავშნილი ღამე ერთხელ ითვლება და 100%-ს არ სცდება
- **ADR** — შემოსავალი / გაყიდული ღამეები
- **RevPAR** — შემოსავალი / ხელმისაწვდომი ღამეები
- შემოსავალი ღამეების მიხედვით ნაწილდება, როცა ჯავშანი თვის საზღვარს კვეთს

### 3.5 საინვესტიციო კალკულატორი **[აშენებულია]**
**უძრავი ქონება:** ფასი, რემონტის ბიუჯეტი, მოსალოდნელი ქირა, უქმე პერიოდი %,
საშემოსავლო %, იპოთეკა (პირველადი შენატანი %, განაკვეთი, ვადა), **და
ალტერნატივა — ბანკის დეპოზიტი**.

გამოაქვს: მთლიანი ინვესტიცია, საკუთარი ფული, ყოველთვიური შენატანი,
სესხის სრული ღირებულება, წმინდა თვიური შემოსავალი, **ფულადი ნაკადი**,
მთლიანი და წმინდა სარგებელი %, ამოგების ვადა, **ფულის ამოგების ვადა**,
რამდენს მოგცემდა იგივე ფული დეპოზიტზე, და ვერდიქტი (კარგი / საშუალო / ცუდი).

**ავტომობილი:** 11 პოპულარული მოდელის საორიენტაციო ფასი და დღიური ტარიფი
(Prius 32,000₾ / 90₾; Camry 58,000₾ / 160₾; Prado 145,000₾ / 320₾…),
თვეში გაქირავებული დღეები (ნაგულისხმევი 18), ხარჯები შემოსავლის %-ად
(ნაგულისხმევი 30% — დაზღვევა, სერვისი, რეცხვა, ამორტიზაცია).

**PRO ანალიზი:** 5-წლიანი სრული პროექცია — სესხის ამორტიზაცია, ქირის ზრდა,
უქმე პერიოდი, დაზღვევა, შენახვა, მართვა, კომუნალური, ბროკერის %, ამხანაგობა,
ქონების გადასახადი, points, ცვეთა, საშემოსავლო.

### 3.6 პროაქტიული შეტყობინებები **[აშენებულია]**
ავტომატურად ჩნდება, თითოეულს აქვს რეკომენდებული ქმედება:
- **თავისუფალი ფანჯარა** კალენდარში
- **ხელშეკრულება/იჯარა იწურება**
- **ფასი ბაზარზე დაბალია**

### 3.7 საქართველოზე მორგებული წვრილმანები **[აშენებულია]**
- **ჭკვიანი განცხადების ბმული** — აგდებ URL-ს, სისტემა თავად ცნობს
  პლატფორმას (myhome.ge, ss.ge, myauto.ge, Airbnb, Booking) და ლოგოს აჩენს
- **ციფრული კარის კოდი** — გენერირდება და WhatsApp-ით ეგზავნება დამქირავებელს
- ლარი ძირითად ვალუტად; დოლარის აქტივები **NBG-ის კურსით** ლარად
- ქართული და ინგლისური სრულად; ღია და მუქი თემა

### 3.8 ციფრული აქტივები ცოცხალი ფასებით **[აშენებულია]**
კრიპტო (CoinGecko), აქციები (Finnhub → Stooq სარეზერვოდ), ლითონები.
საშუალო შესყიდვის ფასი **ავტომატურად ითვლება** ყიდვა/გაყიდვის ისტორიიდან;
ჩანს მიმდინარე ღირებულება და მოგება/ზარალი ₾-ში და %-ში.

### 3.9 ინფრასტრუქტურა **[აშენებულია]**
რეგისტრაცია/ავტორიზაცია დაჰეშილი პაროლებით და ცალმხრივად დაჰეშილი სესიებით;
5 სატარიფო პაკეტი 30-დღიანი უფასო პერიოდით; Flitt-ის გადახდა (ბარათი,
Apple Pay, Google Pay) გადამოწმებული სერვერული callback-ით; მხარდაჭერის ბოტი.

## 4. რას მისცემს მომხმარებელს 100%-ზე

### კითხვა 1: „რა ღირს ჩემი ქონება?"
დღეს პასუხი არავინ იცის, რადგან საჭიროა სამი რამ ერთად:
**(ა)** სრული სია — რა მაქვს (ეს **უკვე არის**),
**(ბ)** თითოეულის მიმდინარე ღირებულება,
**(გ)** დროში ცვლილება.

- ციფრული აქტივები დღესვე **რეალურ ფასშია** — ეს არაა შეფასება, ეს ფაქტია
- უძრავი ქონება და მანქანები დღეს **ხელით შეყვანილი შეფასებაა**
  **[დაგეგმილია]** უბნისა და ფართობის მიხედვით ავტომატური შეფასება
- **[დაგეგმილია]** ღირებულების ისტორია — გრაფიკი, რომელიც აჩვენებს
  პორტფელი გაიზარდა თუ დაიკლო

### კითხვა 2: „რამდენად სტაბილურია ჩემი შემოსავალი?"
ეს ყველაზე ღირებული კითხვაა და **ყველაზე ახლოსაა განხორციელებასთან**,
რადგან მონაცემები უკვე გროვდება: ჯავშნები, ხელშეკრულებები, შემოსავლის
ჩანაწერები, მუდმივი წყაროები.

**[დაგეგმილია]** ამ მონაცემებზე აშენებული:
- **სეზონურობის პროფილი** — რომელ თვეებში იკლებს შემოსავალი და რამდენით
- **სტაბილურობის მაჩვენებელი** — რა წილი მოდის გარანტირებულ (გრძელვადიანი
  ხელშეკრულება, ხელფასი) და რა წილი ცვალებად (დღიური, ტაქსი) შემოსავალზე
- **კონცენტრაციის რისკი** — თუ შემოსავლის 60% ერთ ბინაზე მოდის, ეს რისკია
- **წინსწრებით გაფრთხილება** — „მომდევნო 60 დღეში ორი ხელშეკრულება იწურება
  და ივნისი ისტორიულად სუსტი თვეა"

### კითხვა 3: „რომელი აქტივი მუშაობს და რომელი არა?"
სწორედ აქ ჩნდება ერთიანი მოდელის ღირებულება: **შედარება ერთ საზომში.**
ბინა, მანქანა, დეპოზიტი და აქცია ერთ ცხრილში, ერთი მაჩვენებლით —
**რამდენ % აძლევს ჩადებულ ფულს.**

**[დაგეგმილია]** ეს რეიტინგი. მონაცემები უკვე მოდელშია, ლოგიკა კალკულატორში —
დარჩენილია ფაქტობრივ მონაცემებზე მიმართვა (დღეს კალკულატორი ვარაუდებზე მუშაობს).

### კითხვა 4: „ეს ნაბიჯი მომგებიანია?"
- **ბინის ყიდვა გასაქირავებლად** — **[აშენებულია]** სრულად
- **მანქანის ყიდვა ტაქსისთვის/გასაქირავებლად** — **[აშენებულია]** სრულად
- **ფლიპი** — **[ნაწილობრივ]**: კალკულატორს რემონტის ბიუჯეტი აქვს, მაგრამ
  `Asset`-ს **არ აქვს შესყიდვის ფასი, გაყიდვის ფასი და ფლობის პერიოდი**.
  **[დაგეგმილია]** ფლიპის სრული ციკლის თვალყური

## 5. რატომ არის „ორი კატეგორიის" არგუმენტი მცდარი ამ ბაზარზე

მიმოხილვის მთავარი კონცეპტუალური არგუმენტი: net-worth ტრეკინგი პასიურია,
არხების მართვა — ტრანზაქციული; სხვადასხვა ადამიანი, სხვადასხვა რეჟიმი.

**ეს განვითარებულ ბაზრებზე მართალია. საქართველოში — არა.**

აშშ-ში ბინის მფლობელი მართვას კომპანიას აბარებს და თვეში ერთხელ იხედება.
საქართველოში იგივე ადამიანი **თვითონ ხვდება სტუმარს, თვითონ აგზავნის კოდს,
თვითონ აქირავებს მანქანას და თვითონვე უყურებს რამდენი დარჩა.** ის ერთდროულად
ოპერატორიცაა და მესაკუთრეც.

სწორედ ამიტომ არ არსებობს ასეთი პროდუქტი მსოფლიოში: **განვითარებულ ბაზრებზე
ეს ორი როლი მართლაც გაყოფილია.** აქ არაა. ეს არაა კატეგორიული შეცდომა —
ეს არის სხვა ბაზრის სხვა რეალობა.

## 6. რა არის ჯერ გასაკეთებელი (პატიოსანი სია)

რომ დოკუმენტი სანდო იყოს, ესეც უნდა ეწეროს:

1. **განმეორებადი გადახდა** — დღეს ერთი გადახდა ერთ თვეს ხსნის, ავტომატური
   განახლება არაა და ვადის გასვლა არ სრულდება. **ეს ყველაზე გადაუდებელია.**
2. **გუნდური წვდომა** — ბიზნეს-პაკეტი ადგილებს ყიდის, მაგრამ წევრები
   ერთმანეთის მონაცემებს ვერ ხედავენ. საერთო სივრცე ჯერ არაა.
3. **საბაზრო მონაცემები მოგონილია** — უბნების ₾/მ² ხელით ჩაწერილი რიცხვებია.
   არქიტექტურა ჩანაცვლებისთვის მზადაა, მაგრამ რეალური მონაცემი დღეს არაა.
4. **iCal ცალმხრივია** და ჩავარდნილ ფიდზე მომხმარებელს შეტყობინება არ მიდის.
5. **სტაბილურობის/სეზონურობის ანალიზი** — მონაცემები გროვდება, ანალიზი ჯერ არაა.
6. **ავტომატური შეფასება** უძრავი ქონებისა და მანქანებისთვის.
7. **ფლიპის ციკლი** — შესყიდვის/გაყიდვის ფასი და ფლობის პერიოდი.

---
---

# PART 2 — English version

## What the strategy review missed

The review split Activo into "positioned for the owner, built for the
operator" and concluded the two halves belong to different people. **In
Georgia they are the same person**, and that is the entire thesis.

> **Marked throughout: [BUILT] vs [PLANNED]. Nothing is overstated —
> this document is going to a critic.**

## 1. The core thesis

Existing software looks at property either **operationally** (bookings,
calendars, invoices) or **passively** ("here is your net worth"). Activo
answers a different question — one nobody answers precisely today:

> **What do I own, what is it worth, what does it pay me, and how reliably?**

Those four are inseparable, yet the market scatters them across four tools.
Someone with two flats (one daily, one long-term), a car running as a taxi
and some crypto has **nowhere today** where this appears together. They use
Excel, or nothing.

**The innovation is not the calendar and not the crypto ticker.** It is that
every asset and every income stream sit in **one model**, which makes
possible questions no single-purpose tool can answer:

- What is my property **actually** worth today?
- Is my income **stable** or seasonal?
- Which asset returns least on the money tied up in it?
- If I sell a flat and buy two cars for taxi work, am I better or worse off?

## 2. Why Georgia — four real behaviours

The review reduced the market to "Airbnb hosts". That is wrong. In Georgia
the same person routinely does several of these **at once**:

1. **Daily rental, including tiny 20 m² studios.** Not just Batumi
   aparthotels — an ordinary person with one small studio. Hostaway at
   $125/month makes no sense for them, but a double booking hurts just as much.
2. **Long-term rental.** 5% flat tax, declared separately by April 1st,
   **cannot** sit inside the 1% small-business regime. Almost nobody tracks
   this systematically.
3. **Flipping** — buy a fixer-upper, renovate, sell. Very common. Entirely
   different questions: total in, how long held, what the annualised return was.
4. **Taxi and car rental.** Taxi income exceeds the average salary here, so
   it is a trend; people buy cars as **investments**. Almost nobody computes
   depreciation, insurance, servicing and idle days honestly.

**The key point: these are four behaviours of one person, not four segments.**
That is exactly why the product cannot be split into "operator" and "owner".

## 3. What is already built

- **One unified asset model [BUILT]** — real estate (apartment, house,
  commercial, land, garage), vehicles (car, motorcycle, truck), income
  sources (salary, dividend), digital assets (crypto, stocks, metals). Each
  with status, estimated value, currency, district, address, area. *This is
  the core the review called "two different products". It is one table.*
- **Both rental modes on the same asset [BUILT]** — long-term contracts
  (dates, rent, tenant, phone) and daily rates with weekend/holiday premiums,
  plus a per-asset occupancy calendar where you drag across days and save the
  range straight to a contract.
- **Channel sync [BUILT]** — iCal from Airbnb and Booking.com, deduped on
  (unit, source, external id), with availability blocks filtered out so they
  never count as revenue, and overlap (double-booking) detection.
  **[PLANNED]** two-way API integration to *push* rates and availability.
- **Industry-standard analytics [BUILT]** — occupancy with overlapping stays
  merged (so a double-booked night counts once and occupancy caps at 100%),
  ADR, RevPAR, revenue prorated per night across window edges. Pure,
  unit-tested module.
- **Investment calculator [BUILT]** — *Real estate:* price, renovation,
  expected rent, vacancy %, income tax, mortgage (down payment, rate, term)
  **and the bank-deposit alternative for the same cash**. Returns total
  investment, own cash, monthly payment, total loan cost, net monthly income,
  cash flow, gross and net yield, payback, cash payback, what a deposit would
  pay, and a verdict. *Vehicles:* 11 popular models with reference prices and
  daily rates (Prius ₾32,000 / ₾90; Camry ₾58,000 / ₾160; Prado ₾145,000 /
  ₾320…), rented days per month, running costs as % of income.
  *PRO analysis:* full 5-year projection — amortization, rent growth,
  vacancy, insurance, maintenance, management, utilities, broker fees, HOA,
  property tax, points, depreciation, income tax.
- **Proactive alerts [BUILT]** — vacancy gaps, expiring contracts and leases,
  underpriced units, each with a suggested action.
- **Georgia-specific details [BUILT]** — paste any listing URL and the
  platform is auto-detected (myhome.ge, ss.ge, myauto.ge, Airbnb, Booking);
  digital door codes shared over WhatsApp; GEL as the base currency with
  USD assets converted at the **National Bank rate**; full Georgian and
  English; light and dark themes.
- **Live-priced digital assets [BUILT]** — crypto (CoinGecko), stocks
  (Finnhub with Stooq fallback), metals. Average buy price derived
  automatically from trade history; value and P/L shown in ₾ and %.
- **Infrastructure [BUILT]** — hashed passwords and one-way-hashed sessions,
  five plans with a 30-day trial, Flitt payments (card, Apple Pay, Google Pay)
  activated only by a signature-verified server callback, support bot.

## 4. What it gives the user at 100%

**"What is my property worth?"** Needs three things together: the full list
(**built**), a current value for each, and change over time. Digital assets
are already at real market prices. Real estate and vehicles are currently
manual estimates — **[PLANNED]** automatic valuation from district and area,
plus **[PLANNED]** a value history showing whether the portfolio grew or shrank.

**"How stable is my income?"** The most valuable question, and the closest to
reach, because the data already accumulates: bookings, contracts, income
records, recurring sources. **[PLANNED]** on top of it: a seasonality profile
(which months drop and by how much), a stability score (guaranteed income
from long-term contracts and salary vs variable income from daily rental and
taxi), concentration risk (60% of income from one flat is a risk), and
forward warnings ("two contracts expire in the next 60 days and June is
historically weak").

**"Which asset is working?"** This is where the unified model pays off:
**comparison in one measure.** A flat, a car, a deposit and a share in one
table, ranked by return on money tied up. **[PLANNED]** — the data is already
in the model and the maths already in the calculator; what remains is
pointing it at actual rather than assumed figures.

**"Is this move worth it?"** Buying to let — **[BUILT]**. Buying a car for
taxi or rental — **[BUILT]**. Flipping — **[PARTIAL]**: the calculator takes
a renovation budget, but `Asset` has **no purchase price, sale price or
holding period**, so the full flip cycle is **[PLANNED]**.

## 5. Why the "two categories" argument fails in this market

The review's central conceptual claim: net-worth tracking is passive and
periodic, channel management is high-frequency and transactional — different
users, different modes.

**True in developed markets. Not here.**

In the US an owner hands management to a company and looks once a month. In
Georgia the same person **meets the guest, sends the door code, rents out the
car and checks what is left** — operator and owner simultaneously.

That is precisely why no such product exists globally: in developed markets
the two roles genuinely are separate. Here they are not. This is not a
category error — it is a different market with a different reality.

## 6. What is honestly still missing

1. **Recurring billing** — one payment opens one month; there is no automatic
   renewal and expiry is not enforced. **Most urgent.**
2. **Team access** — business plans sell seats, but members cannot see each
   other's data. There is no shared workspace yet.
3. **Market data is mock** — district ₾/m² figures are hand-written. The
   architecture is built for replacement, but no real data exists today.
4. **iCal is one-way**, and a broken feed produces no user-facing alert.
5. **Stability and seasonality analysis** — data accumulates, analysis not built.
6. **Automatic valuation** for real estate and vehicles.
7. **Flip cycle** — purchase price, sale price, holding period.
