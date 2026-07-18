export type Locale = "en" | "ka";

export const LOCALES: Locale[] = ["en", "ka"];

const en = {
  appName: "STR Operator Dashboard",
  nav_dashboard: "Dashboard",
  nav_units: "Units",
  nav_calendar: "Calendar",
  nav_analytics: "Analytics",
  nav_alerts: "Alerts",

  onboarding_title: "Welcome",
  onboarding_intro:
    "Set up your operator account to start managing your portfolio.",
  onboarding_submit: "Create account",
  operator_name: "Company / operator name",
  operator_email: "Email",

  units_title: "Units",
  units_add: "Add unit",
  units_empty: "No units yet. Add your first unit to get started.",
  unit_new_title: "New unit",
  unit_edit_title: "Edit unit",

  unit_name: "Name",
  unit_name_ka: "Name (Georgian)",
  unit_city: "City",
  unit_district: "District",
  unit_address: "Address",
  unit_type: "Type",
  unit_capacity: "Capacity (guests)",
  unit_bedrooms: "Bedrooms",
  unit_base_rate: "Base nightly rate",
  unit_currency: "Currency",
  unit_amenities: "Amenities (comma-separated)",
  unit_airbnb_url: "Airbnb listing URL",
  unit_booking_url: "Booking.com listing URL",
  unit_ical_urls: "iCal calendar URLs (one per line)",
  unit_ical_hint:
    "Paste the iCal export URL from each channel (Airbnb: Calendar → Availability → Connect another website; Booking.com: Rates & Availability → Sync calendars).",

  type_apartment: "Apartment",
  type_studio: "Studio",
  type_aparthotel_room: "Aparthotel room",
  type_house: "House",

  bookings: "Bookings",
  leases: "Leases",
  base_rate_short: "Base rate",

  save: "Save",
  cancel: "Cancel",
  edit: "Edit",
  delete: "Delete",
  delete_confirm: "Delete this unit and all its bookings?",

  calendar_all_units: "All units",
  calendar_gaps: "Vacancy gaps",
  calendar_overlaps: "Double bookings",
  calendar_no_gaps: "No vacancy gaps of 2+ nights in this month.",
  calendar_no_overlaps: "No double bookings in this month.",
  calendar_vacant: "Vacant",
  calendar_lease: "Lease",
  calendar_overlap: "Overlap",
  calendar_direct_manual: "Direct / manual",
  nights_short: "nights",

  sync_now: "Sync calendars",
  bookings_add: "Add booking",
  booking_new_title: "New booking",
  booking_unit: "Unit",
  booking_source: "Source",
  source_manual: "Manual",
  source_direct: "Direct",
  booking_guest: "Guest name (optional)",
  booking_check_in: "Check-in",
  booking_check_out: "Check-out",
  booking_amount: "Total amount (optional)",

  error_required: "Please fill in all required fields.",
  error_invalid_number: "Rates, capacity and bedrooms must be valid numbers.",
  error_email_taken: "An operator with this email already exists.",
  error_dates: "Check-out must be after check-in.",
};

const ka: Record<StringKey, string> = {
  appName: "STR ოპერატორის დაფა",
  nav_dashboard: "მთავარი",
  nav_units: "ერთეულები",
  nav_calendar: "კალენდარი",
  nav_analytics: "ანალიტიკა",
  nav_alerts: "გაფრთხილებები",

  onboarding_title: "მოგესალმებით",
  onboarding_intro:
    "შექმენით ოპერატორის ანგარიში პორტფელის მართვის დასაწყებად.",
  onboarding_submit: "ანგარიშის შექმნა",
  operator_name: "კომპანიის / ოპერატორის სახელი",
  operator_email: "ელფოსტა",

  units_title: "ერთეულები",
  units_add: "ერთეულის დამატება",
  units_empty: "ერთეულები ჯერ არ არის. დაამატეთ პირველი ერთეული დასაწყებად.",
  unit_new_title: "ახალი ერთეული",
  unit_edit_title: "ერთეულის რედაქტირება",

  unit_name: "სახელი",
  unit_name_ka: "სახელი (ქართულად)",
  unit_city: "ქალაქი",
  unit_district: "უბანი",
  unit_address: "მისამართი",
  unit_type: "ტიპი",
  unit_capacity: "ტევადობა (სტუმრები)",
  unit_bedrooms: "საძინებლები",
  unit_base_rate: "საბაზო ღამის ტარიფი",
  unit_currency: "ვალუტა",
  unit_amenities: "კეთილმოწყობა (მძიმით გამოყოფილი)",
  unit_airbnb_url: "Airbnb განცხადების ბმული",
  unit_booking_url: "Booking.com განცხადების ბმული",
  unit_ical_urls: "iCal კალენდრის ბმულები (თითო ხაზზე)",
  unit_ical_hint:
    "ჩასვით iCal ექსპორტის ბმული თითოეული არხიდან (Airbnb: Calendar → Availability → Connect another website; Booking.com: Rates & Availability → Sync calendars).",

  type_apartment: "ბინა",
  type_studio: "სტუდია",
  type_aparthotel_room: "აპარტოტელის ნომერი",
  type_house: "სახლი",

  bookings: "ჯავშნები",
  leases: "იჯარები",
  base_rate_short: "საბაზო ტარიფი",

  save: "შენახვა",
  cancel: "გაუქმება",
  edit: "რედაქტირება",
  delete: "წაშლა",
  delete_confirm: "წაიშალოს ეს ერთეული და მისი ყველა ჯავშანი?",

  calendar_all_units: "ყველა ერთეული",
  calendar_gaps: "თავისუფალი ფანჯრები",
  calendar_overlaps: "ორმაგი ჯავშნები",
  calendar_no_gaps: "ამ თვეში 2+ ღამიანი თავისუფალი ფანჯარა არ არის.",
  calendar_no_overlaps: "ამ თვეში ორმაგი ჯავშანი არ არის.",
  calendar_vacant: "თავისუფალი",
  calendar_lease: "იჯარა",
  calendar_overlap: "გადაფარვა",
  calendar_direct_manual: "პირდაპირი / ხელით",
  nights_short: "ღამე",

  sync_now: "კალენდრების სინქრონიზაცია",
  bookings_add: "ჯავშნის დამატება",
  booking_new_title: "ახალი ჯავშანი",
  booking_unit: "ერთეული",
  booking_source: "წყარო",
  source_manual: "ხელით",
  source_direct: "პირდაპირი",
  booking_guest: "სტუმრის სახელი (არასავალდებულო)",
  booking_check_in: "შესვლა",
  booking_check_out: "გასვლა",
  booking_amount: "სრული თანხა (არასავალდებულო)",

  error_required: "გთხოვთ, შეავსოთ ყველა სავალდებულო ველი.",
  error_invalid_number:
    "ტარიფი, ტევადობა და საძინებლების რაოდენობა უნდა იყოს რიცხვები.",
  error_email_taken: "ოპერატორი ამ ელფოსტით უკვე არსებობს.",
  error_dates: "გასვლის თარიღი შესვლის თარიღის შემდეგ უნდა იყოს.",
};

export type StringKey = keyof typeof en;

const dictionaries: Record<Locale, Record<StringKey, string>> = { en, ka };

export function t(locale: Locale, key: StringKey): string {
  return dictionaries[locale][key] ?? en[key] ?? key;
}
