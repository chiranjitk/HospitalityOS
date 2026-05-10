/**
 * MAC OUI (Organizationally Unique Identifier) Vendor Lookup
 *
 * The first 3 bytes (6 hex chars) of a MAC address identify the hardware vendor.
 *
 * Strategy: OUI entries are ordered by priority (mobile > laptop > TV > router).
 * First match wins — duplicates are resolved at build time to a single vendor per OUI.
 *
 * Used for external NAS (MikroTik) sessions where User-Agent is not available.
 */

// ---------------------------------------------------------------------------
// Build deduplicated OUI map: process entries in priority order
// Mobile vendors first (most common WiFi clients), then laptops, then networking
// ---------------------------------------------------------------------------

type OUIEntry = [string, string]; // [oui_hex, vendor_name]

const RAW_OUI_ENTRIES: OUIEntry[] = [
  // ═══════════════════════════════════════════════════════════════
  // 1. MOBILE PHONES & TABLETS (highest priority — most common guests)
  // ═══════════════════════════════════════════════════════════════

  // Apple (iPhone, iPad, Mac, Apple Watch, AirPods)
  ...[
    '001e52','a4b197','a4b198','a4b1ba','a47733','a4f1e8','3c22fb','8ca982',
    'a860b6','78ca39','ac87a3','f01898','f8ff0a','5cf7e6','b8e856','e0accb',
    'ec1f72','e4b318','40c795','60f81e','507ac5','b4e1a5','28f076','68a8d4',
    'a8a445','5c5948','041532','d4619d','84119e','7cd1c3',
  ].map(oui => [oui, 'Apple'] as OUIEntry),

  // Samsung (Galaxy phones/tablets)
  ...[
    'a4c494','b47443','b0b448','607b89','d02598','d45e4e','dc2b2a','9cb70d',
    '4c11bf','e04f43','f8a45d','b46ba0','98fa9b','382c4a','28c2a6','a0cbfd',
    '08d45e','b472cf','98e0d9','48db50','009065','b4f176','70a8d3','88f0f7',
    '9cb01d','78564e',
  ].map(oui => [oui, 'Samsung'] as OUIEntry),

  // Xiaomi / Redmi / POCO
  ...[
    '78110b','9c99a0','a076c1','b827eb','c8f2a0','dc4a3e','e8e0e0','f0a740',
    'f8a4c8','64b473','0c1daf','10bf48','180acf','28e31f','40b3d8','507a21',
    '5844aa','60ab56','6ca05e','78411c','846eb2','9876b6','b454e0','c0ee1b',
    'e4c36b','ecb1ee','f07431','64a2f9','009e77','94e1ac','a4cf12',
  ].map(oui => [oui, 'Xiaomi'] as OUIEntry),

  // Huawei
  ...[
    '20a6cd','7cc2c6','8c715f','a0c69a','b0f1ec','b4eeb4','cc96a0','e0191d',
    'e474a0','f48e38','5c7d5e','80d261','48a195','02d0a7','38b181','5c915f',
    '70e89a','88d502','a494a8','c471d8','6478d2','2466ab','5caafd','18c05d',
    'e4f01c',
  ].map(oui => [oui, 'Huawei'] as OUIEntry),

  // OPPO
  ...[
    '3c947e','7844fd','7cc537','a4749a','c8ad34','d4612e','e4a749','f0b45c',
    '44d4e2','60456b','80eaac','a0beb1','b8a160','e091f5','e87cd1','98f5a9',
  ].map(oui => [oui, 'OPPO'] as OUIEntry),

  // Vivo
  ...[
    '48901e','6c72e7','88c663','a8dbf5','cc2d82','d0bae9','50eb71','c0f0c9',
  ].map(oui => [oui, 'Vivo'] as OUIEntry),

  // OnePlus
  ...['c41e30','8c1662'].map(oui => [oui, 'OnePlus'] as OUIEntry),

  // Realme
  ...[].map(oui => [oui, 'Realme'] as OUIEntry), // shares OPPO OUIs, handled above

  // Honor
  ...[
    '704f57','78110b','9c99a0','a4cf12','c8f2a0','d4619d','e4c36b','f8a45d',
    '9876b6','64a2f9','94e1ac','b827eb',
  ].map(oui => [oui, 'Honor'] as OUIEntry),

  // Google (Pixel, Nest, Chromecast)
  ...[
    'f8a9d0','7c7045','78a1bf','b4f0ab','24f5a2','186d40','382c4a','a0c69a',
    '6c5697','001a11','00:1a:11',
  ].map(oui => [oui, 'Google'] as OUIEntry),

  // Nokia / HMD Global
  ...[
    '0059c7','0c7ce4','1c94a9','2caaed','349be6','4c7c5f','507a21','5c0a5b',
    '606d3c','70e89a','782b46','7c04d0','90b11d','a0ceb8','b454e0','c471d8',
    'e8e0e0','3c0630',
  ].map(oui => [oui, 'Nokia'] as OUIEntry),

  // Sony (Xperia phones)
  ...[
    '54834c','786327','7c6d62','8439c1','a0e4a7','b4b571','c8ba94','d0c1b1',
    'e04a13','f07816','f4b792','a4a0ed',
  ].map(oui => [oui, 'Sony'] as OUIEntry),

  // LG (phones, TVs)
  ...[
    'a48894','b07053','c45693','d8bbc1','e47854','f0b4d2','f8a4c8','00c0f0',
    '485d60','60fb42','8c3ae3','94ebcd','a0f3c1','c079d5','dca5b4','2cfda1',
    'b827eb','70a8d3',
  ].map(oui => [oui, 'LG'] as OUIEntry),

  // Motorola (Lenovo-owned)
  ...[
    '60ab56','8ca982','98e0d9','b472cf','c8ad34','dc2b2a','f8a45d','a076c1',
    'b0f1ec','cc96a0','009e77','4c11bf','e04f43','78110b','704f57','64a2f9',
    'f07431','64b473',
  ].map(oui => [oui, 'Motorola'] as OUIEntry),

  // Infinix
  ...[].map(oui => [oui, 'Infinix'] as OUIEntry), // shares OPPO OUIs

  // Tecno
  ...[].map(oui => [oui, 'Tecno'] as OUIEntry), // shares OPPO/Huawei OUIs

  // Nothing Phone
  ...[].map(oui => [oui, 'Nothing'] as OUIEntry), // shares OPPO OUIs

  // Amazon (Kindle, Fire TV, Echo)
  ...[
    '40b4cd','685463','747548','7ce9a4','848697','b8f0b1','c86000','f8b156',
  ].map(oui => [oui, 'Amazon'] as OUIEntry),

  // ═══════════════════════════════════════════════════════════════
  // 2. LAPTOPS / DESKTOPS (lower priority — less common WiFi guests)
  // ═══════════════════════════════════════════════════════════════

  // Microsoft (Surface, Xbox)
  ...[
    '001dd8','2c41a1','3c52a0','4843b6','7ced8d','80ce62','a47b58','c89c1d',
    'f0de71','001505',
  ].map(oui => [oui, 'Microsoft'] as OUIEntry),

  // Dell
  ...[
    '001e4f','001cc4','0022fa','0050b6','00609e','14aabe','1caadd','20773f',
    '28cfe1','3417eb','3c5282','44870a','485b39','5c0e6b','6c4b90','88ae48',
    '98f0de','b8ac6f','e0db55','f8bc12','a4f1e8','b0b448',
  ].map(oui => [oui, 'Dell'] as OUIEntry),

  // HP
  ...[
    '001a4b','001b78','001e0f','00225b','0080c7','10604b','1c6ab7','2c41a1',
    '3417eb','3c5282','485b39','5c0e6b','6c4b90','88ae48','b8ac6f','f4ce46',
    'a0f3c1','507ac5','6478d2',
  ].map(oui => [oui, 'HP'] as OUIEntry),

  // Lenovo (ThinkPad, IdeaPad)
  ...[
    '0015c5','001a6b','00e04c','083e8e','0c627c','1087fb','1cbfce','20e5c2',
    '24773e','40167e','54bf64','606d3c','70b5e8','8c704a','90e6ba','b4f0ab',
    'f0b4d2','f4ce46','507a21','782b46','88ae48','6c4b90','3c5282','485b39',
    '3417eb','5c0e6b','b8ac6f','a0f3c1','c4a81d','28cfda',
  ].map(oui => [oui, 'Lenovo'] as OUIEntry),

  // Asus (laptops — also makes routers but guests are more likely laptops)
  ...[
    '001120','001e8c','04d4c4','1087fb','1cbfce','244b03','30f9ed','40167e',
    '50465c','782b46','8439c1','a0ceb8','a8d0e6','bc1085','c079d5','d0bae9',
    'd8bbc1','2cfda1','60456b','6c72e7','b0f1ec','e8e0e0','f0b4d2','b827eb',
    'a4c494','b47443','d02598',
  ].map(oui => [oui, 'Asus'] as OUIEntry),

  // Acer
  ...[
    '001122','00179d','001e33','00716b','1c6ab7','24f5a2','2caaed','3417eb',
    '3c5282','485b39','54bf64','6c4b90','70b5e8','782b46','88ae48','a0f3c1',
    'b8ac6f','c079d5','dca5b4','e0191d','e8e0e0','f4ce46','b827eb',
  ].map(oui => [oui, 'Acer'] as OUIEntry),

  // ═══════════════════════════════════════════════════════════════
  // 3. SMART TV / STREAMING
  // ═══════════════════════════════════════════════════════════════

  // Roku
  ...[
    '5c2d64','68c90b','786945','a0e482','b8b0c4','d86162','e04a13','f87716',
  ].map(oui => [oui, 'Roku'] as OUIEntry),

  // ═══════════════════════════════════════════════════════════════
  // 4. NETWORKING EQUIPMENT (APs, routers, switches — lowest priority)
  // ═══════════════════════════════════════════════════════════════

  // MikroTik (RouterOS)
  ...[
    'e4d65d','7c695b','4c5e0c','001c23','00c07e','64820c','48a9d4','d4611b',
    '788daf','e01ab3','b8aa1f','f0e1fe','a040a0','280fa8','64d14e','7ce423',
    '9829a6','e47a5c','b4b024','d6ca6d',
  ].map(oui => [oui, 'MikroTik'] as OUIEntry),

  // Ruckus Wireless (enterprise APs)
  ...[
    '001c57','1801a2','286c07','3816a0','40f409','50678b','58698d','6cfa99',
    '70b5d8','7885ba','88623d','9830a1','a00c29','c402b6','d03745','e0cb4e',
    'f0f7b3',
  ].map(oui => [oui, 'Ruckus'] as OUIEntry),

  // Ubiquiti (UniFi APs)
  ...[
    '0024a5','0418b6','04d18c','0c2e6d','1c0e2c','202bc7','24a43c','286731',
    '2c4165','308d84','3869cc','4048f3','44d9e7','5067f2','606dbd','68867c',
    '6c7219','706f87','746d2e','788ada','7cdd90','802aa8','907259','b4fbd5',
    'c09aef','ccf861','d85dfb','e08406','e894f6','f092b1','fc9947',
  ].map(oui => [oui, 'Ubiquiti'] as OUIEntry),

  // Cisco (enterprise APs/switches)
  ...[
    '001457','001a2b','001c58','001e7a','001f9e','002155','00226b','00236b',
    '00243c','002564','005056','080273','2893fe','30e4db','34a7d8','50f1e8',
    '5475d0','5897f8','6c9c04','7081b3','747695','78da26','7c0e24','884347',
    '8c704a',
  ].map(oui => [oui, 'Cisco'] as OUIEntry),

  // Aruba / HPE (enterprise APs)
  ...[
    '00119b','0c866c','20f372','24de4c','2c5212','3c8ca8','4c7de5','5880bf',
    '6094c0','70b5d8','7c2d1e','887208','a0d3c1','c050e6','d87b37','e04f43',
    'f07431','f8b156',
  ].map(oui => [oui, 'Aruba'] as OUIEntry),

  // TP-Link (consumer routers/APs)
  ...[
    '500c0f','5c628b','6cb4ce','782bcb','840d8e','908d6c','9ca2f4','b0a7b9',
    'c071bf','c83f65','d8bbd1','ec172f','a0f3c1','b4a984','e0191d','f0b4d2',
    '5c8196','b8a160','18c05d',
  ].map(oui => [oui, 'TP-Link'] as OUIEntry),

  // D-Link (routers/APs)
  ...[
    '00195b','001e58','145992','24a4c1','340b5b','3c970e','6c19af','7c911b',
    '84c9b2','c0a0bb','d8bbd1','e0191d','ec172f','a0c69a','70a8d3',
  ].map(oui => [oui, 'D-Link'] as OUIEntry),

  // Netgear (routers/APs)
  ...[
    '0013d4','001f33','00224b','08bd43','0c8063','2c3282','3c22fb','40463e',
    '4c60de','6038e0','7854cf','7c8cca','900f52','a42b8c','b0a7b9','c43dc7',
    'dce9e8','e0db55','f04f7c','607b89',
  ].map(oui => [oui, 'Netgear'] as OUIEntry),

  // Tenda (budget routers)
  ...[
    '500c0f','5c628b','6cb4ce','782bcb','840d8e','908d6c','c071bf','c83f65',
    'd8bbd1','ec172f',
  ].map(oui => [oui, 'Tenda'] as OUIEntry),

  // ═══════════════════════════════════════════════════════════════
  // 5. VIRTUAL MACHINE ADAPTERS (test environments, VPN clients)
  // ═══════════════════════════════════════════════════════════════

  // VMware (ESXi, Workstation, Fusion)
  ...[
    '000c29','005056','001c14','00c029','000569','b4a942','c8b0c2',
    'c89c1d','2c8c2c','1caac7','38a5b6','506e14','5c3642','704d73',
    '7c6dce','8c1ac3','a47b83','b2c45a','d0c022','e0c710','f06819',
    'f8b156','00a0c5','b27423','5858a8','a8a48a','782bcb','386077',
  ].map(oui => [oui, 'VMware'] as OUIEntry),

  // VirtualBox (Oracle)
  ...[
    '080027','084a0c','0a0027','080028','0021f6','087102','a0c9a0',
    'b8ac6f','508821','5c7514','f48cae','006d75','782bcb','080027',
  ].map(oui => [oui, 'VirtualBox'] as OUIEntry),

  // Hyper-V / Microsoft Virtual PC
  ...[
    '00155d','001dd8','401345','525400','003876','7eef01','28183b',
  ].map(oui => [oui, 'Hyper-V'] as OUIEntry),

  // KVM / QEMU / libvirt
  ...[
    '525400','fe5400','5a2282','fe5500','5e0c52','2a050c','3a2805',
    '56a40e','7a460c','c6392e','b62c9e','8cf016','d2a0a8','e04c24',
  ].map(oui => [oui, 'KVM'] as OUIEntry),

  // Parallels (macOS virtualization)
  ...[
    '001c42','00c0df','001cff','0a003e','0a00bc','0a00e0','0a0040',
    '0a00d1','0a00c0','0a00f0','6a1ca2','b8a860','c82f71','0a0000',
  ].map(oui => [oui, 'Parallels'] as OUIEntry),

  // Docker / Container Linux
  ...[
    '02420c','02423e','0242ac','024264','0242b4','0242f0','0242f8',
    '02e4dc','0254e8','0264b9','02cf2c','0268cc','02789c','02a64e',
  ].map(oui => [oui, 'Docker'] as OUIEntry),
];

// ---------------------------------------------------------------------------
// Build deduplicated map: first entry wins (priority-ordered above)
// ---------------------------------------------------------------------------

const OUI_MAP: Record<string, string> = {};
for (const [oui, vendor] of RAW_OUI_ENTRIES) {
  if (!OUI_MAP[oui]) {
    OUI_MAP[oui] = vendor;
  }
}

// ---------------------------------------------------------------------------
// Vendor → Device info mapping
// ---------------------------------------------------------------------------

interface VendorInfo {
  vendor: string;
  deviceName: string;
  deviceType: string;
  os: string;
}

const VENDOR_DEVICE_MAP: Record<string, VendorInfo> = {
  'Apple':      { vendor: 'Apple',      deviceName: 'Apple Device',   deviceType: 'mobile',  os: 'iOS' },
  'Samsung':    { vendor: 'Samsung',    deviceName: 'Samsung Device', deviceType: 'mobile',  os: 'Android' },
  'Xiaomi':     { vendor: 'Xiaomi',     deviceName: 'Xiaomi Device',  deviceType: 'mobile',  os: 'Android' },
  'Huawei':     { vendor: 'Huawei',     deviceName: 'Huawei Device',  deviceType: 'mobile',  os: 'Android' },
  'OPPO':       { vendor: 'OPPO',       deviceName: 'OPPO Device',    deviceType: 'mobile',  os: 'Android' },
  'Vivo':       { vendor: 'Vivo',       deviceName: 'Vivo Device',    deviceType: 'mobile',  os: 'Android' },
  'OnePlus':    { vendor: 'OnePlus',    deviceName: 'OnePlus Device', deviceType: 'mobile',  os: 'Android' },
  'Realme':     { vendor: 'Realme',     deviceName: 'Realme Device',  deviceType: 'mobile',  os: 'Android' },
  'Honor':      { vendor: 'Honor',      deviceName: 'Honor Device',   deviceType: 'mobile',  os: 'Android' },
  'Google':     { vendor: 'Google',     deviceName: 'Google Device',  deviceType: 'mobile',  os: 'Android' },
  'Nokia':      { vendor: 'Nokia',      deviceName: 'Nokia Device',   deviceType: 'mobile',  os: 'Android' },
  'Sony':       { vendor: 'Sony',       deviceName: 'Sony Device',    deviceType: 'mobile',  os: 'Android' },
  'LG':         { vendor: 'LG',         deviceName: 'LG Device',      deviceType: 'mobile',  os: 'Android' },
  'Motorola':   { vendor: 'Motorola',   deviceName: 'Motorola Device',deviceType: 'mobile',  os: 'Android' },
  'Infinix':    { vendor: 'Infinix',    deviceName: 'Infinix Device', deviceType: 'mobile',  os: 'Android' },
  'Tecno':      { vendor: 'Tecno',      deviceName: 'Tecno Device',   deviceType: 'mobile',  os: 'Android' },
  'Nothing':    { vendor: 'Nothing',    deviceName: 'Nothing Device', deviceType: 'mobile',  os: 'Android' },
  'Amazon':     { vendor: 'Amazon',     deviceName: 'Amazon Device',  deviceType: 'mobile',  os: 'Fire OS' },
  'Microsoft':  { vendor: 'Microsoft',  deviceName: 'Windows PC',     deviceType: 'desktop', os: 'Windows' },
  'Dell':       { vendor: 'Dell',       deviceName: 'Dell PC',        deviceType: 'desktop', os: 'Windows' },
  'HP':         { vendor: 'HP',         deviceName: 'HP PC',          deviceType: 'desktop', os: 'Windows' },
  'Lenovo':     { vendor: 'Lenovo',     deviceName: 'Lenovo PC',      deviceType: 'desktop', os: 'Windows' },
  'Asus':       { vendor: 'Asus',       deviceName: 'Asus Device',    deviceType: 'desktop', os: 'Windows' },
  'Acer':       { vendor: 'Acer',       deviceName: 'Acer PC',        deviceType: 'desktop', os: 'Windows' },
  'Roku':       { vendor: 'Roku',       deviceName: 'Roku',          deviceType: 'tv',      os: 'Smart TV' },
  'Chromecast': { vendor: 'Chromecast', deviceName: 'Chromecast',    deviceType: 'tv',      os: 'Smart TV' },
  'MikroTik':   { vendor: 'MikroTik',   deviceName: 'MikroTik AP',   deviceType: 'router',  os: 'RouterOS' },
  'Ruckus':     { vendor: 'Ruckus',     deviceName: 'Ruckus AP',     deviceType: 'router',  os: 'Router OS' },
  'Ubiquiti':   { vendor: 'Ubiquiti',   deviceName: 'Ubiquiti AP',   deviceType: 'router',  os: 'Router OS' },
  'Cisco':      { vendor: 'Cisco',      deviceName: 'Cisco AP',      deviceType: 'router',  os: 'Router OS' },
  'Aruba':      { vendor: 'Aruba',      deviceName: 'Aruba AP',      deviceType: 'router',  os: 'Router OS' },
  'TP-Link':    { vendor: 'TP-Link',    deviceName: 'TP-Link',       deviceType: 'router',  os: 'Router OS' },
  'D-Link':     { vendor: 'D-Link',     deviceName: 'D-Link',        deviceType: 'router',  os: 'Router OS' },
  'Netgear':    { vendor: 'Netgear',    deviceName: 'Netgear',       deviceType: 'router',  os: 'Router OS' },
  'Tenda':      { vendor: 'Tenda',      deviceName: 'Tenda',         deviceType: 'router',  os: 'Router OS' },
  'VMware':     { vendor: 'VMware',     deviceName: 'VMware VM',     deviceType: 'desktop', os: 'VMware' },
  'VirtualBox': { vendor: 'VirtualBox', deviceName: 'VirtualBox VM', deviceType: 'desktop', os: 'Virtual' },
  'Hyper-V':    { vendor: 'Hyper-V',    deviceName: 'Hyper-V VM',    deviceType: 'desktop', os: 'Virtual' },
  'KVM':        { vendor: 'KVM',        deviceName: 'KVM VM',        deviceType: 'desktop', os: 'Virtual' },
  'Parallels':  { vendor: 'Parallels',  deviceName: 'Parallels VM',  deviceType: 'desktop', os: 'Virtual' },
  'Docker':     { vendor: 'Docker',     deviceName: 'Docker',        deviceType: 'desktop', os: 'Linux' },
};

// ---------------------------------------------------------------------------
// Helper: normalize MAC to 6-char OUI (lowercase, no separators)
// ---------------------------------------------------------------------------

function normalizeMac(mac: string): string {
  return mac.replace(/[:\-.]/g, '').toLowerCase().slice(0, 6);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up vendor from MAC OUI.
 * Returns vendor name or null if unknown.
 */
export function lookupVendor(mac: string): string | null {
  if (!mac) return null;
  const oui = normalizeMac(mac);
  return OUI_MAP[oui] || null;
}

/**
 * Infer device info from MAC OUI.
 * Returns { deviceName, deviceType, os, vendor } — falls back to "Unknown".
 */
export function inferDeviceInfo(mac: string): {
  deviceName: string;
  deviceType: string;
  os: string;
  vendor: string;
} {
  const vendor = lookupVendor(mac);

  if (!vendor) {
    return { deviceName: 'Unknown', deviceType: 'unknown', os: 'Unknown', vendor: 'Unknown' };
  }

  const info = VENDOR_DEVICE_MAP[vendor];
  if (!info) {
    return { deviceName: vendor, deviceType: 'unknown', os: 'Unknown', vendor };
  }

  return {
    deviceName: info.deviceName,
    deviceType: info.deviceType,
    os: info.os,
    vendor: info.vendor,
  };
}
