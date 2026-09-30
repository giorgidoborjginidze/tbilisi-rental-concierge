// Terms of Service — Georgian first, English second.
//
// DRAFT — TO BE REVIEWED BY A LAWYER BEFORE LAUNCH. Written to match what
// the product does today (month-at-a-time billing through Flitt, messages
// sent in the owner's name, GPS red lines, estimates that are not advice);
// see docs/legal-review.md for the facts it rests on, the open questions
// (refunds, liability cap, consumer law) and the placeholders that need
// real values. Do not mark the page itself as a draft.
//
// The owner is addressed informally (შენ), like the rest of the UI.
// Activo never contacts 112 or the police itself: the wording speaks of the
// owner's right to do so.

import type { LegalText } from "./doc";

export const TERMS: LegalText = {
  ka: {
    title: "მომსახურების პირობები",
    intro:
      "ეს პირობები არეგულირებს Activo-ს (activo.world) გამოყენებას. ანგარიშის შექმნით ან სერვისის გამოყენებით ეთანხმები ამ პირობებს და [კონფიდენციალურობის პოლიტიკას](/privacy). მომსახურებას გიწევს {entity}.",
    sections: [
      {
        id: "service",
        heading: "რა არის Activo",
        body: [
          "Activo აქტივების მართვის ონლაინ სერვისია: აქტივების, ხელშეკრულებებისა და გადახდების აღრიცხვა, ჯავშნების კალენდარი, შეხსენებები და გაფრთხილებები, WhatsApp შეტყობინებები დამქირავებლებისა და მძღოლებისთვის, GPS წითელი ხაზები, ბაზრის შეფასებები და კალკულატორები. სერვისს მუდმივად ვაუმჯობესებთ, ამიტომ ფუნქციები შეიძლება შეიცვალოს.",
        ],
      },
      {
        id: "account",
        heading: "ანგარიში",
        list: [
          "Activo-ს გამოყენება შეუძლია 18 წელს მიღწეულ პირს — საკუთარი სახელით ან იმ ორგანიზაციის სახელით, რომლის წარმომადგენლობის უფლებაც აქვს.",
          "მიუთითე სწორი ელფოსტა და დაიცავი პაროლი. შენი ანგარიშიდან შესრულებულ ქმედებებზე, მათ შორის გუნდის მოწვეული წევრების ქმედებებზე, პასუხს შენ აგებ.",
          "აკრძალულია სხვის ანგარიშში ან სისტემაში შეღწევის მცდელობა, სერვისის ავტომატური მასობრივი ჩამოტვირთვა, მისი ხელოვნური გადატვირთვა და მისი გამოყენება კანონსაწინააღმდეგო მიზნით.",
        ],
      },
      {
        id: "billing",
        heading: "გეგმები და გადახდა",
        list: [
          "ახალ ანგარიშს პირველი {trial} დღე ყველაზე მაღალი გეგმის შესაძლებლობები უფასოდ აქვს.",
          "თვიური ფასები ლარში: {plans}. რეგისტრაციის შემდეგ ისინი აპშიც ჩანს, გვერდზე [„პაკეტი და გადახდა“](/billing). გადახდა ხდება Flitt-ის მეშვეობით, ერთი თვით წინასწარ. ბარათიდან თანხა ავტომატურად არ ჩამოიჭრება — ყოველი გადახდა გეგმას ერთი თვით აგრძელებს.",
          "გადახდილი პერიოდის განმავლობაში გეგმის შეცვლისას დარჩენილი დრო ახალ ფასზე გადაითვლება.",
          "გადახდილი პერიოდის დასრულებიდან {grace} დღის შემდეგ ანგარიში ქვედა ლიმიტებზე გადადის. მონაცემები არ იშლება — მხოლოდ ლიმიტს ზემოთ ახლის დამატება ჩერდება.",
          "გადახდილი თვის თანხა არ ბრუნდება, გარდა კანონით, მათ შორის მომხმარებლის უფლებების დაცვის კანონმდებლობით, გათვალისწინებული შემთხვევებისა და იმ შემთხვევისა, როცა სერვისი ჩვენი მიზეზით ვერ მიიღე.",
          "ფასის ცვლილებას წინასწარ გამოვაქვეყნებთ; ის უკვე გადახდილ პერიოდზე არ ვრცელდება.",
        ],
      },
      {
        id: "data",
        heading: "შენი და სხვა ადამიანების მონაცემები",
        list: [
          "შენ მიერ შეყვანილი მონაცემები შენია. გვაძლევ უფლებას, დავამუშაოთ ისინი მხოლოდ სერვისის მოსაწოდებლად, [კონფიდენციალურობის პოლიტიკის](/privacy) მიხედვით.",
          "დამქირავებლის, სტუმრის ან მძღოლის მონაცემებზე დამუშავებისთვის პასუხისმგებელი პირი შენ ხარ, Activo კი — შენი დავალებით მოქმედი უფლებამოსილი პირი. შენ უზრუნველყოფ, რომ მათი მონაცემების შეყვანისა და დამუშავების კანონიერი საფუძველი გქონდეს და ისინი ამის შესახებ ინფორმირებული იყვნენ.",
          "ამ მონაცემებს ვამუშავებთ მხოლოდ შენი მითითებით, ვიცავთ მათ კონფიდენციალურობას, ვიყენებთ მხოლოდ პოლიტიკაში ჩამოთვლილ მომწოდებლებს, გეხმარებით მონაცემთა სუბიექტის მოთხოვნებზე პასუხში და ანგარიშის წაშლისას მათ ვშლით.",
        ],
      },
      {
        id: "messages",
        heading: "შეტყობინებები შენი სახელით",
        list: [
          "Activo დამქირავებლებსა და მძღოლებს WhatsApp-ით წერს შენი სახელით, შაბლონებით, რომლებსაც შენ ხედავ და ცვლი. შეტყობინების შინაარსზე, გაგზავნაზე და შედეგებზე პასუხს შენ აგებ — განსაკუთრებით შენ მიერ შეცვლილ ტექსტზე.",
          "მიმღები შენთან ურთიერთობისას (მაგალითად, ხელშეკრულებაში) უნდა დათანხმებოდა შეტყობინებების მიღებას. სპამი, მუქარა, შეურაცხყოფა და კანონსაწინააღმდეგო მოთხოვნა აკრძალულია; ვინც უარს იტყვის, მას შეტყობინება აღარ უნდა გაეგზავნოს.",
          "შეტყობინება ავტომობილის დაბრუნების ან სხვა ღონისძიების შესახებ მხოლოდ ინფორმაციაა: ღონისძიება ხელშეკრულებისა და კანონის ფარგლებში შენი გადაწყვეტილებაა. Activo თავად არ უკავშირდება პოლიციას ან 112-ს — მათთვის მიმართვის უფლება შენ გაქვს.",
          "შეტყობინების მიწოდება WhatsApp-ზეა დამოკიდებული; მიუწოდებელ ან დაგვიანებულ შეტყობინებაზე პასუხს არ ვაგებთ.",
        ],
      },
      {
        id: "gps",
        heading: "GPS და წითელი ხაზები",
        list: [
          "ტრეკერს დააყენებ და დააკავშირებ მხოლოდ შენს საკუთრებაში ან კანონიერ მფლობელობაში არსებულ ავტომობილზე.",
          "მძღოლს ტრეკერის შესახებ წინასწარ და წერილობით უნდა აცნობო — რისთვის და რა მონაცემები მუშავდება — და ეს შენს ხელშეკრულებაში უნდა აისახოს.",
          "გაფრთხილებები საინფორმაციოა: მათი სიზუსტე ტრეკერსა და კავშირზეა დამოკიდებული. Activo ავტომობილს არ აჩერებს და არ თიშავს.",
        ],
      },
      {
        id: "advice",
        heading: "შეფასებები რჩევა არ არის",
        body: [
          "ბაზრის საშუალოები, ფასის შეთავაზებები, წმინდა ღირებულება და კალკულატორები მიახლოებითი შეფასებებია — არა ფინანსური, საინვესტიციო, საგადასახადო ან იურიდიული რჩევა. გადაწყვეტილებას შენ იღებ.",
        ],
      },
      {
        id: "availability",
        heading: "ხელმისაწვდომობა",
        body: [
          "ვცდილობთ, სერვისი უწყვეტად მუშაობდეს, თუმცა ამას ვერ გარანტირებთ: შესაძლოა შეფერხდეს ტექნიკური სამუშაოების ან მესამე მხარის (ჰოსტინგი, WhatsApp, Flitt, კალენდრის არხები, ფასების წყაროები) გამო. სერვისი მოცემულია „როგორც არის“.",
        ],
      },
      {
        id: "liability",
        heading: "პასუხისმგებლობა",
        list: [
          "კანონით დაშვებულ ფარგლებში Activo არ აგებს პასუხს არაპირდაპირ ზიანზე, მიუღებელ შემოსავალზე, გადაუხდელ ქირაზე და შენსა და მესამე პირს შორის დავაზე.",
          "ჩვენი ჯამური პასუხისმგებლობა შემოიფარგლება თანხით, რომელიც ზიანის გამომწვევ მოვლენამდე ბოლო 12 თვეში გადაგვიხადე.",
          "ეს შეზღუდვა არ ვრცელდება განზრახ ან უხეში გაუფრთხილებლობით მიყენებულ ზიანზე და იმ უფლებებზე, რომლებსაც კანონი ვერ ზღუდავს.",
        ],
      },
      {
        id: "termination",
        heading: "შეწყვეტა",
        list: [
          "გამოყენების შეწყვეტა ნებისმიერ დროს შეგიძლია. ანგარიშისა და მონაცემების წაშლა მოგვთხოვე მისამართზე {email}.",
          "ამ პირობების არსებითი დარღვევისას ანგარიში შეიძლება შევაჩეროთ ან დავხუროთ — შესაძლებლობისამებრ წინასწარი გაფრთხილებით.",
          "დახურვამდე შეგიძლია მოგვთხოვო შენი მონაცემების ასლი.",
        ],
      },
      {
        id: "law",
        heading: "მოქმედი სამართალი და დავები",
        body: [
          "ეს პირობები საქართველოს კანონმდებლობით რეგულირდება. დავის მოგვარებას ჯერ მოლაპარაკებით ვცდით; შეუთანხმებლობისას დავას განიხილავს თბილისის საქალაქო სასამართლო. მომხმარებლისთვის კანონით მინიჭებული უფლებები ამით არ იზღუდება.",
        ],
      },
      {
        id: "changes",
        heading: "პირობების ცვლილება",
        body: [
          "არსებით ცვლილებას ამ გვერდზე ძალაში შესვლამდე არანაკლებ 14 დღით ადრე გამოვაქვეყნებთ. ცვლილების ძალაში შესვლის შემდეგ სერვისის გამოყენება მის მიღებას ნიშნავს. პირობები ქართულ და ინგლისურ ენებზეა; შეუსაბამობისას უპირატესობა ქართულ ვერსიას აქვს.",
        ],
      },
      {
        id: "contact",
        heading: "კონტაქტი",
        body: ["{entity} · {email} · [საკონტაქტო გვერდი](/contact)"],
      },
    ],
  },
  en: {
    title: "Terms of Service",
    intro:
      "These terms govern the use of Activo (activo.world). By creating an account or using the service you accept these terms and the [Privacy Policy](/privacy). The service is provided by {entity}.",
    sections: [
      {
        id: "service",
        heading: "What Activo is",
        body: [
          "Activo is an online service for managing assets: records of assets, contracts and payments, a booking calendar, reminders and alerts, WhatsApp messages to tenants and drivers, GPS red lines, market estimates and calculators. We keep improving the service, so features may change.",
        ],
      },
      {
        id: "account",
        heading: "Your account",
        list: [
          "Activo may be used by people aged 18 or over — in their own name, or in the name of an organisation they are entitled to represent.",
          "Give a correct email address and keep your password safe. You are responsible for what is done from your account, including by team members you invite.",
          "Attempts to access another account or system, automated mass downloading, artificially overloading the service and any unlawful use are prohibited.",
        ],
      },
      {
        id: "billing",
        heading: "Plans and payment",
        list: [
          "A new account gets the highest plan's features free for its first {trial} days.",
          "Monthly prices, in GEL: {plans}. After sign-up they are also shown in the app, on the [Plan & billing](/billing) page. Payment is made through Flitt, one month in advance. Nothing is charged to your card automatically — each payment extends the plan by one month.",
          "If you change plans during a paid period, the remaining time is converted at the new price.",
          "{grace} days after the paid period ends, the account moves to the lower limits. No data is deleted — only adding beyond the limits stops.",
          "A paid month is not refunded, except where the law, including consumer-protection law, requires it or where you could not use the service because of us.",
          "We announce price changes in advance; they never apply to a period already paid for.",
        ],
      },
      {
        id: "data",
        heading: "Your data and other people's data",
        list: [
          "The data you enter is yours. You allow us to process it only to provide the service, as described in the [Privacy Policy](/privacy).",
          "For a tenant's, guest's or driver's data you are the controller and Activo is the processor acting on your instructions. You make sure you have a lawful basis for entering and processing their data and that they are informed about it.",
          "We process that data only on your instructions, keep it confidential, use only the providers listed in the policy, help you answer data-subject requests and delete it when the account is deleted.",
        ],
      },
      {
        id: "messages",
        heading: "Messages in your name",
        list: [
          "Activo writes to tenants and drivers on WhatsApp in your name, using templates you can see and edit. You are responsible for a message's content, its sending and its consequences — especially for text you changed.",
          "The recipient must have agreed to receive messages in their dealings with you (for example, in the contract). Spam, threats, insults and unlawful demands are prohibited; anyone who objects must not be sent further messages.",
          "A message about taking a vehicle back or any other measure is information only: the measure is your decision, within the contract and the law. Activo never contacts the police or 112 itself — the right to do so is yours.",
          "Delivery depends on WhatsApp; we are not responsible for messages that are not delivered or are delayed.",
        ],
      },
      {
        id: "gps",
        heading: "GPS and red lines",
        list: [
          "Install and connect a tracker only in a vehicle you own or lawfully hold.",
          "Tell the driver about the tracker in advance and in writing — why and which data is processed — and include it in your contract.",
          "Alerts are for information: their accuracy depends on the tracker and its connection. Activo does not stop or disable vehicles.",
        ],
      },
      {
        id: "advice",
        heading: "Estimates are not advice",
        body: [
          "Market averages, price suggestions, net worth and calculators are approximate estimates — not financial, investment, tax or legal advice. The decision is yours.",
        ],
      },
      {
        id: "availability",
        heading: "Availability",
        body: [
          "We aim to keep the service running without interruption but cannot guarantee it: it may be interrupted by maintenance or by third parties (hosting, WhatsApp, Flitt, calendar feeds, price sources). The service is provided “as is”.",
        ],
      },
      {
        id: "liability",
        heading: "Liability",
        list: [
          "To the extent the law allows, Activo is not liable for indirect damage, lost profit, unpaid rent or disputes between you and third parties.",
          "Our total liability is limited to the amount you paid us in the 12 months before the event that caused the damage.",
          "This limit does not apply to damage caused intentionally or by gross negligence, or to rights the law does not allow to be limited.",
        ],
      },
      {
        id: "termination",
        heading: "Ending the service",
        list: [
          "You can stop using Activo at any time. Ask us to delete your account and data at {email}.",
          "If these terms are materially breached we may suspend or close the account — with notice in advance where possible.",
          "Before closing, you can ask us for a copy of your data.",
        ],
      },
      {
        id: "law",
        heading: "Governing law and disputes",
        body: [
          "These terms are governed by the law of Georgia. We first try to settle a dispute by negotiation; failing that, it is heard by Tbilisi City Court. Rights the law gives consumers are not limited by this.",
        ],
      },
      {
        id: "changes",
        heading: "Changes to these terms",
        body: [
          "We publish any material change on this page at least 14 days before it takes effect. Using the service after the change takes effect means accepting it. The terms exist in Georgian and English; if they differ, the Georgian version prevails.",
        ],
      },
      {
        id: "contact",
        heading: "Contact",
        body: ["{entity} · {email} · [contact page](/contact)"],
      },
    ],
  },
};
