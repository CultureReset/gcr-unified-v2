import { SUBTYPE_TO_CATEGORY } from '../categoryMap'

// Splits the existing 'things-to-do' bucket into rentals vs tours/charters vs
// general attractions — these three read completely differently (Coyote Beach
// Sports is a rental business: pricing-grid-forward, "choose your gear".
// Pure Aloha Adventures is a tour: schedule/booking-forward, "book your
// experience"). Everything else reuses the existing category groupings as-is
// since those are already correct and already used by nav/listing pages.
const RENTAL_SUBTYPES = new Set([
  'bike_rental', 'boat_rental', 'boat_rentals', 'kayak_rental', 'jet_ski',
  'watersports', 'car_rental', 'car-rental', 'rentals', 'marina-and-rentals',
  'jet-ski-rentals-tours',
])
const TOUR_SUBTYPES = new Set([
  'sailing_charter', 'tour_agency', 'tour-operator', 'tour', 'dolphin_cruise',
  'dolphin_tour', 'sunset_cruise', 'glass_bottom_boat', 'wildlife_tour',
  'charter', 'charter_fishing', 'charter-fishing', 'fishing_charter',
  'snorkeling', 'parasailing',
])

// Template bucket -> reference examples, just for our own sanity when building.
//   restaurants      Tacky Jacks, most food/bar entities
//   coffee           coffee shops, bakeries, dessert
//   rentals          Coyote Beach Sports, Amberjack E-Bike Rentals
//   tours-charters   Pure Aloha Adventures, dolphin cruises, fishing charters
//   attractions      museums, arcades, mini golf — things-to-do minus rentals/tours
//   nightlife        bars, breweries, live music venues
//   staying          hotels, condos, vacation rentals
//   wellness         spas, salons, gyms
//   services         photographers, real estate, transportation
//   shopping         retail, boutiques, galleries
//   public-spots     parks, beaches, landmarks

export function resolveTemplate(entity) {
  const subtype = (entity?.entity_subtype || '').toLowerCase()
  const type = (entity?.entity_type || '').toLowerCase()
  const category = SUBTYPE_TO_CATEGORY[subtype] || SUBTYPE_TO_CATEGORY[type]

  if (category === 'things-to-do') {
    if (RENTAL_SUBTYPES.has(subtype) || RENTAL_SUBTYPES.has(type)) return 'rentals'
    if (TOUR_SUBTYPES.has(subtype) || TOUR_SUBTYPES.has(type)) return 'tours-charters'
    return 'attractions'
  }
  return category || 'general'
}
