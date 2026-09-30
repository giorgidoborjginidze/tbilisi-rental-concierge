// Privacy policy — Georgian first, English second.
//
// DRAFT — TO BE REVIEWED BY A LAWYER BEFORE LAUNCH. Written against the Law
// of Georgia on Personal Data Protection (2023) and what the code actually
// does today (see docs/legal-review.md for the facts it rests on, the open
// questions and the placeholders that need real values). Do not mark the
// page itself as a draft; change this text only together with the doc.
//
// The owner is addressed informally (შენ), like the rest of the UI; the
// section for tenants, guests and drivers addresses them formally (თქვენ).

import type { LegalText } from "./doc";

export const PRIVACY: LegalText = {
  ka: {
    title: "კონფიდენციალურობის პოლიტიკა",
    intro:
      "ეს პოლიტიკა აგიხსნის, რა პერსონალურ მონაცემებს ამუშავებს Activo (activo.world), რისთვის და რა საფუძვლით, ვის გადაეცემა, რამდენ ხანს ინახება და რა უფლებები გაქვს — „პერსონალურ მონაცემთა დაცვის შესახებ“ საქართველოს კანონის შესაბამისად. ის ეხება იმ ადამიანებსაც, რომელთა მონაცემებსაც შენ შეიყვან Activo-ში: დამქირავებლებს, სტუმრებს და მძღოლებს.",
    sections: [
      {
        id: "controller",
        heading: "ვინ ამუშავებს მონაცემებს",
        body: [
          "შენი ანგარიშის მონაცემებზე დამუშავებისთვის პასუხისმგებელი პირია {entity}. დაგვიკავშირდი: {email}.",
          "როცა Activo-ში სხვა ადამიანის მონაცემს შეიყვან — დამქირავებლის, სტუმრის ან მძღოლის სახელს, ტელეფონს, ხელშეკრულებას ან ავტომობილის მდებარეობას — მასზე დამუშავებისთვის პასუხისმგებელი პირი შენ ხარ. Activo ამ მონაცემებს შენი დავალებით, დამუშავებაზე უფლებამოსილი პირის როლში ამუშავებს და მხოლოდ იმისთვის, რომ სერვისი შენთვის იმუშაოს.",
        ],
      },
      {
        id: "data",
        heading: "რა მონაცემებს ვამუშავებთ",
        list: [
          "ანგარიში: ელფოსტა, პაროლი (მხოლოდ ჰეშის სახით — თავად პაროლი არსად ინახება), სახელი (თუ მიუთითებ), ენა და სამუშაო სივრცის ტიპი; გუნდში მოწვევისას — მოწვეულის ელფოსტა.",
          "უსაფრთხოება: სესიის ჩანაწერი (ცალმხრივი ჰეშით) და შესვლის მცდელობები (ელფოსტა და IP მისამართი) — ზედმეტი მცდელობების შესაზღუდად.",
          "შენი პორტფელი: აქტივები, მისამართები, ღირებულებები, ხელშეკრულებები, გადახდები, შემოსავალი, ჯავშნები, ციფრული აქტივები და შენიშვნები — რასაც თავად შეიყვან.",
          "სხვა ადამიანების მონაცემები, რასაც შენ შეიყვან: დამქირავებლის, სტუმრის ან მძღოლის სახელი და ტელეფონის ნომერი, ხელშეკრულების პირობები, გადახდები და მათთვის გაგზავნილი შეტყობინებების ტექსტი.",
          "ავტომობილის მდებარეობა, თუ GPS ტრეკერს დააკავშირებ: ბოლო მიღებული წერტილი, სიჩქარე და დრო (ყოველი ახალი სიგნალი წინას ცვლის) და ის წერტილები, სადაც ავტომობილი შენ მიერ დადგენილ წითელ ხაზს მიუახლოვდა, გადაკვეთა ან დაბრუნდა. მარშრუტის ისტორიას არ ვინახავთ.",
          "კალენდრები: Airbnb-ისა და Booking.com-ის iCal ბმულები და მათგან მიღებული ჯავშნების თარიღები (და სტუმრის სახელი, თუ არხი მას შეიცავს).",
          "გადახდა: გეგმა, თანხა, შეკვეთის ნომერი და სტატუსი. ბარათის მონაცემებს Flitt-ის გვერდზე შეიყვან — ისინი ჩვენამდე არ მოდის.",
          "ტექნიკური: მხოლოდ აუცილებელი ქუქიები — session (შესვლა), locale (ენა), theme (ფერის რეჟიმი), splash_seen (შესავლის ერთხელ ჩვენება); ბრაუზერის localStorage ტურის პროგრესისთვის; ჰოსტინგის სერვერის ჟურნალი (IP მისამართი, დრო, გვერდი). სარეკლამო ან ანალიტიკურ თვალთვალს არ ვიყენებთ.",
        ],
      },
      {
        id: "purposes",
        heading: "რისთვის და რა საფუძვლით",
        list: [
          "სერვისის მიწოდება — ანგარიში, პორტფელი, კალენდარი, შეხსენებები და გაფრთხილებები: ჩვენ შორის დადებული ხელშეკრულების ([მომსახურების პირობები](/terms)) შესრულება.",
          "WhatsApp შეტყობინებები დამქირავებლებსა და მძღოლებს, შენი სახელით და შენი მითითებით: ვმოქმედებთ როგორც უფლებამოსილი პირი; სამართლებრივი საფუძველი შენ უნდა გქონდეს — მაგალითად, ხელშეკრულება დამქირავებელთან ან მისი თანხმობა.",
          "GPS-ით წითელი ხაზის გაფრთხილებები: ვმოქმედებთ როგორც უფლებამოსილი პირი; საფუძველია შენი ხელშეკრულება მძღოლთან და მისი წინასწარი ინფორმირება.",
          "უსაფრთხოება და ბოროტად გამოყენების თავიდან აცილება (შესვლის ლიმიტი, ჟურნალები): ჩვენი კანონიერი ინტერესი.",
          "გადახდა და აღრიცხვა: ხელშეკრულების შესრულება და კანონით დაკისრებული ვალდებულება (საგადასახადო აღრიცხვა).",
          "პაროლის აღდგენის წერილი: ხელშეკრულების შესრულება.",
          "ფასის შეთავაზების ახსნა ხელოვნური ინტელექტით, როცა ჩართულია: იგზავნება ერთეულის სახელი, უბანი, ქალაქი და ფასები — არა დამქირავებლის ან სტუმრის მონაცემები; ჩვენი კანონიერი ინტერესი.",
        ],
        after: [
          "მარკეტინგულ შეტყობინებებს თანხმობის გარეშე არ ვაგზავნით, მონაცემებს არ ვყიდით და შენზე სამართლებრივი შედეგის მქონე ავტომატურ გადაწყვეტილებას არ ვიღებთ.",
        ],
      },
      {
        id: "recipients",
        heading: "ვის გადაეცემა მონაცემები",
        body: [
          "მონაცემებს მხოლოდ იმ მომწოდებლებს ვანდობთ, რომლებიც სერვისის სამუშაოდ გვჭირდება, და მხოლოდ იმას, რაც მათ თავიანთი ნაწილისთვის სჭირდებათ:",
        ],
        list: [
          "Vercel — ჰოსტინგი: ყველა მოთხოვნა მასზე გადის.",
          "Neon — მონაცემთა ბაზა: ყველა შენახული მონაცემი.",
          "Meta Platforms (WhatsApp Business) — მიმღების ტელეფონი და შეტყობინების ტექსტი, როცა შეტყობინება იგზავნება.",
          "Flitt — ბარათით გადახდა: ბარათის მონაცემებს თავად იღებს.",
          "Resend — პაროლის აღდგენის წერილი: შენი ელფოსტა.",
          "Anthropic — ფასის შეთავაზების ახსნის ტექსტი (ერთეულის სახელი, უბანი, ფასები), როცა ეს ფუნქცია ჩართულია.",
        ],
        after: [
          "ბაზრის ფასების წყაროებს (CoinGecko, Finnhub, Stooq, Gold API, საქართველოს ეროვნული ბანკი) მხოლოდ აქტივის სიმბოლოს ვეკითხებით — პერსონალურ მონაცემს არა. Airbnb-სა და Booking.com-ს მხოლოდ შენ მიერ მოცემულ კალენდრის ბმულს ვკითხულობთ. სახელმწიფო ორგანოს მონაცემს მხოლოდ კანონით გათვალისწინებულ შემთხვევაში გადავცემთ.",
        ],
      },
      {
        id: "transfers",
        heading: "მონაცემები საქართველოს ფარგლებს გარეთ",
        body: [
          "ჩამოთვლილი მომწოდებლების ნაწილი მონაცემებს საქართველოს გარეთ ამუშავებს (მაგალითად, აშშ-სა და ევროკავშირში). ასეთ გადაცემას მხოლოდ კანონით გათვალისწინებული დაცვის გარანტიებით ვახორციელებთ — მაგალითად, მომწოდებელთან დადებული მონაცემთა დამუშავების ხელშეკრულებით.",
        ],
      },
      {
        id: "retention",
        heading: "რამდენ ხანს ვინახავთ",
        list: [
          "ანგარიშისა და პორტფელის მონაცემებს — სანამ ანგარიში არსებობს. ანგარიშის წაშლის მოთხოვნიდან 30 დღეში ვშლით, გარდა გადახდის ჩანაწერებისა, რომლებსაც საგადასახადო კანონმდებლობით დადგენილი ვადით ვინახავთ.",
          "რასაც თავად წაშლი, მაშინვე ქრება შენი ხედიდან. წაშლილი ხელშეკრულება 30 დღის განმავლობაში აღდგენადია, მისი გადახდების ისტორია კი დამალულად რჩება ანგარიშთან; სრულად წაშლა შეგიძლია მოგვთხოვო.",
          "GPS: ბოლო წერტილი ყოველ ახალ სიგნალზე იცვლება; წითელი ხაზის მოვლენები ინახება, სანამ ხაზს, ავტომობილს ან ანგარიშს არ წაშლი.",
          "შესვლის მცდელობები — 24 საათი; სესია — 30 დღე ან გამოსვლამდე.",
          "გაგზავნილი შეტყობინებების ჩანაწერი — ანგარიშთან ერთად.",
          "სერვერის ჟურნალი — ჰოსტინგის მომწოდებლის მიერ დადგენილი ვადით.",
        ],
      },
      {
        id: "rights",
        heading: "შენი უფლებები",
        body: ["კანონის შესაბამისად გაქვს უფლება:"],
        list: [
          "მიიღო ინფორმაცია შენი მონაცემების დამუშავების შესახებ და მათი ასლი;",
          "მოითხოვო არაზუსტი ან არასრული მონაცემის გასწორება;",
          "მოითხოვო მონაცემების წაშლა ან განადგურება;",
          "მოითხოვო დამუშავების შეწყვეტა ან მონაცემების დაბლოკვა;",
          "მიიღო შენ მიერ მოწოდებული მონაცემები სტრუქტურირებული, მანქანით წაკითხვადი ფორმით, სადაც ამას კანონი ითვალისწინებს;",
          "გამოიხმო თანხმობა, სადაც დამუშავება თანხმობას ეყრდნობა;",
          "მიმართო პერსონალურ მონაცემთა დაცვის სამსახურს ([personaldata.ge](https://personaldata.ge)) ან სასამართლოს.",
        ],
        after: [
          "მოთხოვნა გამოგზავნე მისამართზე {email} იმ ელფოსტიდან, რომლითაც ანგარიშზე შედიხარ. გიპასუხებთ კანონით დადგენილ ვადაში — არაუგვიანეს 10 სამუშაო დღისა.",
        ],
      },
      {
        id: "third-persons",
        heading: "თუ თქვენ დამქირავებელი, სტუმარი ან მძღოლი ხართ",
        body: [
          "თქვენს მონაცემებს Activo-ში ქონების ან ავტომობილის მფლობელი შეიყვანს და მათზე დამუშავებისთვის პასუხისმგებელი პირი ის არის. თქვენი უფლებების გამოსაყენებლად მიმართეთ მას. შეგიძლიათ მოგვწეროთ {email}-ზეც — მოთხოვნას მფლობელს გადავუგზავნით და მის შესრულებაში დავეხმარებით. თუ WhatsApp შეტყობინებების მიღება აღარ გსურთ, აცნობეთ მფლობელს.",
        ],
      },
      {
        id: "security",
        heading: "მონაცემების დაცვა",
        body: [
          "პაროლები მხოლოდ ჰეშის სახით ინახება, სესიები — ცალმხრივი ჰეშით; კავშირი დაშიფრულია (HTTPS); ყველა ანგარიში ერთმანეთისგან გამიჯნულია და თითოეული მოთხოვნა მხოლოდ თავისი ანგარიშის მონაცემებს ეხება. GPS ტრეკერი საკუთარი საიდუმლო გასაღებით უკავშირდება. უსაფრთხოების ინციდენტის შესახებ კანონით დადგენილი წესით ვაცნობებთ პერსონალურ მონაცემთა დაცვის სამსახურს და, საჭიროებისას, შენ.",
        ],
      },
      {
        id: "children",
        heading: "არასრულწლოვნები",
        body: ["Activo 18 წლამდე პირებისთვის არ არის განკუთვნილი და მათ მონაცემებს შეგნებულად არ ვაგროვებთ."],
      },
      {
        id: "changes",
        heading: "ცვლილებები",
        body: [
          "პოლიტიკის არსებით ცვლილებას ამ გვერდზე ძალაში შესვლამდე გამოვაქვეყნებთ. პოლიტიკა ქართულ და ინგლისურ ენებზეა; შეუსაბამობისას უპირატესობა ქართულ ვერსიას აქვს.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    intro:
      "This policy explains which personal data Activo (activo.world) processes, why and on what basis, who receives it, how long it is kept and what rights you have, in line with the Law of Georgia on Personal Data Protection. It also covers the people whose data you enter into Activo: tenants, guests and drivers.",
    sections: [
      {
        id: "controller",
        heading: "Who processes the data",
        body: [
          "The controller of your account data is {entity}. Contact: {email}.",
          "When you enter another person's data into Activo — a tenant's, guest's or driver's name, phone number, contract or a vehicle's location — you are the controller of that data. Activo processes it on your instructions, as your processor, and only so that the service works for you.",
        ],
      },
      {
        id: "data",
        heading: "What data we process",
        list: [
          "Account: email, password (stored only as a hash — the password itself is never kept), name (if you give one), language and workspace type; for a team invitation, the invitee's email.",
          "Security: a session record (one-way hashed) and sign-in attempts (email and IP address) to limit repeated attempts.",
          "Your portfolio: assets, addresses, values, contracts, payments, income, bookings, digital holdings and notes — whatever you enter.",
          "Other people's data you enter: a tenant's, guest's or driver's name and phone number, contract terms, payments and the text of messages sent to them.",
          "Vehicle location, if you connect a GPS tracker: the last reported position, speed and time (each new report replaces the previous one) and the positions where the vehicle approached, crossed or came back across a red line you set. We keep no route history.",
          "Calendars: Airbnb and Booking.com iCal links and the booking dates read from them (and the guest's name if the feed includes it).",
          "Billing: plan, amount, order number and status. You enter card details on Flitt's page — they never reach us.",
          "Technical: essential cookies only — session (sign-in), locale (language), theme (colour mode), splash_seen (the intro shown once); browser localStorage for the tour's progress; the host's server logs (IP address, time, page). We use no advertising or analytics tracking.",
        ],
      },
      {
        id: "purposes",
        heading: "Why, and on what legal basis",
        list: [
          "Providing the service — account, portfolio, calendar, reminders and alerts: performance of our contract with you (the [Terms of Service](/terms)).",
          "WhatsApp messages to tenants and drivers, in your name and on your instructions: we act as your processor; the legal basis is yours to have — for example, your contract with the tenant or their consent.",
          "GPS red-line alerts: we act as your processor; the basis is your contract with the driver and informing them in advance.",
          "Security and abuse prevention (sign-in limits, logs): our legitimate interest.",
          "Billing and accounting: performance of the contract and a legal obligation (tax records).",
          "Password-reset email: performance of the contract.",
          "AI-written explanations of price suggestions, when enabled: the unit's name, district, city and prices are sent — never tenant or guest data; our legitimate interest.",
        ],
        after: [
          "We send no marketing without consent, never sell data and make no automated decisions about you that have legal effect.",
        ],
      },
      {
        id: "recipients",
        heading: "Who receives the data",
        body: [
          "We entrust data only to the providers the service needs to run, and only with what each needs for its part:",
        ],
        list: [
          "Vercel — hosting: every request passes through it.",
          "Neon — database: all stored data.",
          "Meta Platforms (WhatsApp Business) — the recipient's phone number and the message text when a message is sent.",
          "Flitt — card payments: it receives the card details itself.",
          "Resend — password-reset email: your email address.",
          "Anthropic — the text of price-suggestion explanations (unit name, district, prices), when that feature is enabled.",
        ],
        after: [
          "Market price sources (CoinGecko, Finnhub, Stooq, Gold API, the National Bank of Georgia) are asked only for an asset's symbol — never for personal data. From Airbnb and Booking.com we only read the calendar link you give. We disclose data to public authorities only where the law requires it.",
        ],
      },
      {
        id: "transfers",
        heading: "Data outside Georgia",
        body: [
          "Some of these providers process data outside Georgia (for example in the USA and the EU). Such transfers are made only with the safeguards the law requires — for example, a data processing agreement with the provider.",
        ],
      },
      {
        id: "retention",
        heading: "How long we keep data",
        list: [
          "Account and portfolio data — while the account exists. We delete it within 30 days of a request to delete the account, except payment records, which we keep for the period tax law requires.",
          "What you delete disappears from your view at once. A deleted contract can be restored for 30 days, and its payment history stays hidden with the account; you can ask us to erase it completely.",
          "GPS: the last position is replaced with every new report; red-line events are kept until you delete the red line, the vehicle or the account.",
          "Sign-in attempts — 24 hours; sessions — 30 days or until you sign out.",
          "The log of sent messages — with the account.",
          "Server logs — for the period set by the hosting provider.",
        ],
      },
      {
        id: "rights",
        heading: "Your rights",
        body: ["Under the law you have the right to:"],
        list: [
          "be informed about the processing of your data and get a copy of it;",
          "have inaccurate or incomplete data corrected;",
          "have your data deleted or destroyed;",
          "have processing stopped or your data blocked;",
          "receive the data you provided in a structured, machine-readable form, where the law provides for it;",
          "withdraw consent where processing relies on consent;",
          "complain to the Personal Data Protection Service of Georgia ([personaldata.ge](https://personaldata.ge)) or to a court.",
        ],
        after: [
          "Send your request to {email} from the email address you sign in with. We answer within the time the law sets — no later than 10 working days.",
        ],
      },
      {
        id: "third-persons",
        heading: "If you are a tenant, guest or driver",
        body: [
          "Your data was entered into Activo by the owner of the property or vehicle, who is its controller. To exercise your rights, contact the owner. You can also write to us at {email} — we will pass the request to the owner and help them fulfil it. If you no longer want to receive WhatsApp messages, tell the owner.",
        ],
      },
      {
        id: "security",
        heading: "How data is protected",
        body: [
          "Passwords are stored only as hashes and sessions as one-way hashes; connections are encrypted (HTTPS); every account is kept apart from the others and every request touches only its own account's data. A GPS tracker connects with its own secret key. We report a security incident to the Personal Data Protection Service, and to you where needed, as the law requires.",
        ],
      },
      {
        id: "children",
        heading: "Minors",
        body: ["Activo is not meant for people under 18, and we do not knowingly collect their data."],
      },
      {
        id: "changes",
        heading: "Changes",
        body: [
          "We publish any material change on this page before it takes effect. The policy exists in Georgian and English; if they differ, the Georgian version prevails.",
        ],
      },
    ],
  },
};
