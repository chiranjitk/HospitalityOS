import { describe, it, expect, afterAll } from 'vitest';
import { GET as getDnsZones } from '@/app/api/networking/dns/zones/route';
import { GET as getDnsRedirects } from '@/app/api/networking/dns/redirects/route';
import { GET as getDhcpSubnets } from '@/app/api/networking/dhcp/subnets/route';
import { GET as getDhcpLeases } from '@/app/api/networking/dhcp/leases/route';
import { GET as getDhcpReservations } from '@/app/api/networking/dhcp/reservations/route';
import { GET as getFirewallRules } from '@/app/api/networking/firewall/rules/route';
import { GET as getFirewallZones } from '@/app/api/networking/firewall/zones/route';
import { GET as getFirewallMacFilter } from '@/app/api/networking/firewall/mac-filter/route';
import { GET as getBandwidthPolicies } from '@/app/api/networking/bandwidth/policies/route';
import { GET as getPortals } from '@/app/api/networking/portals/route';
import { GET as getSystemHealth } from '@/app/api/networking/system/health/route';
import { GET as getBandwidthReport } from '@/app/api/networking/reports/bandwidth/route';
import { GET as getSurfingReport } from '@/app/api/networking/reports/surfing/route';
import { GET as getPortForwarding } from '@/app/api/networking/port-forwarding/route';
import { GET as getVlans } from '@/app/api/networking/vlans/route';
import { GET as getBonds } from '@/app/api/networking/bonds/route';
import { GET as getSyslog } from '@/app/api/networking/syslog/route';
import { createAuthRequest, buildUrl } from './test-helpers';

describe('Networking — DNS Zones', () => {
  describe('GET /api/networking/dns/zones', () => {
    it('should return DNS zones list', async () => {
      const url = buildUrl('/api/networking/dns/zones');
      const req = await createAuthRequest(url);
      const res = await getDnsZones(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/networking/dns/zones');
      const res = await getDnsZones(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });
});

describe('Networking — DNS Redirects', () => {
  describe('GET /api/networking/dns/redirects', () => {
    it('should return DNS redirect rules', async () => {
      const url = buildUrl('/api/networking/dns/redirects');
      const req = await createAuthRequest(url);
      const res = await getDnsRedirects(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/networking/dns/redirects');
      const res = await getDnsRedirects(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });
});

describe('Networking — DHCP Subnets', () => {
  describe('GET /api/networking/dhcp/subnets', () => {
    it('should return DHCP subnets', async () => {
      const url = buildUrl('/api/networking/dhcp/subnets');
      const req = await createAuthRequest(url);
      const res = await getDhcpSubnets(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/networking/dhcp/subnets');
      const res = await getDhcpSubnets(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });
});

describe('Networking — DHCP Leases', () => {
  describe('GET /api/networking/dhcp/leases', () => {
    it('should return DHCP leases', async () => {
      const url = buildUrl('/api/networking/dhcp/leases');
      const req = await createAuthRequest(url);
      const res = await getDhcpLeases(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/networking/dhcp/leases');
      const res = await getDhcpLeases(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });
});

describe('Networking — DHCP Reservations', () => {
  describe('GET /api/networking/dhcp/reservations', () => {
    it('should return DHCP reservations', async () => {
      const url = buildUrl('/api/networking/dhcp/reservations');
      const req = await createAuthRequest(url);
      const res = await getDhcpReservations(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/networking/dhcp/reservations');
      const res = await getDhcpReservations(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });
});

describe('Networking — Firewall Rules', () => {
  describe('GET /api/networking/firewall/rules', () => {
    it('should return firewall rules', async () => {
      const url = buildUrl('/api/networking/firewall/rules');
      const req = await createAuthRequest(url);
      const res = await getFirewallRules(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/networking/firewall/rules');
      const res = await getFirewallRules(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });
});

describe('Networking — Firewall Zones', () => {
  describe('GET /api/networking/firewall/zones', () => {
    it('should return firewall zones', async () => {
      const url = buildUrl('/api/networking/firewall/zones');
      const req = await createAuthRequest(url);
      const res = await getFirewallZones(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/networking/firewall/zones');
      const res = await getFirewallZones(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });
});

describe('Networking — MAC Filter', () => {
  describe('GET /api/networking/firewall/mac-filter', () => {
    it('should return MAC filter rules', async () => {
      const url = buildUrl('/api/networking/firewall/mac-filter');
      const req = await createAuthRequest(url);
      const res = await getFirewallMacFilter(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/networking/firewall/mac-filter');
      const res = await getFirewallMacFilter(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });
});

describe('Networking — Bandwidth Policies', () => {
  describe('GET /api/networking/bandwidth/policies', () => {
    it('should return bandwidth policies', async () => {
      const url = buildUrl('/api/networking/bandwidth/policies');
      const req = await createAuthRequest(url);
      const res = await getBandwidthPolicies(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/networking/bandwidth/policies');
      const res = await getBandwidthPolicies(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });
});

describe('Networking — Portals', () => {
  describe('GET /api/networking/portals', () => {
    it('should return captive portal list', async () => {
      const url = buildUrl('/api/networking/portals');
      const req = await createAuthRequest(url);
      const res = await getPortals(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/networking/portals');
      const res = await getPortals(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });
});

describe('Networking — System Health', () => {
  describe('GET /api/networking/system/health', () => {
    it('should return system health status', async () => {
      const url = buildUrl('/api/networking/system/health');
      const req = await createAuthRequest(url);
      const res = await getSystemHealth(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/networking/system/health');
      const res = await getSystemHealth(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });
});

describe('Networking — VLANs', () => {
  describe('GET /api/networking/vlans', () => {
    it('should return VLAN list', async () => {
      const url = buildUrl('/api/networking/vlans');
      const req = await createAuthRequest(url);
      const res = await getVlans(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});

describe('Networking — Bonds', () => {
  describe('GET /api/networking/bonds', () => {
    it('should return bond interfaces', async () => {
      const url = buildUrl('/api/networking/bonds');
      const req = await createAuthRequest(url);
      const res = await getBonds(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});

describe('Networking — Port Forwarding', () => {
  describe('GET /api/networking/port-forwarding', () => {
    it('should return port forwarding rules', async () => {
      const url = buildUrl('/api/networking/port-forwarding');
      const req = await createAuthRequest(url);
      const res = await getPortForwarding(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});

describe('Networking — Reports', () => {
  describe('GET /api/networking/reports/bandwidth', () => {
    it('should return bandwidth report data', async () => {
      const url = buildUrl('/api/networking/reports/bandwidth');
      const req = await createAuthRequest(url);
      const res = await getBandwidthReport(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
    });
  });

  describe('GET /api/networking/reports/surfing', () => {
    it('should return web surfing report data', async () => {
      const url = buildUrl('/api/networking/reports/surfing');
      const req = await createAuthRequest(url);
      const res = await getSurfingReport(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
    });
  });
});

describe('Networking — Syslog', () => {
  describe('GET /api/networking/syslog', () => {
    it('should return syslog entries', async () => {
      const url = buildUrl('/api/networking/syslog');
      const req = await createAuthRequest(url);
      const res = await getSyslog(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
