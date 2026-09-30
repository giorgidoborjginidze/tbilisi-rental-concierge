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
  cheap VPS (2 GB RAM handles hundreds of vehicles). Its position
  *forward* posts every position to **one** URL for the whole server — it
  cannot carry a different token per device, so on its own it cannot call
  our endpoint (see step 4 below).
* **Wialon (Gurtam)** — commercial, dominant in the region, and many
  Georgian telematics resellers already run it. If a customer already has
  trackers, they are probably on Wialon; it has a retranslator/API that can
  feed us.

One gateway serves every customer — it is set up once, not per vehicle
(with Traccar, plus the small per-device relay described in step 4).

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
4. Copy the **ping address** shown (it carries the device id and its token,
   never a position) and hand it to whoever runs the gateway. It is a
   per-device address, and that decides how the gateway is wired:
   * **Wialon**: a retranslator can target one address per unit, so each
     vehicle gets its own copied address.
   * **Traccar**: its forward URL is global — one address for every device —
     and cannot carry a per-device token. It needs a small relay between
     Traccar and Activo that maps each IMEI to its token (or one
     retranslator per unit). **Activo staff set this up**; until a
     gateway-level credential exists, do not describe Traccar as
     "paste the address and done".
5. Draw the **red lines**, set how far ahead to warn, and check the message
   texts.

`POST` is preferred (JSON or form-encoded), with the token in the
`Authorization: Bearer <token>` header so it stays out of URLs and logs.
`GET` with the same fields as a query string is still accepted, because some
gateways and cheap devices can only fire a plain URL:

```
POST /api/gps/ping
Authorization: Bearer <token>
{ "deviceId": "<IMEI>", "lat": 41.6410, "lng": 41.6330, "speed": 54, "at": "2026-09-30T10:00:00Z" }

GET /api/gps/ping?deviceId=<IMEI>&token=<token>&lat=<latitude>&lng=<longitude>&speed=<km/h>&timestamp=<fix time>
```

`lon` is read as `lng`, and `timestamp` (ISO, compact `YYYYMMDDhhmmss`, or
Unix seconds / milliseconds) as `at`. A time without a zone offset is read
as UTC. A ping is refused unless it is one real, fresh fix:

| Refused | Response |
|---|---|
| wrong device id or token | 401 `unauthorized` |
| a coordinate given more than once (`lat` twice, or `lng` and `lon` together) | 400 `duplicate_position` |
| an empty, non-numeric or out-of-range coordinate | 400 `invalid_position` |
| 0,0 or `valid=false` (no satellite fix) | 422 `no_fix` |
| the example position shown on the rental page (41.7151, 44.8271) | 422 `example_position` |
| a fix time more than 5 minutes in the future | 400 `future_timestamp` |
| a fix time more than 7 days old (a broken tracker clock, e.g. 1970) | 400 `invalid_timestamp` |
| a fix no newer than the last accepted one | 409 `stale_ping` |
| more than one accepted ping per device every 5 seconds | 429 `rate_limited` |

Each device has its own token (compared in constant time); nothing else can
post positions on its behalf. Rotate it from the same screen if it leaks.

A tracker that has reported before and then stays silent for more than 30
minutes, on a rented vehicle with an active red line, raises a "tracker
silent" alert at the next scan, and the rental page shows the red lines as
"unknown" instead of "inside".

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
  ასეულობით მანქანას წევს). მისი Forward ფუნქცია ყოველ კოორდინატს **ერთ**
  საერთო მისამართზე აგზავნის — თითო მოწყობილობის ტოკენს ვერ ატარებს, ამიტომ
  პირდაპირ ჩვენს მისამართს ვერ გამოიძახებს (იხ. ქვემოთ, ნაბიჯი 4).
* **Wialon (Gurtam)** — კომერციული, რეგიონში დომინანტი. ქართველი
  ტელემატიკის დილერების უმეტესობა სწორედ ამაზე ზის. თუ კლიენტს უკვე აქვს
  ტრეკერები, დიდი ალბათობით Wialon-ზეა და რეტრანსლატორით მოგვაწოდებს.

ერთი გეითვეი ყველა კლიენტს ემსახურება — ერთხელ იდგმება, არა თითო მანქანაზე
(Traccar-ის შემთხვევაში — ნაბიჯ 4-ში აღწერილ პატარა შუამავალთან ერთად).

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
4. დააკოპირე გამოჩენილი **მისამართი** (მასში მხოლოდ მოწყობილობის ID და
   ტოკენია, კოორდინატი — არა) და გადაეცი მას, ვინც გეითვეის მართავს. ეს
   მისამართი თითო მოწყობილობისთვისაა, და ამაზეა დამოკიდებული, როგორ
   დაუკავშირდება გეითვეი:
   * **Wialon**: რეტრანსლატორს თითო ერთეულზე თავისი მისამართი შეიძლება
     მიეთითოს — თითო მანქანას თავისი დაკოპირებული მისამართი.
   * **Traccar**: მისი გადამისამართების URL საერთოა ყველა მოწყობილობისთვის
     და თითო მოწყობილობის ტოკენს ვერ ატარებს. საჭიროა პატარა შუამავალი
     (relay) Traccar-სა და Activo-ს შორის, რომელიც თითო IMEI-ს თავის ტოკენს
     შეუსაბამებს (ან თითო ერთეულზე ცალკე რეტრანსლატორი). **ამას Activo-ს
     გუნდი აწყობს**; სანამ გეითვეის დონის საერთო გასაღები არ არსებობს,
     Traccar „ჩასვი მისამართი და მზადაა“ არ არის.
5. დახაზე **წითელი ხაზები**, მიუთითე რამდენი კილომეტრით ადრე გააფრთხილოს და
   გადახედე შეტყობინებების ტექსტებს.

სასურველია `POST` (JSON ან ფორმა), ტოკენით სათაურში
`Authorization: Bearer <token>`, რომ ბმულებსა და ლოგებში არ მოხვდეს. `GET`
იგივე ველებით კვლავ მიიღება, რადგან ზოგ გეითვეის და იაფ მოწყობილობას მხოლოდ
ბმულის გამოძახება შეუძლია:

```
POST /api/gps/ping
Authorization: Bearer <token>
{ "deviceId": "<IMEI>", "lat": 41.6410, "lng": 41.6330, "speed": 54, "at": "2026-09-30T10:00:00Z" }

GET /api/gps/ping?deviceId=<IMEI>&token=<token>&lat=<განედი>&lng=<გრძედი>&speed=<კმ/სთ>&timestamp=<დრო>
```

არ მიიღება: ერთზე მეტჯერ მოცემული კოორდინატი (`lat` ორჯერ, ან `lng` და `lon` ერთად), ცარიელი ან
არარიცხვითი კოორდინატი, 0,0 ან `valid=false` (სატელიტური სიგნალი არ არის),
გაქირავების გვერდზე ნაჩვენები მაგალითის კოორდინატი, 5 წუთზე მეტით მომავალი
ან 7 დღეზე ძველი დრო (მაგ. 1970 — ტრეკერის გაფუჭებული საათი), ბოლო მიღებულზე არაახალი კოორდინატი და 5 წამში ერთზე მეტი კოორდინატი.

თითოეულ მოწყობილობას თავისი ტოკენი აქვს; სხვა ვერავინ ჩაწერს კოორდინატს მის
ნაცვლად. გაჟონვის შემთხვევაში იმავე ეკრანიდან შეცვლი.

თუ ტრეკერი, რომელსაც ადრე უგზავნია, 30 წუთზე მეტხანს დუმს გაქირავებულ
მანქანაზე აქტიური წითელი ხაზით, შემდეგი შემოწმება ქმნის გაფრთხილებას
„ტრეკერი დადუმდა“, გაქირავების გვერდი კი წითელ ხაზებს „უცნობია“-დ აჩვენებს.

## როგორ შევთავაზოთ ეს სერვისად

პრაქტიკული პაკეტი გაქირავების ბიზნესისთვის:

1. ერთი Traccar VPS, შენს მართვაში, ყველა კლიენტისთვის საერთო.
2. FMC920 დიდი პარტიით, მონტაჟი პარტნიორ ავტოელექტრიკოსთან.
3. თვიური საფასური თითო მანქანაზე — SIM, გეითვეი და Activo ერთად.

კლიენტი Traccar-ს საერთოდ ვერ ხედავს. ის ხედავს თავის მანქანებს, თავის წითელ
ხაზებს და თავის WhatsApp შეტყობინებებს.
