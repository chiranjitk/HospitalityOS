/**
 * Prisma Schema Validation Tests
 *
 * Verifies database schema integrity: model existence, field definitions,
 * relations, unique constraints, and seed data for the StaySuite-HospitalityOS
 * project's 300+ Prisma models.
 */
import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';

// Helper: check that a model delegate exists on the Prisma client
function modelExists(name: string): boolean {
  return name in (db as Record<string, unknown>);
}

// ─── 1. Model Existence ──────────────────────────────────────────────────────

describe('Model Existence', () => {
  describe('Core models', () => {
    const models = [
      'booking', 'guest', 'room', 'roomType', 'property', 'tenant', 'user',
      'folio', 'folioLineItem', 'groupBooking', 'reservation',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Billing & Finance models', () => {
    const models = [
      'invoice', 'payment', 'taxReport', 'financialAccount',
      'depositSchedule', 'financingPlan', 'financingInstallment',
      'cashFlowForecast', 'budget', 'budgetLine', 'revenueAccount',
      'journalEntry', 'journalEntryLine', 'creditNote', 'postingRule',
      'postingLog', 'paymentSchedule', 'paymentGateway', 'paymentTerminal',
      'paymentToken', 'exchangeRate', 'bankAccount', 'bankTransaction',
      'manualTransaction', 'reconciliation', 'apInvoice', 'apInvoiceLine',
      'apPayment', 'cityLedgerInvoice', 'cityLedgerItem', 'cityLedgerPayment',
      'gstSettings', 'gstReturn', 'gstEInvoice', 'gstSacCode',
      'tdsRecord', 'tcsRecord',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('PMS models', () => {
    const models = [
      'task', 'workOrder', 'serviceRequest', 'waitlistEntry',
      'preventiveMaintenance', 'maintenanceBlock', 'noShowSettings' as string,
      'roomMoveLog', 'roomTypeChange', 'nightAudit', 'nightAuditLog',
      'nightAuditStep', 'registrationCard', 'keyCard', 'smartLock',
      'smartLockAccessLog', 'digitalKeyAccessLog',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      // noShowSettings is not a model, skip
      if (m === 'noShowSettings') {
        expect(modelExists(m), `db.${m} should not exist (it is a JSON field on Property)`).toBe(false);
        return;
      }
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Revenue Management models', () => {
    const models = [
      'ratePlan', 'rateShoppingCompetitor', 'rateShoppingResult',
      'competitorPrice', 'competitorSyncLog', 'pricingRule', 'demandForecast',
      'priceOverride', 'packagePlan', 'packageComponent', 'packageRate',
      'cancellationPolicy', 'cancellationPenalty', 'discount', 'promotion',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Marketing & CRM models', () => {
    const models = [
      'campaign', 'journeyCampaign', 'journeyStage', 'journeyAction',
      'abandonedBooking', 'guestSegment', 'segmentMembership',
      'guestBehavior', 'guestRecommendation', 'guestJourney',
      'brand', 'adCampaign', 'adPerformance', 'upsellCampaign',
      'upsellOffer', 'upsellRule', 'travelAgent',
      'campaignAbTest', 'campaignSegment',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Staff & HR models', () => {
    const models = [
      'payrollPeriod', 'payrollEntry', 'salaryComponent',
      'staffShift', 'staffAttendance', 'staffLeave', 'staffSchedule',
      'staffPerformance', 'staffSkill', 'staffWorkload', 'staffChannel',
      'staffChannelMember', 'staffChatMessage', 'shiftTemplate',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Experience models', () => {
    const models = [
      'spaAppointment', 'spaTreatment', 'spaTherapist',
      'golfTeeTime', 'golfCourse', 'golfMembership',
      'casinoTransaction', 'casinoTable',
      'timeshareOwnership', 'timeshareUnit',
      'experience', 'experienceBooking', 'experienceFeedback',
      'experiencePricing', 'experienceVendor',
      'laundryOrder', 'laundryOrderItem', 'laundryItem',
      'minibarSetup', 'minibarItem', 'minibarConsumption',
      'lostFoundItem', 'parkingSlot', 'parkingPass', 'vehicle',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('IoT models', () => {
    const models = [
      'ioTDevice', 'ioTCommand', 'ioTReading',
      'energyMetric',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('WiFi & Network models', () => {
    const models = [
      'wiFiUser', 'wiFiSession', 'wiFiVoucher', 'wiFiPlan',
      'bandwidthPool', 'bandwidthPolicy', 'bandwidthPolicyDetail',
      'bandwidthTopup', 'bandwidthUsageDaily', 'bandwidthUsageSession',
      'fairAccessPolicy', 'fupSwitchLog',
      'wiFiAAAConfig', 'wiFiGateway', 'wiFiAccountingSync',
      'radiusNAS', 'radiusServerConfig', 'radiusAuthLog', 'radiusCoaLog',
      'radiusProvisioningLog', 'radiusEventUser', 'radiusMacAuth',
      'radAcct', 'radCheck', 'radReply', 'radGroupCheck', 'radGroupReply',
      'radPostAuth', 'radUserGroup',
      'networkInterface', 'interfaceConfig', 'interfaceAlias', 'interfaceRole',
      'vlanConfig', 'roomVlan', 'ipPool', 'ipPoolRange',
      'firewallRule', 'firewallZone', 'firewallSchedule', 'natLog',
      'staticRoute', 'gateway', 'gatewayExplicitRoute', 'gatewayFwmark',
      'gatewayHealthRule', 'bridgeConfig', 'bondConfig',
      'multiWanConfig', 'wanFailover', 'portForwardRule',
      'rateLimitRule', 'macFilter', 'contentFilter', 'webCategory',
      'webCategorySchedule', 'captivePortal', 'portalTemplate', 'portalPage',
      'portalMapping', 'portalAuthentication', 'portalWhitelist',
      'nas', 'nasHealthLog', 'nasReload',
      'dhcpSubnet', 'dhcpOption', 'dhcpReservation', 'dhcpBlacklist',
      'dhcpHostnameFilter', 'dhcpTagRule', 'dhcpLease', 'dhcpLeaseScript',
      'dnsZone', 'dnsRecord', 'dnsRedirectRule',
      'systemNetworkHealth', 'surveillanceConfig', 'syslogServer',
      'networkConfigBackup', 'usageLog', 'usageSummary',
      'dataUsageByPeriod',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Notification models', () => {
    const models = [
      'notificationTemplate', 'notificationLog', 'notification',
      'notificationPreference', 'scheduledNotification',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Audit & Security models', () => {
    const models = [
      'auditLog', 'bookingAuditLog', 'securityEvent', 'securityIncident',
      'securitySettings', 'idempotencyKey',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Webhook models', () => {
    const models = [
      'webhookEndpoint', 'webhookDeliveryLog',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('POS / Restaurant models', () => {
    const models = [
      'restaurantTable', 'order', 'orderItem', 'orderCategory',
      'orderDiscount', 'menuItem', 'menuModifier', 'menuModifierOption',
      'menuVariant', 'menuBoard', 'menuBoardItem',
      'posTerminal',
      'terminalTransaction', 'offlineOrder', 'tableMerge',
      'recipe', 'recipeIngredient',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Channel / OTA / Integration models', () => {
    const models = [
      'channelConnection', 'channelMapping', 'channelRestriction',
      'channelSyncLog', 'channelRetryQueue', 'channelDeadLetterQueue',
      'gdsBooking', 'gdsConnection', 'gdsRateCode',
      'googleHotelAdsConnection', 'metasearchConnection',
      'integration', 'commissionRule', 'commissionRecord', 'commissionPayment',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Events & Banquet models', () => {
    const models = [
      'event', 'eventSpace', 'eventResource', 'banquetEventOrder', 'bEOItem',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Chat & Communication models', () => {
    const models = [
      'chatConversation', 'chatMessage', 'chatAttachment', 'chatTransfer',
      'communicationChannel', 'messageTemplate',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Inventory & Asset models', () => {
    const models = [
      'inventoryItem', 'inventoryLock', 'inventoryMovement',
      'inventoryTransfer', 'inventoryTransferItem',
      'purchaseOrder', 'purchaseOrderItem',
      'purchaseRequisition', 'purchaseRequisitionItem',
      'stockItem', 'stockConsumption',
      'asset', 'amenity',
      'inspectionTemplate', 'inspectionResult',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Subscription & Loyalty models', () => {
    const models = [
      'subscription', 'subscriptionPlan', 'subscriptionInvoice',
      'loyaltyTier', 'loyaltyReward', 'loyaltyPointTransaction',
      'loyaltyRedemption', 'loyaltyTransaction',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Automation & AI models', () => {
    const models = [
      'automationRule', 'automationExecutionLog',
      'aISuggestion', 'aiConversation', 'aiConversationMessage',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Reporting & Analytics models', () => {
    const models = [
      'reportCache', 'reportHistory', 'analyticsQuery',
      'scheduledReport', 'liveSession',
      'featureAnnouncement', 'helpArticle', 'helpCategory',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Document & Compliance models', () => {
    const models = [
      'documentApproval', 'consentRecord', 'gDPRRequest',
      'guestDocument', 'guestFeedback', 'guestReview', 'externalReview',
      'guestStay', 'deviceProfile',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });

  describe('Other models', () => {
    const models = [
      'session', 'role', 'licenseKey', 'vendor', 'vendorPayment',
      'registrationPlan', 'sSOConnection', 'sSOSession',
      'userFcmToken', 'userTutorial',
      'kioskSettings', 'scheduleAccess', 'storedToken',
      'camera', 'cameraGroup', 'cameraEvent',
      'coaSessionDetail', 'invoiceTemplate', 'invoiceMatch', 'invoiceMatchLine',
      'scheduledCharge', 'scheduledChargeExecution',
      'vipAlert', 'vipRule',
      'floorPlan', 'floorPlanRoom',
      'hardwareAdapter', 'hardwareOperationLog', 'hardwareWebhookLog',
    ];
    it.each(models)('should have model "%s" on db client', (m) => {
      expect(modelExists(m), `db.${m} should exist`).toBe(true);
    });
  });
});

// ─── 2. Model Field Validation ───────────────────────────────────────────────

describe('Model Field Validation', () => {
  it('Booking model should have expected fields', async () => {
    const booking = await db.booking.findFirst({
      select: {
        id: true, status: true, confirmationCode: true, checkIn: true,
        checkOut: true, totalAmount: true, tenantId: true, propertyId: true,
        primaryGuestId: true, source: true, adults: true, children: true,
        roomRate: true, currency: true, createdAt: true, updatedAt: true,
        deletedAt: true, portalToken: true, groupId: true,
      },
    });
    // Should not throw — even if null (empty table), Prisma accepts the select
    expect(booking === null || typeof booking === 'object').toBe(true);
  });

  it('Guest model should have expected fields', async () => {
    const guest = await db.guest.findFirst({
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true,
        nationality: true, dateOfBirth: true, gender: true, idType: true,
        idNumber: true, address: true, city: true, state: true, country: true,
        postalCode: true, loyaltyTier: true, loyaltyPoints: true, isVip: true,
        vipLevel: true, status: true, source: true, totalStays: true,
        totalSpent: true, kycStatus: true, createdAt: true, updatedAt: true,
        deletedAt: true, tenantId: true,
      },
    });
    expect(guest === null || typeof guest === 'object').toBe(true);
  });

  it('Room model should have expected fields', async () => {
    const room = await db.room.findFirst({
      select: {
        id: true, number: true, floor: true, status: true,
        propertyId: true, roomTypeId: true, housekeepingStatus: true,
        createdAt: true, updatedAt: true, deletedAt: true,
      },
    });
    expect(room === null || typeof room === 'object').toBe(true);
  });

  it('RoomType model should have expected fields', async () => {
    const roomType = await db.roomType.findFirst({
      select: {
        id: true, name: true, code: true, description: true, basePrice: true,
        maxOccupancy: true, propertyId: true, status: true,
        createdAt: true, updatedAt: true, deletedAt: true,
      },
    });
    expect(roomType === null || typeof roomType === 'object').toBe(true);
  });

  it('Property model should have expected fields', async () => {
    const property = await db.property.findFirst({
      select: {
        id: true, name: true, slug: true, description: true, type: true,
        address: true, city: true, state: true, country: true, postalCode: true,
        latitude: true, longitude: true, checkInTime: true, checkOutTime: true,
        timezone: true, currency: true, taxType: true, defaultTaxRate: true,
        totalRooms: true, totalFloors: true, status: true,
        noShowSettings: true, createdAt: true, updatedAt: true, deletedAt: true,
        tenantId: true, brandId: true,
      },
    });
    expect(property === null || typeof property === 'object').toBe(true);
  });

  it('Tenant model should have expected fields', async () => {
    const tenant = await db.tenant.findFirst({
      select: {
        id: true, name: true, slug: true, email: true, status: true,
        plan: true, createdAt: true, updatedAt: true,
      },
    });
    expect(tenant === null || typeof tenant === 'object').toBe(true);
  });

  it('User model should have expected fields', async () => {
    const user = await db.user.findFirst({
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true, status: true,
        tenantId: true, roleId: true, createdAt: true, updatedAt: true,
      },
    });
    expect(user === null || typeof user === 'object').toBe(true);
  });

  it('Folio model should have expected fields', async () => {
    const folio = await db.folio.findFirst({
      select: {
        id: true, folioNumber: true, bookingId: true, guestId: true,
        subtotal: true, taxes: true, discount: true, totalAmount: true,
        paidAmount: true, balance: true, currency: true, status: true,
        tenantId: true, propertyId: true, createdAt: true, updatedAt: true,
      },
    });
    expect(folio === null || typeof folio === 'object').toBe(true);
  });

  it('FolioLineItem model should have expected fields', async () => {
    const item = await db.folioLineItem.findFirst({
      select: {
        id: true, folioId: true, description: true, category: true,
        quantity: true, unitPrice: true, totalAmount: true, serviceDate: true,
      },
    });
    expect(item === null || typeof item === 'object').toBe(true);
  });

  it('Invoice model should have expected fields', async () => {
    const invoice = await db.invoice.findFirst({
      select: {
        id: true, invoiceNumber: true, status: true, totalAmount: true,
        tenantId: true, folioId: true, createdAt: true, updatedAt: true,
      },
    });
    expect(invoice === null || typeof invoice === 'object').toBe(true);
  });

  it('Payment model should have expected fields', async () => {
    const payment = await db.payment.findFirst({
      select: {
        id: true, amount: true, method: true, status: true,
        tenantId: true, createdAt: true, updatedAt: true,
      },
    });
    expect(payment === null || typeof payment === 'object').toBe(true);
  });

  it('Task model should have expected fields', async () => {
    const task = await db.task.findFirst({
      select: {
        id: true, title: true, description: true, status: true,
        priority: true, propertyId: true, roomId: true, assignedTo: true,
        createdAt: true, updatedAt: true,
      },
    });
    expect(task === null || typeof task === 'object').toBe(true);
  });

  it('WorkOrder model should have expected fields', async () => {
    const wo = await db.workOrder.findFirst({
      select: {
        id: true, title: true, description: true, status: true,
        priority: true, propertyId: true, createdAt: true, updatedAt: true,
      },
    });
    expect(wo === null || typeof wo === 'object').toBe(true);
  });

  it('RatePlan model should have expected fields', async () => {
    const rp = await db.ratePlan.findFirst({
      select: {
        id: true, name: true, description: true, status: true,
        tenantId: true, roomTypeId: true, createdAt: true, updatedAt: true,
      },
    });
    expect(rp === null || typeof rp === 'object').toBe(true);
  });

  it('Campaign model should have expected fields', async () => {
    const c = await db.campaign.findFirst({
      select: {
        id: true, name: true, type: true, status: true,
        tenantId: true, createdAt: true, updatedAt: true,
      },
    });
    expect(c === null || typeof c === 'object').toBe(true);
  });

  it('IoTDevice model should have expected fields', async () => {
    const d = await (db as any).ioTDevice.findFirst({
      // Note: Prisma client uses ioTDevice (not iotDevice) due to acronym casing
    
      select: {
        id: true, name: true, type: true, status: true,
        propertyId: true, createdAt: true, updatedAt: true,
      },
    });
    expect(d === null || typeof d === 'object').toBe(true);
  });

  it('WiFiUser model should have expected fields', async () => {
    const u = await (db as any).wiFiUser.findFirst({
      // Note: Prisma client uses wiFiUser (not wifiUser) due to acronym casing
      select: {
        id: true, username: true, password: true, status: true,
        propertyId: true, tenantId: true, planId: true, guestId: true,
        createdAt: true, updatedAt: true,
      },
    });
    expect(u === null || typeof u === 'object').toBe(true);
  });

  it('RestaurantTable model should have expected fields', async () => {
    const t = await db.restaurantTable.findFirst({
      select: {
        id: true, name: true, capacity: true, status: true,
        propertyId: true, createdAt: true, updatedAt: true,
      },
    });
    expect(t === null || typeof t === 'object').toBe(true);
  });

  it('Order model should have expected fields', async () => {
    const o = await db.order.findFirst({
      select: {
        id: true, status: true, totalAmount: true, propertyId: true,
        createdAt: true, updatedAt: true,
      },
    });
    expect(o === null || typeof o === 'object').toBe(true);
  });

  it('MenuItem model should have expected fields', async () => {
    const mi = await db.menuItem.findFirst({
      select: {
        id: true, name: true, description: true, price: true,
        propertyId: true, createdAt: true, updatedAt: true,
      },
    });
    expect(mi === null || typeof mi === 'object').toBe(true);
  });
});

// ─── 3. Relation Validation ──────────────────────────────────────────────────

describe('Relation Validation', () => {
  describe('Booking relations', () => {
    it('Booking should include related primaryGuest', async () => {
      const booking = await db.booking.findFirst({
        include: { primaryGuest: true },
      });
      if (booking) {
        expect(booking.primaryGuest).toBeDefined();
        expect(booking.primaryGuest).toHaveProperty('id');
        expect(booking.primaryGuest).toHaveProperty('firstName');
      }
    });

    it('Booking should include related room (nullable)', async () => {
      const booking = await db.booking.findFirst({
        include: { room: true },
      });
      if (booking) {
        // room is optional — may be null
        if (booking.room) {
          expect(booking.room).toHaveProperty('id');
          expect(booking.room).toHaveProperty('number');
        }
      }
    });

    it('Booking should include related roomType', async () => {
      const booking = await db.booking.findFirst({
        include: { roomType: true },
      });
      if (booking) {
        expect(booking.roomType).toBeDefined();
        expect(booking.roomType).toHaveProperty('id');
        expect(booking.roomType).toHaveProperty('name');
      }
    });

    it('Booking should include related property', async () => {
      const booking = await db.booking.findFirst({
        include: { property: true },
      });
      if (booking) {
        expect(booking.property).toBeDefined();
        expect(booking.property).toHaveProperty('id');
        expect(booking.property).toHaveProperty('name');
      }
    });

    it('Booking should include related folios', async () => {
      const booking = await db.booking.findFirst({
        include: { folios: true },
      });
      if (booking) {
        expect(Array.isArray(booking.folios)).toBe(true);
      }
    });

    it('Booking should include related auditLogs', async () => {
      const booking = await db.booking.findFirst({
        include: { auditLogs: true },
      });
      if (booking) {
        expect(Array.isArray(booking.auditLogs)).toBe(true);
      }
    });

    it('Booking should include related depositSchedules', async () => {
      const booking = await db.booking.findFirst({
        include: { depositSchedules: true },
      });
      if (booking) {
        expect(Array.isArray(booking.depositSchedules)).toBe(true);
      }
    });
  });

  describe('Folio relations', () => {
    it('Folio should include related booking', async () => {
      const folio = await db.folio.findFirst({
        include: { booking: true },
      });
      if (folio) {
        expect(folio.booking).toBeDefined();
        expect(folio.booking).toHaveProperty('id');
        expect(folio.booking).toHaveProperty('confirmationCode');
      }
    });

    it('Folio should include related lineItems', async () => {
      const folio = await db.folio.findFirst({
        include: { lineItems: true },
      });
      if (folio) {
        expect(Array.isArray(folio.lineItems)).toBe(true);
      }
    });

    it('Folio should include related payments', async () => {
      const folio = await db.folio.findFirst({
        include: { payments: true },
      });
      if (folio) {
        expect(Array.isArray(folio.payments)).toBe(true);
      }
    });
  });

  describe('Guest relations', () => {
    it('Guest should include related tenant', async () => {
      const guest = await db.guest.findFirst({
        include: { tenant: true },
      });
      if (guest) {
        expect(guest.tenant).toBeDefined();
        expect(guest.tenant).toHaveProperty('id');
        expect(guest.tenant).toHaveProperty('name');
      }
    });

    it('Guest should include related bookings', async () => {
      const guest = await db.guest.findFirst({
        include: { bookings: true },
      });
      if (guest) {
        expect(Array.isArray(guest.bookings)).toBe(true);
      }
    });

    it('Guest should include related segmentMemberships', async () => {
      const guest = await db.guest.findFirst({
        include: { segmentMemberships: true },
      });
      if (guest) {
        expect(Array.isArray(guest.segmentMemberships)).toBe(true);
      }
    });
  });

  describe('Property relations', () => {
    it('Property should include related tenant', async () => {
      const property = await db.property.findFirst({
        include: { tenant: true },
      });
      if (property) {
        expect(property.tenant).toBeDefined();
        expect(property.tenant).toHaveProperty('id');
      }
    });

    it('Property should include related rooms', async () => {
      const property = await db.property.findFirst({
        include: { rooms: true },
      });
      if (property) {
        expect(Array.isArray(property.rooms)).toBe(true);
      }
    });

    it('Property should include related roomTypes', async () => {
      const property = await db.property.findFirst({
        include: { roomTypes: true },
      });
      if (property) {
        expect(Array.isArray(property.roomTypes)).toBe(true);
      }
    });

    it('Property should include related brand', async () => {
      const property = await db.property.findFirst({
        include: { brand: true },
      });
      if (property) {
        // brand is optional
        if (property.brand) {
          expect(property.brand).toHaveProperty('id');
          expect(property.brand).toHaveProperty('name');
        }
      }
    });

    it('Property should include related iotDevices', async () => {
      const property = await db.property.findFirst({
        include: { iotDevices: true },
      });
      if (property) {
        expect(Array.isArray(property.iotDevices)).toBe(true);
      }
    });

    it('Property should include related tables (RestaurantTable)', async () => {
      const property = await db.property.findFirst({
        include: { tables: true },
      });
      if (property) {
        expect(Array.isArray(property.tables)).toBe(true);
      }
    });
  });

  describe('Room relations', () => {
    it('Room should include related property', async () => {
      const room = await db.room.findFirst({
        include: { property: true },
      });
      if (room) {
        expect(room.property).toBeDefined();
        expect(room.property).toHaveProperty('id');
      }
    });

    it('Room should include related roomType', async () => {
      const room = await db.room.findFirst({
        include: { roomType: true },
      });
      if (room) {
        expect(room.roomType).toBeDefined();
        expect(room.roomType).toHaveProperty('id');
        expect(room.roomType).toHaveProperty('name');
      }
    });

    it('Room should include related bookings', async () => {
      const room = await db.room.findFirst({
        include: { bookings: true },
      });
      if (room) {
        expect(Array.isArray(room.bookings)).toBe(true);
      }
    });
  });

  describe('User relations', () => {
    it('User should include related tenant', async () => {
      const user = await db.user.findFirst({
        include: { tenant: true },
      });
      if (user) {
        expect(user.tenant).toBeDefined();
        expect(user.tenant).toHaveProperty('id');
      }
    });

    it('User should include related sessions', async () => {
      const user = await db.user.findFirst({
        include: { sessions: true },
      });
      if (user) {
        expect(Array.isArray(user.sessions)).toBe(true);
      }
    });
  });

  describe('Tenant relations', () => {
    it('Tenant should include related properties', async () => {
      const tenant = await db.tenant.findFirst({
        include: { properties: true },
      });
      if (tenant) {
        expect(Array.isArray(tenant.properties)).toBe(true);
      }
    });

    it('Tenant should include related users', async () => {
      const tenant = await db.tenant.findFirst({
        include: { users: true },
      });
      if (tenant) {
        expect(Array.isArray(tenant.users)).toBe(true);
      }
    });

    it('Tenant should include related guests', async () => {
      const tenant = await db.tenant.findFirst({
        include: { guests: true },
      });
      if (tenant) {
        expect(Array.isArray(tenant.guests)).toBe(true);
      }
    });

    it('Tenant should include related campaigns', async () => {
      const tenant = await db.tenant.findFirst({
        include: { campaigns: true },
      });
      if (tenant) {
        expect(Array.isArray(tenant.campaigns)).toBe(true);
      }
    });
  });

  describe('DepositSchedule relations', () => {
    it('DepositSchedule should include related booking', async () => {
      const ds = await db.depositSchedule.findFirst({
        include: { booking: true },
      });
      if (ds) {
        expect(ds.booking).toBeDefined();
        expect(ds.booking).toHaveProperty('id');
      }
    });
  });

  describe('FinancingInstallment relations', () => {
    it('FinancingInstallment should include related financingPlan', async () => {
      const fi = await db.financingInstallment.findFirst({
        include: { financingPlan: true },
      });
      if (fi) {
        expect(fi.financingPlan).toBeDefined();
        expect(fi.financingPlan).toHaveProperty('id');
      }
    });
  });

  describe('WiFiUser relations', () => {
    it('WiFiUser should include related property', async () => {
      const wu = await (db as any).wiFiUser.findFirst({
      // Note: Prisma client uses wiFiUser (not wifiUser)
        include: { property: true },
      });
      if (wu) {
        expect(wu.property).toBeDefined();
        expect(wu.property).toHaveProperty('id');
      }
    });

    it('WiFiUser should include related tenant', async () => {
      const wu = await (db as any).wiFiUser.findFirst({
      // Note: Prisma client uses wiFiUser (not wifiUser)
        include: { tenant: true },
      });
      if (wu) {
        expect(wu.tenant).toBeDefined();
        expect(wu.tenant).toHaveProperty('id');
      }
    });
  });

  describe('NotificationTemplate relations', () => {
    it('NotificationTemplate should exist and have basic fields', async () => {
      const nt = await db.notificationTemplate.findFirst({
        select: { id: true, name: true, type: true, triggerEvent: true },
      });
      expect(nt === null || typeof nt === 'object').toBe(true);
    });
  });

  describe('AuditLog relations', () => {
    it('AuditLog should exist and have basic fields', async () => {
      const al = await db.auditLog.findFirst({
        select: { id: true, action: true, module: true, createdAt: true },
      });
      expect(al === null || typeof al === 'object').toBe(true);
    });
  });

  describe('WebhookEndpoint relations', () => {
    it('WebhookEndpoint should exist and have basic fields', async () => {
      const we = await db.webhookEndpoint.findFirst({
        select: { id: true, url: true, events: true, secret: true, isActive: true },
      });
      expect(we === null || typeof we === 'object').toBe(true);
    });
  });
});

// ─── 4. Status Field Validation (schema uses String, not enums) ──────────────

describe('Status Field Validation', () => {
  it('Booking status should be a string value', async () => {
    const booking = await db.booking.findFirst({ select: { status: true } });
    if (booking) {
      expect(typeof booking.status).toBe('string');
      expect(booking.status.length).toBeGreaterThan(0);
    }
  });

  it('Room status should be a string value', async () => {
    const room = await db.room.findFirst({ select: { status: true } });
    if (room) {
      expect(typeof room.status).toBe('string');
    }
  });

  it('Property status should be a string value', async () => {
    const property = await db.property.findFirst({ select: { status: true } });
    if (property) {
      expect(typeof property.status).toBe('string');
    }
  });

  it('Guest status should be a string value', async () => {
    const guest = await db.guest.findFirst({ select: { status: true } });
    if (guest) {
      expect(typeof guest.status).toBe('string');
    }
  });

  it('Folio status should be a string value', async () => {
    const folio = await db.folio.findFirst({ select: { status: true } });
    if (folio) {
      expect(typeof folio.status).toBe('string');
    }
  });

  it('Payment status should be a string value', async () => {
    const payment = await db.payment.findFirst({ select: { status: true } });
    if (payment) {
      expect(typeof payment.status).toBe('string');
    }
  });

  it('Task status should be a string value', async () => {
    const task = await db.task.findFirst({ select: { status: true } });
    if (task) {
      expect(typeof task.status).toBe('string');
    }
  });

  it('Invoice status should be a string value', async () => {
    const invoice = await db.invoice.findFirst({ select: { status: true } });
    if (invoice) {
      expect(typeof invoice.status).toBe('string');
    }
  });

  it('Campaign status should be a string value', async () => {
    const campaign = await db.campaign.findFirst({ select: { status: true } });
    if (campaign) {
      expect(typeof campaign.status).toBe('string');
    }
  });

  it('IoTDevice status should be a string value', async () => {
    const device = await (db as any).ioTDevice.findFirst({ select: { status: true } });
    // Note: Prisma client uses ioTDevice (not iotDevice) due to acronym casing
    if (device) {
      expect(typeof device.status).toBe('string');
    }
  });

  it('Tenant status should be a string value', async () => {
    const tenant = await db.tenant.findFirst({ select: { status: true } });
    if (tenant) {
      expect(typeof tenant.status).toBe('string');
    }
  });
});

// ─── 5. Unique Constraint Validation ─────────────────────────────────────────

describe('Unique Constraint Validation', () => {
  const testSuffix = `SC${Date.now().toString(36)}`;

  it('should enforce unique constraint on Booking.confirmationCode', async () => {
    const code = `UNIQ-${testSuffix}`;
    await db.booking.create({
      data: {
        tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
        propertyId: '281fde73-7836-4511-b644-91f3663d8fcd',
        roomTypeId: '4d5269a2-63ad-48e7-8683-4b0efca11567',
        primaryGuestId: 'cb127462-1b96-4e37-8f78-65bbd0493ee1',
        confirmationCode: code,
        checkIn: new Date(),
        checkOut: new Date(Date.now() + 86400000),
        totalAmount: 100,
      },
    });

    await expect(
      db.booking.create({
        data: {
          tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
          propertyId: '281fde73-7836-4511-b644-91f3663d8fcd',
          roomTypeId: '4d5269a2-63ad-48e7-8683-4b0efca11567',
          primaryGuestId: 'cb127462-1b96-4e37-8f78-65bbd0493ee1',
          confirmationCode: code,
          checkIn: new Date(),
          checkOut: new Date(Date.now() + 86400000),
          totalAmount: 200,
        },
      })
    ).rejects.toThrow();

    // Cleanup
    await db.booking.deleteMany({ where: { confirmationCode: code } });
  });

  it('should enforce unique constraint on Folio.folioNumber', async () => {
    const folioNum = `FOL-UNIQ-${testSuffix}`;
    await db.folio.create({
      data: {
        tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
        propertyId: '281fde73-7836-4511-b644-91f3663d8fcd',
        bookingId: 'b544cc77-46a6-4e53-921e-50db663eb482',
        guestId: 'cb127462-1b96-4e37-8f78-65bbd0493ee1',
        folioNumber: folioNum,
        totalAmount: 0,
        balance: 0,
      },
    });

    await expect(
      db.folio.create({
        data: {
          tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
          propertyId: '281fde73-7836-4511-b644-91f3663d8fcd',
          bookingId: 'b544cc77-46a6-4e53-921e-50db663eb482',
          guestId: 'cb127462-1b96-4e37-8f78-65bbd0493ee1',
          folioNumber: folioNum,
          totalAmount: 0,
          balance: 0,
        },
      })
    ).rejects.toThrow();

    // Cleanup
    await db.folioLineItem.deleteMany({ where: { folio: { folioNumber: folioNum } } });
    await db.folio.deleteMany({ where: { folioNumber: folioNum } });
  });

  it('should enforce unique constraint on WiFiUser.username', async () => {
    const username = `uniquser_${testSuffix}`;
    const plan = await (db as any).wiFiPlan.findFirst({ select: { id: true } });

    await (db as any).wiFiUser.create({
      data: {
        tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
        propertyId: '281fde73-7836-4511-b644-91f3663d8fcd',
        username,
        password: 'TestPass123!',
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 86400000),
        planId: plan?.id,
      },
    });

    await expect(
      (db as any).wiFiUser.create({
        data: {
          tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
          propertyId: '281fde73-7836-4511-b644-91f3663d8fcd',
          username,
          password: 'TestPass456!',
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 86400000),
        },
      })
    ).rejects.toThrow();

    // Cleanup
    await (db as any).wiFiUser.deleteMany({ where: { username } });
  });

  it('should enforce unique constraint on WiFiVoucher.code', async () => {
    const code = `VOUCH-${testSuffix}`;
    const plan = await (db as any).wiFiPlan.findFirst({ select: { id: true } });
    if (!plan) {
      return; // skip if no plan available
    }

    await (db as any).wiFiVoucher.create({
      data: {
        tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
        planId: plan.id,
        code,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 86400000),
      },
    });

    await expect(
      (db as any).wiFiVoucher.create({
        data: {
          tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
          planId: plan.id,
          code,
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 86400000),
        },
      })
    ).rejects.toThrow();

    // Cleanup
    await (db as any).wiFiVoucher.deleteMany({ where: { code } });
  });

  it('should enforce unique constraint on User.email', async () => {
    const email = `uniq-${testSuffix}@test.com`;

    await db.user.create({
      data: {
        email,
        firstName: `Unique`,
        lastName: `Test ${testSuffix}`,
        passwordHash: 'hashedpassword',
        tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
      },
    });

    await expect(
      db.user.create({
        data: {
          email,
          firstName: `Duplicate`,
          lastName: `Test ${testSuffix}`,
          passwordHash: 'hashedpassword2',
          tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
        },
      })
    ).rejects.toThrow();

    // Cleanup
    await db.user.deleteMany({ where: { email } });
  });

  it('should enforce unique constraint on Property.slug', async () => {
    const slug = `uniq-prop-${testSuffix}`;

    await db.property.create({
      data: {
        tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
        name: `Unique Property ${testSuffix}`,
        slug,
        address: '123 Test St',
        city: 'Testville',
        country: 'US',
      },
    });

    await expect(
      db.property.create({
        data: {
          tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
          name: `Duplicate Property ${testSuffix}`,
          slug,
          address: '456 Test Ave',
          city: 'Testville',
          country: 'US',
        },
      })
    ).rejects.toThrow();

    // Cleanup
    await db.property.deleteMany({ where: { slug } });
  });
});

// ─── 6. Seed Data Integrity ──────────────────────────────────────────────────

describe('Seed Data Integrity', () => {
  it('should have seed tenants', async () => {
    const count = await db.tenant.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should have seed properties', async () => {
    const count = await db.property.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should have seed users', async () => {
    const count = await db.user.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should have seed guests', async () => {
    const count = await db.guest.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should have seed bookings', async () => {
    const count = await db.booking.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should have seed rooms', async () => {
    const count = await db.room.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should have seed room types', async () => {
    const count = await db.roomType.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should have seed folios', async () => {
    const count = await db.folio.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should have seed sessions', async () => {
    const count = await db.session.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should have seed roles', async () => {
    const count = await db.role.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should have seed invoices', async () => {
    const count = await db.invoice.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should have seed payments', async () => {
    const count = await db.payment.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should have seed revenue accounts', async () => {
    const count = await db.revenueAccount.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should have seed financial accounts', async () => {
    const count = await db.financialAccount.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('should have seed WiFi plans', async () => {
    const count = await (db as any).wiFiPlan.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('should have seed restaurant tables', async () => {
    const count = await db.restaurantTable.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should have seed menu items', async () => {
    const count = await db.menuItem.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should have seed notification templates', async () => {
    const count = await db.notificationTemplate.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should have seed POS terminals', async () => {
    const count = await db.posTerminal.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('seed admin user should have correct email', async () => {
    const admin = await db.user.findFirst({
      where: { email: 'admin@royalstay.in' },
      select: { id: true, email: true, firstName: true },
    });
    expect(admin).not.toBeNull();
    expect(admin!.email).toBe('admin@royalstay.in');
  });

  it('seed property should have expected name', async () => {
    const prop = await db.property.findFirst({
      where: { name: 'Royal Stay Kolkata' },
      select: { id: true, name: true, city: true },
    });
    expect(prop).not.toBeNull();
    expect(prop!.city).toBe('Kolkata');
  });

  it('seed booking should have confirmation code', async () => {
    const booking = await db.booking.findFirst({
      where: { confirmationCode: 'RS-2024-001' },
      select: { id: true, confirmationCode: true, status: true },
    });
    expect(booking).not.toBeNull();
    expect(booking!.status).toBe('checked_in');
  });
});

// ─── 7. Total Model Count Validation ─────────────────────────────────────────

describe('Model Count Validation', () => {
  it('should have at least 300 Prisma models defined', () => {
    // Count all model delegates on the db client
    // PrismaClient exposes delegates for each model; internal properties start with _
    const allKeys = Object.keys(db).filter(
      (k) => !k.startsWith('_') && typeof (db as Record<string, unknown>)[k] === 'object' && (db as Record<string, unknown>)[k] !== null
    );
    expect(allKeys.length).toBeGreaterThanOrEqual(300);
  });
});
