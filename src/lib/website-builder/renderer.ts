/**
 * Website Renderer
 * Renders public-facing hotel website HTML from DB data
 * Uses inline styles (no Tailwind) since this is served outside the dashboard
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WebsiteTheme {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  borderRadius: string;
  logoUrl?: string;
  heroImageUrl?: string;
}

export interface PageSection {
  id: string;
  type: string;
  content: Record<string, unknown>;
  order: number;
  visible: boolean;
}

export interface WebsitePage {
  id: string;
  slug: string;
  title: string;
  sections: PageSection[];
  published: boolean;
}

export interface PropertyData {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  type: string;
  address: string;
  city: string;
  state?: string | null;
  country: string;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  email?: string | null;
  phone?: string | null;
  logo?: string | null;
  primaryColor?: string | null;
  checkInTime: string;
  checkOutTime: string;
  currency: string;
  totalRooms: number;
  amenities?: string | null;
}

export interface RoomTypeData {
  id: string;
  name: string;
  description?: string | null;
  basePrice: number;
  currency: string;
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  amenities: string;
  images: string;
  totalRooms: number;
  sizeSqMeters?: number | null;
}

export interface ReviewData {
  id: string;
  overallRating: number;
  title?: string | null;
  comment?: string | null;
  source: string;
  createdAt: Date;
  guest: { firstName: string; lastName: string };
}

export type TemplateType = 'modern' | 'classic' | 'boutique' | 'resort' | 'minimal';

// ─── Template Styles ────────────────────────────────────────────────────────

interface TemplateConfig {
  heroStyle: 'gradient' | 'image' | 'split' | 'fullwidth' | 'minimal';
  sectionSpacing: string;
  cardShadow: string;
  headingFont: string;
  navStyle: 'floating' | 'fixed' | 'transparent' | 'solid' | 'centered';
  heroOverlay: string;
  cardStyle: 'shadow' | 'border' | 'flat' | 'elevated' | 'outline';
}

const TEMPLATE_CONFIGS: Record<TemplateType, TemplateConfig> = {
  modern: {
    heroStyle: 'gradient',
    sectionSpacing: '80px',
    cardShadow: '0 4px 20px rgba(0,0,0,0.08)',
    headingFont: 'inherit',
    navStyle: 'floating',
    heroOverlay: 'linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 100%)',
    cardStyle: 'shadow',
  },
  classic: {
    heroStyle: 'image',
    sectionSpacing: '60px',
    cardShadow: '0 2px 8px rgba(0,0,0,0.1)',
    headingFont: 'Georgia, serif',
    navStyle: 'fixed',
    heroOverlay: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
    cardStyle: 'border',
  },
  boutique: {
    heroStyle: 'split',
    sectionSpacing: '100px',
    cardShadow: '0 8px 30px rgba(0,0,0,0.12)',
    headingFont: 'inherit',
    navStyle: 'transparent',
    heroOverlay: 'linear-gradient(45deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 100%)',
    cardStyle: 'elevated',
  },
  resort: {
    heroStyle: 'fullwidth',
    sectionSpacing: '100px',
    cardShadow: '0 6px 24px rgba(0,0,0,0.1)',
    headingFont: 'inherit',
    navStyle: 'transparent',
    heroOverlay: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 100%)',
    cardStyle: 'shadow',
  },
  minimal: {
    heroStyle: 'minimal',
    sectionSpacing: '120px',
    cardShadow: '0 1px 3px rgba(0,0,0,0.05)',
    headingFont: 'inherit',
    navStyle: 'centered',
    heroOverlay: 'rgba(0,0,0,0.3)',
    cardStyle: 'outline',
  },
};

// ─── Utility Helpers ────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseJsonSafe<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

function getThemeColors(theme: WebsiteTheme) {
  return {
    primary: theme.primaryColor || '#0d9488',
    secondary: theme.secondaryColor || '#f59e0b',
    font: theme.fontFamily || 'Inter',
    radius: theme.borderRadius || '8px',
    logoUrl: theme.logoUrl,
    heroImageUrl: theme.heroImageUrl,
  };
}

function getTemplateConfig(template: string): TemplateConfig {
  return TEMPLATE_CONFIGS[template as TemplateType] || TEMPLATE_CONFIGS.modern;
}

function sectionWrapper(content: string, template: TemplateType, spacing: string): string {
  return `<section style="padding:${spacing} 24px;">${content}</section>`;
}

function containerWrapper(content: string, maxWidth = '1200px'): string {
  return `<div style="max-width:${maxWidth};margin:0 auto;">${content}</div>`;
}

function headingHtml(text: string, colors: ReturnType<typeof getThemeColors>, template: TemplateType): string {
  const config = getTemplateConfig(template);
  const headingFont = config.headingFont !== 'inherit' ? config.headingFont : colors.font;
  return `<h2 style="font-family:'${headingFont}',sans-serif;font-size:2rem;font-weight:700;color:#1a1a2e;margin:0 0 16px;text-align:center;">${esc(text)}</h2>`;
}

// ─── Section Renderers ──────────────────────────────────────────────────────

function renderHero(
  content: Record<string, unknown>,
  theme: WebsiteTheme,
  template: TemplateType,
  property: PropertyData
): string {
  const colors = getThemeColors(theme);
  const config = getTemplateConfig(template);
  const heading = esc((content.heading as string) || `Welcome to ${property.name}`);
  const subheading = (content.subheading as string) || property.description || '';
  const ctaText = (content.ctaText as string) || 'Book Now';
  const showBooking = content.showBookingWidget as boolean;
  const heroImage = colors.heroImageUrl || property.logo;

  let bgStyle = '';
  switch (config.heroStyle) {
    case 'gradient':
      bgStyle = `background:linear-gradient(135deg, ${colors.primary}, ${colors.primary}cc);`;
      break;
    case 'image':
    case 'fullwidth':
      if (heroImage) {
        bgStyle = `background-image:${config.heroOverlay},url('${heroImage}');background-size:cover;background-position:center;`;
      } else {
        bgStyle = `background:linear-gradient(135deg, ${colors.primary}, ${colors.primary}cc);`;
      }
      break;
    case 'minimal':
      if (heroImage) {
        bgStyle = `background-image:${config.heroOverlay},url('${heroImage}');background-size:cover;background-position:center;`;
      } else {
        bgStyle = `background:#fafafa;`;
      }
      break;
    case 'split':
    default:
      if (heroImage) {
        bgStyle = `background-image:${config.heroOverlay},url('${heroImage}');background-size:cover;background-position:center;`;
      } else {
        bgStyle = `background:linear-gradient(135deg, ${colors.primary}, ${colors.primary}cc);`;
      }
      break;
  }

  const textColor = config.heroStyle === 'minimal' && !heroImage ? '#1a1a2e' : '#ffffff';
  const minHeight = template === 'resort' ? '85vh' : template === 'boutique' ? '75vh' : template === 'minimal' ? '60vh' : '70vh';

  const bookingWidget = showBooking ? `
    <div style="margin-top:32px;display:inline-block;background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border-radius:${colors.radius};padding:20px 24px;">
      <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;">
        <div style="flex:1;min-width:150px;text-align:left;">
          <label style="display:block;font-size:12px;opacity:0.9;margin-bottom:4px;color:${textColor};">Check-in</label>
          <input type="date" style="width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,0.3);border-radius:${colors.radius};background:rgba(255,255,255,0.2);color:${textColor};font-size:14px;outline:none;" />
        </div>
        <div style="flex:1;min-width:150px;text-align:left;">
          <label style="display:block;font-size:12px;opacity:0.9;margin-bottom:4px;color:${textColor};">Check-out</label>
          <input type="date" style="width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,0.3);border-radius:${colors.radius};background:rgba(255,255,255,0.2);color:${textColor};font-size:14px;outline:none;" />
        </div>
        <div style="flex:1;min-width:100px;text-align:left;">
          <label style="display:block;font-size:12px;opacity:0.9;margin-bottom:4px;color:${textColor};">Guests</label>
          <select style="width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,0.3);border-radius:${colors.radius};background:rgba(255,255,255,0.2);color:${textColor};font-size:14px;outline:none;">
            <option value="1" style="color:#333;">1 Guest</option>
            <option value="2" style="color:#333;" selected>2 Guests</option>
            <option value="3" style="color:#333;">3 Guests</option>
            <option value="4" style="color:#333;">4+ Guests</option>
          </select>
        </div>
        <button onclick="document.getElementById('booking')?.scrollIntoView({behavior:'smooth'})" style="padding:10px 28px;background:${colors.secondary};color:#fff;border:none;border-radius:${colors.radius};font-size:15px;font-weight:600;cursor:pointer;white-space:nowrap;">${esc(ctaText)}</button>
      </div>
    </div>` : `
    <a href="#booking" style="display:inline-block;margin-top:32px;padding:14px 40px;background:${colors.secondary};color:#fff;text-decoration:none;border-radius:${colors.radius};font-size:16px;font-weight:600;letter-spacing:0.5px;transition:transform 0.2s;">${esc(ctaText)}</a>`;

  return `
    <section style="min-height:${minHeight};${bgStyle}display:flex;align-items:center;justify-content:center;padding:60px 24px;">
      <div style="max-width:800px;text-align:center;">
        <h1 style="font-size:clamp(2rem,5vw,3.5rem);font-weight:800;color:${textColor};margin:0 0 16px;line-height:1.1;">${heading}</h1>
        ${subheading ? `<p style="font-size:clamp(1rem,2.5vw,1.25rem);color:${textColor};opacity:0.9;margin:0 0 8px;line-height:1.6;max-width:600px;margin-left:auto;margin-right:auto;">${esc(subheading)}</p>` : ''}
        ${bookingWidget}
      </div>
    </section>`;
}

function renderRoomsGrid(
  content: Record<string, unknown>,
  theme: WebsiteTheme,
  template: TemplateType,
  _property: PropertyData,
  rooms: RoomTypeData[]
): string {
  const colors = getThemeColors(theme);
  const config = getTemplateConfig(template);
  const heading = (content.heading as string) || 'Our Rooms';
  const showPrices = content.showPrices !== false;
  const showAmenities = content.showAmenities === true;

  if (!rooms.length) {
    return sectionWrapper(
      containerWrapper(`${headingHtml(heading, colors, template)}<p style="text-align:center;color:#666;">Room information coming soon.</p>`),
      template,
      config.sectionSpacing
    );
  }

  const cardsHtml = rooms.map(room => {
    const images: string[] = parseJsonSafe(room.images, []);
    const amenities: string[] = parseJsonSafe(room.amenities, []);
    const imgUrl = images[0] || '';
    const imgTag = imgUrl
      ? `<div style="width:100%;height:220px;background-image:url('${imgUrl}');background-size:cover;background-position:center;border-radius:${colors.radius} ${colors.radius} 0 0;"></div>`
      : `<div style="width:100%;height:220px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;border-radius:${colors.radius} ${colors.radius} 0 0;color:#9ca3af;font-size:14px;">No Image</div>`;

    const cardBorder = config.cardStyle === 'border' ? `border:1px solid #e5e7eb;` :
                       config.cardStyle === 'outline' ? `border:2px solid #e5e7eb;` : '';

    const amenitiesHtml = showAmenities && amenities.length
      ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">${amenities.slice(0, 4).map(a => `<span style="font-size:11px;background:${colors.primary}15;color:${colors.primary};padding:2px 8px;border-radius:12px;">${esc(a)}</span>`).join('')}</div>`
      : '';

    return `
      <div style="flex:1;min-width:280px;max-width:380px;background:#fff;border-radius:${colors.radius};overflow:hidden;box-shadow:${config.cardShadow};${cardBorder}">
        ${imgTag}
        <div style="padding:20px;">
          <h3 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#1a1a2e;">${esc(room.name)}</h3>
          ${room.description ? `<p style="margin:0 0 12px;font-size:14px;color:#6b7280;line-height:1.5;">${esc(room.description).substring(0, 120)}${room.description.length > 120 ? '...' : ''}</p>` : ''}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
            <div>
              ${showPrices ? `<span style="font-size:22px;font-weight:700;color:${colors.primary};">${formatCurrency(room.basePrice, room.currency)}</span><span style="font-size:13px;color:#9ca3af;"> /night</span>` : ''}
            </div>
            <div style="font-size:13px;color:#6b7280;">
              <span style="margin-right:8px;">👥 Up to ${room.maxOccupancy}</span>
              ${room.sizeSqMeters ? `<span>${room.sizeSqMeters}m²</span>` : ''}
            </div>
          </div>
          ${amenitiesHtml}
          <a href="#booking" onclick="document.getElementById('ss-room-type') && (document.getElementById('ss-room-type').value = '${room.id}')" style="display:inline-block;margin-top:12px;padding:8px 20px;background:${colors.primary};color:#fff;text-decoration:none;border-radius:${colors.radius};font-size:13px;font-weight:600;">Book Now</a>
        </div>
      </div>`;
  }).join('');

  return sectionWrapper(
    containerWrapper(`
      ${headingHtml(heading, colors, template)}
      <div style="display:flex;flex-wrap:wrap;gap:24px;justify-content:center;">
        ${cardsHtml}
      </div>
    `),
    template,
    config.sectionSpacing
  );
}

function renderFeatures(
  content: Record<string, unknown>,
  theme: WebsiteTheme,
  template: TemplateType
): string {
  const colors = getThemeColors(theme);
  const config = getTemplateConfig(template);
  const heading = (content.heading as string) || 'Why Choose Us';
  const items = (content.items as Array<{ icon?: string; title: string; description?: string }>) || [];

  if (!items.length) {
    return '';
  }

  const iconMap: Record<string, string> = {
    wifi: '📶', pool: '🏊', spa: '🧖', restaurant: '🍽️', parking: '🅿️', gym: '💪',
    beach: '🏖️', bar: '🍸', concierge: '🔔', roomservice: '🛎️', ac: '❄️', tv: '📺',
    coffee: '☕', breakfast: '🥐', shuttle: '🚌', pet: '🐾', garden: '🌳', security: '🔒',
    default: '✨',
  };

  const cardsHtml = items.map(item => {
    const icon = iconMap[(item.icon || '').toLowerCase()] || iconMap.default;
    const cardBg = config.cardStyle === 'outline' ? `border:2px solid #e5e7eb;` :
                   config.cardStyle === 'border' ? `border:1px solid #e5e7eb;` : '';
    return `
      <div style="flex:1;min-width:200px;max-width:280px;text-align:center;padding:32px 20px;background:#fff;border-radius:${colors.radius};box-shadow:${config.cardShadow};${cardBg}">
        <div style="font-size:36px;margin-bottom:12px;">${icon}</div>
        <h4 style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1a1a2e;">${esc(item.title)}</h4>
        ${item.description ? `<p style="margin:0;font-size:14px;color:#6b7280;line-height:1.5;">${esc(item.description)}</p>` : ''}
      </div>`;
  }).join('');

  return sectionWrapper(
    containerWrapper(`
      ${headingHtml(heading, colors, template)}
      <div style="display:flex;flex-wrap:wrap;gap:24px;justify-content:center;">
        ${cardsHtml}
      </div>
    `),
    template,
    config.sectionSpacing
  );
}

function renderGallery(
  content: Record<string, unknown>,
  theme: WebsiteTheme,
  template: TemplateType
): string {
  const colors = getThemeColors(theme);
  const config = getTemplateConfig(template);
  const heading = (content.heading as string) || 'Gallery';
  const images = (content.images as Array<{ url: string; alt?: string }>) || [];

  if (!images.length) {
    return '';
  }

  const imagesHtml = images.map((img, i) => {
    const isLarge = i === 0 && images.length > 3;
    const span = isLarge ? 'grid-column:span 2;grid-row:span 2;' : '';
    const height = isLarge ? '100%' : '240px';
    return `
      <div style="min-height:200px;${span}background-image:url('${img.url}');background-size:cover;background-position:center;border-radius:${colors.radius};position:relative;overflow:hidden;">
        ${img.alt ? `<div style="position:absolute;bottom:0;left:0;right:0;padding:12px 16px;background:linear-gradient(transparent,rgba(0,0,0,0.6));color:#fff;font-size:13px;">${esc(img.alt)}</div>` : ''}
      </div>`;
  }).join('');

  return sectionWrapper(
    containerWrapper(`
      ${headingHtml(heading, colors, template)}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;">
        ${imagesHtml}
      </div>
    `),
    template,
    config.sectionSpacing
  );
}

function renderTestimonials(
  content: Record<string, unknown>,
  theme: WebsiteTheme,
  template: TemplateType,
  _property: PropertyData,
  reviews: ReviewData[]
): string {
  const colors = getThemeColors(theme);
  const config = getTemplateConfig(template);
  const heading = (content.heading as string) || 'Guest Reviews';
  const maxReviews = (content.maxReviews as number) || 6;

  const displayReviews = reviews.slice(0, maxReviews);

  if (!displayReviews.length) {
    return '';
  }

  const starsHtml = (rating: number) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  const cardsHtml = displayReviews.map(review => {
    const name = `${review.guest.firstName} ${review.guest.lastName.charAt(0)}.`;
    const dateStr = new Date(review.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    const cardBorder = config.cardStyle === 'outline' ? `border:2px solid #e5e7eb;` :
                       config.cardStyle === 'border' ? `border:1px solid #e5e7eb;` : '';

    return `
      <div style="flex:1;min-width:280px;max-width:380px;padding:28px;background:#fff;border-radius:${colors.radius};box-shadow:${config.cardShadow};${cardBorder}">
        <div style="color:${colors.secondary};font-size:18px;margin-bottom:12px;letter-spacing:2px;">${starsHtml(review.overallRating)}</div>
        ${review.title ? `<h4 style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1a1a2e;">${esc(review.title)}</h4>` : ''}
        ${review.comment ? `<p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;font-style:italic;">"${esc(review.comment)}"</p>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:14px;font-weight:600;color:#1a1a2e;">${esc(name)}</span>
          <span style="font-size:12px;color:#9ca3af;">${dateStr}</span>
        </div>
      </div>`;
  }).join('');

  return sectionWrapper(
    containerWrapper(`
      ${headingHtml(heading, colors, template)}
      <div style="display:flex;flex-wrap:wrap;gap:24px;justify-content:center;">
        ${cardsHtml}
      </div>
    `),
    template,
    config.sectionSpacing
  );
}

function renderCta(
  content: Record<string, unknown>,
  theme: WebsiteTheme,
  template: TemplateType
): string {
  const colors = getThemeColors(theme);
  const heading = (content.heading as string) || 'Ready to Book?';
  const subheading = (content.subheading as string) || '';
  const buttonText = (content.buttonText as string) || 'Book Now';
  const buttonUrl = (content.buttonUrl as string) || '#booking';

  return `
    <section style="padding:60px 24px;background:${colors.primary};">
      <div style="max-width:700px;margin:0 auto;text-align:center;">
        <h2 style="font-size:2rem;font-weight:700;color:#fff;margin:0 0 12px;">${esc(heading)}</h2>
        ${subheading ? `<p style="font-size:1.1rem;color:rgba(255,255,255,0.85);margin:0 0 28px;line-height:1.6;">${esc(subheading)}</p>` : ''}
        <a href="${esc(buttonUrl)}" style="display:inline-block;padding:14px 40px;background:#fff;color:${colors.primary};text-decoration:none;border-radius:${colors.radius};font-size:16px;font-weight:600;transition:transform 0.2s;">${esc(buttonText)}</a>
      </div>
    </section>`;
}

function renderAmenities(
  content: Record<string, unknown>,
  theme: WebsiteTheme,
  template: TemplateType,
  property: PropertyData
): string {
  const colors = getThemeColors(theme);
  const config = getTemplateConfig(template);
  const heading = (content.heading as string) || 'Amenities';
  const amenities: string[] = parseJsonSafe(property.amenities, []);

  if (!amenities.length) {
    return '';
  }

  const amenityIcons: Record<string, string> = {
    wifi: '📶', pool: '🏊', spa: '🧖', restaurant: '🍽️', parking: '🅿️', gym: '💪',
    beach: '🏖️', bar: '🍸', concierge: '🔔', 'room service': '🛎️', ac: '❄️', tv: '📺',
    coffee: '☕', breakfast: '🥐', shuttle: '🚌', 'pet friendly': '🐾', garden: '🌳',
    security: '🔒', elevator: '🛗', laundry: '👔', 'air conditioning': '❄️',
    minibar: '🍷', bathtub: '🛁', balcony: '🌅', 'free breakfast': '🥐',
    'free wifi': '📶', 'free parking': '🅿️', sauna: '🧖', tennis: '🎾',
    golf: '⛳', kids: '👶', business: '💼', meeting: '📋',
  };

  const itemsHtml = amenities.map(a => {
    const key = a.toLowerCase();
    const icon = Object.entries(amenityIcons).find(([k]) => key.includes(k))?.[1] || '✓';
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff;border-radius:${colors.radius};box-shadow:${config.cardShadow};">
        <span style="font-size:20px;">${icon}</span>
        <span style="font-size:14px;color:#374151;font-weight:500;">${esc(a)}</span>
      </div>`;
  }).join('');

  return sectionWrapper(
    containerWrapper(`
      ${headingHtml(heading, colors, template)}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">
        ${itemsHtml}
      </div>
    `),
    template,
    config.sectionSpacing
  );
}

function renderDining(
  content: Record<string, unknown>,
  theme: WebsiteTheme,
  template: TemplateType
): string {
  const colors = getThemeColors(theme);
  const config = getTemplateConfig(template);
  const heading = (content.heading as string) || 'Dining';
  const restaurants = (content.restaurants as Array<{ name: string; description?: string; cuisine?: string; hours?: string }>) || [];

  if (!restaurants.length) {
    return '';
  }

  const cardsHtml = restaurants.map(r => {
    const cardBorder = config.cardStyle === 'outline' ? `border:2px solid #e5e7eb;` :
                       config.cardStyle === 'border' ? `border:1px solid #e5e7eb;` : '';
    return `
      <div style="flex:1;min-width:280px;max-width:380px;padding:28px;background:#fff;border-radius:${colors.radius};box-shadow:${config.cardShadow};${cardBorder}">
        <h4 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#1a1a2e;">${esc(r.name)}</h4>
        ${r.cuisine ? `<span style="display:inline-block;font-size:12px;background:${colors.secondary}20;color:${colors.secondary};padding:2px 10px;border-radius:12px;margin-bottom:8px;">${esc(r.cuisine)}</span>` : ''}
        ${r.description ? `<p style="margin:8px 0;font-size:14px;color:#6b7280;line-height:1.5;">${esc(r.description)}</p>` : ''}
        ${r.hours ? `<p style="margin:8px 0 0;font-size:13px;color:#9ca3af;">🕐 ${esc(r.hours)}</p>` : ''}
      </div>`;
  }).join('');

  return sectionWrapper(
    containerWrapper(`
      ${headingHtml(heading, colors, template)}
      <div style="display:flex;flex-wrap:wrap;gap:24px;justify-content:center;">
        ${cardsHtml}
      </div>
    `),
    template,
    config.sectionSpacing
  );
}

function renderMap(
  content: Record<string, unknown>,
  theme: WebsiteTheme,
  template: TemplateType,
  property: PropertyData
): string {
  const colors = getThemeColors(theme);
  const config = getTemplateConfig(template);
  const heading = (content.heading as string) || 'Our Location';
  const zoom = (content.zoom as number) || 14;

  if (!property.latitude || !property.longitude) {
    return '';
  }

  const addressParts = [property.address, property.city, property.state, property.country, property.postalCode].filter(Boolean);
  const addressStr = addressParts.join(', ');

  return sectionWrapper(
    containerWrapper(`
      ${headingHtml(heading, colors, template)}
      ${addressStr ? `<p style="text-align:center;color:#6b7280;margin-bottom:24px;">📍 ${esc(addressStr)}</p>` : ''}
      <div style="border-radius:${colors.radius};overflow:hidden;box-shadow:${config.cardShadow};">
        <iframe
          src="https://maps.google.com/maps?q=${property.latitude},${property.longitude}&z=${zoom}&output=embed"
          width="100%"
          height="400"
          style="border:0;display:block;"
          allowfullscreen
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          title="Hotel location on Google Maps"
        ></iframe>
      </div>
    `),
    template,
    config.sectionSpacing
  );
}

function renderFaq(
  content: Record<string, unknown>,
  theme: WebsiteTheme,
  template: TemplateType
): string {
  const colors = getThemeColors(theme);
  const config = getTemplateConfig(template);
  const heading = (content.heading as string) || 'FAQ';
  const items = (content.items as Array<{ question: string; answer: string }>) || [];

  if (!items.length) {
    return '';
  }

  const faqId = `faq-${Math.random().toString(36).slice(2, 8)}`;
  const itemsHtml = items.map((item, i) => `
    <details style="border-bottom:1px solid #e5e7eb;padding:20px 0;cursor:pointer;${i === 0 ? 'border-top:1px solid #e5e7eb;' : ''}">
      <summary style="font-size:16px;font-weight:600;color:#1a1a2e;list-style:none;display:flex;justify-content:space-between;align-items:center;">
        ${esc(item.question)}
        <span style="color:${colors.primary};font-size:20px;font-weight:400;">+</span>
      </summary>
      <p style="margin:12px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">${esc(item.answer)}</p>
    </details>
  `).join('');

  return sectionWrapper(
    containerWrapper(`
      ${headingHtml(heading, colors, template)}
      <div style="max-width:700px;margin:0 auto;" id="${faqId}">
        ${itemsHtml}
      </div>
    `),
    template,
    config.sectionSpacing
  );
}

function renderContactForm(
  content: Record<string, unknown>,
  theme: WebsiteTheme,
  template: TemplateType,
  property: PropertyData
): string {
  const colors = getThemeColors(theme);
  const config = getTemplateConfig(template);
  const heading = (content.heading as string) || 'Contact Us';
  const showMap = content.showMap !== false;
  const showPhone = content.showPhone !== false;
  const showEmail = content.showEmail !== false;

  const contactInfoHtml = `
    <div style="margin-bottom:24px;">
      ${showPhone && property.phone ? `<p style="margin:0 0 8px;font-size:14px;color:#6b7280;">📞 <a href="tel:${esc(property.phone)}" style="color:${colors.primary};text-decoration:none;">${esc(property.phone)}</a></p>` : ''}
      ${showEmail && property.email ? `<p style="margin:0 0 8px;font-size:14px;color:#6b7280;">✉️ <a href="mailto:${esc(property.email)}" style="color:${colors.primary};text-decoration:none;">${esc(property.email)}</a></p>` : ''}
      <p style="margin:0;font-size:14px;color:#6b7280;">📍 ${esc([property.address, property.city, property.state, property.country].filter(Boolean).join(', '))}</p>
    </div>`;

  const mapHtml = showMap && property.latitude && property.longitude
    ? `<div style="border-radius:${colors.radius};overflow:hidden;margin-top:24px;">
        <iframe src="https://maps.google.com/maps?q=${property.latitude},${property.longitude}&z=15&output=embed" width="100%" height="250" style="border:0;display:block;" loading="lazy" title="Location map"></iframe>
      </div>`
    : '';

  return sectionWrapper(
    containerWrapper(`
      ${headingHtml(heading, colors, template)}
      <div style="display:flex;flex-wrap:wrap;gap:40px;justify-content:center;">
        <div style="flex:1;min-width:280px;max-width:500px;">
          <form id="ss-contact-form" style="display:flex;flex-direction:column;gap:16px;">
            <div id="ss-contact-msg" style="display:none;padding:12px 16px;border-radius:${colors.radius};font-size:14px;"></div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <input type="text" name="ss-contact-name" placeholder="Your Name" style="flex:1;min-width:120px;padding:12px 16px;border:1px solid #d1d5db;border-radius:${colors.radius};font-size:14px;outline:none;font-family:'${colors.font}',sans-serif;" />
              <input type="email" name="ss-contact-email" placeholder="Email Address" style="flex:1;min-width:120px;padding:12px 16px;border:1px solid #d1d5db;border-radius:${colors.radius};font-size:14px;outline:none;font-family:'${colors.font}',sans-serif;" />
            </div>
            <input type="text" name="ss-contact-subject" placeholder="Subject" style="padding:12px 16px;border:1px solid #d1d5db;border-radius:${colors.radius};font-size:14px;outline:none;font-family:'${colors.font}',sans-serif;" />
            <input type="tel" name="ss-contact-phone" placeholder="Phone Number (optional)" style="padding:12px 16px;border:1px solid #d1d5db;border-radius:${colors.radius};font-size:14px;outline:none;font-family:'${colors.font}',sans-serif;" />
            <textarea name="ss-contact-message" placeholder="Your Message" rows="5" style="padding:12px 16px;border:1px solid #d1d5db;border-radius:${colors.radius};font-size:14px;outline:none;resize:vertical;font-family:'${colors.font}',sans-serif;"></textarea>
            <button type="submit" style="padding:12px 32px;background:${colors.primary};color:#fff;border:none;border-radius:${colors.radius};font-size:15px;font-weight:600;cursor:pointer;align-self:flex-start;">Send Message</button>
          </form>
          <script>
          (function(){
            var form=document.getElementById('ss-contact-form');
            if(!form)return;
            var msgBox=document.getElementById('ss-contact-msg');
            function showMsg(text,ok){
              if(!msgBox)return;
              msgBox.style.display='block';
              msgBox.style.background=ok?'#d1fae5':'#fee2e2';
              msgBox.style.color=ok?'#065f46':'#991b1b';
              msgBox.textContent=text;
            }
            form.addEventListener('submit',function(e){
              e.preventDefault();
              var name=(form.querySelector('[name="ss-contact-name"]').value||'').trim();
              var email=(form.querySelector('[name="ss-contact-email"]').value||'').trim();
              var phone=(form.querySelector('[name="ss-contact-phone"]').value||'').trim();
              var subject=(form.querySelector('[name="ss-contact-subject"]').value||'').trim();
              var message=(form.querySelector('[name="ss-contact-message"]').value||'').trim();
              if(!name){showMsg('Please enter your name.',false);return;}
              if(!email||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){showMsg('Please enter a valid email address.',false);return;}
              if(!message||message.length<5){showMsg('Please enter a message (at least 5 characters).',false);return;}
              var btn=form.querySelector('button[type="submit"]');
              var origText=btn.textContent;btn.textContent='Sending...';btn.disabled=true;
              fetch('/api/site/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({websiteId:window.__STAYSUITE.websiteId,propertyId:window.__STAYSUITE.propertyId,name:name,email:email,phone:phone,subject:subject,message:message})})
              .then(function(r){return r.json();})
              .then(function(data){
                if(data.success){showMsg('Thank you! Your message has been sent successfully. We will get back to you soon.',true);form.reset();}
                else{showMsg(data.error&&data.error.message?data.error.message:'Something went wrong. Please try again.',false);}
              })
              .catch(function(){showMsg('Network error. Please check your connection and try again.',false);})
              .finally(function(){btn.textContent=origText;btn.disabled=false;});
            });
          })();
          </script>
        </div>
        <div style="flex:1;min-width:280px;max-width:400px;">
          ${contactInfoHtml}
          ${mapHtml}
        </div>
      </div>
    `),
    template,
    config.sectionSpacing
  );
}

function renderBookingWidget(
  content: Record<string, unknown>,
  theme: WebsiteTheme,
  template: TemplateType,
  property: PropertyData,
  rooms: RoomTypeData[]
): string {
  const colors = getThemeColors(theme);
  const config = getTemplateConfig(template);
  const heading = (content.heading as string) || 'Book Your Stay';

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const dayAfterStr = dayAfter.toISOString().split('T')[0];

  const roomOptions = rooms.map(r => `<option value="${esc(r.id)}" style="color:#333;">${esc(r.name)} - ${formatCurrency(r.basePrice, r.currency)}/night</option>`).join('');

  return sectionWrapper(
    containerWrapper(`
      ${headingHtml(heading, colors, template)}
      <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:${colors.radius};padding:32px;box-shadow:0 4px 20px rgba(0,0,0,0.08);" id="booking">
        <form id="ss-booking-form" style="display:flex;flex-direction:column;gap:16px;">
          <div id="ss-booking-error" style="display:none;padding:12px 16px;background:#fee2e2;color:#991b1b;border-radius:${colors.radius};font-size:14px;"></div>
          <!-- Step 1: Search -->
          <div id="ss-step1">
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <div style="flex:1;min-width:180px;">
                <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Check-in</label>
                <input type="date" id="ss-checkin" value="${tomorrowStr}" min="${tomorrowStr}" style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:${colors.radius};font-size:14px;outline:none;" />
              </div>
              <div style="flex:1;min-width:180px;">
                <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Check-out</label>
                <input type="date" id="ss-checkout" value="${dayAfterStr}" min="${dayAfterStr}" style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:${colors.radius};font-size:14px;outline:none;" />
              </div>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <div style="flex:1;min-width:200px;">
                <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Room Type</label>
                <select id="ss-room-type" style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:${colors.radius};font-size:14px;outline:none;color:#333;">
                  <option value="" style="color:#333;">Select a room</option>
                  ${roomOptions}
                </select>
              </div>
              <div style="flex:1;min-width:100px;">
                <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Guests</label>
                <select id="ss-guests" style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:${colors.radius};font-size:14px;outline:none;color:#333;">
                  <option value="1" style="color:#333;">1 Guest</option>
                  <option value="2" style="color:#333;" selected>2 Guests</option>
                  <option value="3" style="color:#333;">3 Guests</option>
                  <option value="4" style="color:#333;">4 Guests</option>
                  <option value="5" style="color:#333;">5+ Guests</option>
                </select>
              </div>
            </div>
            <button type="button" id="ss-to-step2" style="padding:14px 32px;background:${colors.primary};color:#fff;border:none;border-radius:${colors.radius};font-size:16px;font-weight:600;cursor:pointer;margin-top:8px;">Continue</button>
          </div>
          <!-- Step 2: Guest Details (hidden initially) -->
          <div id="ss-step2" style="display:none;">
            <h3 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#1a1a2e;">Guest Details</h3>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <div style="flex:1;min-width:200px;">
                <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Full Name *</label>
                <input type="text" id="ss-guest-name" placeholder="John Doe" style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:${colors.radius};font-size:14px;outline:none;" />
              </div>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <div style="flex:1;min-width:200px;">
                <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Email *</label>
                <input type="email" id="ss-guest-email" placeholder="john@example.com" style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:${colors.radius};font-size:14px;outline:none;" />
              </div>
              <div style="flex:1;min-width:200px;">
                <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Phone</label>
                <input type="tel" id="ss-guest-phone" placeholder="+1 234 567 8900" style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:${colors.radius};font-size:14px;outline:none;" />
              </div>
            </div>
            <div style="margin-top:4px;">
              <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Special Requests</label>
              <textarea id="ss-special-requests" rows="3" placeholder="Any special requirements?" style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:${colors.radius};font-size:14px;outline:none;resize:vertical;"></textarea>
            </div>
            <div style="display:flex;gap:12px;margin-top:8px;">
              <button type="button" id="ss-back-step1" style="padding:12px 24px;background:#e5e7eb;color:#374151;border:none;border-radius:${colors.radius};font-size:14px;font-weight:600;cursor:pointer;">Back</button>
              <button type="button" id="ss-submit-booking" style="padding:12px 32px;background:${colors.primary};color:#fff;border:none;border-radius:${colors.radius};font-size:16px;font-weight:600;cursor:pointer;">Confirm Booking</button>
            </div>
          </div>
          <!-- Step 3: Confirmation (hidden initially) -->
          <div id="ss-step3" style="display:none;text-align:center;">
            <div style="font-size:48px;margin-bottom:16px;">&#10003;</div>
            <h3 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;">Booking Confirmed!</h3>
            <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">Your booking has been submitted successfully.</p>
            <p id="ss-confirmation-code" style="margin:0 0 16px;font-size:16px;font-weight:600;color:${colors.primary};"></p>
            <button type="button" id="ss-new-booking" style="padding:12px 24px;background:${colors.primary};color:#fff;border:none;border-radius:${colors.radius};font-size:14px;font-weight:600;cursor:pointer;">Book Another Stay</button>
          </div>
        </form>
        <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;text-align:center;">Check-in: ${esc(property.checkInTime)} | Check-out: ${esc(property.checkOutTime)}</p>
      </div>
      <script>
      (function(){
        var form=document.getElementById('ss-booking-form');
        if(!form)return;
        var step1=document.getElementById('ss-step1');
        var step2=document.getElementById('ss-step2');
        var step3=document.getElementById('ss-step3');
        var errorBox=document.getElementById('ss-booking-error');
        function showError(msg){if(!errorBox)return;errorBox.style.display='block';errorBox.textContent=msg;}
        function hideError(){if(!errorBox)return;errorBox.style.display='none';}
        function showStep(n){step1.style.display=n===1?'block':'none';step2.style.display=n===2?'block':'none';step3.style.display=n===3?'block':'none';}
        document.getElementById('ss-to-step2').addEventListener('click',function(){
          hideError();
          var checkin=document.getElementById('ss-checkin').value;
          var checkout=document.getElementById('ss-checkout').value;
          var roomType=document.getElementById('ss-room-type').value;
          if(!checkin){showError('Please select a check-in date.');return;}
          if(!checkout){showError('Please select a check-out date.');return;}
          if(new Date(checkout)<=new Date(checkin)){showError('Check-out date must be after check-in date.');return;}
          if(!roomType){showError('Please select a room type.');return;}
          var nights=Math.ceil((new Date(checkout)-new Date(checkin))/(1000*60*60*24));
          if(nights>90){showError('Maximum stay is 90 nights.');return;}
          showStep(2);
        });
        document.getElementById('ss-back-step1').addEventListener('click',function(){hideError();showStep(1);});
        document.getElementById('ss-submit-booking').addEventListener('click',function(){
          hideError();
          var name=(document.getElementById('ss-guest-name').value||'').trim();
          var email=(document.getElementById('ss-guest-email').value||'').trim();
          var phone=(document.getElementById('ss-guest-phone').value||'').trim();
          var requests=(document.getElementById('ss-special-requests').value||'').trim();
          if(!name){showError('Please enter your full name.');return;}
          if(!email||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){showError('Please enter a valid email address.');return;}
          var btn=this;var origText=btn.textContent;btn.textContent='Submitting...';btn.disabled=true;
          var payload={websiteId:window.__STAYSUITE.websiteId,propertyId:window.__STAYSUITE.propertyId,roomTypeId:document.getElementById('ss-room-type').value,checkIn:document.getElementById('ss-checkin').value,checkOut:document.getElementById('ss-checkout').value,guests:parseInt(document.getElementById('ss-guests').value)||2,adults:parseInt(document.getElementById('ss-guests').value)||2,children:0,guestName:name,guestEmail:email,guestPhone:phone,specialRequests:requests};
          fetch('/api/site/booking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
          .then(function(r){return r.json();})
          .then(function(data){
            if(data.success){showStep(3);var codeEl=document.getElementById('ss-confirmation-code');if(codeEl){var code=data.confirmationCode||(data.data&&data.data.confirmationCode)||'';if(code)codeEl.textContent='Confirmation: '+code;}}
            else{showError(data.error&&data.error.message?data.error.message:'Booking failed. Please try again.');}
          })
          .catch(function(){showError('Network error. Please check your connection and try again.');})
          .finally(function(){btn.textContent=origText;btn.disabled=false;});
        });
        document.getElementById('ss-new-booking').addEventListener('click',function(){
          form.reset();
          showStep(1);
          var t=new Date();t.setDate(t.getDate()+1);
          var t2=new Date();t2.setDate(t2.getDate()+2);
          document.getElementById('ss-checkin').value=t.toISOString().split('T')[0];
          document.getElementById('ss-checkout').value=t2.toISOString().split('T')[0];
        });
      })();
      </script>
    `),
    template,
    config.sectionSpacing
  );
}

function renderHtml(
  content: Record<string, unknown>
): string {
  const html = content.html as string || '';
  if (!html) return '';
  return `<section style="padding:0 24px;">${containerWrapper(html)}</section>`;
}

// ─── Navbar ─────────────────────────────────────────────────────────────────

function renderNavbar(
  property: PropertyData,
  theme: WebsiteTheme,
  pages: WebsitePage[],
  template: TemplateType
): string {
  const colors = getThemeColors(theme);
  const config = getTemplateConfig(template);

  const isTransparent = config.navStyle === 'transparent' || config.navStyle === 'floating';
  const navBg = isTransparent ? 'rgba(255,255,255,0.95)' : '#ffffff';
  const navShadow = config.navStyle === 'floating' ? '0 2px 20px rgba(0,0,0,0.08)' :
                    config.navStyle === 'fixed' ? '0 1px 3px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.08)';
  const navPosition = (config.navStyle === 'fixed' || config.navStyle === 'floating' || config.navStyle === 'transparent') ? 'fixed' : 'sticky';

  const logoHtml = colors.logoUrl || property.logo
    ? `<img src="${esc(colors.logoUrl || property.logo || '')}" alt="${esc(property.name)}" style="height:36px;width:auto;" />`
    : `<span style="font-size:20px;font-weight:700;color:${colors.primary};text-decoration:none;">${esc(property.name)}</span>`;

  const publishedPages = pages.filter(p => p.published && p.slug !== 'home');
  const navLinks = publishedPages.map(p =>
    `<a href="/site/${esc(property.slug || '')}/${esc(p.slug)}" style="font-size:14px;color:#374151;text-decoration:none;font-weight:500;transition:color 0.2s;">${esc(p.title)}</a>`
  ).join('');

  const mobileNavLinks = publishedPages.map(p =>
    `<a href="/site/${esc(property.slug || '')}/${esc(p.slug)}" style="display:block;padding:12px 0;font-size:15px;color:#374151;text-decoration:none;font-weight:500;border-bottom:1px solid #f3f4f6;">${esc(p.title)}</a>`
  ).join('');

  return `
    <nav style="position:${navPosition};top:0;left:0;right:0;z-index:1000;background:${navBg};backdrop-filter:blur(12px);box-shadow:${navShadow};padding:0 24px;">
      <div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:64px;">
        <a href="/site/${esc(property.slug || '')}" style="text-decoration:none;display:flex;align-items:center;gap:8px;">${logoHtml}</a>
        <div style="display:flex;align-items:center;gap:24px;" class="desktop-nav">
          ${navLinks}
        </div>
        <a href="#booking" style="display:inline-block;padding:8px 24px;background:${colors.primary};color:#fff;text-decoration:none;border-radius:${colors.radius};font-size:14px;font-weight:600;">Book Now</a>
      </div>
      <!-- Mobile nav handled by hamburger (CSS-only) -->
      <style>
        .desktop-nav { display:flex !important; }
        @media (max-width: 768px) {
          .desktop-nav { display:none !important; }
          .mobile-menu-btn { display:block !important; }
          .mobile-menu-content { display:none; }
          .mobile-menu-btn:checked ~ .mobile-menu-content { display:block; }
        }
        @media (min-width: 769px) {
          .mobile-menu-btn, .mobile-menu-label { display:none !important; }
        }
        details[open] summary span:last-child { display:none; }
        details[open] summary::after { content:"-"; color:${colors.primary}; font-size:20px; }
      </style>
      <input type="checkbox" id="mobile-menu-btn" class="mobile-menu-btn" style="display:none;" />
      <label for="mobile-menu-btn" class="mobile-menu-label" style="display:none;position:absolute;top:16px;right:24px;font-size:24px;cursor:pointer;color:#374151;">☰</label>
      <div class="mobile-menu-content" style="padding:8px 0 16px;">
        ${mobileNavLinks}
      </div>
    </nav>`;
}

// ─── Footer ─────────────────────────────────────────────────────────────────

function renderFooter(
  property: PropertyData,
  theme: WebsiteTheme,
  template: TemplateType
): string {
  const colors = getThemeColors(theme);
  const addressParts = [property.address, property.city, property.state, property.country, property.postalCode].filter(Boolean);
  const addressStr = addressParts.join(', ');
  const year = new Date().getFullYear();

  return `
    <footer style="background:#1a1a2e;color:#fff;padding:48px 24px 24px;">
      <div style="max-width:1200px;margin:0 auto;">
        <div style="display:flex;flex-wrap:wrap;gap:40px;justify-content:space-between;margin-bottom:32px;">
          <div style="flex:1;min-width:250px;">
            <h4 style="margin:0 0 12px;font-size:18px;font-weight:600;">${esc(property.name)}</h4>
            ${addressStr ? `<p style="margin:0 0 8px;font-size:14px;color:#9ca3af;line-height:1.6;">📍 ${esc(addressStr)}</p>` : ''}
            ${property.phone ? `<p style="margin:0 0 8px;font-size:14px;color:#9ca3af;">📞 ${esc(property.phone)}</p>` : ''}
            ${property.email ? `<p style="margin:0 0 8px;font-size:14px;color:#9ca3af;">✉️ ${esc(property.email)}</p>` : ''}
            <p style="margin:8px 0 0;font-size:13px;color:#9ca3af;">Check-in: ${esc(property.checkInTime)} | Check-out: ${esc(property.checkOutTime)}</p>
          </div>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:20px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;">
          <p style="margin:0;font-size:13px;color:#6b7280;">© ${year} ${esc(property.name)}. All rights reserved.</p>
          <p style="margin:0;font-size:12px;color:#4b5563;">Powered by <span style="color:${colors.primary};font-weight:600;">StaySuite</span></p>
        </div>
      </div>
    </footer>`;
}

// ─── Analytics Scripts ──────────────────────────────────────────────────────

function renderAnalyticsScripts(analytics: Record<string, unknown>): string {
  let scripts = '';

  const gaId = analytics.googleAnalyticsId as string;
  if (gaId) {
    scripts += `
      <script async src="https://www.googletagmanager.com/gtag/js?id=${esc(gaId)}"></script>
      <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${esc(gaId)}');
      </script>`;
  }

  const gtmId = analytics.googleTagManagerId as string;
  if (gtmId) {
    scripts += `
      <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${esc(gtmId)}');</script>`;
  }

  const fbPixel = analytics.facebookPixelId as string || analytics.metaPixelId as string;
  if (fbPixel) {
    scripts += `
      <script>
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${esc(fbPixel)}');
        fbq('track', 'PageView');
      </script>`;
  }

  const liTag = analytics.linkedInsightTag as string;
  if (liTag) {
    scripts += `
      <script type="text/javascript">
        _linkedin_partner_id = "${esc(liTag)}";
        window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
        window._linkedin_data_partner_ids.push(_linkedin_partner_id);
      </script>
      <script type="text/javascript">
        (function(){var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s);})();
      </script>`;
  }

  const twPixel = analytics.twitterPixelId as string;
  if (twPixel) {
    scripts += `
      <script>
        !function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='//static.ads-twitter.com/uwt.js',a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
        twq('init','${esc(twPixel)}');
        twq('track','PageView');
      </script>`;
  }

  return scripts;
}

// ─── Full Page Render ───────────────────────────────────────────────────────

export interface RenderPageOptions {
  property: PropertyData;
  rooms: RoomTypeData[];
  reviews: ReviewData[];
  theme: WebsiteTheme;
  template: TemplateType;
  pages: WebsitePage[];
  currentPage: WebsitePage;
  seo: Record<string, unknown>;
  analytics: Record<string, unknown>;
  domain: string;
  preview: boolean;
  websiteId: string;
  propertyId: string;
}

export function renderFullPage(opts: RenderPageOptions): string {
  const { property, rooms, reviews, theme, template, pages, currentPage, seo, analytics, domain, preview, websiteId, propertyId } = opts;
  const colors = getThemeColors(theme);
  const config = getTemplateConfig(template);

  // Sort sections by order, filter visible
  const visibleSections = currentPage.sections
    .filter(s => s.visible)
    .sort((a, b) => a.order - b.order);

  // Render each section
  const sectionsHtml = visibleSections.map(section => {
    switch (section.type) {
      case 'hero':
        return renderHero(section.content, theme, template, property);
      case 'rooms_grid':
        return renderRoomsGrid(section.content, theme, template, property, rooms);
      case 'features':
        return renderFeatures(section.content, theme, template);
      case 'gallery':
        return renderGallery(section.content, theme, template);
      case 'testimonials':
        return renderTestimonials(section.content, theme, template, property, reviews);
      case 'cta':
        return renderCta(section.content, theme, template);
      case 'amenities':
        return renderAmenities(section.content, theme, template, property);
      case 'dining':
        return renderDining(section.content, theme, template);
      case 'map':
        return renderMap(section.content, theme, template, property);
      case 'faq':
        return renderFaq(section.content, theme, template);
      case 'contact_form':
        return renderContactForm(section.content, theme, template, property);
      case 'booking_widget':
        return renderBookingWidget(section.content, theme, template, property, rooms);
      case 'html':
        return renderHtml(section.content);
      default:
        return '';
    }
  }).join('\n');

  // Build navbar
  const navbarHtml = renderNavbar(property, theme, pages, template);
  const footerHtml = renderFooter(property, theme, template);

  // SEO
  const seoTitle = (seo.title as string) || `${property.name} - Official Website`;
  const seoDescription = (seo.description as string) || property.description || `Book your stay at ${property.name}`;
  const seoKeywords = Array.isArray(seo.keywords) ? (seo.keywords as string[]).join(', ') : '';
  const ogImage = (seo.ogImage as string) || theme.heroImageUrl || property.logo || '';
  const faviconUrl = (seo.faviconUrl as string) || property.logo || '/favicon.ico';

  // Google Fonts URL
  const fontFamilies = [colors.font];
  if (config.headingFont !== 'inherit' && !fontFamilies.includes(config.headingFont)) {
    fontFamilies.push(config.headingFont);
  }
  const googleFontsUrl = `https://fonts.googleapis.com/css2?family=${fontFamilies.map(f => f.replace(/ /g, '+')).join('&family=')}&display=swap`;

  // Analytics scripts
  const analyticsScripts = renderAnalyticsScripts(analytics);

  // Preview banner
  const previewBanner = preview ? `
    <div style="position:fixed;bottom:20px;left:20px;z-index:9999;background:#f59e0b;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
      👁 Preview Mode
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${esc(seoTitle)}</title>
  <meta name="description" content="${esc(seoDescription)}" />
  ${seoKeywords ? `<meta name="keywords" content="${esc(seoKeywords)}" />` : ''}
  <meta property="og:title" content="${esc(seoTitle)}" />
  <meta property="og:description" content="${esc(seoDescription)}" />
  ${ogImage ? `<meta property="og:image" content="${ogImage}" />` : ''}
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="${esc(faviconUrl)}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${googleFontsUrl}" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
    body { font-family: '${colors.font}', sans-serif; color: #1a1a2e; background: #ffffff; line-height: 1.6; }
    img { max-width: 100%; height: auto; }
    a { color: ${colors.primary}; }
    a:hover { opacity: 0.85; }
    button:hover { opacity: 0.9; transform: translateY(-1px); }
    input:focus, textarea:focus, select:focus { border-color: ${colors.primary} !important; outline: none; box-shadow: 0 0 0 3px ${colors.primary}25; }
    details summary::-webkit-details-marker { display: none; }
    details summary { list-style: none; }
    details summary::marker { display: none; content: ''; }
    ::selection { background: ${colors.primary}30; }
    @media (max-width: 768px) {
      h1 { font-size: 2rem !important; }
      h2 { font-size: 1.5rem !important; }
      section { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
  ${analyticsScripts}
</head>
<body>
  ${navbarHtml}
  <main style="padding-top:64px;">
    ${sectionsHtml}
  </main>
  ${footerHtml}
  ${previewBanner}
  <script>
  window.__STAYSUITE = {
    websiteId: ${JSON.stringify(websiteId)},
    propertyId: ${JSON.stringify(propertyId)},
    propertySlug: ${JSON.stringify(property.slug)}
  };
  </script>
</body>
</html>`;
}
