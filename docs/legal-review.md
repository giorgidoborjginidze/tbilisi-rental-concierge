# Activo — იურიდიული ტექსტების განხილვა (პროექტი იურისტისთვის)

> **სტატუსი: პროექტი.** `/terms` (მომსახურების პირობები) და `/privacy`
> (კონფიდენციალურობის პოლიტიკა) დაწერილია „პერსონალურ მონაცემთა დაცვის
> შესახებ“ საქართველოს კანონის (2023) და პლატფორმის რეალური მუშაობის
> მიხედვით, მაგრამ **გაშვებამდე იურისტმა უნდა გადახედოს**. თავად გვერდებზე
> „პროექტი“ არ წერია — ეს ჩანიშნულია მხოლოდ აქ და კოდის კომენტარებში
> (`lib/legal/terms.ts`, `lib/legal/privacy.ts`).
>
> დოკუმენტი ორ ნაწილადაა: ქართული (მფლობელისა და იურისტისთვის) და English
> (for a reviewer who reads English).

---

# ნაწილი 1 — ქართული

## 1. სად არის ტექსტი

| რა | სად |
|---|---|
| მომსახურების პირობები (ka + en) | `lib/legal/terms.ts` → გვერდი `/terms` (`/terms?lang=en` — ინგლისური) |
| კონფიდენციალურობის პოლიტიკა (ka + en) | `lib/legal/privacy.ts` → გვერდი `/privacy` |
| ბოლო განახლების თარიღი | `lib/legal/values.ts` → `LEGAL_UPDATED` (ცვლილებისას განაახლე) |
| კონტაქტი და იურიდიული პირი | `lib/contact.ts` |
| ბმულები | ქვედა ზოლი (ყველა გვერდი), რეგისტრაცია, გეგმები და გადახდა |

ტექსტში `{email}`, `{entity}`, `{trial}`, `{grace}`, `{plans}` ავტომატურად
ივსება `lib/contact.ts`-დან და ბილინგის მუდმივებიდან (`TRIAL_DAYS` = 30,
`GRACE_DAYS` = 3; `{plans}` — ყველა გეგმა თავისი თვიური ფასით, `PLANS`-იდან,
`lib/billing/plans.ts`). ასე პირობებში ფასები ჩანს რეგისტრაციამდეც
(`/billing` მხოლოდ შესულ მომხმარებელს უჩანს) და ფასის შეცვლისას ტექსტი თავისით
განახლდება. ტესტი (`lib/legal/legal.test.ts`) ამოწმებს, რომ ქართულსა
და ინგლისურს ერთი და იგივე სექციები, ბმულები და ველები აქვს.

## 2. რა უნდა შეივსოს რეალური მონაცემებით (placeholder-ები)

| ველი | ახლა | რა სჭირდება | ფაილი |
|---|---|---|---|
| იურიდიული პირი (`LEGAL_ENTITY`) | „Activo (activo.world)“ — ბრენდი | რეგისტრირებული კომპანიის სრული სახელი (მაგ. შპს „…“), საიდენტიფიკაციო კოდი, იურიდიული მისამართი | `lib/contact.ts` |
| ელფოსტა (`CONTACT_EMAIL`) | contact@activo.world | რეალურად მოქმედი საფოსტო ყუთი, რომელსაც ვინმე კითხულობს (მონაცემთა სუბიექტის მოთხოვნები აქ მოვა) | `lib/contact.ts` |
| WhatsApp (`CONTACT_WHATSAPP_DISPLAY` / `_DIGITS`) | +995 555 12 34 56 — **პირობითი** | მხარდაჭერის რეალური ნომერი (მხარდაჭერის ჩატის „ადამიანთან საუბარი“ აქ მიდის) | `lib/contact.ts` |
| „/contact“-ის შენიშვნა „ეს მონაცემები ჯერ პირობითია“ | ჩანს გვერდზე | წაშალე `contact_placeholder_note`, როცა ზემოთ მოცემული შეივსება | `app/contact/page.tsx`, `lib/i18n/strings.ts` |
| მონაცემთა დაცვის ოფიცერი | არ არის დასახელებული | გადაწყვიტე, გჭირდება თუ არა (კანონი მას გარკვეულ შემთხვევებში ავალდებულებს) და დაამატე კონტაქტი | `lib/legal/privacy.ts` |

## 3. რას ეყრდნობა ტექსტი (ფაქტები კოდიდან)

- **პაროლი** ინახება მხოლოდ scrypt-ჰეშად; **სესია** — SHA-256 ჰეშად, 30 დღე; გამოსვლისას მაშინვე იშლება, ვადაგასულს ყოველდღიური გაშვება შლის (`lib/auth/prune.ts`).
- **შესვლის მცდელობები და აღდგენის მოთხოვნები** (ელფოსტა + IP) — 24 საათის შემდეგ იშლება ახალი მცდელობისას (`lib/auth/limit.ts`) ან ყოველდღიური გაშვებით — ანუ არაუგვიანეს ~48 საათისა.
- **პაროლის აღდგენის ბმული** — ერთჯერადი, 1 საათი (`RESET_TTL_MS`); გამოყენებულს ან ვადაგასულს ყოველდღიური გაშვება შლის.
- **ყოველდღიური გაშვება** — `/api/cron` (Vercel Cron, `vercel.json`) ან `npm run scheduler`. მუშაობს მხოლოდ მაშინ, როცა `CRON_SECRET` დაყენებულია — მის გარეშე ზემოთ მოცემული წაშლაც არ ხდება.
- **GPS**: ინახება მხოლოდ ბოლო წერტილი (`GpsDevice.lastLat/lastLng/lastSpeed/lastPingAt` — ყოველ სიგნალზე იცვლება) და წითელი ხაზის მოვლენები (`GeoEvent`: მიახლოება / გადაკვეთა / დაბრუნება). მარშრუტის ისტორია არ ინახება. მოვლენები იშლება ხაზთან, აქტივთან ან ანგარიშთან ერთად.
- **WhatsApp**: Meta Cloud API — იგზავნება მიმღების ნომერი და ტექსტი; ერთი საერთო პლატფორმის ნომრიდან (მომხმარებლის საკუთარი ნომერი ჯერ არ არის).
- **AI**: `ANTHROPIC_API_KEY`-ით Anthropic-ს ეგზავნება ერთეულის სახელი, უბანი, ქალაქი და ფასები (ფასის შეთავაზების ახსნა). დამქირავებლის/სტუმრის მონაცემი არ ეგზავნება. გასაღების გარეშე ტექსტი ადგილზე იწერება.
- **გადახდა**: Flitt, თვეში ერთხელ, **ავტომატური განმეორებითი ჩამოჭრის გარეშე**; ბარათის მონაცემები ჩვენთან არ მოდის.
- **ელფოსტა**: Resend — მხოლოდ პაროლის აღდგენა.
- **ჰოსტინგი/ბაზა**: Vercel + Neon Postgres.
- **ქუქიები**: `session`, `locale`, `theme`, `splash_seen`; localStorage — ტური. ანალიტიკა/რეკლამა არ არის.
- **წაშლა**: წაშლილი ხელშეკრულება 30 დღე აღდგენადია (`CONTRACT_UNDO_MS`) და შემდეგაც დამალულად რჩება (soft delete). ანგარიშის თვითწაშლის ღილაკი **არ არსებობს** — წაშლა ხდება მოთხოვნით ელფოსტაზე. ექსპორტის ღილაკი **არ არსებობს** — ასლი იგზავნება მოთხოვნით.

## 4. ღია კითხვები იურისტისთვის

1. **ტონი.** მფლობელს ტექსტი მიმართავს „შენ“-ით (როგორც მთელი აპი — მფლობელის გადაწყვეტილება); დამქირავებლებისა და მძღოლების სექცია — „თქვენ“-ით. მისაღებია თუ არა იურიდიულ ტექსტში?
2. **როლები.** მფლობელი = დამუშავებისთვის პასუხისმგებელი პირი დამქირავებლის/მძღოლის მონაცემებზე, Activo = უფლებამოსილი პირი. საჭიროა თუ არა ცალკე დამუშავების ხელშეკრულება (DPA) მომხმარებელთან, თუ პირობების სექცია „შენი და სხვა ადამიანების მონაცემები“ საკმარისია?
3. **GPS.** სამართლებრივი საფუძველი მძღოლის მდებარეობისთვის: ხელშეკრულება + წინასწარი წერილობითი ინფორმირება — საკმარისია თუ საჭიროა თანხმობა? საჭიროა მძღოლის ხელშეკრულების სანიმუშო პუნქტი (ტრეკერი + WhatsApp შეტყობინებები) — შეგვიძლია დავამატოთ აპში.
4. **პასუხის ვადა** მონაცემთა სუბიექტის მოთხოვნაზე — ტექსტში „არაუგვიანეს 10 სამუშაო დღისა“. გადაამოწმეთ ახალი კანონის მიხედვით (მათ შორის გაგრძელების შესაძლებლობა).
5. **საერთაშორისო გადაცემა** (აშშ/ევროკავშირი: Vercel, Meta, Anthropic, Resend, Neon-ის რეგიონი): რა გარანტიებია საჭირო და რომელი ქვეყნებია „ადეკვატური“ სამსახურის სიის მიხედვით?
6. **შენახვის ვადები.** გადახდის ჩანაწერების ვადა („საგადასახადო კანონმდებლობით დადგენილი ვადა“) — ზუსტი რიცხვი. ანგარიშის წაშლა „30 დღეში“ — მისაღებია? სერვერის ჟურნალის ვადა Vercel-ის პარამეტრებზეა დამოკიდებული.
7. **თანხის დაბრუნება.** „გადახდილი თვე არ ბრუნდება, გარდა კანონით გათვალისწინებული შემთხვევებისა“ — მომხმარებლის უფლებების დაცვის კანონით (დისტანციური ხელშეკრულება, 14-დღიანი უარის უფლება ციფრულ მომსახურებაზე) რა უნდა ეწეროს ზუსტად?
8. **პასუხისმგებლობის ზღვარი** — ბოლო 12 თვის გადახდილი თანხა. დასაშვებია თუ არა ფიზიკურ პირ მომხმარებელთან?
9. **დავა** — თბილისის საქალაქო სასამართლო. საჭიროა თუ არა არბიტრაჟი ბიზნეს-მომხმარებლებისთვის?
10. **ინციდენტის შეტყობინება** — ვადა და ფორმა სამსახურისა და სუბიექტისთვის.
11. **არასრულწლოვნები** — 18 წელი ზღვრად.
12. **ფასის ინფორმაცია ხელშეკრულებამდე.** პირობებში ახლა ყველა გეგმის თვიური ფასი წერია (`{plans}`), ლარში. საკმარისია თუ არა ეს მომხმარებლის უფლებების დაცვის კანონით ხელშეკრულების დადებამდე მისაწოდებელი ინფორმაციისთვის (ფასი გადასახადების ჩათვლით, გადახდის წესი, ხანგრძლივობა, უარის უფლება), თუ საჭიროა ცალკე საჯარო ფასების გვერდი ან დამატებითი ტექსტი გადახდის ღილაკთან?

## 5. პროდუქტში გასაკეთებელი, რაც ტექსტს სრულად ჭეშმარიტს გახდის

- ანგარიშის წაშლის და მონაცემების ექსპორტის თვითმომსახურება (ახლა — მოთხოვნით).
- soft-delete-ით წაშლილი ხელშეკრულებების სრული წაშლა ვადის შემდეგ (ახლა რჩება).
- დამქირავებლის/მძღოლის თანხმობის ჩეკბოქსი ხელშეკრულების ფორმაში და უარის თქმის (opt-out) გზა WhatsApp შეტყობინებებში.
- მძღოლის ხელშეკრულების სანიმუშო GPS პუნქტი.

---

# Part 2 — English

## Status

`/terms` and `/privacy` are **drafts to be reviewed by a lawyer before
launch**. They are written against the Law of Georgia on Personal Data
Protection (2023) and what the code actually does. The pages themselves do
not say "draft"; this document and the code comments in
`lib/legal/terms.ts` and `lib/legal/privacy.ts` do. The Georgian version
prevails (stated in both documents).

## Placeholders that need real values (all in `lib/contact.ts`)

- `LEGAL_ENTITY` — now the brand "Activo (activo.world)"; needs the registered
  company's full name, identification code and legal address.
- `CONTACT_EMAIL` — contact@activo.world; must be a monitored mailbox (data
  subject requests arrive there).
- `CONTACT_WHATSAPP_DISPLAY` / `CONTACT_WHATSAPP_DIGITS` — +995 555 12 34 56 is
  a **placeholder**; the support bot's "talk to a person" uses it.
- Remove the "these details are provisional" note on `/contact`
  (`contact_placeholder_note`) once the above are real.
- Decide whether a data protection officer must be named.

## Facts the texts rely on

Passwords: scrypt hashes; sessions: SHA-256 hashes, 30 days, deleted at
sign-out, and expired ones deleted by the daily run (`lib/auth/prune.ts`);
sign-in attempts and reset requests (email + IP): deleted once 24 h old, on
the next attempt or by the daily run, so at most ~48 h; password-reset links:
single use, 1 hour (`RESET_TTL_MS`), deleted by the daily run once used or
expired. The daily run is `/api/cron` (Vercel Cron) or `npm run scheduler`
and only runs when `CRON_SECRET` is set — without it none of this pruning
happens. The Terms quote every plan's monthly price through `{plans}`
(built from `PLANS` in `lib/billing/plans.ts`), so prices are visible
before sign-up (`/billing` needs an account) and follow any price change. GPS: only the last position (overwritten on every ping)
and red-line events (approach/breach/return); no route history. WhatsApp via
Meta Cloud API from one platform number. Anthropic receives unit name,
district, city and prices only when `ANTHROPIC_API_KEY` is set. Flitt:
one month at a time, no recurring charges, no card data stored. Resend:
password reset only. Hosting Vercel, database Neon. Essential cookies only
(`session`, `locale`, `theme`, `splash_seen`). No self-service account
deletion or data export yet (on request by email); soft-deleted contracts
are kept.

## Open questions for the lawyer

Register (informal "შენ" to owners, formal "თქვენ" to tenants/drivers);
controller/processor split and whether a separate DPA is needed; GPS legal
basis for drivers (contract + prior written notice vs consent) and a model
contract clause; the 10-working-day response time; cross-border transfer
safeguards; retention of payment records; refund wording under consumer law
(distance contracts, digital services); the 12-month liability cap for
consumers; forum (Tbilisi City Court vs arbitration for businesses); breach
notification; age limit 18; pre-contract price information under consumer
law (the Terms now list every plan's monthly GEL price — is that enough, or
is a public price page or more text at the pay button needed: price incl.
taxes, payment terms, duration, withdrawal right?).
