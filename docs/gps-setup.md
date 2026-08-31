# GPS trackers for Activo — what to install, and how it connects

*(ქართული ვერსია ქვემოთ)*

## The one thing to know first

Almost no vehicle tracker speaks HTTP. Teltonika, Concox, Queclink and the
rest send **binary packets over raw TCP** to a server that understands their
protocol. So a tracker cannot call `/api/gps/ping` by itself.

The chain is:

```
tracker  ──TCP (binary)──▶  gateway  ──HTTPS GET/POST──▶  activo.world/api/gps/ping
```

The gateway is a small, standard piece of software. Two good options:

* **Traccar** — open source, understands 200+ tracker protocols, runs on a
  cheap VPS (2 GB RAM handles hundreds of vehicles). Its *Computed
  attributes / Forward* feature posts every position to a URL, which is
  exactly our endpoint.
* **Wialon (Gurtam)** — commercial, dominant in the region, and many
  Georgian telematics resellers already run it. If a customer already has
  trackers, they are probably on Wialon; it has a retranslator/API that can
  feed us.

One gateway serves every customer — it is set up once, not per vehicle.

## Recommended hardware

| Model | Type | Why | Rough cost |
|---|---|---|---|
| **Teltonika FMC920** | wired, LTE Cat‑1 | The default choice. Internal battery, accelerometer, ignition detection, immobiliser output, excellent documentation, every gateway supports it. LTE matters — 2G is being retired. | $45–65 |
| Teltonika FMB920 | wired, 2G | Same device on 2G. Only if the fleet is price-driven and 2G still runs where they operate. | $30–45 |
| Teltonika FMB003 | OBD‑II plug-in | Installs in 30 seconds, no wiring. **The renter can unplug it** — fine as a cheap tier, not for the repossession use case. | $30–40 |
| Queclink GV57 / GV355 | wired, LTE | Solid alternative if Teltonika supply is short. | $40–60 |
| Concox / Jimi GT06N | wired, 2G | Cheapest. Rougher firmware, weaker support. Use only to test the idea. | $15–25 |

**Recommendation: standardise on the Teltonika FMC920.** One model means one
install procedure, one spare-parts box, one set of instructions, and the
gateway never has to be reconfigured. The extra $15 over the cheap options
buys reliability on exactly the vehicles where reliability is the product.

Two features on the FMC920 matter specifically here:

* **Ignition + internal battery** — the tracker keeps reporting for a while
  after power is cut, so pulling the fuse does not make the car vanish
  silently.
* **Digital output (immobiliser)** — legally delicate and *not* wired into
  Activo, but the hardware supports it if an operator's contract does.

## SIM cards

Any Georgian M2M data plan works — the traffic is tiny (roughly 20–50 MB per
vehicle per month at a 30-second reporting interval). Magti and Silknet both
sell M2M SIMs; ask for a static-IP-free, data-only plan. Budget a few GEL per
vehicle per month.

## Installation

Wired install by an auto-electrician takes 20–40 minutes: permanent 12 V,
ground, ignition sense, and the unit hidden behind the dashboard away from
metal. Roughly 30–60 GEL per car in Tbilisi. For a rental fleet this is done
once per vehicle, not per rental.

## Connecting a vehicle in Activo

1. Open the asset → **Rental service**.
2. Enter the vehicle's state plate — the notifications quote it verbatim.
3. Under **GPS tracker**, enter the tracker's IMEI as the Device ID and save.
4. Copy the **ping address** shown, and set it as the forward URL in Traccar
   (or the retranslation target in Wialon) for that device.
5. Draw the **red lines**, set how far ahead to warn, and check the message
   texts.

The endpoint accepts both `POST` (JSON) and `GET` (query string), because
some gateways and cheap devices can only fire a plain URL:

```
GET /api/gps/ping?deviceId=<IMEI>&token=<token>&lat=41.7151&lng=44.8271&speed=54
```

Each device has its own token; nothing else can post positions on its behalf.
Rotate it from the same screen if it leaks.

## Offering this as a service

The practical package for a car-rental business:

1. One Traccar VPS, run by you, shared by all customers.
2. FMC920 units bought in bulk, installed by a partner auto-electrician.
3. Per-vehicle monthly fee covering the SIM, the gateway and Activo.

The customer never sees Traccar. They see their cars, their red lines and
their WhatsApp messages.

---

# GPS ტრეკერები Activo-სთვის — რა დავაყენოთ და როგორ უკავშირდება

## პირველი, რაც უნდა ვიცოდეთ

თითქმის არცერთი ავტომობილის ტრეკერი HTTP-ს არ იყენებს. Teltonika, Concox,
Queclink და დანარჩენები **ბინარულ პაკეტებს აგზავნიან TCP-ით** სერვერზე,
რომელსაც მათი პროტოკოლი ესმის. ანუ ტრეკერი თავად ვერ გამოიძახებს
`/api/gps/ping`-ს.

ჯაჭვი ასეთია:

```
ტრეკერი ──TCP (ბინარული)──▶ გეითვეი ──HTTPS──▶ activo.world/api/gps/ping
```

გეითვეი სტანდარტული პროგრამაა. ორი კარგი ვარიანტი:

* **Traccar** — ღია კოდი, 200-ზე მეტი პროტოკოლი, იაფ VPS-ზე დგება (2 GB RAM
  ასეულობით მანქანას წევს). მისი Forward ფუნქცია ყოველ კოორდინატს ჩვენს
  მისამართზე აგზავნის.
* **Wialon (Gurtam)** — კომერციული, რეგიონში დომინანტი. ქართველი
  ტელემატიკის დილერების უმეტესობა სწორედ ამაზე ზის. თუ კლიენტს უკვე აქვს
  ტრეკერები, დიდი ალბათობით Wialon-ზეა და რეტრანსლატორით მოგვაწოდებს.

ერთი გეითვეი ყველა კლიენტს ემსახურება — ერთხელ იდგმება, არა თითო მანქანაზე.

## რეკომენდებული აპარატურა

| მოდელი | ტიპი | რატომ | ფასი დაახლ. |
|---|---|---|---|
| **Teltonika FMC920** | ჩასამონტაჟებელი, LTE | ძირითადი არჩევანი. შიდა ბატარეა, აქსელერომეტრი, ანთების ამოცნობა, იმობილაიზერის გამოსავალი, შესანიშნავი დოკუმენტაცია. LTE მნიშვნელოვანია — 2G ითიშება. | $45–65 |
| Teltonika FMB920 | ჩასამონტაჟებელი, 2G | იგივე მოწყობილობა 2G-ზე. მხოლოდ თუ ფასი კრიტიკულია. | $30–45 |
| Teltonika FMB003 | OBD-ში ჩასარჭობი | 30 წამში ჯდება, მონტაჟი არ სჭირდება. **დამქირავებელს ამოღება შეუძლია** — ჩვენი ამოცანისთვის არ გამოდგება. | $30–40 |
| Queclink GV57 | ჩასამონტაჟებელი, LTE | კარგი ალტერნატივა. | $40–60 |
| Concox GT06N | ჩასამონტაჟებელი, 2G | ყველაზე იაფი. სუსტი firmware და მხარდაჭერა — მხოლოდ იდეის შესამოწმებლად. | $15–25 |

**რეკომენდაცია: აირჩიე ერთი მოდელი — Teltonika FMC920.** ერთი მოდელი ნიშნავს
ერთ ინსტრუქციას, ერთ სათადარიგო ყუთს და გეითვეის, რომელსაც გადაწყობა აღარ
სჭირდება. იაფ ვარიანტთან სხვაობა $15-ია — ზუსტად იმ მანქანებზე, სადაც
საიმედოობა თავად პროდუქტია.

ორი ფუნქცია აქ განსაკუთრებით მნიშვნელოვანია:

* **ანთება + შიდა ბატარეა** — კვების მოხსნის შემდეგაც აგრძელებს გადაცემას,
  ანუ დაზგის ამოღებით მანქანა უხმაუროდ არ ქრება.
* **ციფრული გამოსავალი (იმობილაიზერი)** — იურიდიულად დელიკატურია და Activo-ში
  **არ** გვაქვს ჩართული, მაგრამ აპარატურას შეუძლია, თუ კონტრაქტი ითვალისწინებს.

## SIM ბარათები

ნებისმიერი M2M პაკეტი გამოდგება — ტრაფიკი მცირეა (30 წამში ერთხელ გადაცემისას
დაახლოებით 20–50 MB თვეში თითო მანქანაზე). Magti-საც და Silknet-საც აქვთ M2M
ტარიფები. ჩადე რამდენიმე ლარი თვეში თითო ავტომობილზე.

## მონტაჟი

ავტოელექტრიკოსთან 20–40 წუთია: მუდმივი 12 V, მასა, ანთების სიგნალი და
მოწყობილობა დაფის უკან, ლითონისგან მოშორებით. თბილისში დაახლოებით 30–60 ლარი.
კეთდება ერთხელ თითო მანქანაზე — არა ყოველ გაქირავებაზე.

## მანქანის მიბმა Activo-ში

1. გახსენი აქტივი → **გაქირავების სერვისი**.
2. შეიყვანე სახელმწიფო ნომერი — შეტყობინებებში ზუსტად ეს ჩაიწერება.
3. **GPS მოწყობილობაში** ჩაწერე ტრეკერის IMEI როგორც Device ID და შეინახე.
4. დააკოპირე გამოჩენილი **მისამართი** და Traccar-ში (ან Wialon-ში) მიუთითე
   იმ მოწყობილობის გადამისამართების URL-ად.
5. დახაზე **წითელი ხაზები**, მიუთითე რამდენი კილომეტრით ადრე გააფრთხილოს და
   გადახედე შეტყობინებების ტექსტებს.

მისამართი იღებს როგორც `POST`-ს (JSON), ისე `GET`-ს (query), რადგან ზოგ
გეითვეის და იაფ მოწყობილობას მხოლოდ ბმულის გამოძახება შეუძლია:

```
GET /api/gps/ping?deviceId=<IMEI>&token=<token>&lat=41.7151&lng=44.8271&speed=54
```

თითოეულ მოწყობილობას თავისი ტოკენი აქვს; სხვა ვერავინ ჩაწერს კოორდინატს მის
ნაცვლად. გაჟონვის შემთხვევაში იმავე ეკრანიდან შეცვლი.

## როგორ შევთავაზოთ ეს სერვისად

პრაქტიკული პაკეტი გაქირავების ბიზნესისთვის:

1. ერთი Traccar VPS, შენს მართვაში, ყველა კლიენტისთვის საერთო.
2. FMC920 დიდი პარტიით, მონტაჟი პარტნიორ ავტოელექტრიკოსთან.
3. თვიური საფასური თითო მანქანაზე — SIM, გეითვეი და Activo ერთად.

კლიენტი Traccar-ს საერთოდ ვერ ხედავს. ის ხედავს თავის მანქანებს, თავის წითელ
ხაზებს და თავის WhatsApp შეტყობინებებს.
