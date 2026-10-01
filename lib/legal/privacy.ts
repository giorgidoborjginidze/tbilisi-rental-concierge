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
          "როცა Activo-ში სხვა ადამიანის მონაცემს შეიყვან — დამქირავებლის, სტუმრის ან მძღოლის სახელს, ტელეფონს, ხელშეკრულებას ან ავტომობილის მდებარეობას — მასზე დამუშავებისთვის პასუხისმგებელი პირი შენ ხარ. Activo ამ მონაცემებს შენი დავალებით, დამუშავებაზე უფლებამოსილი პირის როლში ამუშავებს და მხოლოდ იმისთვის, რომ სერვისი შენთვის იმუშაოს — გარდა ქვემოთ აღწერილი ანონიმური უბნის საშუალოებისა.",
        ],
      },
      {
        id: "data",
        heading: "რა მონაცემებს ვამუშავებთ",
        list: [
          "ანგარიში: ელფოსტა და ის, დადასტურებულია თუ არა, პაროლი (მხოლოდ ჰეშის სახით — თავად პაროლი არსად ინახება), სახელი (თუ მიუთითებ), ენა და სამუშაო სივრცის ტიპი; გუნდში მოწვევისას — მოწვეულის ელფოსტა და მისი როლი.",
          "გუნდი და ქმედებების ჟურნალი: ვინ რა გააკეთა სივრცეში და როდის (მაგალითად, „ჩაწერა გადახდა“, აქტივის ან დამქირავებლის სახელით). კომპანიის სივრცეში მის მონაცემებსა და ფაილებს მფლობელი და გუნდის ყველა წევრი ხედავს; ჟურნალს — მფლობელი და გუნდი.",
          "ატვირთული დოკუმენტები და ფოტოები: რასაც თავად ატვირთავ — მაგალითად, ხელშეკრულება, დამქირავებლის ან მძღოლის პირადობის ასლი, ტექპასპორტი, ქვითრები.",
          "ინვოისები: დამქირავებლის სახელი და ტელეფონი, თანხა, პერიოდი, შენი „გამომწერის“ მონაცემები და გადახდის ინსტრუქცია; ინვოისს შეიძლება ჰქონდეს ბმული, რომელსაც დამქირავებელს გაუზიარებ.",
          "შეტყობინებები: მოწყობილობები, სადაც ტელეფონის შეტყობინებებს ჩართავ (push მისამართი და ბრაუზერის ტიპი); ელფოსტის დადასტურების ბმული. თუ საკუთარ WhatsApp Business ნომერს დააკავშირებ — მისი იდენტიფიკატორი, ნომერი და Meta-ს წვდომის ტოკენი (დაშიფრულად).",
          "უსაფრთხოება: სესიის ჩანაწერი (ცალმხრივი ჰეშით) და შესვლის მცდელობები (ელფოსტა და IP მისამართი) — ზედმეტი მცდელობების შესაზღუდად.",
          "შენი პორტფელი: აქტივები, მისამართები, ღირებულებები, ხელშეკრულებები, გადახდები, შემოსავალი, ჯავშნები, ციფრული აქტივები და შენიშვნები — რასაც თავად შეიყვან.",
          "სხვა ადამიანების მონაცემები, რასაც შენ შეიყვან: დამქირავებლის, სტუმრის ან მძღოლის სახელი და ტელეფონის ნომერი, ხელშეკრულების პირობები, გადახდები, მათთვის გაგზავნილი შეტყობინებების ტექსტი და შენი აღნიშვნა — დაეთანხმა თუ არა WhatsApp შეტყობინებებს და ხომ არ ითხოვა მათი შეწყვეტა. გადახდის ინსტრუქცია (მაგალითად, ანგარიშის ნომერი), რომელსაც შენ დაწერ, შეტყობინებებში ემატება.",
          "ავტომობილის მდებარეობა, თუ GPS ტრეკერს დააკავშირებ: ბოლო მიღებული წერტილი, სიჩქარე და დრო (ყოველი ახალი სიგნალი წინას ცვლის) და ის წერტილები, სადაც ავტომობილი შენ მიერ დადგენილ წითელ ხაზს მიუახლოვდა, გადაკვეთა ან დაბრუნდა. მარშრუტის ისტორიას არ ვინახავთ.",
          "კალენდრები: Airbnb-ისა და Booking.com-ის iCal ბმულები და მათგან მიღებული ჯავშნების თარიღები (და სტუმრის სახელი, თუ არხი მას შეიცავს); ასევე თითოეული ერთეულის კალენდრის ბმული, რომელსაც თავად აძლევ არხებს (ერთეულის სახელი და დაკავებული ღამეები — სტუმრის მონაცემების გარეშე).",
          "გადახდა: გეგმა, თანხა, შეკვეთის ნომერი და სტატუსი. ბარათის მონაცემებს Flitt-ის გვერდზე შეიყვან — ისინი ჩვენამდე არ მოდის.",
          "ტექნიკური: მხოლოდ აუცილებელი ქუქიები — session (შესვლა), locale (ენა), theme (ფერის რეჟიმი), splash_seen (შესავლის ერთხელ ჩვენება); ბრაუზერის localStorage ტურის პროგრესისთვის; ჰოსტინგის სერვერის ჟურნალი (IP მისამართი, დრო, გვერდი). სარეკლამო ან ანალიტიკურ თვალთვალს არ ვიყენებთ.",
        ],
      },
      {
        id: "purposes",
        heading: "რისთვის და რა საფუძვლით",
        list: [
          "სერვისის მიწოდება — ანგარიში, პორტფელი, კალენდარი, შეხსენებები და გაფრთხილებები: ჩვენ შორის დადებული ხელშეკრულების ([მომსახურების პირობები](/terms)) შესრულება.",
          "WhatsApp შეტყობინებები დამქირავებლებსა და მძღოლებს, შენი სახელით და შენი მითითებით: ვმოქმედებთ როგორც უფლებამოსილი პირი; სამართლებრივი საფუძველი შენ უნდა გქონდეს — მაგალითად, ხელშეკრულება დამქირავებელთან ან მისი თანხმობა. შეტყობინება მხოლოდ მაშინ იგზავნება, როცა მიმღების თანხმობას ხელშეკრულებაში აღნიშნავ.",
          "GPS-ით წითელი ხაზის გაფრთხილებები: ვმოქმედებთ როგორც უფლებამოსილი პირი; საფუძველია შენი ხელშეკრულება მძღოლთან და მისი წინასწარი ინფორმირება.",
          "უსაფრთხოება და ბოროტად გამოყენების თავიდან აცილება (შესვლის ლიმიტი, ჟურნალები): ჩვენი კანონიერი ინტერესი.",
          "გადახდა და აღრიცხვა: ხელშეკრულების შესრულება და კანონით დაკისრებული ვალდებულება (საგადასახადო აღრიცხვა).",
          "წერილები (პაროლის აღდგენა, ელფოსტის დადასტურება, სასწრაფო გაფრთხილებები) და ტელეფონის შეტყობინებები: ხელშეკრულების შესრულება; გაფრთხილების წერილებსა და შეტყობინებებს პარამეტრებში გამორთავ.",
          "ქმედებების ჟურნალი — რომ მფლობელმა დაინახოს, გუნდში ვინ რა შეცვალა: სივრცის უსაფრთხოება, შენი და ჩვენი კანონიერი ინტერესი.",
          "ფასის შეთავაზების ახსნა ხელოვნური ინტელექტით, როცა ჩართულია: იგზავნება ერთეულის სახელი, უბანი, ქალაქი და ფასები — არა დამქირავებლის ან სტუმრის მონაცემები; ჩვენი კანონიერი ინტერესი.",
          "ანონიმური საბაზრო საშუალოები: მიმდინარე ხელშეკრულებებისა და ჯავშნების ქირიდან ვითვლით უბნის საშუალო ქირას მ²-ზე, ღამის ფასს და დატვირთვას. ინახება მხოლოდ უბნის საშუალო და მხოლოდ მაშინ, როცა ის მინიმუმ 5 ჩანაწერს მინიმუმ 3 სხვადასხვა ანგარიშიდან ეყრდნობა — არც ერთი მფლობელის, დამქირავებლის ან სტუმრის მონაცემი არ ჩანს და არ გადაეცემა; ჩვენი კანონიერი ინტერესი (საბაზრო შედარება ყველა მომხმარებლისთვის).",
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
          "Vercel — ჰოსტინგი: ყველა მოთხოვნა მასზე გადის; ასევე დახურული საცავი, სადაც ინახება შენ მიერ ატვირთული დოკუმენტები და ფოტოები.",
          "Neon — მონაცემთა ბაზა: ყველა შენახული მონაცემი.",
          "Meta Platforms (WhatsApp Business) — მიმღების ტელეფონი და შეტყობინების ტექსტი, როცა შეტყობინება იგზავნება (თუ საკუთარ ნომერს დააკავშირებ — შენი Meta-ს ანგარიშით).",
          "Flitt — ბარათით გადახდა: ბარათის მონაცემებს თავად იღებს.",
          "Resend — პაროლის აღდგენის და სასწრაფო შეტყობინებების წერილები: შენი ელფოსტა და შეტყობინების ტექსტი.",
          "შენი ბრაუზერის push-სერვისი (Google, Apple, Mozilla) — დაშიფრული შეტყობინება ტელეფონზე, თუ ჩართავ.",
          "Sentry — შეცდომების ანგარიშები: შეცდომის ტექნიკური დეტალები, სახელისა და ელფოსტის გარეშე.",
          "Anthropic — ფასის შეთავაზების ახსნის ტექსტი (ერთეულის სახელი, უბანი, ფასები), როცა ეს ფუნქცია ჩართულია.",
          "OpenStreetMap — რუკის ფრაგმენტები წითელი ხაზის დახატვისას: შენი IP მისამართი და რუკის არე.",
        ],
        after: [
          "ბაზრის ფასების წყაროებს (CoinGecko, Finnhub, Stooq, Gold API, საქართველოს ეროვნული ბანკი) მხოლოდ აქტივის სიმბოლოს ვეკითხებით — პერსონალურ მონაცემს არა. Airbnb-სა და Booking.com-ს მხოლოდ შენ მიერ მოცემულ კალენდრის ბმულს ვკითხულობთ, ხოლო ერთეულის დაკავებული ღამეების ბმულს მათ შენ აძლევ. ინვოისის გაზიარებული ბმული შესვლის გარეშე იხსნება — ვისაც აქვს, ის ხედავს მას (დამქირავებლის სახელითა და ტელეფონით, შენი რეკვიზიტებით), სანამ ინვოისს არ გააუქმებ. სახელმწიფო ორგანოს მონაცემს მხოლოდ კანონით გათვალისწინებულ შემთხვევაში გადავცემთ.",
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
          "ანგარიშისა და პორტფელის მონაცემებს — სანამ ანგარიში არსებობს. თუ ანგარიშს თავად წაშლი (პარამეტრები → შენი მონაცემები), ის მაშინვე იშლება ყველაფერთან ერთად, რაც მასში იყო — ატვირთული ფაილებიც, მათ შორის გამოწერის გადახდების ჩვენეული ჩანაწერიც (ბაზის სარეზერვო ასლში შეიძლება კიდევ რამდენიმე დღე დარჩეს, სანამ ის განახლდება); ბარათით გადახდის ჩანაწერს Flitt საგადასახადო კანონმდებლობით დადგენილი ვადით ინახავს. წერილობითი მოთხოვნისას 30 დღეში ვშლით.",
          "რასაც თავად წაშლი, მაშინვე ქრება შენი ხედიდან. წაშლილი ხელშეკრულება 30 დღის განმავლობაში აღდგენადია, მისი გადახდების ისტორია კი დამალულად რჩება ანგარიშთან; სრულად წაშლა შეგიძლია მოგვთხოვო.",
          "GPS: ბოლო წერტილი ყოველ ახალ სიგნალზე იცვლება; წითელი ხაზის მოვლენები ინახება, სანამ ხაზს, ავტომობილს ან ანგარიშს არ წაშლი.",
          "შესვლის მცდელობები და პაროლის აღდგენის მოთხოვნები (ლიმიტის დასაცავად) — ერთი დღის შემდეგ იშლება, არაუგვიანეს ორი დღისა.",
          "სესია — 30 დღე ან გამოსვლამდე; ვადაგასული სესია ერთ დღეში იშლება. პაროლის აღდგენის ბმული ერთხელ და ერთი საათით მოქმედებს და ამის შემდეგ ერთ დღეში იშლება.",
          "გაგზავნილი შეტყობინებების ჩანაწერი — ანგარიშთან ერთად.",
          "ინვოისები — ანგარიშთან ერთად; გამოწერილი ინვოისი არ იშლება, მხოლოდ უქმდება (აღრიცხვისთვის).",
          "ქმედებების ჟურნალი — 1 წელი; გუნდის წევრი, რომელიც ანგარიშს წაშლის, მასში აღარ სახელდება.",
          "შეტყობინებების მოწყობილობები — სანამ არ გამორთავ, იმ მოწყობილობიდან არ გახვალ ან push-სერვისი არ შეგვატყობინებს, რომ ის აღარ არსებობს. ელფოსტის დადასტურების ბმული ერთხელ და 3 დღით მოქმედებს.",
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
          "პარამეტრებში, „შენი მონაცემები“ განყოფილებაში, შეგიძლია თავად ჩამოტვირთო შენი სივრცის ყველა მონაცემის ასლი (JSON ფაილი; თავად დოკუმენტები და ფოტოები თითოეული აქტივის გვერდიდან ჩამოიტვირთება) და თავად წაშალო ანგარიში.",
          "სხვა მოთხოვნა გამოგზავნე მისამართზე {email} იმ ელფოსტიდან, რომლითაც ანგარიშზე შედიხარ. გიპასუხებთ კანონით დადგენილ ვადაში — არაუგვიანეს 10 სამუშაო დღისა.",
        ],
      },
      {
        id: "third-persons",
        heading: "თუ თქვენ დამქირავებელი, სტუმარი ან მძღოლი ხართ",
        body: [
          "თქვენს მონაცემებს Activo-ში ქონების ან ავტომობილის მფლობელი შეიყვანს და მათზე დამუშავებისთვის პასუხისმგებელი პირი ის არის. თქვენი უფლებების გამოსაყენებლად მიმართეთ მას. შეგიძლიათ მოგვწეროთ {email}-ზეც — მოთხოვნას მფლობელს გადავუგზავნით და მის შესრულებაში დავეხმარებით. თუ WhatsApp შეტყობინებების მიღება აღარ გსურთ, აცნობეთ მფლობელს: როცა ის ამას აღნიშნავს, თქვენთვის ახალი შეტყობინებები აღარ მზადდება. ამას ყოველი შეტყობინებაც გახსენებთ.",
        ],
      },
      {
        id: "security",
        heading: "მონაცემების დაცვა",
        body: [
          "პაროლები მხოლოდ ჰეშის სახით ინახება, სესიები — ცალმხრივი ჰეშით; კავშირი დაშიფრულია (HTTPS); ყველა ანგარიში ერთმანეთისგან გამიჯნულია და თითოეული მოთხოვნა მხოლოდ თავისი სივრცის მონაცემებს ეხება; გამონაკლისია ბმულები, რომლებსაც თავად აზიარებ (ინვოისი, ერთეულის კალენდარი). ატვირთული ფაილები დახურულ საცავში ინახება და მხოლოდ სივრცის წევრებს მიეწოდება. GPS ტრეკერი საკუთარი საიდუმლო გასაღებით უკავშირდება; საკუთარი WhatsApp ნომრის ტოკენი დაშიფრულად ინახება. უსაფრთხოების ინციდენტის შესახებ კანონით დადგენილი წესით ვაცნობებთ პერსონალურ მონაცემთა დაცვის სამსახურს და, საჭიროებისას, შენ.",
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
          "When you enter another person's data into Activo — a tenant's, guest's or driver's name, phone number, contract or a vehicle's location — you are the controller of that data. Activo processes it on your instructions, as your processor, and only so that the service works for you — apart from the anonymous district averages described below.",
        ],
      },
      {
        id: "data",
        heading: "What data we process",
        list: [
          "Account: email and whether it is confirmed, password (stored only as a hash — the password itself is never kept), name (if you give one), language and workspace type; for a team invitation, the invitee's email and role.",
          "Team and activity log: who did what in the workspace and when (for example “recorded a payment”, with the asset's or tenant's name). In a company workspace its data and files are seen by the owner and every team member; the log by the owner and the team.",
          "Uploaded documents and photos: whatever you upload — for example a contract, a tenant's or driver's ID copy, a technical passport, receipts.",
          "Invoices: the tenant's name and phone, amount, period, your “from” details and payment instructions; an invoice may have a link you share with the tenant.",
          "Notifications: the devices you turn phone notifications on for (push address and browser type); email-confirmation links. If you connect your own WhatsApp Business number — its ID, number and Meta access token (encrypted).",
          "Security: a session record (one-way hashed) and sign-in attempts (email and IP address) to limit repeated attempts.",
          "Your portfolio: assets, addresses, values, contracts, payments, income, bookings, digital holdings and notes — whatever you enter.",
          "Other people's data you enter: a tenant's, guest's or driver's name and phone number, contract terms, payments, the text of messages sent to them, and your note of whether they agreed to WhatsApp messages and whether they asked to stop them. The payment instructions you write (for example an account number) are added to those messages.",
          "Vehicle location, if you connect a GPS tracker: the last reported position, speed and time (each new report replaces the previous one) and the positions where the vehicle approached, crossed or came back across a red line you set. We keep no route history.",
          "Calendars: Airbnb and Booking.com iCal links and the booking dates read from them (and the guest's name if the feed includes it); also each unit's calendar link that you give to the channels (the unit's name and its busy nights — no guest data).",
          "Billing: plan, amount, order number and status. You enter card details on Flitt's page — they never reach us.",
          "Technical: essential cookies only — session (sign-in), locale (language), theme (colour mode), splash_seen (the intro shown once); browser localStorage for the tour's progress; the host's server logs (IP address, time, page). We use no advertising or analytics tracking.",
        ],
      },
      {
        id: "purposes",
        heading: "Why, and on what legal basis",
        list: [
          "Providing the service — account, portfolio, calendar, reminders and alerts: performance of our contract with you (the [Terms of Service](/terms)).",
          "WhatsApp messages to tenants and drivers, in your name and on your instructions: we act as your processor; the legal basis is yours to have — for example, your contract with the tenant or their consent. A message is sent only once you record the recipient's agreement on the contract.",
          "GPS red-line alerts: we act as your processor; the basis is your contract with the driver and informing them in advance.",
          "Security and abuse prevention (sign-in limits, logs): our legitimate interest.",
          "Billing and accounting: performance of the contract and a legal obligation (tax records).",
          "Emails (password reset, address confirmation, urgent alerts) and phone notifications: performance of the contract; you can turn alert emails and notifications off in Settings.",
          "The activity log — so the owner can see who in the team changed what: the security of the workspace, your and our legitimate interest.",
          "AI-written explanations of price suggestions, when enabled: the unit's name, district, city and prices are sent — never tenant or guest data; our legitimate interest.",
          "Anonymous market averages: from running contracts and stays we compute each district's average rent per m², nightly rate and occupancy. Only the district average is kept, and only when it rests on at least 5 records from at least 3 different accounts — no owner's, tenant's or guest's data shows in it or leaves us; our legitimate interest (a market comparison for every customer).",
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
          "Vercel — hosting: every request passes through it; also the private store that keeps the documents and photos you upload.",
          "Neon — database: all stored data.",
          "Meta Platforms (WhatsApp Business) — the recipient's phone number and the message text when a message is sent (through your own Meta account if you connect your own number).",
          "Flitt — card payments: it receives the card details itself.",
          "Resend — password-reset and urgent-alert emails: your email address and the alert text.",
          "Your browser's push service (Google, Apple, Mozilla) — the encrypted notification to your phone, if you turn it on.",
          "Sentry — error reports: the technical details of an error, without your name or email.",
          "Anthropic — the text of price-suggestion explanations (unit name, district, prices), when that feature is enabled.",
          "OpenStreetMap — map tiles when you draw a red line: your IP address and the map area.",
        ],
        after: [
          "Market price sources (CoinGecko, Finnhub, Stooq, Gold API, the National Bank of Georgia) are asked only for an asset's symbol — never for personal data. From Airbnb and Booking.com we only read the calendar link you give, and you give them the link of a unit's busy nights. A shared invoice link opens without signing in — whoever has it sees that invoice (with the tenant's name and phone and your details) until you void it. We disclose data to public authorities only where the law requires it.",
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
          "Account and portfolio data — while the account exists. When you delete the account yourself (Settings → Your data) it is erased at once together with everything in it — uploaded files too — including our record of your subscription payments (a copy may stay in the database backup for a few more days, until it is replaced); Flitt keeps its own record of card payments for the period tax law requires. On a written request we delete within 30 days.",
          "What you delete disappears from your view at once. A deleted contract can be restored for 30 days, and its payment history stays hidden with the account; you can ask us to erase it completely.",
          "GPS: the last position is replaced with every new report; red-line events are kept until you delete the red line, the vehicle or the account.",
          "Sign-in attempts and password-reset requests (kept for the rate limit) — deleted after a day, at the latest within two days.",
          "Sessions — 30 days or until you sign out; an expired session is deleted within a day. A password-reset link works once and for one hour, and is deleted within a day after that.",
          "The log of sent messages — with the account.",
          "Invoices — with the account; an issued invoice is not deleted, only voided (for accounting).",
          "The activity log — 1 year; a team member who deletes their account is no longer named in it.",
          "Notification devices — until you turn them off, sign out on that device, or the push service tells us it is gone. An email-confirmation link works once and for 3 days.",
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
          "In Settings → Your data you can download a copy of everything in your workspace (a JSON file; the documents and photos themselves download from each asset's page) and delete the account yourself.",
          "Send any other request to {email} from the email address you sign in with. We answer within the time the law sets — no later than 10 working days.",
        ],
      },
      {
        id: "third-persons",
        heading: "If you are a tenant, guest or driver",
        body: [
          "Your data was entered into Activo by the owner of the property or vehicle, who is its controller. To exercise your rights, contact the owner. You can also write to us at {email} — we will pass the request to the owner and help them fulfil it. If you no longer want to receive WhatsApp messages, tell the owner: once they mark it, no further messages are prepared for you. Every message says this too.",
        ],
      },
      {
        id: "security",
        heading: "How data is protected",
        body: [
          "Passwords are stored only as hashes and sessions as one-way hashes; connections are encrypted (HTTPS); every account is kept apart from the others and every request touches only its own workspace's data; the exceptions are the links you share yourself (an invoice, a unit's calendar). Uploaded files are kept in a private store and served only to the workspace's members. A GPS tracker connects with its own secret key; your own WhatsApp number's token is stored encrypted. We report a security incident to the Personal Data Protection Service, and to you where needed, as the law requires.",
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
