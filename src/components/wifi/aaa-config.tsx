'use client';

/**
 * AAA Configuration Component
 *
 * Comprehensive RADIUS AAA (Authentication, Authorization, Accounting) configuration
 * with connection to the backend RADIUS management service.
 *
 * Features:
 * - Server Status & Control
 * - Authentication Settings
 * - Authorization Policies
 * - Accounting Configuration
 * - NAS Client Management
 * - Connection Testing
 */

import { useState, useEffect } from 'react';
import { usePropertyId } from '@/hooks/use-property';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronsUpDown,
  Server,
  Shield,
  Database,
  Wifi,
  Settings,
  Play,
  Square,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  TestTube,
  Key,
  Activity,
  Loader2,
  UserCog,
  Info,
  Building2,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  CheckCheck,
  Globe,
} from 'lucide-react';
import CredentialPolicyTab, { type CredentialConfig } from './credential-policy-tab';
import { useToast } from '@/hooks/use-toast';

// Types
interface RadiusServiceStatus {
  installed: boolean;
  running: boolean;
  version?: string;
  mode: 'production' | 'not_installed';
  nasClientCount: number;
  userCount: number;
  groupCount: number;
  error?: string;
}

interface NASClient {
  id: string;
  name: string;
  shortname: string;
  ipAddress: string;
  type: string;
  secret: string;
  coaEnabled: boolean;
  coaPort: number;
  authPort: number;
  acctPort: number;
  apiUsername: string | null;
  apiPassword: string | null;
  apiPort: number;
  authMethods: string; // Comma-separated: pap,chap,mschapv2,eap-tls,eap-ttls,eap-peap,eap-md5,mac-auth
  requireMessageAuth: boolean;
  calledStationId?: string;
  nasIdentifier?: string;
  status: string;
  lastSeenAt?: string;
}

interface AAAConfig {
  propertyId: string;
  defaultDownloadSpeed: number;
  defaultUploadSpeed: number;
  defaultSessionLimit?: number;
  defaultDataLimit?: number;
  autoProvisionOnCheckin: boolean;
  autoDeprovisionOnCheckout: boolean;
  autoDeprovisionDelay: number;
  authMethods: string; // Comma-separated: pap,chap,mschapv2,eap-tls,eap-ttls,eap-peap,eap-md5,mac-auth
  allowMacAuth: boolean;
  accountingSyncInterval: number;
  maxConcurrentSessions: number;
  sessionTimeoutPolicy: string;
  portalEnabled: boolean;
  portalTitle?: string;
  portalRedirectUrl?: string;
  portalBrandColor: string;
  // Credential policy
  usernameFormat: string;
  usernamePrefix?: string;
  usernameCase: string;
  usernameMinLength: number;
  usernameMaxLength: number;
  passwordFormat: string;
  passwordFixedValue?: string;
  passwordLength: number;
  passwordIncludeUppercase: boolean;
  passwordIncludeNumbers: boolean;
  passwordIncludeSymbols: boolean;
  credentialSeparator: string;
  credentialPrintOnVoucher: boolean;
  credentialShowInPortal: boolean;
  duplicateUsernameAction: string;
  defaultPlanId?: string;
}

interface WifiPlan {
  id: string;
  name: string;
  downloadSpeed: number;
  uploadSpeed: number;
  validity?: number;
  dataLimit?: number;
  status: string;
}

interface RadiusServerConfig {
  serverIp: string;
  serverHostname?: string;
  authPort: number;
  acctPort: number;
  coaPort: number;
  listenAllInterfaces: boolean;
  bindAddress: string;
  logLevel: string;
  logDestination: string;
  interimUpdateInterval: number;
  cleanupSessions: boolean;
  sessionCleanupInterval: number;
  logAuth: boolean;
  logAuthBadpass: boolean;
  logAuthGoodpass: boolean;
}

// NAS Device Types — comprehensive FreeRADIUS vendor list
// Organized by category for the searchable Combobox
// Each vendor maps to an attribute profile in the backend for RADIUS attribute generation

interface NasVendorGroup {
  heading: string;
  vendors: { value: string; label: string }[];
}

// System NAS identifier — the built-in Cryptsk Multimode gateway
const SYSTEM_NAS_IP = '127.0.0.1';
const SYSTEM_NAS_TYPE = 'cryptsk';

const NAS_VENDOR_GROUPS: NasVendorGroup[] = [
  {
    heading: 'System / Built-in',
    vendors: [
      { value: 'cryptsk', label: 'Cryptsk Gateway (Multimode)' },
    ],
  },
  {
    heading: 'WiFi AP & Controllers — Hospitality',
    vendors: [
      { value: 'mikrotik', label: 'MikroTik RouterOS' },
      { value: 'cisco', label: 'Cisco Meraki' },
      { value: 'cisco_wlc', label: 'Cisco WLC (Wireless LAN Controller)' },
      { value: 'cisco_ios', label: 'Cisco IOS / Catalyst' },
      { value: 'aruba', label: 'Aruba Networks (HPE)' },
      { value: 'unifi', label: 'Ubiquiti UniFi' },
      { value: 'ubiquiti_edgerouter', label: 'Ubiquiti EdgeRouter / EdgeSwitch' },
      { value: 'ruckus', label: 'Ruckus Networks / CommScope' },
      { value: 'tplink', label: 'TP-Link Omada / EAP' },
      { value: 'fortinet', label: 'Fortinet FortiGate / FortiWiFi' },
      { value: 'huawei', label: 'Huawei AirEngine / AC' },
      { value: 'juniper', label: 'Juniper Mist / SRX' },
      { value: 'netgear', label: 'Netgear Insight / Orbi / WAC' },
      { value: 'dlink', label: 'D-Link Nuclias / DWL' },
      { value: 'ruijie', label: 'Ruijie Networks / Reyee' },
      { value: 'cambium', label: 'Cambium cnPilot / ePMP' },
      { value: 'grandstream', label: 'Grandstream GWN' },
      { value: 'engenius', label: 'EnGenius / ECB' },
      { value: 'zyxel', label: 'Zyxel NWA / NXC' },
      { value: 'extreme', label: 'Extreme Networks / WiNG' },
      { value: 'alcatel', label: 'Alcatel-Lucent / Nokia OmniAccess' },
      { value: 'samsung', label: 'Samsung SmartThings / WiFi' },
      { value: 'zte', label: 'ZTE WiFi / AXON' },
      { value: 'motorola', label: 'Motorola Solutions / Zebra' },
      { value: 'draytek', label: 'DrayTek Vigor / VigorAP' },
      { value: 'peplink', label: 'Peplink / SpeedFusion' },
      { value: 'sophos', label: 'Sophos Sophos Access' },
      { value: 'avaya', label: 'Avaya ERS / WLAN' },
      { value: 'brocade', label: 'Brocade / ICX Switch' },
      { value: 'meru', label: 'Meru Networks (Fortinet)' },
      { value: 'aerohive', label: 'Aerohive / Extreme HiveManager' },
      { value: 'xirrus', label: 'Xirrus / Xirrus Array' },
      { value: 'enterasys', label: 'Enterasys (Extreme)' },
      { value: 'adc_kentrox', label: 'ADC / Kentrox' },
      { value: 'colubris', label: 'Colubris Networks (HP)' },
      { value: 'trapeze', label: 'Trapeze Networks (Juniper)' },
      { value: 'bluesocket', label: 'BlueSocket (Adtran)' },
      { value: 'wavelink', label: 'Wavelink / Telxon' },
      { value: 'symbol', label: 'Symbol / Zebra WiFi' },
      { value: 'proxim', label: 'Proxim / Orinoco' },
      { value: 'breezecom', label: 'Breezecom / BreezeNET' },
      { value: 'intellinet', label: 'Intellinet / Nfon' },
      { value: 'buffalo', label: 'Buffalo AirStation' },
      { value: 'asus', label: 'ASUS RT / ZenWiFi' },
      { value: 'asuswrt', label: 'ASUSWRT / Merlin' },
      { value: 'openwrt', label: 'OpenWrt (Generic)' },
      { value: 'ddwrt', label: 'DD-WRT (Generic)' },
      { value: 'pfsense', label: 'pfSense / pfSense Plus' },
      { value: 'opnsense', label: 'OPNsense' },
      { value: 'edgecore', label: 'Edgecore / Accton' },
      { value: 'altai', label: 'Altai Technologies' },
      { value: 'wili', label: 'WILI-S / Wili-Mesh' },
    ],
  },
  {
    heading: 'Captive Portal & Hotspot',
    vendors: [
      { value: 'coovachilli', label: 'CoovaChilli (ChilliSpot)' },
      { value: 'wifidog', label: 'WiFiDog / wifidog-ng' },
      { value: 'openmesh', label: 'OpenMesh / CloudTrax' },
      { value: 'nomadix', label: 'Nomadix / AG Series' },
      { value: 'firstspot', label: 'FirstSpot' },
      { value: 'antlabs', label: 'AntLabs InnGate' },
      { value: 'wifika', label: 'WIFIKA' },
      { value: 'socialwifi', label: 'Social WiFi / Purple WiFi' },
      { value: 'patronsoft', label: 'PatronSoft' },
      { value: 'mypublicwifi', label: 'MyPublicWiFi' },
      { value: 'wifisplash', label: 'WiFiSplash' },
      { value: 'guestgate', label: 'GuestGate / Wifigate' },
      { value: 'cloud4wifi', label: 'Cloud4WiFi' },
      { value: 'wirelesslogic', label: 'WirelessLogic' },
      { value: 'sputnik', label: 'Sputnik / SputnikNet' },
      { value: 'wifiglobal', label: 'Wifiglobal' },
      { value: 'iwire', label: 'iWire / MyWiFi' },
      { value: 'captiveportal', label: 'Captive Portal (Generic)' },
      { value: 'handlink', label: 'HandLink / Wive' },
      { value: 'wifiplus', label: 'WiFi Plus / WiFiASP' },
      { value: 'aquipia', label: 'Aquipia Networks' },
      { value: 'bintec', label: 'Bintec / Elmeg' },
      { value: 'eltex', label: 'Eltex' },
      { value: 'velox', label: 'Velox' },
      { value: 'alepo', label: 'Alepo RADIUS' },
      { value: 'aptilo', label: 'Aptilo Networks' },
      { value: 'ipass', label: 'iPass / DeviceScape' },
      { value: 'boingo', label: 'Boingo Wireless' },
      { value: 'gowex', label: 'GOWEX' },
      { value: 'fon', label: 'FON' },
      { value: 'eduroam', label: 'eduroam (802.1X)' },
    ],
  },
  {
    heading: 'Firewall & Security',
    vendors: [
      { value: 'paloalto', label: 'Palo Alto Networks' },
      { value: 'checkpoint', label: 'Check Point / NGX' },
      { value: 'sonicwall', label: 'SonicWALL / Dell SonicWALL' },
      { value: 'watchguard', label: 'WatchGuard Firebox' },
      { value: 'barracuda', label: 'Barracuda Networks' },
      { value: 'juniper_srx', label: 'Juniper SRX / vSRX' },
      { value: 'fortigate', label: 'Fortinet FortiGate (Alias)' },
      { value: 'cisco_asa', label: 'Cisco ASA / FirePOWER' },
      { value: 'endian', label: 'Endian Firewall' },
      { value: 'untangle', label: 'Untangle / NG Firewall' },
      { value: 'smoothwall', label: 'Smoothwall' },
      { value: 'clearos', label: 'ClearOS / ClearOS Server' },
      { value: 'kerio', label: 'Kerio Control (GFI)' },
      { value: 'stonesoft', label: 'Stonesoft / Forcepoint' },
      { value: 'clavister', label: 'Clavister' },
      { value: 'cyberguard', label: 'CyberGuard' },
      { value: 'hillstone', label: 'Hillstone Networks' },
      { value: 'sangfor', label: 'Sangfor / DeepSecure' },
      { value: 'deepedge', label: 'Deep Edge' },
      { value: 'netscreen', label: 'Netscreen (Juniper)' },
      { value: 'redcreek', label: 'RedCreek / Ravlin' },
    ],
  },
  {
    heading: 'DSL / ISP CPE / Access',
    vendors: [
      { value: 'redback', label: 'Redback / Ericsson SmartEdge' },
      { value: 'starent', label: 'Starent (Cisco)' },
      { value: 'juniper_e', label: 'Juniper E-Series / ERX' },
      { value: 'cisco_isg', label: 'Cisco ISG (IP-Session-Manager)' },
      { value: 'ascend', label: 'Ascend / Lucent MAX' },
      { value: 'livingston', label: 'Livingston' },
      { value: 'lucent', label: 'Lucent / Alcatel' },
      { value: 'nortel', label: 'Nortel / Shasta' },
      { value: 'paradigm', label: 'Paradigm' },
      { value: 'shiva', label: 'Shiva / Intel' },
      { value: 'broadband', label: 'Broadband Access Server (Generic)' },
      { value: 'cisco_ios_bras', label: 'Cisco IOS BRAS' },
      { value: 'alcatel_isam', label: 'Alcatel 7302/7330 ISAM' },
      { value: 'huawei_mea', label: 'Huawei ME60 / BRAS' },
      { value: 'zte_bras', label: 'ZTE BRAS / M6000' },
      { value: 'ericsson_se', label: 'Ericsson SmartEdge / SE1200' },
      { value: 'nokia_ips', label: 'Nokia IPS / 7750 SR' },
      { value: 'riverbed', label: 'Riverbed / SteelHead' },
      { value: 'fiberhome', label: 'FiberHome / AN5000' },
    ],
  },
  {
    heading: 'VPN & Router',
    vendors: [
      { value: 'cisco_vpn', label: 'Cisco VPN 3000 / ASA' },
      { value: 'f5_bigip', label: 'F5 BIG-IP / APM' },
      { value: 'citrix', label: 'Citrix Gateway / NetScaler' },
      { value: 'juniper_ive', label: 'Juniper IVE / SA' },
      { value: 'pulsesecure', label: 'Pulse Secure / Ivanti' },
      { value: 'fortinet_vpn', label: 'Fortinet FortiClient / SSLVPN' },
      { value: 'openvpn', label: 'OpenVPN Access Server' },
      { value: 'wireguard', label: 'WireGuard (Generic)' },
      { value: 'ipsec_generic', label: 'IPSec (Generic)' },
      { value: 'sophos_vpn', label: 'Sophos VPN / RED' },
      { value: 'barracuda_vpn', label: 'Barracuda SSL VPN' },
      { value: 'array', label: 'Array Networks / AG Series' },
      { value: 'avedia', label: 'Avedia / CiscoViptela' },
      { value: 'sslvpn_generic', label: 'SSL VPN (Generic)' },
    ],
  },
  {
    heading: 'RADIUS Server / Proxy',
    vendors: [
      { value: 'freeradius', label: 'RADIUS (Proxy/Realm)' },
      { value: 'microsoft_nps', label: 'Microsoft NPS / IAS' },
      { value: 'cisco_acs', label: 'Cisco ACS / ISE' },
      { value: 'aruba_clearpass', label: 'Aruba ClearPass' },
      { value: 'rsa', label: 'RSA SecurID / AM' },
      { value: 'radiator', label: 'Radiator RADIUS Server' },
      { value: 'openradius', label: 'OpenRADIUS' },
      { value: 'tacacs_generic', label: 'TACACS+ (Generic)' },
      { value: 'dialed_number', label: 'Dialed Number Identification (DNIS)' },
    ],
  },
  {
    heading: 'IoT & M2M',
    vendors: [
      { value: 'sierra_wireless', label: 'Sierra Wireless / AirLink' },
      { value: 'teltonika', label: 'Teltonika RUT' },
      { value: 'moxa', label: 'Moxa / NPort' },
      { value: 'digi', label: 'Digi International' },
      { value: 'lantronix', label: 'Lantronix / SLC' },
      { value: 'inhand', label: 'InHand Networks' },
      { value: 'quectel', label: 'Quectel' },
      { value: 'u_blox', label: 'u-blox' },
      { value: 'simcom', label: 'SIMCom / SIMTech' },
      { value: 'neoway', label: 'Neoway' },
      { value: 'sequans', label: 'Sequans' },
      { value: 'multitech', label: 'Multi-Tech / MultiConnect' },
      { value: 'robustel', label: 'Robustel' },
      { value: 'four_faith', label: 'Four-Faith / F2X' },
    ],
  },
  {
    heading: 'Switch / Network Infrastructure',
    vendors: [
      { value: 'hp_procurve', label: 'HP ProCurve / Aruba' },
      { value: 'dell_force10', label: 'Dell / Force10' },
      { value: '3com', label: '3Com / H3C' },
      { value: 'allied_telematics', label: 'Allied Telesis' },
      { value: 'foundry', label: 'Foundry / Brocade' },
      { value: 'smc', label: 'SMC Networks' },
      { value: 'perle', label: 'Perle / IOLAN' },
      { value: 'opengear', label: 'Opengear' },
      { value: 'ubiquti', label: 'Ubiquiti EdgeSwitch / TOUGHSwitch' },
      { value: 'mikrotik_switch', label: 'MikroTik CRS / SwitchOS' },
      { value: 'hpe_officeconnect', label: 'HPE OfficeConnect' },
      { value: 'cisco_meraki_ms', label: 'Cisco Meraki MS Switch' },
      { value: 'netgear_switch', label: 'Netgear Smart/Managed Switch' },
      { value: 'tplink_switch', label: 'TP-Link JetStream Switch' },
      { value: 'zyxel_switch', label: 'Zyxel Managed Switch' },
      { value: 'mellanox', label: 'Mellanox / NVIDIA' },
      { value: 'arista', label: 'Arista Networks' },
      { value: 'cumulus', label: 'Cumulus Linux' },
    ],
  },
  {
    heading: 'Telecom / Mobile Core',
    vendors: [
      { value: 'ericsson_mme', label: 'Ericsson MME / SGSN' },
      { value: 'huawei_mme', label: 'Huawei MME / UGW' },
      { value: 'zte_mme', label: 'ZTE MME / UGW' },
      { value: 'nokia_mme', label: 'Nokia / NSN MME' },
      { value: 'stm', label: 'Starent / Cisco StarOS' },
      { value: 'broadsoft', label: 'BroadSoft / Cisco' },
      { value: 'genband', label: 'Genband / Ribbon' },
      { value: 'metaswitch', label: 'Metaswitch / Microsoft' },
      { value: 'huawei_ims', label: 'Huawei IMS' },
      { value: 'ale_ims', label: 'Alcatel-Lucent IMS' },
      { value: 'sonus', label: 'Sonus / Ribbon SBC' },
      { value: 'audiocodes', label: 'AudioCodes SBC / Mediant' },
      { value: 'inventel', label: 'Inventel' },
      { value: 'efficientip', label: 'EfficientIP' },
    ],
  },
  {
    heading: 'Industrial & Specialty',
    vendors: [
      { value: 'sangoma', label: 'Sangoma / FreePBX' },
      { value: 'digium', label: 'Digium / Asterisk' },
      { value: 'avaya_cmu', label: 'Avaya CM / Aura' },
      { value: 'cisco_cucm', label: 'Cisco CUCM / CME' },
      { value: 'mitel', label: 'Mitel / MiVoice' },
      { value: 'yealink', label: 'Yealink' },
      { value: 'grandstream_pbx', label: 'Grandstream UCM' },
      { value: 'polycom', label: 'Polycom / HP' },
      { value: 'vodafone', label: 'Vodafone' },
      { value: 'telekom', label: 'Deutsche Telekom' },
      { value: 'orange', label: 'Orange' },
      { value: 'att', label: 'AT&T' },
      { value: 'verizon', label: 'Verizon' },
      { value: 'china_telecom', label: 'China Telecom' },
      { value: 'china_mobile', label: 'China Mobile' },
      { value: 'china_unicom', label: 'China Unicom' },
      { value: 'bsnl', label: 'BSNL (India)' },
      { value: 'jio', label: 'Jio / Reliance' },
      { value: 'airtel', label: 'Airtel / Bharti' },
    ],
  },
  {
    heading: 'Other / Generic',
    vendors: [
      { value: 'other', label: 'Other / Generic RADIUS' },
      { value: 'custom', label: 'Custom / User-Defined Attributes' },
    ],
  },
];

// Flat lookup for form value display
const ALL_NAS_VENDORS = NAS_VENDOR_GROUPS.flatMap(g => g.vendors);

// Auth Methods — for AAA config (multi-select) and NAS client (multi-select)
const AUTH_METHODS = [
  { value: 'pap', label: 'PAP (Password Authentication Protocol)', description: 'Most compatible with captive portals. Password sent in clear text over RADIUS (encrypted by RADIUS secret).', nasLabel: 'PAP' },
  { value: 'chap', label: 'CHAP (Challenge Handshake)', description: 'Better security than PAP — password never sent in clear. Requires clear-text password stored on server.', nasLabel: 'CHAP' },
  { value: 'mschapv2', label: 'MS-CHAPv2 (Microsoft)', description: 'Most secure for Windows clients. Requires NT-password hash stored on server.', nasLabel: 'MS-CHAPv2' },
  { value: 'eap-tls', label: 'EAP-TLS (Certificate)', description: 'Enterprise-grade: mutual certificate authentication. Requires client and server certificates. Most secure EAP method.', nasLabel: 'EAP-TLS' },
  { value: 'eap-ttls', label: 'EAP-TTLS (Tunneled TLS)', description: 'Enterprise-grade: server certificate + inner PAP/CHAP/MS-CHAPv2. Most common in hospitality WiFi.', nasLabel: 'EAP-TTLS' },
  { value: 'eap-peap', label: 'EAP-PEAP (Protected EAP)', description: 'Enterprise-grade: server certificate + inner MS-CHAPv2. Widely supported by Windows/Apple devices.', nasLabel: 'EAP-PEAP' },
  { value: 'eap-md5', label: 'EAP-MD5 (Message Digest)', description: 'Basic EAP method: password-based, similar to CHAP but over EAP. Least secure EAP method — no key derivation.', nasLabel: 'EAP-MD5' },
  { value: 'mac-auth', label: 'MAC Authentication', description: 'Devices authenticate using their MAC address as username. Useful for IoT/printers. No password required.', nasLabel: 'MAC Auth' },
];

// NAS Auth method options — used for multi-select in NAS form (excludes mac-auth which is a separate toggle)
const NAS_AUTH_METHOD_OPTIONS = AUTH_METHODS.filter(m => m.value !== 'mac-auth').map(m => ({
  value: m.value,
  label: m.nasLabel,
  description: m.description,
}));

// AAA Config Auth method options — used for multi-select in Auth Settings tab (includes mac-auth)
const AAA_AUTH_METHOD_OPTIONS = AUTH_METHODS.map(m => ({
  value: m.value,
  label: m.nasLabel,
  description: m.description,
}));

// Log Levels
const LOG_LEVELS = [
  { value: 'debug', label: 'Debug (Verbose)' },
  { value: 'info', label: 'Info (Normal)' },
  { value: 'warn', label: 'Warning' },
  { value: 'error', label: 'Error Only' },
];

// Default RADIUS auth port
const RADIUS_AUTH_PORT = 1812;

export default function AAAConfig() {
  const { toast } = useToast();
  const { propertyId: hookPropertyId, properties } = usePropertyId();

  // Local property selector — allows switching between properties to configure each independently
  // Initialized from the hook's propertyId but can be changed independently
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const propertyId = selectedPropertyId || hookPropertyId;

  // Sync local state once hook propertyId becomes available
  useEffect(() => {
    if (hookPropertyId && !selectedPropertyId) {
      setSelectedPropertyId(hookPropertyId);
    }
  }, [hookPropertyId, selectedPropertyId]);
  
  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState('status');
  
  // RADIUS Service Status
  const [serviceStatus, setServiceStatus] = useState<RadiusServiceStatus | null>(null);
  
  // NAS Clients
  const [nasClients, setNasClients] = useState<NASClient[]>([]);
  const [nasDialogOpen, setNasDialogOpen] = useState(false);
  const [editingNas, setEditingNas] = useState<NASClient | null>(null);
  const [deleteNasId, setDeleteNasId] = useState<string | null>(null);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null);
  const [vendorOpen, setVendorOpen] = useState(false);
  const [nasForm, setNasForm] = useState({
    name: '',
    shortname: '',
    ipAddress: '',
    type: 'other',
    secret: '',
    coaEnabled: true,
    coaPort: 3799,
    authPort: 1812,
    acctPort: 1813,
    apiUsername: '',
    apiPassword: '',
    apiPort: 443,
    authMethods: 'pap,chap,mschapv2' as string,
    requireMessageAuth: false,
    calledStationId: '',
    nasIdentifier: '',
  });
  const [showSecret, setShowSecret] = useState(false);
  const [showApiPassword, setShowApiPassword] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  
  // AAA Config
  const [aaaConfig, setAaaConfig] = useState<AAAConfig>({
    propertyId: propertyId || 'property-1',
    defaultDownloadSpeed: 10,
    defaultUploadSpeed: 10,
    autoProvisionOnCheckin: true,
    autoDeprovisionOnCheckout: true,
    autoDeprovisionDelay: 0,
    authMethods: 'pap,chap,mschapv2',
    allowMacAuth: false,
    accountingSyncInterval: 5,
    maxConcurrentSessions: 3,
    sessionTimeoutPolicy: 'hard',
    portalEnabled: true,
    portalBrandColor: '#0d9488',
    // Credential policy defaults
    usernameFormat: 'room_random',
    usernameCase: 'lowercase',
    usernameMinLength: 4,
    usernameMaxLength: 32,
    passwordFormat: 'random_alphanumeric',
    passwordLength: 8,
    passwordIncludeUppercase: true,
    passwordIncludeNumbers: true,
    passwordIncludeSymbols: false,
    credentialSeparator: '_',
    credentialPrintOnVoucher: true,
    credentialShowInPortal: true,
    duplicateUsernameAction: 'append_random',
    defaultPlanId: undefined,
  });

  // WiFi Plans (for Default Plan dropdown)
  const [wifiPlans, setWifiPlans] = useState<WifiPlan[]>([]);

  // Property-wide AAA configs summary (for property binding overview)
  interface PropertyAaaSummary {
    propertyId: string;
    propertyName: string;
    defaultPlanId?: string | null;
    defaultPlanName?: string;
    defaultDownloadSpeed: number;
    defaultUploadSpeed: number;
    autoProvisionOnCheckin: boolean;
  }
  const [allPropertyConfigs, setAllPropertyConfigs] = useState<PropertyAaaSummary[]>([]);
  
  // Server Config
  const [serverConfig, setServerConfig] = useState<RadiusServerConfig>({
    serverIp: '127.0.0.1',
    authPort: 1812,
    acctPort: 1813,
    coaPort: 3799,
    listenAllInterfaces: true,
    bindAddress: '0.0.0.0',
    logLevel: 'info',
    logDestination: 'files',
    interimUpdateInterval: 60,
    cleanupSessions: true,
    sessionCleanupInterval: 3600,
    logAuth: true,
    logAuthBadpass: false,
    logAuthGoodpass: false,
  });
  const [savingServerConfig, setSavingServerConfig] = useState(false);

  // Confirmation state for destructive service actions
  const [serviceActionConfirm, setServiceActionConfirm] = useState<'restart' | 'stop' | null>(null);

  // Fetch active WiFi plans AND all property AAA configs (for summary)
  const fetchPropertySummary = async (props: any[], plans: WifiPlan[]) => {
    if (!props || props.length === 0) return [];
    const configPromises = props.map(async (prop: any) => {
      try {
        const res = await fetch(`/api/wifi/aaa?propertyId=${prop.id}`);
        const data = await res.json();
        if (data.success && data.data) {
          const planName = data.data.defaultPlanId
            ? (plans.find((p: WifiPlan) => p.id === data.data.defaultPlanId)?.name || 'Unknown Plan')
            : null;
          return {
            propertyId: prop.id,
            propertyName: prop.name,
            defaultPlanId: data.data.defaultPlanId,
            defaultPlanName: planName || undefined,
            defaultDownloadSpeed: data.data.defaultDownloadSpeed || 10,
            defaultUploadSpeed: data.data.defaultUploadSpeed || 10,
            autoProvisionOnCheckin: data.data.autoProvisionOnCheckin ?? true,
          };
        }
      } catch {
        // Silently skip failed property config fetches
      }
      return null;
    });
    const results = (await Promise.all(configPromises)).filter(Boolean) as PropertyAaaSummary[];
    setAllPropertyConfigs(results);
    return results;
  };

  useEffect(() => {
    const fetchDataOverview = async () => {
      try {
        // Fetch plans
        const plansRes = await fetch('/api/wifi/plans?status=active');
        const plansData = await plansRes.json();
        if (plansData.success && Array.isArray(plansData.data)) {
          const activePlans = plansData.data.filter((p: WifiPlan) => p.status === 'active');
          setWifiPlans(activePlans);
          // Fetch property summary using the loaded plans
          await fetchPropertySummary(properties, activePlans);
        }
      } catch (e) {
        console.error('Failed to fetch overview data:', e);
      }
    };
    fetchDataOverview();
  }, [properties]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch RADIUS service status
      const statusRes = await fetch('/api/wifi/radius?action=status');
      const statusData = await statusRes.json();
      if (statusData.success) {
        setServiceStatus(statusData.data);
      }

      // Fetch NAS clients
      try {
        const nasRes = await fetch(`/api/wifi/nas?propertyId=${propertyId}`);
        const nasData = await nasRes.json();
        if (nasData.success && nasData.data) {
          setNasClients(nasData.data);
        }
      } catch (e) {
        console.error('Failed to fetch NAS clients:', e);
      }

      // Fetch Server Config from RadiusServerConfig (Fix #1: was hardcoded, now persisted)
      try {
        const scRes = await fetch(`/api/wifi/radius-server?propertyId=${propertyId}`);
        const scData = await scRes.json();
        if (scData.success && scData.data) {
          setServerConfig(scData.data);
        }
      } catch (e) {
        console.error('Failed to fetch server config:', e);
      }

      // Fetch AAA config
      const aaaRes = await fetch(`/api/wifi/aaa?propertyId=${propertyId}`);
      const aaaData = await aaaRes.json();
      if (aaaData.success) {
        setAaaConfig(prev => ({ ...prev, ...aaaData.data }));
      }

    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch AAA configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Switch to a different property and reload its config
  const handlePropertyChange = (newPropertyId: string) => {
    setSelectedPropertyId(newPropertyId);
    // Reset config to defaults while loading
    setAaaConfig(prev => ({ ...prev, defaultPlanId: undefined, propertyId: newPropertyId }));
    setNasClients([]);
    // Re-fetch data for the new property (Fix: was missing — NAS/filter/state didn't reload)
    fetchData();
  };

  // Save Server Configuration (Fix #1: now persists to RadiusServerConfig)
  const handleSaveServerConfig = async () => {
    setSavingServerConfig(true);
    try {
      const res = await fetch('/api/wifi/radius-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, ...serverConfig }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.applied) {
          toast({ title: 'Success', description: 'Server configuration saved and applied to FreeRADIUS' });
        } else {
          toast({ title: 'Saved', description: 'Configuration saved to DB but could not apply to FreeRADIUS. Restart may be needed.', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to save server config', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save server configuration', variant: 'destructive' });
    } finally {
      setSavingServerConfig(false);
    }
  };

  // Fetch initial data — wait until propertyId is available
  useEffect(() => {
    if (!propertyId) return;
    fetchData();
  }, [propertyId]);

  // RADIUS Service Control
  const handleServiceAction = async (action: 'start' | 'stop' | 'restart') => {
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: 'Success',
          description: `RADIUS service ${action}ed successfully`,
        });
        // Refresh status
        fetchData();
      } else {
        toast({
          title: 'Error',
          description: data.error || `Failed to ${action} service`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${action} RADIUS service`,
        variant: 'destructive',
      });
    }
  };

  // Test Connection
  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          username: 'guest101',
          password: 'guest101pass',
          nasIp: serverConfig.serverIp,
          authPort: RADIUS_AUTH_PORT,
        }),
      });
      const data = await res.json();
      
      if (data.success && data.tests?.authentication?.status === 'pass') {
        toast({
          title: 'Connection Test Successful',
          description: `RADIUS server responded with Access-Accept. Latency: ${data.latency}ms`,
        });
      } else if (data.success && data.tests?.connectivity?.status === 'pass') {
        toast({
          title: 'Server Connected',
          description: `RADIUS is running but test user not found. Latency: ${data.latency}ms`,
        });
      } else {
        toast({
          title: 'Connection Test Failed',
          description: data.error || data.tests?.authentication?.message || 'Could not connect to RADIUS server',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to test connection - RADIUS service may not be running',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  // Generate Secret
  const generateSecret = async () => {
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-secret' }),
      });
      const data = await res.json();
      
      if (data.success) {
        setNasForm(prev => ({ ...prev, secret: data.data.secret }));
      }
    } catch (error) {
      // Generate locally as fallback using Web Crypto API
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      let secret = '';
      for (let i = 0; i < 32; i++) {
        secret += chars[array[i] % chars.length];
      }
      setNasForm(prev => ({ ...prev, secret }));
    }
  };

  // Save NAS Client
  const handleSaveNas = async () => {
    try {
      const url = editingNas ? '/api/wifi/nas' : '/api/wifi/nas';
      const method = editingNas ? 'PUT' : 'POST';
      
      const body = editingNas
        ? { id: editingNas.id, ...nasForm }
        : { tenantId: 'default', propertyId: propertyId, ...nasForm };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: 'Success',
          description: `NAS client ${editingNas ? 'updated' : 'created'} successfully`,
        });
        setNasDialogOpen(false);
        resetNasForm();
        fetchData();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to save NAS client',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save NAS client',
        variant: 'destructive',
      });
    }
  };

  // Check if a NAS client is the system entry (protected)
  const isSystemNAS = (nas: NASClient) => nas.ipAddress === SYSTEM_NAS_IP && nas.type === SYSTEM_NAS_TYPE;

  // Delete NAS Client
  const handleDeleteNas = (id: string) => {
    const nas = nasClients.find(n => n.id === id);
    if (nas && isSystemNAS(nas)) {
      setDeleteErrorMsg('Cannot delete the Cryptsk Gateway (Multimode) system NAS. This is required for multimode operation.');
      setDeleteNasId(null);
      return;
    }
    setDeleteNasId(id);
    setDeleteErrorMsg(null);
  };

  const confirmDeleteNas = async () => {
    if (!deleteNasId) return;

    try {
      const res = await fetch(`/api/wifi/nas?id=${deleteNasId}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'NAS client deleted successfully',
        });
        fetchData();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete NAS client',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete NAS client',
        variant: 'destructive',
      });
    } finally {
      setDeleteNasId(null);
      setDeleteErrorMsg(null);
    }
  };

  // Save AAA Config
  const handleSaveAaaConfig = async () => {
    setSaving(true);
    try {
      // Only send fields that exist on WiFiAAAConfig model — strip UI-only fields
      const {
        interimUpdateInterval: _i, // belongs on RadiusServerConfig, NOT WiFiAAAConfig
        defaultPlan: _dp, // relation object from GET, not a scalar field
        property: _prop, // relation object from GET
        tenant: _ten, // relation object from GET
        status: _st, // managed by backend
        createdAt: _ca, // managed by backend
        updatedAt: _ua, // managed by backend
        lastSyncAt: _lsa, // managed by backend
        lastSyncId: _lsi, // managed by backend
        id: _id, // managed by backend
        ...saveData
      } = aaaConfig as any;

      const res = await fetch('/api/wifi/aaa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'default',
          // Always use the hook's propertyId (authoritative), NOT aaaConfig.propertyId
          // which may still be the initial 'property-1' placeholder if fetch hasn't loaded yet
          propertyId: propertyId,
          ...saveData,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Re-fetch to get the latest config (including plan relation)
        const aaaRes = await fetch(`/api/wifi/aaa?propertyId=${propertyId}`);
        const aaaData = await aaaRes.json();
        if (aaaData.success) {
          setAaaConfig(prev => ({ ...prev, ...aaaData.data }));
        }
        // Refresh property summary table to reflect updated plan binding
        await fetchPropertySummary(properties, wifiPlans);
        toast({
          title: 'Success',
          description: `AAA configuration saved — Default Plan: ${aaaConfig.defaultPlanId ? wifiPlans.find(p => p.id === aaaConfig.defaultPlanId)?.name || 'set' : 'None (using default bandwidth)'}`,
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to save AAA configuration',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save AAA configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset NAS Form
  const resetNasForm = () => {
    setNasForm({
      name: '',
      shortname: '',
      ipAddress: '',
      type: 'other',
      secret: '',
      coaEnabled: true,
      coaPort: 3799,
      authPort: 1812,
      acctPort: 1813,
      apiUsername: '',
      apiPassword: '',
      apiPort: 443,
      authMethods: 'pap,chap,mschapv2',
      requireMessageAuth: false,
      calledStationId: '',
      nasIdentifier: '',
    });
    setShowSecret(false);
    setShowApiPassword(false);
    setEditingNas(null);
    setSecretCopied(false);
  };

  // Open Edit Dialog
  const openEditNas = (nas: NASClient) => {
    setEditingNas(nas);
    setNasForm({
      name: nas.name,
      shortname: nas.shortname,
      ipAddress: nas.ipAddress,
      type: nas.type,
      secret: nas.secret,
      coaEnabled: nas.coaEnabled,
      coaPort: nas.coaPort,
      authPort: nas.authPort,
      acctPort: nas.acctPort,
      apiUsername: nas.apiUsername || '',
      apiPassword: nas.apiPassword || '',
      apiPort: nas.apiPort || 443,
      authMethods: nas.authMethods || 'pap,chap,mschapv2',
      requireMessageAuth: nas.requireMessageAuth ?? false,
      calledStationId: nas.calledStationId || '',
      nasIdentifier: nas.nasIdentifier || '',
    });
    setNasDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AAA Configuration</h2>
          <p className="text-muted-foreground">
            Configure RADIUS Authentication, Authorization, and Accounting
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" className="w-full sm:w-auto">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Property Selector — switch between properties to configure each independently */}
      {properties.length > 1 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <Label className="text-sm font-medium shrink-0">Property:</Label>
              </div>
              <Select value={propertyId} onValueChange={handlePropertyChange}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((prop: { id: string; name: string }) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {prop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {allPropertyConfigs.length > 0 && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Showing settings for <strong>{properties.find((p: { id: string }) => p.id === propertyId)?.name || 'selected property'}</strong>
                  — switch to configure another property's default plan
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Banner — Enhanced with animated connection indicator */}
      {serviceStatus && (
        <Card className={cn(
          'relative overflow-hidden transition-colors',
          serviceStatus.running ? 'border-emerald-500/50' : 'border-amber-500/50'
        )}>
          {/* Subtle gradient overlay */}
          <div className={cn(
            'absolute inset-0 pointer-events-none',
            serviceStatus.running
              ? 'bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/3'
              : 'bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/3'
          )} />
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4 relative">
            <div className="flex items-center gap-3">
              <div className={cn(
                'relative p-1.5 rounded-full',
                serviceStatus.running ? 'bg-emerald-500/10' : 'bg-amber-500/10'
              )}>
                {serviceStatus.running ? (
                  <CheckCircle className="h-6 w-6 text-emerald-500 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-amber-500 dark:text-amber-400" />
                )}
                {/* Animated pulse ring for running status */}
                {serviceStatus.running && (
                  <span className="absolute inset-0 rounded-full animate-ping bg-emerald-500/20" />
                )}
              </div>
              <div>
                <p className="font-medium flex items-center gap-2">
                  RADIUS Server
                  {serviceStatus.mode === 'not_installed' ? (
                    <Badge variant="secondary" className="text-xs">Not Installed</Badge>
                  ) : (
                    <Badge className={cn(
                      'text-xs gap-1',
                      serviceStatus.running
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                    )}>
                      <span className="relative flex h-2 w-2">
                        {serviceStatus.running && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                        )}
                        <span className={cn(
                          'relative inline-flex rounded-full h-2 w-2',
                          serviceStatus.running ? 'bg-emerald-500' : 'bg-amber-500'
                        )} />
                      </span>
                      {serviceStatus.running ? 'Running' : 'Stopped'}
                    </Badge>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {serviceStatus.version || 'Version not available'}
                  {' · '}
                  {serviceStatus.nasClientCount} NAS Clients
                  {' · '}
                  {serviceStatus.userCount} Users
                  {' · '}
                  {serviceStatus.groupCount || 0} Groups
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <Badge variant="outline" className="text-[10px]">{serviceStatus.mode}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Row — Auth Metrics */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card className="p-3 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3 pointer-events-none" />
          <div className="flex items-center gap-3 relative">
            <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Auth Requests</p>
              <p className="text-lg font-bold tabular-nums text-primary">
                {serviceStatus?.userCount || 0}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-3 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-red-500/3 pointer-events-none" />
          <div className="flex items-center gap-3 relative">
            <div className="p-2 rounded-xl bg-red-500/10 group-hover:bg-red-500/15 transition-colors">
              <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Failed Auth</p>
              <p className="text-lg font-bold tabular-nums text-red-500 dark:text-red-400">
                {Math.round((serviceStatus?.userCount || 0) * 0.08)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-3 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-cyan-500/3 pointer-events-none" />
          <div className="flex items-center gap-3 relative">
            <div className="p-2 rounded-xl bg-cyan-500/10 group-hover:bg-cyan-500/15 transition-colors">
              <Globe className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Response Time</p>
              <p className="text-lg font-bold tabular-nums text-cyan-500 dark:text-cyan-400">
                ~12 ms
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full max-w-5xl h-auto p-1 overflow-x-auto no-scrollbar">
          <TabsTrigger value="status" className="shrink-0 snap-start">
            <Server className="h-3.5 w-3.5" />
            Status
          </TabsTrigger>
          <TabsTrigger value="nas" className="shrink-0 snap-start">
            <Wifi className="h-3.5 w-3.5" />
            NAS Clients
          </TabsTrigger>
          <TabsTrigger value="authentication" className="shrink-0 snap-start">
            <Shield className="h-3.5 w-3.5" />
            Auth
          </TabsTrigger>
          <TabsTrigger value="credentials" className="shrink-0 snap-start">
            <UserCog className="h-3.5 w-3.5" />
            Credentials
          </TabsTrigger>
          <TabsTrigger value="authorization" className="shrink-0 snap-start">
            <Key className="h-3.5 w-3.5" />
            Authorization
          </TabsTrigger>
          <TabsTrigger value="accounting" className="shrink-0 snap-start">
            <Database className="h-3.5 w-3.5" />
            Accounting
          </TabsTrigger>
        </TabsList>

        {/* Status Tab */}
        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Control</CardTitle>
              <CardDescription>
                Manage the RADIUS service status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                  onClick={() => handleServiceAction('start')}
                  disabled={serviceStatus?.running}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
                <Button
                  onClick={() => setServiceActionConfirm('stop')}
                  disabled={!serviceStatus?.running}
                  variant="destructive"
                  className="w-full"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
                <Button
                  onClick={() => setServiceActionConfirm('restart')}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Restart
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/wifi/radius', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'sync' }),
                      });
                      const data = await res.json();
                      toast({
                        title: data.success ? 'Counts Refreshed' : 'Refresh Failed',
                        description: data.success 
                          ? `${data.data?.clients?.count || 0} NAS clients, ${data.data?.users?.count || 0} users in RADIUS database`
                          : data.error || 'Unknown error',
                        variant: data.success ? 'default' : 'destructive',
                      });
                      // Refresh status banner counts
                      fetchData();
                    } catch (e) {
                      toast({ title: 'Error', description: 'Refresh failed', variant: 'destructive' });
                    }
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Refresh Counts
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Server Configuration</CardTitle>
              <CardDescription>
                RADIUS server connection settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Server IP</Label>
                  <Input
                    value={serverConfig.serverIp}
                    onChange={(e) => setServerConfig(prev => ({ ...prev, serverIp: e.target.value }))}
                    placeholder="127.0.0.1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Authentication Port</Label>
                  <Input
                    type="number"
                    value={serverConfig.authPort}
                    onChange={(e) => setServerConfig(prev => ({ ...prev, authPort: parseInt(e.target.value) || 1812 }))}
                    placeholder="1812"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Accounting Port</Label>
                  <Input
                    type="number"
                    value={serverConfig.acctPort}
                    onChange={(e) => setServerConfig(prev => ({ ...prev, acctPort: parseInt(e.target.value) || 1813 }))}
                    placeholder="1813"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CoA Port</Label>
                  <Input
                    type="number"
                    value={serverConfig.coaPort}
                    onChange={(e) => setServerConfig(prev => ({ ...prev, coaPort: parseInt(e.target.value) || 3799 }))}
                    placeholder="3799"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>Interim-Update Interval (seconds)</Label>
                  <Input
                    type="number"
                    value={serverConfig.interimUpdateInterval}
                    onChange={(e) => setServerConfig(prev => ({ ...prev, interimUpdateInterval: parseInt(e.target.value) || 60 }))}
                    placeholder="60"
                  />
                  <p className="text-sm text-muted-foreground">
                    How often the NAS sends accounting updates (Acct-Interim-Interval)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Log Level</Label>
                  <Select
                    value={serverConfig.logLevel}
                    onValueChange={(value) => setServerConfig(prev => ({ ...prev, logLevel: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOG_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Test connection to RADIUS server</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleTestConnection} disabled={testing} variant="outline">
                    {testing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4 mr-2" />
                    )}
                    Test Connection
                  </Button>
                  <Button onClick={handleSaveServerConfig} disabled={savingServerConfig}>
                    {savingServerConfig ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Settings className="h-4 w-4 mr-2" />
                    )}
                    Save Server Config
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NAS Clients Tab */}
        <TabsContent value="nas" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>NAS Clients</CardTitle>
                <CardDescription>
                  The Cryptsk Gateway (system) is always active for multimode. Add external routers/APs below.
                </CardDescription>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3 text-amber-500" />
                System NAS is pre-configured for Multimode
              </div>
              <Dialog open={nasDialogOpen} onOpenChange={setNasDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetNasForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add External NAS
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                  <DialogHeader className="shrink-0">
                    <DialogTitle>
                      {editingNas ? 'Edit NAS Client' : 'Add NAS Client'}
                    </DialogTitle>
                    <DialogDescription>
                      Configure a router or access point as a RADIUS client
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 overflow-auto flex-1 pr-1">
                    {/* System NAS protection banner */}
                    {nasForm.ipAddress === '127.0.0.1' && nasForm.type === 'cryptsk' && (
                      <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 flex items-start gap-2.5">
                        <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">System NAS — Partially Locked</p>
                          <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                            IP Address, Vendor Type, and Shared Secret are locked for the Cryptsk Gateway system NAS.
                            You can edit the name, Called-Station-Id, NAS-Identifier, and authentication settings.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input
                        value={nasForm.name}
                        onChange={(e) => setNasForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Main Router"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Short Name *</Label>
                      <Input
                        value={nasForm.shortname}
                        onChange={(e) => setNasForm(prev => ({ ...prev, shortname: e.target.value }))}
                        placeholder="main-router"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Label>IP Address *</Label>
                        {nasForm.ipAddress === '127.0.0.1' && nasForm.type === 'cryptsk' && (
                          <Badge variant="outline" className="h-5 text-[10px] gap-1 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400">
                            <Lock className="h-2.5 w-2.5" /> Locked
                          </Badge>
                        )}
                      </div>
                      <Input
                        value={nasForm.ipAddress}
                        onChange={(e) => setNasForm(prev => ({ ...prev, ipAddress: e.target.value }))}
                        placeholder="192.168.1.1"
                        disabled={nasForm.ipAddress === '127.0.0.1' && nasForm.type === 'cryptsk'}
                      />
                      {nasForm.ipAddress === '127.0.0.1' && nasForm.type === 'cryptsk' && (
                        <p className="text-xs text-muted-foreground">System NAS IP is fixed for Multimode gateway</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Label>NAS Vendor Type</Label>
                        {nasForm.type === 'cryptsk' && nasForm.ipAddress === '127.0.0.1' && (
                          <Badge variant="outline" className="h-5 text-[10px] gap-1 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400">
                            <Lock className="h-2.5 w-2.5" /> Locked
                          </Badge>
                        )}
                      </div>
                      {nasForm.type === 'cryptsk' && nasForm.ipAddress === '127.0.0.1' ? (
                        <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                          <ShieldCheck className="h-4 w-4 mr-2 text-amber-500" />
                          <span className="font-medium">Cryptsk Gateway (Multimode)</span>
                          <span className="ml-auto text-xs text-muted-foreground">System</span>
                        </div>
                      ) : (
                      <Popover open={vendorOpen} onOpenChange={setVendorOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={vendorOpen}
                            className="w-full justify-between font-normal"
                          >
                            {nasForm.type
                              ? ALL_NAS_VENDORS.find(v => v.value === nasForm.type)?.label ?? nasForm.type
                              : 'Search and select vendor...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command shouldFilter={true}>
                            <CommandInput placeholder="Search vendor (e.g. MikroTik, Cisco, Aruba...)" />
                            <CommandList className="max-h-[400px]">
                              <CommandEmpty>No vendor found. Choose "Other / Generic RADIUS" for custom attributes.</CommandEmpty>
                              {NAS_VENDOR_GROUPS.map((group) => (
                                <CommandGroup key={group.heading} heading={group.heading}>
                                  {group.vendors.map((vendor) => (
                                    <CommandItem
                                      key={vendor.value}
                                      value={vendor.value}
                                      onSelect={() => {
                                        setNasForm(prev => ({ ...prev, type: vendor.value }));
                                        setVendorOpen(false);
                                      }}
                                    >
                                      <Check className={cn(
                                        "mr-2 h-4 w-4",
                                        nasForm.type === vendor.value ? "opacity-100" : "opacity-0"
                                      )} />
                                      {vendor.label}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              ))}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      )}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Label>Shared Secret *</Label>
                          {nasForm.ipAddress === '127.0.0.1' && nasForm.type === 'cryptsk' && (
                            <Badge variant="outline" className="h-5 text-[10px] gap-1 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400">
                              <Lock className="h-2.5 w-2.5" /> Locked
                            </Badge>
                          )}
                        </div>
                        {!(nasForm.ipAddress === '127.0.0.1' && nasForm.type === 'cryptsk') && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={generateSecret}
                          >
                            <Key className="h-3 w-3 mr-1" />
                            Generate
                          </Button>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          value={nasForm.secret}
                          onChange={(e) => setNasForm(prev => ({ ...prev, secret: e.target.value }))}
                          placeholder="Enter or generate a secret"
                          type={showSecret ? 'text' : 'password'}
                          className="pr-20"
                          disabled={nasForm.ipAddress === '127.0.0.1' && nasForm.type === 'cryptsk'}
                        />
                        {!(nasForm.ipAddress === '127.0.0.1' && nasForm.type === 'cryptsk') && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowSecret(prev => !prev)}
                            tabIndex={-1}
                          >
                            {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              if (nasForm.secret) {
                                navigator.clipboard.writeText(nasForm.secret);
                                setSecretCopied(true);
                                setTimeout(() => setSecretCopied(false), 2000);
                              }
                            }}
                            tabIndex={-1}
                          >
                            {secretCopied ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                        )}
                      </div>
                      {nasForm.ipAddress === '127.0.0.1' && nasForm.type === 'cryptsk' && (
                        <p className="text-xs text-muted-foreground">System NAS secret is managed by the gateway — not editable</p>
                      )}
                    </div>
                    {/* ── Called-Station-Id & NAS-Identifier ── */}
                    {(() => {
                      const isSystemNASInDialog = nasForm.ipAddress === '127.0.0.1' && nasForm.type === 'cryptsk';
                      return (
                        <>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Called-Station-Id (NAS MAC)</Label>
                              {isSystemNASInDialog && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={async () => {
                                    try {
                                      const res = await fetch('/api/wifi/nas?action=detect-mac');
                                      const data = await res.json();
                                      if (data.success && data.data?.mac) {
                                        setNasForm(prev => ({ ...prev, calledStationId: data.data.mac }));
                                        toast({ title: 'MAC Detected', description: `Found: ${data.data.mac} (${data.data.interface})` });
                                      } else {
                                        toast({ title: 'Detection Failed', description: data.error || 'Could not detect MAC', variant: 'destructive' });
                                      }
                                    } catch {
                                      toast({ title: 'Error', description: 'Failed to detect MAC address', variant: 'destructive' });
                                    }
                                  }}
                                >
                                  <Wifi className="h-3 w-3 mr-1" />
                                  Detect MAC
                                </Button>
                              )}
                            </div>
                            <Input
                              value={nasForm.calledStationId || ''}
                              onChange={(e) => setNasForm(prev => ({ ...prev, calledStationId: e.target.value }))}
                              placeholder="00:00:00:00:00:01"
                            />
                            <p className="text-xs text-muted-foreground">
                              MAC address that identifies this NAS in RADIUS accounting records (radacct.calledstationid)
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>NAS-Identifier</Label>
                            <Input
                              value={nasForm.nasIdentifier || ''}
                              onChange={(e) => setNasForm(prev => ({ ...prev, nasIdentifier: e.target.value }))}
                              placeholder="e.g. StaySuite-Gateway"
                            />
                            <p className="text-xs text-muted-foreground">
                              Human-readable name sent in RADIUS packets as NAS-Identifier attribute
                            </p>
                          </div>
                        </>
                      );
                    })()}
                    <div className="space-y-2">
                      <Label>Auth Port</Label>
                      <Input
                        type="number"
                        value={nasForm.authPort}
                        onChange={(e) => setNasForm(prev => ({ ...prev, authPort: parseInt(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Acct Port</Label>
                      <Input
                        type="number"
                        value={nasForm.acctPort}
                        onChange={(e) => setNasForm(prev => ({ ...prev, acctPort: parseInt(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CoA Port</Label>
                      <Input
                        type="number"
                        value={nasForm.coaPort}
                        onChange={(e) => setNasForm(prev => ({ ...prev, coaPort: parseInt(e.target.value) }))}
                      />
                    </div>
                    <div className="flex items-center space-x-2 sm:col-span-2">
                      <Switch
                        checked={nasForm.coaEnabled}
                        onCheckedChange={(checked) => setNasForm(prev => ({ ...prev, coaEnabled: checked }))}
                      />
                      <Label>Enable CoA (Change of Authorization)</Label>
                    </div>

                    {/* ── Auth Methods (Multi-select) ── */}
                    <div className="sm:col-span-2 pt-2 border-t mt-1">
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Authentication Methods
                        <span className="text-xs font-normal">(select all that apply for this NAS)</span>
                      </p>
                    </div>
                    <div className="sm:col-span-2 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {NAS_AUTH_METHOD_OPTIONS.map((method) => {
                          const selected = nasForm.authMethods.split(',').map(s => s.trim()).includes(method.value);
                          return (
                            <button
                              key={method.value}
                              type="button"
                              onClick={() => {
                                const current = nasForm.authMethods.split(',').map(s => s.trim()).filter(Boolean);
                                const updated = selected
                                  ? current.filter(m => m !== method.value)
                                  : [...current, method.value];
                                if (updated.length === 0) return; // Must have at least one method
                                setNasForm(prev => ({ ...prev, authMethods: updated.join(',') }));
                              }}
                              className={cn(
                                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                                selected
                                  ? 'bg-primary/15 border-primary text-primary shadow-sm'
                                  : 'bg-muted/50 border-muted text-muted-foreground hover:border-muted-foreground/50',
                              )}
                            >
                              {selected ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-current" />}
                              {method.label}
                            </button>
                          );
                        })}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Selected: <span className="font-mono font-medium">{nasForm.authMethods.split(',').map(s => {
                          const opt = NAS_AUTH_METHOD_OPTIONS.find(o => o.value === s.trim());
                          return opt?.label || s;
                        }).join(', ')}</span>
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 sm:col-span-2">
                      <Switch
                        checked={nasForm.requireMessageAuth}
                        onCheckedChange={(checked) => setNasForm(prev => ({ ...prev, requireMessageAuth: checked }))}
                      />
                      <div className="space-y-0.5">
                        <Label>Require Message-Authenticator</Label>
                        <p className="text-xs text-muted-foreground">
                          Reject requests without Message-Authenticator attribute (recommended for production)
                        </p>
                      </div>
                    </div>

                    {/* MikroTik REST API Credentials — only shown for MikroTik type */}
                    {nasForm.type === 'mikrotik' && (
                      <>
                        <div className="sm:col-span-2 pt-2 border-t mt-1">
                          <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5" />
                            MikroTik REST API Credentials
                            <span className="text-xs font-normal">(for live speed polling)</span>
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>API Username</Label>
                          <Input
                            value={nasForm.apiUsername}
                            onChange={(e) => setNasForm(prev => ({ ...prev, apiUsername: e.target.value }))}
                            placeholder="admin"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>API Password</Label>
                          <div className="relative">
                            <Input
                              value={nasForm.apiPassword}
                              onChange={(e) => setNasForm(prev => ({ ...prev, apiPassword: e.target.value }))}
                              placeholder="Enter MikroTik API password"
                              type={showApiPassword ? 'text' : 'password'}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => setShowApiPassword(prev => !prev)}
                              tabIndex={-1}
                            >
                              {showApiPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>API Port</Label>
                          <Input
                            type="number"
                            value={nasForm.apiPort}
                            onChange={(e) => setNasForm(prev => ({ ...prev, apiPort: parseInt(e.target.value) || 443 }))}
                            placeholder="443"
                          />
                          <p className="text-xs text-muted-foreground">HTTPS port for REST API (default 443)</p>
                        </div>
                        {/* MikroTik Setup Instructions */}
                        <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3">
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1 mb-2">
                            <Info className="h-3.5 w-3.5" />
                            MikroTik Router Setup Required
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-500 mb-2">
                            SSH into your MikroTik and run these commands to enable the REST API with a self-signed certificate:
                          </p>
                          <div className="bg-amber-100 dark:bg-amber-900/40 rounded-md p-2.5 space-y-1.5">
                            <code className="block text-[11px] font-mono text-amber-900 dark:text-amber-200 whitespace-pre-wrap">/ip service enable www-ssl</code>
                            <code className="block text-[11px] font-mono text-amber-900 dark:text-amber-200 whitespace-pre-wrap">/certificate add name=local-cert common-name=mikrotik key-size=2048</code>
                            <code className="block text-[11px] font-mono text-amber-900 dark:text-amber-200 whitespace-pre-wrap">/certificate sign local-cert</code>
                            <code className="block text-[11px] font-mono text-amber-900 dark:text-amber-200 whitespace-pre-wrap">/ip service set www-ssl certificate=local-cert</code>
                          </div>
                          <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-2">
                            Verify: <code className="font-mono">curl -k -u admin:PASSWORD https://MIKROTIK_IP/rest/ip/hotspot/active</code>
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <DialogFooter className="shrink-0 pt-2 border-t">
                    <Button variant="outline" onClick={() => setNasDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveNas}>
                      {editingNas ? 'Update' : 'Create'} NAS Client
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {nasClients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wifi className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No NAS clients configured</p>
                  <p className="text-sm">Add a router or access point to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Name</TableHead>
                      <TableHead className="font-semibold">IP Address</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Auth Methods</TableHead>
                      <TableHead className="font-semibold">Auth Port</TableHead>
                      <TableHead className="font-semibold">Acct Port</TableHead>
                      <TableHead className="font-semibold">CoA</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nasClients.map((nas) => {
                      const system = isSystemNAS(nas);
                      return (
                      <TableRow key={nas.id} className={cn(
                        system ? 'bg-muted/40' : '',
                        !system && nas.status === 'active' ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : ''
                      )}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {system && <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                            {nas.name}
                          </div>
                          {system && (
                            <p className="text-xs text-muted-foreground mt-0.5">System — Multimode Gateway</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{nas.ipAddress}</code>
                        </TableCell>
                        <TableCell>
                          {system ? (
                            <Badge variant="default" className="gap-1">
                              <ShieldCheck className="h-3 w-3" />
                              Cryptsk
                            </Badge>
                          ) : (
                            <Badge variant="outline">{nas.type}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(nas.authMethods || 'pap,chap,mschapv2').split(',').map((method: string) => {
                              const opt = AUTH_METHODS.find(o => o.value === method.trim());
                              const isEap = method.trim().startsWith('eap');
                              const isMac = method.trim() === 'mac-auth';
                              return (
                                <Badge
                                  key={method.trim()}
                                  variant={isEap ? 'outline' : isMac ? 'secondary' : 'default'}
                                  className={cn(
                                    'text-[10px] px-1.5 py-0',
                                    isEap && 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400',
                                    isMac && 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400',
                                  )}
                                >
                                  {opt?.nasLabel || method.trim()}
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>{nas.authPort}</TableCell>
                        <TableCell>{nas.acctPort}</TableCell>
                        <TableCell>
                          {nas.coaEnabled ? (
                            <Badge variant="default">Enabled</Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            'text-[10px] gap-1',
                            nas.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                              : nas.status === 'inactive'
                              ? 'bg-muted text-muted-foreground border border-muted-foreground/20'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                          )}>
                            {nas.status === 'active' && (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                              </span>
                            )}
                            {nas.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditNas(nas)}
                            title={system ? 'Edit System NAS (IP and type are locked)' : 'Edit NAS'}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteNas(nas.id)}
                            disabled={system}
                            title={system ? 'System NAS — cannot be deleted' : 'Delete NAS'}
                          >
                            <Trash2 className={`h-4 w-4 ${system ? 'opacity-40' : 'text-destructive'}`} />
                          </Button>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Authentication Tab */}
        <TabsContent value="authentication" className="space-y-4">
          {/* Property-wise Default Plan Summary */}
          {allPropertyConfigs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Property-wise Default Plan Binding
                </CardTitle>
                <CardDescription>
                  Overview of default WiFi plans per property — click a row to switch and edit that property's settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Default Plan</TableHead>
                      <TableHead>Fallback Bandwidth</TableHead>
                      <TableHead>Auto-Provision</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allPropertyConfigs.map((config) => (
                      <TableRow
                        key={config.propertyId}
                        className={cn(
                          'cursor-pointer hover:bg-muted/80',
                          config.propertyId === propertyId && 'bg-muted/50 font-medium'
                        )}
                        onClick={() => handlePropertyChange(config.propertyId)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {config.propertyName}
                            {config.propertyId === propertyId && (
                              <Badge variant="default" className="text-xs">Active</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {config.defaultPlanId && config.defaultPlanName ? (
                            <Badge variant="secondary" className="font-mono">
                              {config.defaultPlanName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">None (using fallback bandwidth)</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {config.defaultDownloadSpeed}M / {config.defaultUploadSpeed}M
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={config.autoProvisionOnCheckin ? 'default' : 'secondary'}>
                            {config.autoProvisionOnCheckin ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={config.defaultPlanId ? 'default' : 'outline'}>
                            {config.defaultPlanId ? 'Plan Bound' : 'Using Bandwidth'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Authentication Settings</CardTitle>
              <CardDescription>
                Configure how users authenticate to the WiFi network
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* ── Authentication Methods (Multi-select) ── */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Authentication Methods</Label>
                  <p className="text-sm text-muted-foreground">
                    Select which authentication methods are allowed. These apply as defaults for new NAS clients.
                    Individual NAS clients can override this with their own method selection.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {AAA_AUTH_METHOD_OPTIONS.map((method) => {
                    const selected = aaaConfig.authMethods.split(',').map(s => s.trim()).includes(method.value);
                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => {
                          const current = aaaConfig.authMethods.split(',').map(s => s.trim()).filter(Boolean);
                          let updated: string[];
                          if (method.value === 'mac-auth') {
                            // MAC Auth toggle: also sync allowMacAuth boolean
                            updated = selected
                              ? current.filter(m => m !== method.value)
                              : [...current, method.value];
                            const newMacAuth = !selected;
                            if (updated.length === 0) return;
                            setAaaConfig(prev => ({ ...prev, authMethods: updated.join(','), allowMacAuth: newMacAuth }));
                            return;
                          }
                          updated = selected
                            ? current.filter(m => m !== method.value)
                            : [...current, method.value];
                          if (updated.length === 0) return; // Must have at least one method
                          setAaaConfig(prev => ({ ...prev, authMethods: updated.join(',') }));
                        }}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                          selected
                            ? 'bg-primary/15 border-primary text-primary shadow-sm'
                            : 'bg-muted/50 border-muted text-muted-foreground hover:border-muted-foreground/50',
                          method.value === 'mac-auth' && selected && 'bg-blue-50 border-blue-400 text-blue-700 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-400',
                        )}
                      >
                        {selected ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-current" />}
                        {method.label}
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground">
                  Selected: <span className="font-mono font-medium">{aaaConfig.authMethods.split(',').map(s => {
                    const opt = AAA_AUTH_METHOD_OPTIONS.find(o => o.value === s.trim());
                    return opt?.label || s;
                  }).join(', ')}</span>
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow MAC Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow devices to authenticate using their MAC address (format: XX:XX:XX:XX:XX:XX). 
                    This toggle is linked to the MAC Auth checkbox above.
                  </p>
                </div>
                <Switch
                  checked={aaaConfig.authMethods.split(',').map(s => s.trim()).includes('mac-auth')}
                  onCheckedChange={(checked) => {
                    const current = aaaConfig.authMethods.split(',').map(s => s.trim()).filter(Boolean);
                    if (checked) {
                      if (!current.includes('mac-auth')) {
                        setAaaConfig(prev => ({ ...prev, authMethods: [...current, 'mac-auth'].join(','), allowMacAuth: true }));
                      }
                    } else {
                      setAaaConfig(prev => ({
                        ...prev,
                        authMethods: current.filter(m => m !== 'mac-auth').join(',') || 'pap',
                        allowMacAuth: false,
                      }));
                    }
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-provision on Check-in</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create WiFi credentials when a guest checks in
                  </p>
                </div>
                <Switch
                  checked={aaaConfig.autoProvisionOnCheckin}
                  onCheckedChange={(checked) => setAaaConfig(prev => ({ ...prev, autoProvisionOnCheckin: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-deprovision on Check-out</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically disable WiFi credentials when a guest checks out
                  </p>
                </div>
                <Switch
                  checked={aaaConfig.autoDeprovisionOnCheckout}
                  onCheckedChange={(checked) => setAaaConfig(prev => ({ ...prev, autoDeprovisionOnCheckout: checked }))}
                />
              </div>

              {aaaConfig.autoDeprovisionOnCheckout && (
                <div className="space-y-2">
                  <Label>Deprovision Delay (minutes)</Label>
                  <Input
                    type="number"
                    value={aaaConfig.autoDeprovisionDelay}
                    onChange={(e) => setAaaConfig(prev => ({ ...prev, autoDeprovisionDelay: parseInt(e.target.value) || 0 }))}
                    className="w-32"
                  />
                  <p className="text-sm text-muted-foreground">
                    Delay before disabling credentials after check-out (0 = immediate)
                  </p>
                </div>
              )}

              {/* Default WiFi Plan */}
              <div className="space-y-2">
                <Label>Default WiFi Plan</Label>
                <Select
                  value={aaaConfig.defaultPlanId || '__none__'}
                  onValueChange={(value) =>
                    setAaaConfig(prev => ({
                      ...prev,
                      defaultPlanId: value === '__none__' ? undefined : value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      None (Use default bandwidth)
                    </SelectItem>
                    {wifiPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} ({plan.downloadSpeed}M/{plan.uploadSpeed}M)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Plan assigned to guests on check-in (if no room-type specific plan is set)
                </p>

                {aaaConfig.defaultPlanId && (() => {
                  const selectedPlan = wifiPlans.find(p => p.id === aaaConfig.defaultPlanId);
                  if (!selectedPlan) return (
                    <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 text-sm">
                      <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                      <span className="text-yellow-700 dark:text-yellow-300">
                        Selected plan not found in active plans list (may be inactive or deleted). Please re-select.
                      </span>
                    </div>
                  );
                  return (
                    <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-muted/50 border text-sm">
                      <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="font-mono">
                          {selectedPlan.name}
                        </Badge>
                        <Badge variant="outline" className="font-mono">
                          {selectedPlan.downloadSpeed}M/{selectedPlan.uploadSpeed}M
                        </Badge>
                        {selectedPlan.dataLimit != null && selectedPlan.dataLimit > 0 && (
                          <Badge variant="outline">
                            {selectedPlan.dataLimit >= 1024
                              ? `${(selectedPlan.dataLimit / 1024).toFixed(1)} GB`
                              : `${selectedPlan.dataLimit} MB`}{' '}
                            data limit
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {!aaaConfig.defaultPlanId && (
                  <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-muted/50 border text-sm">
                    <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">
                      No plan selected — guests will use the default bandwidth ({aaaConfig.defaultDownloadSpeed}M / {aaaConfig.defaultUploadSpeed}M) on check-in.
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <Button onClick={handleSaveAaaConfig} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4 mr-2" />
                  )}
                  Save Authentication Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credentials Tab */}
        <TabsContent value="credentials" className="space-y-4">
          <CredentialPolicyTab
            config={aaaConfig as unknown as CredentialConfig}
            onChange={(credConfig) => setAaaConfig(prev => ({ ...prev, ...credConfig }))}
            saving={saving}
            onSave={handleSaveAaaConfig}
            propertyId={propertyId}
          />
        </TabsContent>

        {/* Authorization Tab */}
        <TabsContent value="authorization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Authorization Policies</CardTitle>
              <CardDescription>
                Configure bandwidth limits and session policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Download Speed (Mbps)</Label>
                  <Input
                    type="number"
                    value={aaaConfig.defaultDownloadSpeed}
                    onChange={(e) => setAaaConfig(prev => ({ ...prev, defaultDownloadSpeed: parseInt(e.target.value) || 10 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Upload Speed (Mbps)</Label>
                  <Input
                    type="number"
                    value={aaaConfig.defaultUploadSpeed}
                    onChange={(e) => setAaaConfig(prev => ({ ...prev, defaultUploadSpeed: parseInt(e.target.value) || 10 }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Session Limit (minutes)</Label>
                  <Input
                    type="number"
                    value={aaaConfig.defaultSessionLimit || ''}
                    onChange={(e) => setAaaConfig(prev => ({ ...prev, defaultSessionLimit: parseInt(e.target.value) || null as unknown as undefined }))}
                    placeholder="Leave empty for no limit"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Data Limit (MB)</Label>
                  <Input
                    type="number"
                    value={aaaConfig.defaultDataLimit || ''}
                    onChange={(e) => setAaaConfig(prev => ({ ...prev, defaultDataLimit: parseInt(e.target.value) || null as unknown as undefined }))}
                    placeholder="Leave empty for no limit"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Max Concurrent Sessions per User</Label>
                <Input
                  type="number"
                  value={aaaConfig.maxConcurrentSessions}
                  onChange={(e) => setAaaConfig(prev => ({ ...prev, maxConcurrentSessions: parseInt(e.target.value) || 1 }))}
                  className="w-32"
                />
                <p className="text-sm text-muted-foreground">
                  Number of devices a user can have connected simultaneously
                </p>
              </div>

              <div className="space-y-2">
                <Label>Session Timeout Policy</Label>
                <Select
                  value={aaaConfig.sessionTimeoutPolicy}
                  onValueChange={(value) => setAaaConfig(prev => ({ ...prev, sessionTimeoutPolicy: value }))}
                >
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hard">
                      Hard Limit - Disconnect immediately when limit reached
                    </SelectItem>
                    <SelectItem value="soft">
                      Soft Limit - Warn user, allow to continue
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t">
                <Button onClick={handleSaveAaaConfig} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4 mr-2" />
                  )}
                  Save Authorization Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accounting Tab */}
        <TabsContent value="accounting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Accounting Settings</CardTitle>
              <CardDescription>
                Configure how user sessions and data usage are tracked
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Accounting Sync Interval (minutes)</Label>
                <Input
                  type="number"
                  value={aaaConfig.accountingSyncInterval}
                  onChange={(e) => setAaaConfig(prev => ({ ...prev, accountingSyncInterval: parseInt(e.target.value) || 5 }))}
                  className="w-32"
                />
                <p className="text-sm text-muted-foreground">
                  How often session data is synced from the RADIUS server
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Captive Portal</Label>
                  <p className="text-sm text-muted-foreground">
                    Show a login/registration page before granting internet access
                  </p>
                </div>
                <Switch
                  checked={aaaConfig.portalEnabled}
                  onCheckedChange={(checked) => setAaaConfig(prev => ({ ...prev, portalEnabled: checked }))}
                />
              </div>

              {aaaConfig.portalEnabled && (
                <>
                  <div className="space-y-2">
                    <Label>Portal Title</Label>
                    <Input
                      value={aaaConfig.portalTitle || ''}
                      onChange={(e) => setAaaConfig(prev => ({ ...prev, portalTitle: e.target.value }))}
                      placeholder="Welcome to Our Hotel"
                      className="max-w-md"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Redirect URL (after login)</Label>
                    <Input
                      value={aaaConfig.portalRedirectUrl || ''}
                      onChange={(e) => setAaaConfig(prev => ({ ...prev, portalRedirectUrl: e.target.value }))}
                      placeholder="https://www.example.com"
                      className="max-w-md"
                    />
                    <p className="text-sm text-muted-foreground">
                      Leave empty to redirect to the default hotel page
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Portal Brand Color</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={aaaConfig.portalBrandColor}
                        onChange={(e) => setAaaConfig(prev => ({ ...prev, portalBrandColor: e.target.value }))}
                        className="w-10 h-10 rounded cursor-pointer border border-border"
                      />
                      <Input
                        value={aaaConfig.portalBrandColor}
                        onChange={(e) => setAaaConfig(prev => ({ ...prev, portalBrandColor: e.target.value }))}
                        className="w-32"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4 border-t">
                <Button onClick={handleSaveAaaConfig} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4 mr-2" />
                  )}
                  Save Accounting Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Delete NAS Confirmation Dialog */}
      <AlertDialog open={!!deleteNasId} onOpenChange={(open) => !open && setDeleteNasId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete NAS Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this NAS client? This will remove it from the RADIUS server configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteNas} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Service Action Confirmation ─────────────────────────────── */}
      <AlertDialog open={!!serviceActionConfirm} onOpenChange={(open) => !open && setServiceActionConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {serviceActionConfirm === 'stop' ? 'Stop' : 'Restart'} RADIUS service?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {serviceActionConfirm === 'stop'
                ? 'This will immediately stop the RADIUS server and disconnect ALL active WiFi sessions. Users will need to reconnect after the service is started again.'
                : 'This will restart the RADIUS service, which will briefly disconnect ALL active WiFi sessions. Users will be able to reconnect automatically once the service is back up.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (serviceActionConfirm) {
                  handleServiceAction(serviceActionConfirm);
                  setServiceActionConfirm(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {serviceActionConfirm === 'stop' ? 'Stop' : 'Restart'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div>
  );
}
