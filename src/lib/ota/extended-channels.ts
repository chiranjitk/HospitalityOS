/**
 * Extended OTA Channel Configurations
 * 200+ channel definitions for StaySuite Channel Manager
 * Covers global OTAs, regional OTAs, vacation rentals, hostels, metasearch, GDS, wholesalers, bedbanks, tour operators, and corporate channels
 */

export interface ExtendedChannelConfig {
  id: string;
  name: string;
  category: 'ota_global' | 'ota_regional' | 'ota_niche' | 'vacation_rental' | 'hostel' | 'metasearch' | 'gds' | 'wholesaler' | 'tour_operator' | 'corporate' | 'bedbank';
  region: 'global' | 'north_america' | 'europe' | 'asia_pacific' | 'middle_east' | 'africa' | 'latin_america' | 'south_asia' | 'southeast_asia' | 'east_asia';
  website: string;
  apiType: 'xml' | 'rest' | 'soap' | 'channel_manager';
  commissionPercent: number;
  features: {
    instantBooking: boolean;
    modifyReservation: boolean;
    cancelReservation: boolean;
    contentSync: boolean;
    messaging: boolean;
    reviewManagement: boolean;
  };
  status: 'active' | 'coming_soon' | 'beta';
}

// Helper to reduce repetition
function channel(
  id: string,
  name: string,
  category: ExtendedChannelConfig['category'],
  region: ExtendedChannelConfig['region'],
  website: string,
  overrides: Partial<ExtendedChannelConfig>
): ExtendedChannelConfig {
  return {
    id,
    name,
    category,
    region,
    website,
    apiType: 'rest',
    commissionPercent: 15,
    features: {
      instantBooking: true,
      modifyReservation: true,
      cancelReservation: true,
      contentSync: true,
      messaging: false,
      reviewManagement: false,
    },
    status: 'active',
    ...overrides,
  };
}

// ============================================
// GLOBAL OTAs (20)
// ============================================

const GLOBAL_OTAS: ExtendedChannelConfig[] = [
  channel('booking_com', 'Booking.com', 'ota_global', 'global', 'https://www.booking.com', {
    apiType: 'xml', commissionPercent: 17,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('expedia', 'Expedia', 'ota_global', 'global', 'https://www.expedia.com', {
    apiType: 'rest', commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('airbnb', 'Airbnb', 'ota_global', 'global', 'https://www.airbnb.com', {
    category: 'vacation_rental', commissionPercent: 3,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('agoda', 'Agoda', 'ota_global', 'global', 'https://www.agoda.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('hotels_com', 'Hotels.com', 'ota_global', 'global', 'https://www.hotels.com', {
    commissionPercent: 17,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('priceline', 'Priceline', 'ota_global', 'north_america', 'https://www.priceline.com', {
    commissionPercent: 20,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('orbitz', 'Orbitz', 'ota_global', 'north_america', 'https://www.orbitz.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('travelocity', 'Travelocity', 'ota_global', 'north_america', 'https://www.travelocity.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('hotwire', 'Hotwire', 'ota_global', 'north_america', 'https://www.hotwire.com', {
    commissionPercent: 22,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('wotif', 'Wotif', 'ota_global', 'asia_pacific', 'https://www.wotif.com', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('trip_com', 'Trip.com', 'ota_global', 'global', 'https://www.trip.com', {
    commissionPercent: 14,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('ctrip', 'Ctrip', 'ota_global', 'east_asia', 'https://www.ctrip.com', {
    commissionPercent: 14,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('makemytrip', 'MakeMyTrip', 'ota_global', 'south_asia', 'https://www.makemytrip.com', {
    commissionPercent: 20,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('goibibo', 'Goibibo', 'ota_global', 'south_asia', 'https://www.goibibo.com', {
    commissionPercent: 16,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('oyo', 'OYO', 'ota_global', 'global', 'https://www.oyorooms.com', {
    commissionPercent: 22,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('trivago', 'Trivago', 'metasearch', 'global', 'https://www.trivago.com', {
    commissionPercent: 0,
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('hotelscombined', 'HotelsCombined', 'metasearch', 'global', 'https://www.hotelscombined.com', {
    commissionPercent: 0,
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('kayak_hotels', 'Kayak Hotels', 'metasearch', 'global', 'https://www.kayak.com', {
    commissionPercent: 0,
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('google_hotels', 'Google Hotels', 'metasearch', 'global', 'https://www.google.com/travel/hotels', {
    apiType: 'channel_manager', commissionPercent: 0,
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('tripadvisor', 'TripAdvisor', 'ota_global', 'global', 'https://www.tripadvisor.com', {
    commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('vrbo', 'Vrbo', 'vacation_rental', 'global', 'https://www.vrbo.com', {
    commissionPercent: 8,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
];

// ============================================
// EUROPEAN OTAs (30)
// ============================================

const EUROPEAN_OTAS: ExtendedChannelConfig[] = [
  channel('hrs', 'HRS', 'ota_regional', 'europe', 'https://www.hrs.com', {
    commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('hotel_de', 'Hotel.de', 'ota_regional', 'europe', 'https://www.hotel.de', {
    commissionPercent: 14,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('tiscover', 'Tiscover', 'ota_regional', 'europe', 'https://www.tiscover.com', {
    commissionPercent: 12, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('swoodoo', 'Swoodoo', 'ota_regional', 'europe', 'https://www.swoodoo.com', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('opodo', 'Opodo', 'ota_regional', 'europe', 'https://www.opodo.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('edreams', 'eDreams', 'ota_regional', 'europe', 'https://www.edreams.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('logitravel', 'Logitravel', 'ota_regional', 'europe', 'https://www.logitravel.com', {
    commissionPercent: 16,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('lastminute', 'Lastminute.com', 'ota_regional', 'europe', 'https://www.lastminute.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('supertravel', 'Supertravel', 'ota_regional', 'europe', 'https://www.supertravel.co.uk', {
    commissionPercent: 15, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: false, messaging: false, reviewManagement: false },
  }),
  channel('destinia', 'Destinia', 'ota_regional', 'europe', 'https://www.destinia.com', {
    commissionPercent: 16,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('logis_hotels', 'Logis Hotels', 'ota_regional', 'europe', 'https://www.logishotels.com', {
    commissionPercent: 10, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('relais_chateaux', 'Relais & Chateaux', 'ota_niche', 'europe', 'https://www.relaischateaux.com', {
    commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('bestwestern_europe', 'Best Western Europe', 'corporate', 'europe', 'https://www.bestwestern.com', {
    category: 'corporate', commissionPercent: 8,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('bb_hotels', 'B&B Hotels', 'corporate', 'europe', 'https://www.bbhotels.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('accor', 'Accor', 'corporate', 'europe', 'https://www.accor.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('nh_hotels', 'NH Hotels', 'corporate', 'europe', 'https://www.nh-hotels.com', {
    commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('melia', 'Melia Hotels', 'corporate', 'europe', 'https://www.melia.com', {
    commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('riu', 'RIU Hotels', 'corporate', 'europe', 'https://www.riu.com', {
    commissionPercent: 14,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('iberostar', 'Iberostar', 'corporate', 'europe', 'https://www.iberostar.com', {
    commissionPercent: 14,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('barcelo', 'Barcelo Hotels', 'corporate', 'europe', 'https://www.barcelo.com', {
    commissionPercent: 14,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('eurostars', 'Eurostars Hotels', 'corporate', 'europe', 'https://www.eurostarshotels.com', {
    commissionPercent: 12, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('novotel', 'Novotel', 'corporate', 'europe', 'https://www.novotel.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('mercure', 'Mercure', 'corporate', 'europe', 'https://www.mercure.com', {
    commissionPercent: 10, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('adagio', 'Adagio', 'vacation_rental', 'europe', 'https://www.adagio-city.com', {
    commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('citadines', 'Citadines', 'vacation_rental', 'europe', 'https://www.citadines.com', {
    commissionPercent: 12, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('holidaycheck', 'HolidayCheck', 'ota_regional', 'europe', 'https://www.holidaycheck.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('alpharooms', 'AlphaRooms', 'ota_regional', 'europe', 'https://www.alpharooms.com', {
    commissionPercent: 16,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('booking_eu', 'Booking.com EU (variant)', 'ota_global', 'europe', 'https://www.booking.com', {
    apiType: 'xml', commissionPercent: 17, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('tui_eu', 'TUI UK & IE', 'tour_operator', 'europe', 'https://www.tui.co.uk', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('travelodge_uk', 'Travelodge UK', 'corporate', 'europe', 'https://www.travelodge.co.uk', {
    commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('premier_inn', 'Premier Inn', 'corporate', 'europe', 'https://www.premierinn.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
];

// ============================================
// ASIA-PACIFIC OTAs (40)
// ============================================

const ASIA_PACIFIC_OTAS: ExtendedChannelConfig[] = [
  channel('traveloka', 'Traveloka', 'ota_regional', 'southeast_asia', 'https://www.traveloka.com', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('tiket_com', 'Tiket.com', 'ota_regional', 'southeast_asia', 'https://www.tiket.com', {
    commissionPercent: 14,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('pegipegi', 'PegiPegi', 'ota_regional', 'southeast_asia', 'https://www.pegipegi.com', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('nusatrip', 'NusaTrip', 'ota_regional', 'southeast_asia', 'https://www.nusatrip.com', {
    commissionPercent: 12, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('zenrooms', 'ZenRooms', 'ota_regional', 'southeast_asia', 'https://www.zenrooms.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('redoorz', 'RedDoorz', 'ota_regional', 'southeast_asia', 'https://www.reddoorz.com', {
    commissionPercent: 20,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('treebo', 'Treebo', 'ota_regional', 'south_asia', 'https://www.treebo.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('fabhotels', 'FabHotels', 'ota_regional', 'south_asia', 'https://www.fabhotels.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('yatra', 'Yatra', 'ota_regional', 'south_asia', 'https://www.yatra.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('easemytrip', 'EaseMyTrip', 'ota_regional', 'south_asia', 'https://www.easemytrip.com', {
    commissionPercent: 14,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('cleartrip', 'Cleartrip', 'ota_regional', 'south_asia', 'https://www.cleartrip.com', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('oyo_sea', 'OYO Southeast Asia', 'ota_regional', 'southeast_asia', 'https://www.oyorooms.com', {
    commissionPercent: 22,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('klook', 'Klook', 'ota_niche', 'east_asia', 'https://www.klook.com', {
    commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('kkday', 'KKday', 'ota_niche', 'east_asia', 'https://www.kkday.com', {
    commissionPercent: 12, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('agoda_sea', 'Agoda Southeast Asia', 'ota_global', 'southeast_asia', 'https://www.agoda.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('hotelscombined_ap', 'HotelsCombined Asia Pacific', 'metasearch', 'asia_pacific', 'https://www.hotelscombined.com', {
    commissionPercent: 0,
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('rakuten_travel', 'Rakuten Travel', 'ota_regional', 'east_asia', 'https://travel.rakuten.co.jp', {
    commissionPercent: 14,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('jalan_net', 'Jalan.net', 'ota_regional', 'east_asia', 'https://www.jalan.net', {
    commissionPercent: 13,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('booking_japan', 'Booking.com Japan', 'ota_global', 'east_asia', 'https://www.booking.com', {
    apiType: 'xml', commissionPercent: 17,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('japanican', 'Japanican', 'ota_regional', 'east_asia', 'https://www.japanican.com', {
    commissionPercent: 12, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('elong', 'eLong', 'ota_regional', 'east_asia', 'https://www.elong.com', {
    commissionPercent: 14, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('qunar', 'Qunar', 'ota_regional', 'east_asia', 'https://www.qunar.com', {
    commissionPercent: 14, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('fliggy', 'Fliggy', 'ota_regional', 'east_asia', 'https://www.fliggy.com', {
    commissionPercent: 12, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('ly_com', 'Ly.com', 'ota_regional', 'east_asia', 'https://www.ly.com', {
    commissionPercent: 14, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('traveloka_tw', 'Traveloka Taiwan', 'ota_regional', 'east_asia', 'https://www.traveloka.com', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('agoda_korea', 'Agoda Korea', 'ota_global', 'east_asia', 'https://www.agoda.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('yanolja', 'Yanolja', 'ota_regional', 'east_asia', 'https://www.yanolja.com', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('myrealtrip', 'MyRealTrip', 'ota_regional', 'east_asia', 'https://www.myrealtrip.com', {
    commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('goodchoice', 'GoodChoice', 'ota_regional', 'east_asia', 'https://www.goodchoice.co.kr', {
    commissionPercent: 13, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('hotel_91', 'Hotel91', 'ota_regional', 'east_asia', 'https://www.hotel91.com', {
    commissionPercent: 15, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('roov', 'Roov', 'ota_regional', 'east_asia', 'https://www.roov.co.kr', {
    commissionPercent: 14, status: 'coming_soon',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('everyday_hero', 'Everyday Hero', 'ota_regional', 'east_asia', 'https://www.heroes.co.kr', {
    commissionPercent: 12, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('lvmama', 'Lvmama', 'ota_regional', 'east_asia', 'https://www.lvmama.com', {
    commissionPercent: 12, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('tuniu', 'Tuniu', 'ota_regional', 'east_asia', 'https://www.tuniu.com', {
    commissionPercent: 14, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('hotelscombined_india', 'HotelsCombined India', 'metasearch', 'south_asia', 'https://www.hotelscombined.com', {
    commissionPercent: 0,
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('ixigo', 'Ixigo', 'ota_regional', 'south_asia', 'https://www.ixigo.com', {
    commissionPercent: 14,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('travelguru', 'TravelGuru', 'ota_regional', 'south_asia', 'https://www.travelguru.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('oyo_india', 'OYO India', 'ota_regional', 'south_asia', 'https://www.oyorooms.com', {
    commissionPercent: 22,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('stayzilla', 'StayZilla', 'ota_regional', 'south_asia', 'https://www.stayzilla.com', {
    commissionPercent: 15, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
];

// ============================================
// AMERICAS OTAs (25)
// ============================================

const AMERICAS_OTAS: ExtendedChannelConfig[] = [
  channel('hilton', 'Hilton', 'corporate', 'north_america', 'https://www.hilton.com', {
    commissionPercent: 8,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('marriott', 'Marriott', 'corporate', 'north_america', 'https://www.marriott.com', {
    commissionPercent: 8,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('ihg', 'IHG Hotels', 'corporate', 'north_america', 'https://www.ihg.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('wyndham', 'Wyndham Hotels', 'corporate', 'north_america', 'https://www.wyndhamhotels.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('choice_hotels', 'Choice Hotels', 'corporate', 'north_america', 'https://www.choicehotels.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('hyatt', 'Hyatt', 'corporate', 'north_america', 'https://www.hyatt.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('bestwestern_na', 'Best Western North America', 'corporate', 'north_america', 'https://www.bestwestern.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('accor_americas', 'Accor Americas', 'corporate', 'north_america', 'https://www.accor.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('homeaway_na', 'HomeAway', 'vacation_rental', 'north_america', 'https://www.homeaway.com', {
    commissionPercent: 8,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('vacasa', 'Vacasa', 'vacation_rental', 'north_america', 'https://www.vacasa.com', {
    commissionPercent: 25,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('turnkey', 'TurnKey', 'vacation_rental', 'north_america', 'https://www.turnkey.com', {
    commissionPercent: 15, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('sonder', 'Sonder', 'vacation_rental', 'north_america', 'https://www.sonder.com', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('despegar', 'Despegar', 'ota_regional', 'latin_america', 'https://www.despegar.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('viajes_falabella', 'Viajes Falabella', 'ota_regional', 'latin_america', 'https://www.viajesfalabella.com', {
    commissionPercent: 16,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('booking_latam', 'Booking.com LATAM', 'ota_global', 'latin_america', 'https://www.booking.com', {
    apiType: 'xml', commissionPercent: 17,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('priceline_na', 'Priceline North America', 'ota_global', 'north_america', 'https://www.priceline.com', {
    commissionPercent: 20,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('orbitz_na', 'Orbitz North America', 'ota_global', 'north_america', 'https://www.orbitz.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('travelocity_na', 'Travelocity North America', 'ota_global', 'north_america', 'https://www.travelocity.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('hotwire_na', 'Hotwire North America', 'ota_global', 'north_america', 'https://www.hotwire.com', {
    commissionPercent: 22,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('cheapflights', 'CheapFlights', 'metasearch', 'north_america', 'https://www.cheapflights.com', {
    commissionPercent: 0,
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('momondo', 'Momondo', 'metasearch', 'north_america', 'https://www.momondo.com', {
    commissionPercent: 0,
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('trivago_na', 'Trivago North America', 'metasearch', 'north_america', 'https://www.trivago.com', {
    commissionPercent: 0,
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('expedia_stays', 'Expedia Stays', 'vacation_rental', 'north_america', 'https://www.expedia.com', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('booking_homes', 'Booking.com Homes & Villas', 'vacation_rental', 'global', 'https://www.booking.com', {
    apiType: 'xml', commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('cvc_brasil', 'CVC Brasil', 'tour_operator', 'latin_america', 'https://www.cvc.com.br', {
    commissionPercent: 18, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
];

// ============================================
// VACATION RENTAL / SHORT-TERM RENTAL (25)
// ============================================

const VACATION_RENTAL: ExtendedChannelConfig[] = [
  channel('tripadvisor_rentals', 'TripAdvisor Vacation Rentals', 'vacation_rental', 'global', 'https://www.tripadvisor.com', {
    commissionPercent: 8,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('avantstay', 'AvantStay', 'vacation_rental', 'north_america', 'https://www.avantstay.com', {
    commissionPercent: 20,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('casai', 'Casai', 'vacation_rental', 'latin_america', 'https://www.casai.com', {
    commissionPercent: 18, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('kasa', 'Kasa', 'vacation_rental', 'north_america', 'https://www.kasa.com', {
    commissionPercent: 20,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('lyric', 'Lyric', 'vacation_rental', 'north_america', 'https://www.lyric.com', {
    commissionPercent: 18, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('whyhotel', 'WhyHotel', 'vacation_rental', 'north_america', 'https://www.whyhotel.com', {
    commissionPercent: 20, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('mint_house', 'Mint House', 'vacation_rental', 'north_america', 'https://www.minthouse.com', {
    commissionPercent: 18, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('zeus_living', 'Zeus Living', 'vacation_rental', 'north_america', 'https://www.zeusliving.com', {
    commissionPercent: 20,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('blueground', 'Blueground', 'vacation_rental', 'global', 'https://www.theblueground.com', {
    commissionPercent: 20,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('selina', 'Selina', 'vacation_rental', 'global', 'https://www.selina.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('plugandplay', 'Sonder (Plug and Play)', 'vacation_rental', 'north_america', 'https://www.sonder.com', {
    commissionPercent: 15, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('corporate_housing', 'Corporate Housing By Owner', 'vacation_rental', 'north_america', 'https://www.corporatehousingbyowner.com', {
    commissionPercent: 8,
    features: { instantBooking: false, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('furnished_quarters', 'Furnished Quarters', 'vacation_rental', 'north_america', 'https://www.furnishedquarters.com', {
    commissionPercent: 12, status: 'beta',
    features: { instantBooking: false, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('aka_stays', 'AKA Extended Stay', 'vacation_rental', 'north_america', 'https://www.akastays.com', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('extended_stay_america', 'Extended Stay America', 'vacation_rental', 'north_america', 'https://www.extendedstayamerica.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('reserva', 'Reserva', 'vacation_rental', 'latin_america', 'https://www.reserva.com', {
    commissionPercent: 15, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('flipkey', 'FlipKey by TripAdvisor', 'vacation_rental', 'global', 'https://www.flipkey.com', {
    commissionPercent: 5,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('housetrip', 'HouseTrip', 'vacation_rental', 'europe', 'https://www.housetrip.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('stayz_au', 'Stayz Australia', 'vacation_rental', 'asia_pacific', 'https://www.stayz.com.au', {
    commissionPercent: 8,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('bookabach_nz', 'Bookabach New Zealand', 'vacation_rental', 'asia_pacific', 'https://www.bookabach.co.nz', {
    commissionPercent: 8,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('plum_guide', 'Plum Guide', 'vacation_rental', 'global', 'https://www.plumguide.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('inntopia_rentals', 'Inntopia Rentals', 'vacation_rental', 'north_america', 'https://www.inntopia.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('viator_stays', 'Viator Stays', 'vacation_rental', 'global', 'https://www.viator.com', {
    commissionPercent: 20, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('hopper_homes', 'Hopper Homes', 'vacation_rental', 'north_america', 'https://www.hopper.com', {
    commissionPercent: 12, status: 'coming_soon',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('beyond_stays', 'Beyond Stays', 'vacation_rental', 'europe', 'https://www.beyondstays.com', {
    commissionPercent: 15, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
];

// ============================================
// HOSTEL & BUDGET (15)
// ============================================

const HOSTEL_BUDGET: ExtendedChannelConfig[] = [
  channel('hostelworld', 'Hostelworld', 'hostel', 'global', 'https://www.hostelworld.com', {
    commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('hostelbookers', 'Hostelbookers', 'hostel', 'global', 'https://www.hostelbookers.com', {
    commissionPercent: 10, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('booking_hostels', 'Booking.com Hostels', 'hostel', 'global', 'https://www.booking.com', {
    apiType: 'xml', commissionPercent: 17,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('agoda_hostels', 'Agoda Hostels', 'hostel', 'southeast_asia', 'https://www.agoda.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('expedia_hostels', 'Expedia Hostels', 'hostel', 'global', 'https://www.expedia.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('gomio', 'Gomio', 'hostel', 'europe', 'https://www.gomio.com', {
    commissionPercent: 10, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('youthhostels', 'YouthHostels.com', 'hostel', 'europe', 'https://www.youthhostels.com', {
    commissionPercent: 8, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('hi_hostels', 'HI Hostels', 'hostel', 'global', 'https://www.hihostels.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('backpacker_com', 'Backpacker.com', 'hostel', 'global', 'https://www.backpacker.com', {
    commissionPercent: 8, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('hostels_com', 'Hostels.com', 'hostel', 'global', 'https://www.hostels.com', {
    commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('ostellionline', 'OstelliOnline', 'hostel', 'europe', 'https://www.ostellionline.com', {
    commissionPercent: 8, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('backpacker_network', 'Backpacker Network', 'hostel', 'europe', 'https://www.backpackernetwork.com', {
    commissionPercent: 8, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: false, messaging: false, reviewManagement: false },
  }),
  channel('hostelz', 'Hostelz.com', 'hostel', 'global', 'https://www.hostelz.com', {
    commissionPercent: 8, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('omio_stays', 'Omio Stays', 'hostel', 'europe', 'https://www.omio.com', {
    commissionPercent: 10, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('capsule_hotels_jp', 'Japan Capsule Hotel Network', 'hostel', 'east_asia', 'https://www.capsule-inn.com', {
    commissionPercent: 15, status: 'coming_soon',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
];

// ============================================
// METASEARCH (10)
// ============================================

const METASEARCH: ExtendedChannelConfig[] = [
  channel('skyscanner_hotels', 'Skyscanner Hotels', 'metasearch', 'global', 'https://www.skyscanner.com', {
    commissionPercent: 0,
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('wego_hotels', 'Wego Hotels', 'metasearch', 'middle_east', 'https://www.wego.com', {
    commissionPercent: 0,
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('waylo', 'Waylo', 'metasearch', 'global', 'https://www.waylo.com', {
    commissionPercent: 0, status: 'beta',
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('dohop_hotels', 'Dohop Hotels', 'metasearch', 'europe', 'https://www.dohop.com', {
    commissionPercent: 0, status: 'beta',
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('tripadvisor_hotels', 'TripAdvisor Hotels', 'metasearch', 'global', 'https://www.tripadvisor.com', {
    commissionPercent: 5,
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('google_hotels_meta', 'Google Hotel Search', 'metasearch', 'global', 'https://www.google.com/travel/hotels', {
    apiType: 'channel_manager', commissionPercent: 0,
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('hotel_delights', 'Hotel Delights', 'metasearch', 'europe', 'https://www.hoteldelights.co.uk', {
    commissionPercent: 0, status: 'beta',
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('bing_travel', 'Bing Travel Hotels', 'metasearch', 'north_america', 'https://www.bing.com/travel', {
    commissionPercent: 0, status: 'coming_soon',
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('swoodoo_meta', 'Swoodoo Hotels', 'metasearch', 'europe', 'https://www.swoodoo.com', {
    commissionPercent: 0,
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('trip_hunter', 'TripHunter', 'metasearch', 'europe', 'https://www.triphunter.com', {
    commissionPercent: 0, status: 'beta',
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
];

// ============================================
// WHOLESALERS / BEDBANKS (15)
// ============================================

const WHOLESALERS_BEDBANKS: ExtendedChannelConfig[] = [
  channel('hotelbeds', 'Hotelbeds', 'bedbank', 'global', 'https://www.hotelbeds.com', {
    commissionPercent: 20,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('gta_travel', 'GTA Travel', 'bedbank', 'global', 'https://www.gtatravel.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('webbeds', 'WebBeds', 'bedbank', 'global', 'https://www.webbeds.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('tourico_holidays', 'Tourico Holidays', 'wholesaler', 'global', 'https://www.tourico.com', {
    commissionPercent: 20,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('expedia_partner_solutions', 'Expedia Partner Solutions', 'wholesaler', 'global', 'https://www.expediapartnersolutions.com', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('bookingsuite', 'BookingSuite', 'wholesaler', 'global', 'https://www.bookingsuite.com', {
    commissionPercent: 16, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('travco', 'Travco', 'wholesaler', 'middle_east', 'https://www.travco.com', {
    commissionPercent: 20,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('jtb_tourism', 'JTB Tourism', 'wholesaler', 'east_asia', 'https://www.jtb.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('mint_bedbank', 'MiNT', 'bedbank', 'europe', 'https://www.mint-soft.com', {
    commissionPercent: 15, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('gullivers_travel', 'Gullivers Travel', 'wholesaler', 'europe', 'https://www.gulliverstravel.com', {
    commissionPercent: 16, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: false, messaging: false, reviewManagement: false },
  }),
  channel('asian_trails', 'Asian Trails', 'wholesaler', 'southeast_asia', 'https://www.asiantrails.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('pacific_world', 'Pacific World', 'wholesaler', 'asia_pacific', 'https://www.pacificworld.com', {
    commissionPercent: 18, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('miki_travel', 'Miki Travel', 'wholesaler', 'europe', 'https://www.mikitravel.co.uk', {
    commissionPercent: 16,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('kuoni', 'Kuoni', 'wholesaler', 'europe', 'https://www.kuoni.com', {
    commissionPercent: 16,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('diethelm_travel', 'Diethelm Travel', 'wholesaler', 'southeast_asia', 'https://www.diethelmtravel.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
];

// ============================================
// GDS (4)
// ============================================

const GDS_CHANNELS: ExtendedChannelConfig[] = [
  channel('amadeus', 'Amadeus', 'gds', 'global', 'https://www.amadeus.com', {
    apiType: 'soap', commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('sabre', 'Sabre', 'gds', 'global', 'https://www.sabre.com', {
    apiType: 'soap', commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('travelport_galileo', 'Travelport Galileo', 'gds', 'global', 'https://www.travelport.com', {
    apiType: 'soap', commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('pegasus', 'Pegasus Solutions', 'gds', 'global', 'https://www.pegs.com', {
    apiType: 'soap', commissionPercent: 10, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
];

// ============================================
// TOUR OPERATORS / CORPORATE (30)
// ============================================

const TOUR_OPERATORS_CORPORATE: ExtendedChannelConfig[] = [
  channel('tui_de', 'TUI Deutschland', 'tour_operator', 'europe', 'https://www.tui.de', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('der_touristik', 'DER Touristik', 'tour_operator', 'europe', 'https://www.der.com', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('dertour', 'DERTOUR', 'tour_operator', 'europe', 'https://www.dertour.de', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('fti_touristik', 'FTI Touristik', 'tour_operator', 'europe', 'https://www.fti.de', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('schauinsland', 'Schauinsland-Reisen', 'tour_operator', 'europe', 'https://www.schauinsland.com', {
    commissionPercent: 16,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('alltours', 'Alltours', 'tour_operator', 'europe', 'https://www.alltours.de', {
    commissionPercent: 16, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('billa_reisen', 'Billa Reisen', 'tour_operator', 'europe', 'https://www.billa-reisen.at', {
    commissionPercent: 14, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: false, messaging: false, reviewManagement: false },
  }),
  channel('its_reisen', 'ITS Reisen', 'tour_operator', 'europe', 'https://www.its.de', {
    commissionPercent: 16, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('sunrise_tours', 'Sunrise Tours', 'tour_operator', 'europe', 'https://www.sunrise-tours.de', {
    commissionPercent: 16, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('jtb_corp', 'JTB Corporation', 'tour_operator', 'east_asia', 'https://www.jtb.co.jp', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('his_japan', 'H.I.S.', 'tour_operator', 'east_asia', 'https://www.his-j.com', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('knt_ct', 'KNT-CT', 'tour_operator', 'east_asia', 'https://www.knt-ct.co.jp', {
    commissionPercent: 14, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('kinki_nippon', 'Kinki Nippon Tourist', 'tour_operator', 'east_asia', 'https://www.knt.co.jp', {
    commissionPercent: 14, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('hankyu_travel', 'Hankyu Travel', 'tour_operator', 'east_asia', 'https://www.hankyu-travel.com', {
    commissionPercent: 14, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('thomas_cook', 'Thomas Cook', 'tour_operator', 'europe', 'https://www.thomascook.com', {
    commissionPercent: 18, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('jet2holidays', 'Jet2holidays', 'tour_operator', 'europe', 'https://www.jet2holidays.com', {
    commissionPercent: 16,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('on_the_beach', 'On the Beach', 'tour_operator', 'europe', 'https://www.onthebeach.co.uk', {
    commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('loveholidays', 'Loveholidays', 'tour_operator', 'europe', 'https://www.loveholidays.com', {
    commissionPercent: 16,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('british_airways_holidays', 'British Airways Holidays', 'tour_operator', 'europe', 'https://www.britishairways.com/holidays', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('costa_cruises', 'Costa Cruises', 'tour_operator', 'europe', 'https://www.costacruise.com', {
    commissionPercent: 14, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('msc_cruises', 'MSC Cruises', 'tour_operator', 'europe', 'https://www.msccruises.com', {
    commissionPercent: 14, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('携程_holiday', 'Ctrip Holidays', 'tour_operator', 'east_asia', 'https://vacations.ctrip.com', {
    commissionPercent: 14, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('g adventures', 'G Adventures', 'tour_operator', 'global', 'https://www.gadventures.com', {
    commissionPercent: 15, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('intrepid_travel', 'Intrepid Travel', 'tour_operator', 'global', 'https://www.intrepidtravel.com', {
    commissionPercent: 15, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: true },
  }),
  channel('contiki', 'Contiki', 'tour_operator', 'global', 'https://www.contiki.com', {
    commissionPercent: 16, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('ef_holidays', 'EF Go Ahead Tours', 'tour_operator', 'global', 'https://www.goaheadtours.com', {
    commissionPercent: 18, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('omega_world', 'Omega World Travel', 'corporate', 'north_america', 'https://www.omega-travel.com', {
    commissionPercent: 10, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('bcd_travel', 'BCD Travel', 'corporate', 'global', 'https://www.bcdtravel.com', {
    commissionPercent: 8,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('ctp_travel', 'CTP Travel (Corporate Travel Partner)', 'corporate', 'global', 'https://www.ctptravel.com', {
    commissionPercent: 8, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('egencia', 'Egencia', 'corporate', 'global', 'https://www.egencia.com', {
    commissionPercent: 8,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('fcm_travel', 'FCM Travel', 'corporate', 'global', 'https://www.fcmtravel.com', {
    commissionPercent: 8,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
];

// ============================================
// MIDDLE EAST & AFRICA (12)
// ============================================

const MIDDLE_EAST_AFRICA: ExtendedChannelConfig[] = [
  channel('musafir', 'Musafir', 'ota_regional', 'middle_east', 'https://www.musafir.com', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('jumia_travel', 'Jumia Travel', 'ota_regional', 'africa', 'https://travel.jumia.com', {
    commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('rehlat', 'Rehlat', 'ota_regional', 'middle_east', 'https://www.rehlat.com', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('almosafer', 'Almosafer', 'ota_regional', 'middle_east', 'https://www.almosafer.com', {
    commissionPercent: 14,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('tajawal', 'Tajawal', 'ota_regional', 'middle_east', 'https://www.tajawal.com', {
    commissionPercent: 14,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('cleartrip_me', 'Cleartrip Middle East', 'ota_regional', 'middle_east', 'https://www.cleartrip.com', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('safarak', 'Safarak', 'vacation_rental', 'middle_east', 'https://www.safarak.com', {
    commissionPercent: 18, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('hotel_maldives', 'Hotel Maldives', 'ota_regional', 'asia_pacific', 'https://www.hotelmaldives.com', {
    commissionPercent: 16, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('hello_weekend', 'Hello Weekend', 'ota_regional', 'middle_east', 'https://www.helloweekend.com', {
    commissionPercent: 15, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('travel_start', 'Travelstart', 'ota_regional', 'africa', 'https://www.travelstart.com', {
    commissionPercent: 14,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('jovago', 'Jovago', 'ota_regional', 'africa', 'https://www.jovago.com', {
    commissionPercent: 12, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('lamitour', 'Lamitour', 'ota_regional', 'middle_east', 'https://www.lamitour.com', {
    commissionPercent: 15, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
];

// ============================================
// ADDITIONAL NICHE & EMERGING (20)
// ============================================

const NICHE_EMERGING: ExtendedChannelConfig[] = [
  channel('getyourguide', 'GetYourGuide', 'ota_niche', 'global', 'https://www.getyourguide.com', {
    commissionPercent: 20,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('viator', 'Viator', 'ota_niche', 'global', 'https://www.viator.com', {
    commissionPercent: 20,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('booking_activities', 'Booking.com Activities', 'ota_niche', 'global', 'https://www.booking.com', {
    apiType: 'xml', commissionPercent: 18,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('headout', 'Headout', 'ota_niche', 'global', 'https://www.headout.com', {
    commissionPercent: 18, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('klook_hk', 'Klook Hong Kong', 'ota_niche', 'east_asia', 'https://www.klook.com', {
    commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('beachcomber', 'Beachcomber Hotels', 'corporate', 'africa', 'https://www.beachcomber-hotels.com', {
    commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('onefinestay', 'Onefinestay', 'vacation_rental', 'europe', 'https://www.onefinestay.com', {
    commissionPercent: 20,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('citizenm', 'citizenM Hotels', 'corporate', 'global', 'https://www.citizenm.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: true, reviewManagement: false },
  }),
  channel('moxy_hotels', 'Moxy Hotels', 'corporate', 'global', 'https://www.moxyhotels.com', {
    commissionPercent: 10,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('21c_museum', '21c Museum Hotels', 'corporate', 'north_america', 'https://www.21cmuseumhotels.com', {
    commissionPercent: 10, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('india_motels', 'OYO Motels India', 'ota_regional', 'south_asia', 'https://www.oyorooms.com', {
    commissionPercent: 22, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('phildelphia_hospitality', 'Philadelphia Hospitality', 'corporate', 'north_america', 'https://www.philadelphiahh.com', {
    commissionPercent: 12, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: false, messaging: false, reviewManagement: false },
  }),
  channel('spa_finder', 'Spa & Wellness Finder', 'ota_niche', 'global', 'https://www.spafinder.com', {
    commissionPercent: 15, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('hotel_planner', 'HotelPlanner', 'ota_niche', 'north_america', 'https://www.hotelplanner.com', {
    commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('roomkey', 'RoomKey', 'metasearch', 'north_america', 'https://www.roomkey.com', {
    commissionPercent: 0,
    features: { instantBooking: false, modifyReservation: false, cancelReservation: false, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('tablethotels', 'Tablet Hotels', 'ota_niche', 'global', 'https://www.tablethotels.com', {
    commissionPercent: 12, status: 'beta',
    features: { instantBooking: true, modifyReservation: false, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('splendia', 'Splendia', 'ota_niche', 'europe', 'https://www.splendia.com', {
    commissionPercent: 15, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('mr_&_mrs_smith', 'Mr & Mrs Smith', 'ota_niche', 'global', 'https://www.mrandmrssmith.com', {
    commissionPercent: 15,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: true },
  }),
  channel('great_hotels_world', 'Great Hotels of the World', 'ota_niche', 'global', 'https://www.ghotw.com', {
    commissionPercent: 12, status: 'beta',
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
  channel('design_hotels', 'Design Hotels', 'ota_niche', 'global', 'https://www.designhotels.com', {
    commissionPercent: 12,
    features: { instantBooking: true, modifyReservation: true, cancelReservation: true, contentSync: true, messaging: false, reviewManagement: false },
  }),
];

// ============================================
// MASTER LIST - ALL CHANNELS
// ============================================

export const ALL_EXTENDED_CHANNELS: ExtendedChannelConfig[] = [
  ...GLOBAL_OTAS,
  ...EUROPEAN_OTAS,
  ...ASIA_PACIFIC_OTAS,
  ...AMERICAS_OTAS,
  ...VACATION_RENTAL,
  ...HOSTEL_BUDGET,
  ...METASEARCH,
  ...WHOLESALERS_BEDBANKS,
  ...GDS_CHANNELS,
  ...TOUR_OPERATORS_CORPORATE,
  ...MIDDLE_EAST_AFRICA,
  ...NICHE_EMERGING,
];

// Unique category list
export const CHANNEL_CATEGORIES = [
  'ota_global', 'ota_regional', 'ota_niche', 'vacation_rental', 'hostel',
  'metasearch', 'gds', 'wholesaler', 'tour_operator', 'corporate', 'bedbank',
] as const;

// Unique region list
export const CHANNEL_REGIONS = [
  'global', 'north_america', 'europe', 'asia_pacific', 'middle_east',
  'africa', 'latin_america', 'south_asia', 'southeast_asia', 'east_asia',
] as const;

// Unique status list
export const CHANNEL_STATUSES = ['active', 'coming_soon', 'beta'] as const;

// Get channel by ID
export function getExtendedChannelById(id: string): ExtendedChannelConfig | undefined {
  return ALL_EXTENDED_CHANNELS.find(ch => ch.id === id);
}

// Filter channels
export function filterChannels(filters: {
  category?: string;
  region?: string;
  status?: string;
  search?: string;
}): ExtendedChannelConfig[] {
  let result = [...ALL_EXTENDED_CHANNELS];

  if (filters.category) {
    result = result.filter(ch => ch.category === filters.category);
  }
  if (filters.region) {
    result = result.filter(ch => ch.region === filters.region);
  }
  if (filters.status) {
    result = result.filter(ch => ch.status === filters.status);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(ch =>
      ch.name.toLowerCase().includes(q) || ch.id.toLowerCase().includes(q)
    );
  }

  return result;
}

// Channel statistics
export function getChannelStats(): {
  total: number;
  byCategory: Record<string, number>;
  byRegion: Record<string, number>;
  byStatus: Record<string, number>;
  avgCommission: number;
} {
  const byCategory: Record<string, number> = {};
  const byRegion: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let totalCommission = 0;

  for (const ch of ALL_EXTENDED_CHANNELS) {
    byCategory[ch.category] = (byCategory[ch.category] || 0) + 1;
    byRegion[ch.region] = (byRegion[ch.region] || 0) + 1;
    byStatus[ch.status] = (byStatus[ch.status] || 0) + 1;
    totalCommission += ch.commissionPercent;
  }

  return {
    total: ALL_EXTENDED_CHANNELS.length,
    byCategory,
    byRegion,
    byStatus,
    avgCommission: Math.round((totalCommission / ALL_EXTENDED_CHANNELS.length) * 100) / 100,
  };
}
