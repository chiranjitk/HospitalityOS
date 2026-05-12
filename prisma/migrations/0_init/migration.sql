-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'search',
    "platform" TEXT NOT NULL DEFAULT 'google',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "budgetType" TEXT NOT NULL DEFAULT 'daily',
    "spentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "startDate" TIMESTAMPTZ,
    "endDate" TIMESTAMPTZ,
    "bidStrategy" TEXT NOT NULL DEFAULT 'auto',
    "bidAmount" DOUBLE PRECISION,
    "targetCpa" DOUBLE PRECISION,
    "targetRoas" DOUBLE PRECISION,
    "targeting" TEXT NOT NULL DEFAULT '{}',
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "negativeKeywords" TEXT NOT NULL DEFAULT '[]',
    "roomTypes" TEXT NOT NULL DEFAULT '[]',
    "ratePlans" TEXT NOT NULL DEFAULT '[]',
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "externalId" UUID,
    "externalData" TEXT NOT NULL DEFAULT '{}',
    "lastSyncAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPerformance" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "date" TIMESTAMPTZ NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgPosition" DOUBLE PRECISION,
    "qualityScore" DOUBLE PRECISION,
    "searchImpShare" DOUBLE PRECISION,
    "deviceBreakdown" TEXT NOT NULL DEFAULT '{}',
    "sourceBreakdown" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AdPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AISuggestion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "impact" TEXT NOT NULL DEFAULT 'medium',
    "potentialRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "data" TEXT NOT NULL DEFAULT '{}',
    "appliedAt" TIMESTAMPTZ,
    "dismissedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AISuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Amenity" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "roomId" UUID,
    "location" TEXT,
    "purchasePrice" DOUBLE PRECISION,
    "purchaseDate" TIMESTAMPTZ,
    "currentValue" DOUBLE PRECISION,
    "warrantyExpiry" TIMESTAMPTZ,
    "warrantyProvider" TEXT,
    "lastMaintenanceAt" TIMESTAMPTZ,
    "nextMaintenanceAt" TIMESTAMPTZ,
    "maintenanceIntervalDays" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "serialNumber" TEXT,
    "modelNumber" TEXT,
    "manufacturer" TEXT,
    "conditionScore" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID,
    "oldValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "correlationId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConversationMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecutionLog" (
    "id" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "triggerData" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "actionsResult" TEXT,
    "executedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerEvent" TEXT NOT NULL,
    "triggerConditions" TEXT,
    "actions" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "lastExecutedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BandwidthPolicy" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "downloadKbps" INTEGER NOT NULL DEFAULT 10240,
    "uploadKbps" INTEGER NOT NULL DEFAULT 10240,
    "burstDownloadKbps" INTEGER,
    "burstUploadKbps" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "planId" UUID,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "BandwidthPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BandwidthPolicyDetail" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "bandwidthPolicyId" UUID NOT NULL,
    "scheduleAccessId" UUID,
    "downloadLimitBps" INTEGER NOT NULL DEFAULT 0,
    "uploadLimitBps" INTEGER NOT NULL DEFAULT 0,
    "guaranteedDownBps" INTEGER NOT NULL DEFAULT 0,
    "guaranteedUpBps" INTEGER NOT NULL DEFAULT 0,
    "burstTimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "burstThresholdBytes" INTEGER NOT NULL DEFAULT 0,
    "burstUpTimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "burstUpThresholdBytes" INTEGER NOT NULL DEFAULT 0,
    "contentionRatio" INTEGER NOT NULL DEFAULT 1,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "BandwidthPolicyDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BandwidthPool" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "name" TEXT NOT NULL,
    "subnet" TEXT,
    "vlanId" INTEGER,
    "totalDownloadKbps" INTEGER NOT NULL DEFAULT 2000000,
    "totalUploadKbps" INTEGER NOT NULL DEFAULT 2000000,
    "perUserDownloadKbps" INTEGER,
    "perUserUploadKbps" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "BandwidthPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BandwidthTopup" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "allottedUploadMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allottedDownloadMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allottedTotalMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "applicableType" TEXT NOT NULL DEFAULT 'total',
    "bandwidthPolicyId" UUID,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "validityMinutes" INTEGER NOT NULL DEFAULT 60,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "BandwidthTopup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BandwidthUsageDaily" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "date" TIMESTAMPTZ NOT NULL,
    "totalDownloadMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalUploadMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
    "peakUsers" INTEGER NOT NULL DEFAULT 0,
    "peakTime" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "BandwidthUsageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BandwidthUsageSession" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "username" TEXT,
    "ipAddress" TEXT NOT NULL,
    "macAddress" TEXT,
    "planId" UUID,
    "policyId" UUID,
    "downloadBytes" INTEGER NOT NULL DEFAULT 0,
    "uploadBytes" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ,

    CONSTRAINT "BandwidthUsageSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankCode" TEXT,
    "accountType" TEXT NOT NULL DEFAULT 'checking',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastReconciledAt" TIMESTAMPTZ,
    "lastStatementDate" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "bankAccountId" UUID NOT NULL,
    "transactionDate" TIMESTAMPTZ NOT NULL,
    "valueDate" TIMESTAMPTZ,
    "transactionType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "balance" DOUBLE PRECISION,
    "description" TEXT,
    "reference" TEXT,
    "chequeNumber" TEXT,
    "payeeName" TEXT,
    "payeeAccount" TEXT,
    "category" TEXT,
    "subCategory" TEXT,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt" TIMESTAMPTZ,
    "importSource" TEXT NOT NULL DEFAULT 'manual',
    "importBatchId" UUID,
    "rawLine" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BondConfig" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'active-backup',
    "miimon" INTEGER NOT NULL DEFAULT 100,
    "lacpRate" TEXT NOT NULL DEFAULT 'slow',
    "primaryMember" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "BondConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BondMember" (
    "id" UUID NOT NULL,
    "bondConfigId" UUID NOT NULL,
    "interfaceId" UUID NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BondMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "confirmationCode" TEXT NOT NULL,
    "externalRef" TEXT,
    "primaryGuestId" UUID NOT NULL,
    "roomId" UUID,
    "roomTypeId" UUID NOT NULL,
    "checkIn" TIMESTAMPTZ NOT NULL,
    "checkOut" TIMESTAMPTZ NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "infants" INTEGER NOT NULL DEFAULT 0,
    "roomRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "ratePlanId" UUID,
    "promoCode" TEXT,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "channelId" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "actualCheckIn" TIMESTAMPTZ,
    "actualCheckOut" TIMESTAMPTZ,
    "checkedInBy" TEXT,
    "checkedOutBy" TEXT,
    "cancelledAt" TIMESTAMPTZ,
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "specialRequests" TEXT,
    "notes" TEXT,
    "internalNotes" TEXT,
    "groupId" UUID,
    "isGroupLeader" BOOLEAN NOT NULL DEFAULT false,
    "preArrivalSent" BOOLEAN NOT NULL DEFAULT false,
    "preArrivalCompleted" BOOLEAN NOT NULL DEFAULT false,
    "preArrivalLink" TEXT,
    "preArrivalExpires" TIMESTAMPTZ,
    "kycRequired" BOOLEAN NOT NULL DEFAULT false,
    "kycCompleted" BOOLEAN NOT NULL DEFAULT false,
    "kycStatus" TEXT NOT NULL DEFAULT 'pending',
    "portalToken" TEXT,
    "portalTokenExpires" TIMESTAMPTZ,
    "eSignature" TEXT,
    "eSignedAt" TIMESTAMPTZ,
    "preferences" TEXT NOT NULL DEFAULT '{}',
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAuditLog" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT,
    "notes" TEXT,
    "performedBy" TEXT,
    "performedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "standards" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BridgeConfig" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "memberInterfaces" TEXT NOT NULL DEFAULT '[]',
    "stpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "forwardDelay" INTEGER NOT NULL DEFAULT 15,
    "helloTime" INTEGER NOT NULL DEFAULT 2,
    "maxAge" INTEGER NOT NULL DEFAULT 20,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "BridgeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Camera" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "groupId" UUID,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "streamUrl" TEXT,
    "streamType" TEXT NOT NULL DEFAULT 'rtsp',
    "isRecording" BOOLEAN NOT NULL DEFAULT false,
    "recordingUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'online',
    "posX" INTEGER,
    "posY" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Camera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CameraEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cameraId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "thumbnailUrl" TEXT,
    "clipUrl" TEXT,
    "description" TEXT,
    "confidence" DOUBLE PRECISION,
    "isAlert" BOOLEAN NOT NULL DEFAULT false,
    "alertType" TEXT,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CameraEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CameraGroup" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CameraGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "templateId" UUID,
    "targetSegments" TEXT NOT NULL DEFAULT '[]',
    "scheduledAt" TIMESTAMPTZ,
    "sentAt" TIMESTAMPTZ,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "openedCount" INTEGER NOT NULL DEFAULT 0,
    "clickedCount" INTEGER NOT NULL DEFAULT 0,
    "bouncedCount" INTEGER NOT NULL DEFAULT 0,
    "unsubscribedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignSegment" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "segmentId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationPolicy" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "ratePlanId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "freeCancelHoursBefore" INTEGER NOT NULL DEFAULT 48,
    "penaltyPercent" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "noShowPenaltyPercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "penaltyType" TEXT NOT NULL DEFAULT 'percentage',
    "penaltyFixedAmount" DOUBLE PRECISION,
    "penaltyNights" INTEGER,
    "exceptions" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CancellationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptivePortal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "listenIp" TEXT NOT NULL DEFAULT '0.0.0.0',
    "listenPort" INTEGER NOT NULL DEFAULT 80,
    "useSsl" BOOLEAN NOT NULL DEFAULT false,
    "sslCertPath" TEXT,
    "sslKeyPath" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "autoAuthEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxConcurrent" INTEGER NOT NULL DEFAULT 1000,
    "sessionTimeout" INTEGER NOT NULL DEFAULT 86400,
    "idleTimeout" INTEGER NOT NULL DEFAULT 3600,
    "redirectUrl" TEXT,
    "successMessage" TEXT,
    "failMessage" TEXT,
    "slug" TEXT NOT NULL DEFAULT 'default-zone',
    "roamingMode" TEXT NOT NULL DEFAULT 'auth_origin',
    "allowsRoamingFrom" TEXT NOT NULL DEFAULT '[]',
    "authMethod" TEXT NOT NULL DEFAULT 'voucher',
    "maxBandwidthDown" INTEGER NOT NULL DEFAULT 5242880,
    "maxBandwidthUp" INTEGER NOT NULL DEFAULT 1048576,
    "bandwidthPolicy" TEXT NOT NULL DEFAULT 'zone',
    "nasIdentifier" TEXT NOT NULL DEFAULT '',
    "ssidList" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CaptivePortal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelConnection" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "displayName" TEXT,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "username" TEXT,
    "password" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMPTZ,
    "hotelId" UUID,
    "propertyId" UUID,
    "listingId" UUID,
    "endpointUrl" TEXT,
    "credentials" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastSyncAt" TIMESTAMPTZ,
    "lastError" TEXT,
    "autoSync" BOOLEAN NOT NULL DEFAULT true,
    "syncInterval" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelDeadLetterQueue" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "syncLogId" UUID,
    "channelCode" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "error" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "originalCreatedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ChannelDeadLetterQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelMapping" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "roomTypeId" UUID NOT NULL,
    "ratePlanId" UUID,
    "externalRoomId" UUID NOT NULL,
    "externalRoomName" TEXT,
    "externalRateId" UUID,
    "externalRateName" TEXT,
    "syncInventory" BOOLEAN NOT NULL DEFAULT true,
    "syncRates" BOOLEAN NOT NULL DEFAULT true,
    "syncRestrictions" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ChannelMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelRestriction" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "roomTypeId" UUID NOT NULL,
    "startDate" TIMESTAMPTZ NOT NULL,
    "endDate" TIMESTAMPTZ NOT NULL,
    "closedToArrival" BOOLEAN NOT NULL DEFAULT false,
    "closedToDeparture" BOOLEAN NOT NULL DEFAULT false,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "minStay" INTEGER,
    "maxStay" INTEGER,
    "minStayArrival" INTEGER,
    "maxStayArrival" INTEGER,
    "rateMin" DOUBLE PRECISION,
    "rateMax" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "lastSyncedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ChannelRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelRetryQueue" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "syncLogId" UUID,
    "channelCode" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMPTZ,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ChannelRetryQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelSyncLog" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "syncType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "requestPayload" TEXT,
    "responsePayload" TEXT,
    "statusCode" INTEGER,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "correlationId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "guestId" UUID,
    "bookingId" UUID,
    "channel" TEXT NOT NULL,
    "externalId" UUID,
    "channelRef" TEXT,
    "subject" TEXT,
    "assignedTo" UUID,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "lastMessageAt" TIMESTAMPTZ,
    "lastMessage" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" UUID,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "senderType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sentAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoaSessionDetail" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "userId" UUID,
    "coaType" TEXT NOT NULL,
    "policyName" TEXT,
    "bandwidthPercent" DOUBLE PRECISION,
    "triggeredBy" TEXT NOT NULL DEFAULT 'system',
    "nasIpAddress" TEXT,
    "actualSessionTime" INTEGER NOT NULL DEFAULT 0,
    "effectiveSessionTime" INTEGER NOT NULL DEFAULT 0,
    "actualDownloadBytes" INTEGER NOT NULL DEFAULT 0,
    "actualUploadBytes" INTEGER NOT NULL DEFAULT 0,
    "effectiveDownloadBytes" INTEGER NOT NULL DEFAULT 0,
    "effectiveUploadBytes" INTEGER NOT NULL DEFAULT 0,
    "result" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoaSessionDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationChannel" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT,
    "config" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "capabilities" TEXT NOT NULL DEFAULT '[]',
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "messagesReceived" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMPTZ,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CommunicationChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorPrice" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomTypeId" UUID,
    "competitorName" TEXT NOT NULL,
    "competitorType" TEXT NOT NULL DEFAULT 'direct',
    "competitorUrl" TEXT,
    "rating" DOUBLE PRECISION,
    "date" TIMESTAMPTZ NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "roomTypeName" TEXT,
    "ratePlanName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CompetitorPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "guestId" UUID,
    "userId" UUID,
    "consentType" TEXT NOT NULL,
    "consentCategory" TEXT NOT NULL DEFAULT 'preferences',
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "grantedAt" TIMESTAMPTZ,
    "grantedVia" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "consentText" TEXT,
    "consentVersion" TEXT,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMPTZ,
    "revokedVia" TEXT,
    "revocationReason" TEXT,
    "expiresAt" TIMESTAMPTZ,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentFilter" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "domains" TEXT NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "scheduleId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ContentFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "guestId" UUID NOT NULL,
    "bookingId" UUID,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "items" TEXT NOT NULL DEFAULT '[]',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'issued',
    "appliedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "issuedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "validUntil" TIMESTAMPTZ,
    "refundedTo" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_usage_by_period" (
    "username" TEXT NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ,
    "acctinputoctets" BIGINT NOT NULL DEFAULT 0,
    "acctoutputoctets" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "data_usage_by_period_pkey" PRIMARY KEY ("username","period_start")
);

-- CreateTable
CREATE TABLE "DemandForecast" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomTypeId" UUID,
    "date" TIMESTAMPTZ NOT NULL,
    "demandScore" INTEGER NOT NULL DEFAULT 0,
    "occupancyForecast" DOUBLE PRECISION,
    "adrForecast" DOUBLE PRECISION,
    "revparForecast" DOUBLE PRECISION,
    "localEvents" TEXT NOT NULL DEFAULT '[]',
    "eventsImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seasonalFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "dayOfWeekFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "generatedBy" TEXT NOT NULL DEFAULT 'algorithm',
    "modelVersion" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DemandForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DhcpBlacklist" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "subnetId" UUID,
    "macAddress" TEXT NOT NULL,
    "reason" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DhcpBlacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DhcpHostnameFilter" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "subnetId" UUID,
    "pattern" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'ignore',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DhcpHostnameFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DhcpLease" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "subnetId" UUID NOT NULL,
    "macAddress" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "hostname" TEXT,
    "clientId" TEXT,
    "leaseStart" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseEnd" TIMESTAMPTZ NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'active',
    "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DhcpLease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DhcpLeaseScript" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "scriptPath" TEXT NOT NULL,
    "events" TEXT NOT NULL DEFAULT '["add","del","old"]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DhcpLeaseScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DhcpOption" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "subnetId" UUID,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DhcpOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DhcpReservation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "subnetId" UUID NOT NULL,
    "macAddress" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "hostname" TEXT,
    "leaseTime" INTEGER,
    "linkedType" TEXT,
    "linkedId" UUID,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DhcpReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DhcpSubnet" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subnet" TEXT NOT NULL,
    "gateway" TEXT,
    "poolStart" TEXT NOT NULL,
    "poolEnd" TEXT NOT NULL,
    "leaseTime" INTEGER NOT NULL DEFAULT 3600,
    "vlanId" INTEGER,
    "vlanConfigId" UUID,
    "domainName" TEXT,
    "dnsServers" TEXT NOT NULL DEFAULT '[]',
    "ntpServers" TEXT NOT NULL DEFAULT '[]',
    "bootFileName" TEXT,
    "nextServer" TEXT,
    "ipv6Enabled" BOOLEAN NOT NULL DEFAULT false,
    "ipv6Prefix" TEXT,
    "ipv6PoolStart" TEXT,
    "ipv6PoolEnd" TEXT,
    "ipv6LeaseTime" INTEGER NOT NULL DEFAULT 3600,
    "ipv6RAType" TEXT NOT NULL DEFAULT 'slaac',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DhcpSubnet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DhcpTagRule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "subnetId" UUID,
    "name" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "matchPattern" TEXT NOT NULL,
    "setTag" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DhcpTagRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalKeyAccessLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "guestId" UUID,
    "accessType" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "deviceId" UUID,
    "deviceType" TEXT,
    "ipAddress" TEXT,
    "accessedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalKeyAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "minAmount" DOUBLE PRECISION DEFAULT 0,
    "maxDiscount" DOUBLE PRECISION,
    "applicableTo" TEXT DEFAULT 'room',
    "validFrom" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMPTZ,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DnsRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'A',
    "value" TEXT NOT NULL,
    "ttl" INTEGER NOT NULL DEFAULT 300,
    "priority" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DnsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DnsRedirectRule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "matchPattern" TEXT NOT NULL,
    "targetIp" TEXT NOT NULL,
    "applyTo" TEXT NOT NULL DEFAULT 'unauthenticated',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DnsRedirectRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DnsZone" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "domain" TEXT NOT NULL,
    "description" TEXT,
    "vlanId" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DnsZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnergyMetric" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "date" TIMESTAMPTZ NOT NULL,
    "electricityKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gasM3" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waterM3" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "electricityCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gasCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waterCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbonFootprint" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnergyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "spaceId" UUID,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "organizerName" TEXT NOT NULL,
    "organizerEmail" TEXT NOT NULL,
    "organizerPhone" TEXT NOT NULL,
    "startDate" TIMESTAMPTZ NOT NULL,
    "endDate" TIMESTAMPTZ NOT NULL,
    "setupStart" TIMESTAMPTZ,
    "teardownEnd" TIMESTAMPTZ,
    "expectedAttendance" INTEGER NOT NULL,
    "actualAttendance" INTEGER,
    "spaceCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cateringCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'inquiry',
    "contractUrl" TEXT,
    "contractSignedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventResource" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vendorId" UUID,
    "vendorName" TEXT,
    "staffId" UUID,
    "staffName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "setupTime" TIMESTAMPTZ,
    "teardownTime" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "EventResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSpace" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minCapacity" INTEGER NOT NULL,
    "maxCapacity" INTEGER NOT NULL,
    "sizeSqMeters" DOUBLE PRECISION,
    "sizeSqFeet" DOUBLE PRECISION,
    "hourlyRate" DOUBLE PRECISION,
    "dailyRate" DOUBLE PRECISION,
    "amenities" TEXT NOT NULL DEFAULT '[]',
    "images" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "EventSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "validFrom" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalReview" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "externalId" UUID,
    "content" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "reviewerName" TEXT,
    "reviewDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentimentScore" DOUBLE PRECISION,
    "sentimentLabel" TEXT,
    "sentimentAspects" TEXT,
    "sentimentKeywords" TEXT,
    "responseText" TEXT,
    "respondedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ExternalReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FairAccessPolicy" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cycleType" TEXT NOT NULL DEFAULT 'daily',
    "limitType" TEXT NOT NULL DEFAULT 'total',
    "dataLimitMb" DOUBLE PRECISION NOT NULL,
    "dataLimitUnit" TEXT NOT NULL DEFAULT 'mb',
    "switchOverBwPolicyId" UUID,
    "cycleResetHour" INTEGER NOT NULL DEFAULT 23,
    "cycleResetMinute" INTEGER NOT NULL DEFAULT 59,
    "applicableOn" TEXT NOT NULL DEFAULT 'total',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "FairAccessPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fup_switch_log" (
    "id" BIGSERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "fup_policy_name" TEXT,
    "usage_mb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "limit_mb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "throttle_down_kbps" INTEGER NOT NULL DEFAULT 0,
    "throttle_up_kbps" INTEGER NOT NULL DEFAULT 0,
    "triggered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "property_id" UUID,
    "plan_name" TEXT,
    "cycle_type" TEXT,
    "action" TEXT NOT NULL DEFAULT 'throttle',
    "original_down_kbps" INTEGER NOT NULL DEFAULT 0,
    "original_up_kbps" INTEGER NOT NULL DEFAULT 0,
    "nas_ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fup_switch_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureAnnouncement" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "targetRoles" TEXT NOT NULL DEFAULT '[]',
    "startsAt" TIMESTAMPTZ,
    "endsAt" TIMESTAMPTZ,
    "dismissible" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "FeatureAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirewallRule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "chain" TEXT DEFAULT 'input',
    "protocol" TEXT,
    "sourceIp" TEXT,
    "sourceMac" TEXT,
    "sourcePort" TEXT,
    "sourcePortType" TEXT,
    "destIp" TEXT,
    "destPort" TEXT,
    "destPortType" TEXT,
    "action" TEXT NOT NULL DEFAULT 'accept',
    "jumpTarget" TEXT,
    "logPrefix" TEXT,
    "proxyTo" TEXT,
    "sourceIpType" TEXT DEFAULT 'ip',
    "destIpType" TEXT DEFAULT 'ip',
    "sourceIpResolved" TEXT,
    "destIpResolved" TEXT,
    "name" VARCHAR(255) NOT NULL DEFAULT 'Unnamed Rule',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "comment" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "scheduleId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "FirewallRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirewallSchedule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "daysOfWeek" TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7',
    "startTime" TEXT NOT NULL DEFAULT '00:00',
    "endTime" TEXT NOT NULL DEFAULT '23:59',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "FirewallSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirewallZone" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "interfaces" TEXT NOT NULL DEFAULT '[]',
    "inputPolicy" TEXT NOT NULL DEFAULT 'accept',
    "forwardPolicy" TEXT NOT NULL DEFAULT 'accept',
    "outputPolicy" TEXT NOT NULL DEFAULT 'accept',
    "masquerade" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "FirewallZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorPlan" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "floor" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "svgData" TEXT,
    "roomPositions" TEXT NOT NULL DEFAULT '[]',
    "width" INTEGER NOT NULL DEFAULT 800,
    "height" INTEGER NOT NULL DEFAULT 600,
    "gridSize" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "FloorPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorPlanRoom" (
    "id" UUID NOT NULL,
    "floorPlanId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 80,
    "height" INTEGER NOT NULL DEFAULT 60,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "FloorPlanRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folio" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "folioNumber" TEXT NOT NULL,
    "guestId" UUID NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'open',
    "openedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMPTZ,
    "invoiceNumber" TEXT,
    "invoiceUrl" TEXT,
    "invoiceIssuedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Folio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioLineItem" (
    "id" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "serviceDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceType" TEXT,
    "referenceId" UUID,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "itemCurrency" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "baseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "postedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "discountId" UUID,

    CONSTRAINT "FolioLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioTransfer" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "fromFolioId" UUID NOT NULL,
    "toFolioId" UUID NOT NULL,
    "folioLineItemId" UUID,
    "bookingId" UUID,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "transferredBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolioTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GDPRRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "guestId" UUID,
    "requestType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestSource" TEXT NOT NULL DEFAULT 'guest',
    "requesterEmail" TEXT,
    "requesterName" TEXT,
    "verificationToken" TEXT,
    "verifiedAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "notes" TEXT,
    "rejectionReason" TEXT,
    "completedAt" TIMESTAMPTZ,
    "completedBy" TEXT,
    "downloadUrl" TEXT,
    "downloadExpiresAt" TIMESTAMPTZ,
    "dataSnapshot" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GDPRRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleHotelAdsConnection" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "accountId" UUID,
    "subAccountId" UUID,
    "hotelId" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "connectionMode" TEXT NOT NULL DEFAULT 'live',
    "partnerId" UUID,
    "hotelCenterId" UUID,
    "priceFeedUrl" TEXT,
    "priceFeedFormat" TEXT NOT NULL DEFAULT 'xml',
    "lastPriceFeedAt" TIMESTAMPTZ,
    "lastBookingFeedAt" TIMESTAMPTZ,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMPTZ,
    "totalBookings" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgRoas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bidStrategy" TEXT NOT NULL DEFAULT 'auto',
    "baseBidModifier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "occupancyBidModifier" TEXT NOT NULL DEFAULT '{}',
    "dayOfWeekBidModifier" TEXT NOT NULL DEFAULT '{}',
    "advanceBookingModifier" TEXT NOT NULL DEFAULT '{}',
    "lengthOfStayModifier" TEXT NOT NULL DEFAULT '{}',
    "autoBidEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoBidRules" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GoogleHotelAdsConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupBooking" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "checkIn" TIMESTAMPTZ NOT NULL,
    "checkOut" TIMESTAMPTZ NOT NULL,
    "totalRooms" INTEGER NOT NULL DEFAULT 1,
    "bookedRooms" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'inquiry',
    "contractUrl" TEXT,
    "contractSignedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GroupBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" CITEXT,
    "phone" TEXT,
    "alternatePhone" TEXT,
    "nationality" TEXT,
    "dateOfBirth" TIMESTAMPTZ,
    "gender" TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    "idExpiry" TIMESTAMPTZ,
    "idCountry" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "preferences" TEXT NOT NULL DEFAULT '{}',
    "dietaryRequirements" TEXT,
    "specialRequests" TEXT,
    "avatar" TEXT,
    "notes" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "loyaltyTier" TEXT NOT NULL DEFAULT 'bronze',
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "totalStays" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "vipLevel" TEXT,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "sourceId" UUID,
    "emailOptIn" BOOLEAN NOT NULL DEFAULT false,
    "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "kycStatus" TEXT NOT NULL DEFAULT 'pending',
    "kycVerifiedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestBehavior" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "firstVisitAt" TIMESTAMPTZ,
    "lastVisitAt" TIMESTAMPTZ,
    "totalBookings" INTEGER NOT NULL DEFAULT 0,
    "cancelledBookings" INTEGER NOT NULL DEFAULT 0,
    "noShowCount" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgBookingValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetimeValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNights" INTEGER NOT NULL DEFAULT 0,
    "avgStayLength" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "preferredRoomTypes" TEXT NOT NULL DEFAULT '[]',
    "bookingSources" TEXT NOT NULL DEFAULT '{}',
    "serviceRequests" INTEGER NOT NULL DEFAULT 0,
    "foodOrders" INTEGER NOT NULL DEFAULT 0,
    "spaBookings" INTEGER NOT NULL DEFAULT 0,
    "learnedPreferences" TEXT NOT NULL DEFAULT '{}',
    "emailOpens" INTEGER NOT NULL DEFAULT 0,
    "emailClicks" INTEGER NOT NULL DEFAULT 0,
    "smsResponses" INTEGER NOT NULL DEFAULT 0,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vipScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vipDetectedAt" TIMESTAMPTZ,
    "isRepeatGuest" BOOLEAN NOT NULL DEFAULT false,
    "repeatGuestSince" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GuestBehavior_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestDocument" (
    "id" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verifiedAt" TIMESTAMPTZ,
    "verifiedBy" TEXT,
    "rejectionReason" TEXT,
    "expiryDate" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GuestDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestFeedback" (
    "id" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMPTZ,
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GuestFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestJourney" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "bookingId" UUID,
    "stage" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'system',
    "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GuestJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestRecommendation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reason" TEXT,
    "estimatedValue" DOUBLE PRECISION,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "shownAt" TIMESTAMPTZ,
    "acceptedAt" TIMESTAMPTZ,
    "rejectedAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ,
    "actionType" TEXT,
    "actionData" TEXT,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GuestRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestReview" (
    "id" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "cleanlinessRating" INTEGER,
    "serviceRating" INTEGER,
    "locationRating" INTEGER,
    "valueRating" INTEGER,
    "title" TEXT,
    "comment" TEXT,
    "source" TEXT NOT NULL DEFAULT 'internal',
    "responseText" TEXT,
    "respondedAt" TIMESTAMPTZ,
    "respondedBy" TEXT,
    "sentimentScore" DOUBLE PRECISION,
    "sentimentLabel" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GuestReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestSegment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GuestSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestStay" (
    "id" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roomNights" INTEGER NOT NULL DEFAULT 1,
    "feedbackGiven" BOOLEAN NOT NULL DEFAULT false,
    "reviewGiven" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestStay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpArticle" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "category" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "featuredImage" TEXT,
    "videoUrl" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "authorId" UUID,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "publishedAt" TIMESTAMPTZ,

    CONSTRAINT "HelpArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "parentId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "HelpCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID,
    "requestHash" TEXT,
    "responseSnapshot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionResult" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "taskId" UUID,
    "templateId" UUID NOT NULL,
    "inspectorId" UUID NOT NULL,
    "score" INTEGER,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "items" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "completedAt" TIMESTAMPTZ,
    "reAssigned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "InspectionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionTemplate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "roomType" TEXT,
    "category" TEXT NOT NULL DEFAULT 'room',
    "items" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "InspectionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT,
    "config" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastSyncAt" TIMESTAMPTZ,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterfaceAlias" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "interfaceId" UUID NOT NULL,
    "interfaceName" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "netmask" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "InterfaceAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterfaceConfig" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "interfaceId" UUID NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'static',
    "ipAddress" TEXT,
    "netmask" TEXT,
    "gateway" TEXT,
    "dnsPrimary" TEXT,
    "dnsSecondary" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "InterfaceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterfaceRole" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "interfaceId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'lan',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "InterfaceRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLock" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID,
    "roomTypeId" UUID,
    "startDate" TIMESTAMPTZ NOT NULL,
    "endDate" TIMESTAMPTZ NOT NULL,
    "reason" TEXT NOT NULL,
    "lockType" TEXT NOT NULL DEFAULT 'maintenance',
    "sessionId" UUID,
    "expiresAt" TIMESTAMPTZ,
    "createdBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "InventoryLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "folioId" UUID,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerAddress" TEXT,
    "customerPhone" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "taxes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "issuedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMPTZ,
    "paidAt" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "pdfUrl" TEXT,
    "notes" TEXT,
    "lineItems" TEXT NOT NULL DEFAULT '[]',
    "templateId" UUID,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringFrequency" TEXT,
    "recurringNextDate" TIMESTAMPTZ,
    "recurringEndDate" TIMESTAMPTZ,
    "parentInvoiceId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceTemplate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#10b981',
    "footerText" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "InvoiceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioLineItemAudit" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "lineItemId" UUID,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "amount" DOUBLE PRECISION,
    "quantity" INTEGER,
    "userId" UUID,
    "userName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'frontdesk',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolioLineItemAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IoTCommand" (
    "id" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "command" TEXT NOT NULL,
    "parameters" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "executedAt" TIMESTAMPTZ,
    "error" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "triggeredBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IoTCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IoTDevice" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "protocol" TEXT NOT NULL DEFAULT 'wifi',
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "lastHeartbeat" TIMESTAMPTZ,
    "firmwareVersion" TEXT,
    "config" TEXT NOT NULL DEFAULT '{}',
    "currentState" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "IoTDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IoTReading" (
    "id" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IoTReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KioskSettings" (
    "id" TEXT NOT NULL,
    "propertyId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "hotelName" TEXT NOT NULL DEFAULT 'StaySuite',
    "welcomeMessage" TEXT NOT NULL DEFAULT 'Welcome! Please select an option below.',
    "primaryColor" TEXT NOT NULL DEFAULT '#10b981',
    "logoUrl" TEXT,
    "backgroundStyle" TEXT NOT NULL DEFAULT 'gradient',
    "idleTimeout" INTEGER NOT NULL DEFAULT 120,
    "showClock" BOOLEAN NOT NULL DEFAULT true,
    "showLanguageSwitch" BOOLEAN NOT NULL DEFAULT true,
    "enableCheckIn" BOOLEAN NOT NULL DEFAULT true,
    "enableCheckOut" BOOLEAN NOT NULL DEFAULT true,
    "enablePayment" BOOLEAN NOT NULL DEFAULT false,
    "termsContent" TEXT NOT NULL DEFAULT 'By using this kiosk, I agree to the hotel''s terms and conditions.',
    "requirePaymentOnCheckout" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "KioskSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "acctSessionId" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "userId" UUID,
    "planId" UUID,
    "nasIpAddress" TEXT NOT NULL,
    "nasIdentifier" TEXT,
    "nasPortType" TEXT,
    "framedIpAddress" TEXT NOT NULL DEFAULT '',
    "macAddress" TEXT NOT NULL DEFAULT '',
    "clientIpAddress" TEXT NOT NULL DEFAULT '',
    "deviceType" TEXT,
    "operatingSystem" TEXT,
    "manufacturer" TEXT,
    "bandwidthPolicyId" UUID,
    "bandwidthDown" INTEGER NOT NULL DEFAULT 0,
    "bandwidthUp" INTEGER NOT NULL DEFAULT 0,
    "maxInputOctets" INTEGER NOT NULL DEFAULT 0,
    "maxOutputOctets" INTEGER NOT NULL DEFAULT 0,
    "maxTotalOctets" INTEGER NOT NULL DEFAULT 0,
    "sessionTimeout" INTEGER NOT NULL DEFAULT 0,
    "idleTimeout" INTEGER NOT NULL DEFAULT 0,
    "lastInterimUpdate" TIMESTAMPTZ,
    "currentInputBytes" INTEGER NOT NULL DEFAULT 0,
    "currentOutputBytes" INTEGER NOT NULL DEFAULT 0,
    "currentSessionTime" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "roomNo" TEXT,
    "hotelId" UUID,
    "urlFilterPolicy" TEXT,
    "authMethod" TEXT,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyPointTransaction" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT,
    "referenceId" UUID,
    "referenceType" TEXT,
    "description" TEXT,
    "expiresAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyPointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyRedemption" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "rewardId" UUID NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "redemptionCode" TEXT,
    "redeemedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "cancelledReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LoyaltyRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyReward" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "pointsCost" INTEGER NOT NULL,
    "monetaryValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "imageUrl" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "availableFrom" TIMESTAMPTZ,
    "availableUntil" TIMESTAMPTZ,
    "maxRedemptions" INTEGER,
    "currentRedemptions" INTEGER NOT NULL DEFAULT 0,
    "minTierRequired" TEXT,
    "termsConditions" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LoyaltyReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTier" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "minPoints" INTEGER NOT NULL DEFAULT 0,
    "maxPoints" INTEGER,
    "pointsMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "benefits" TEXT NOT NULL DEFAULT '[]',
    "color" TEXT NOT NULL DEFAULT '#cd7f32',
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" UUID,
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MacFilter" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "macAddress" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'allow',
    "listType" TEXT NOT NULL DEFAULT 'blacklist',
    "description" TEXT,
    "linkedType" TEXT,
    "linkedId" UUID,
    "expiresAt" TIMESTAMPTZ,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MacFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceBlock" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMPTZ NOT NULL,
    "endDate" TIMESTAMPTZ,
    "blockedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "vendorId" UUID,
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MaintenanceBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualTransaction" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundId" UUID,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ManualTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "options" TEXT NOT NULL DEFAULT '[]',
    "isVegetarian" BOOLEAN NOT NULL DEFAULT false,
    "isVegan" BOOLEAN NOT NULL DEFAULT false,
    "isGlutenFree" BOOLEAN NOT NULL DEFAULT false,
    "allergens" TEXT NOT NULL DEFAULT '[]',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "availableTimes" TEXT,
    "preparationTime" INTEGER,
    "kitchenStation" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" TEXT NOT NULL DEFAULT '[]',
    "isQuickReply" BOOLEAN NOT NULL DEFAULT false,
    "shortcut" TEXT,
    "whatsappTemplateId" UUID,
    "whatsappCategory" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetasearchConnection" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "connectionUrl" TEXT,
    "feedFormat" TEXT NOT NULL DEFAULT 'xml',
    "lastSyncAt" TIMESTAMPTZ,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMPTZ,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "bookings" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "config" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MetasearchConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MultiWanConfig" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'weighted',
    "checkInterval" INTEGER NOT NULL DEFAULT 20,
    "pingCount" INTEGER NOT NULL DEFAULT 3,
    "pingTimeout" INTEGER NOT NULL DEFAULT 2,
    "tcpTimeout" INTEGER NOT NULL DEFAULT 5,
    "autoSwitchback" BOOLEAN NOT NULL DEFAULT true,
    "switchbackDelay" INTEGER NOT NULL DEFAULT 300,
    "flushConntrackOnFailover" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MultiWanConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gateway" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "multiWanConfigId" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'WAN',
    "ipAddress" TEXT NOT NULL,
    "interfaceName" TEXT NOT NULL,
    "interfaceId" UUID,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isBackup" BOOLEAN NOT NULL DEFAULT false,
    "backupGatewayId" UUID,
    "routingTableId" INTEGER NOT NULL DEFAULT 0,
    "healthStatus" TEXT NOT NULL DEFAULT 'unknown',
    "lastHealthCheck" TIMESTAMPTZ,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Gateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayHealthRule" (
    "id" UUID NOT NULL,
    "gatewayId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'PING',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 0,
    "operator" TEXT NOT NULL DEFAULT '&',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GatewayHealthRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayExplicitRoute" (
    "id" UUID NOT NULL,
    "gatewayId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "network" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GatewayExplicitRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayFwmark" (
    "id" UUID NOT NULL,
    "gatewayId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "fwmarkValue" TEXT NOT NULL DEFAULT '0x1',
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GatewayFwmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NasHealthLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "nasIpAddress" TEXT NOT NULL,
    "nasName" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "liveUsers" INTEGER NOT NULL DEFAULT 0,
    "totalAuths" INTEGER NOT NULL DEFAULT 0,
    "totalAccts" INTEGER NOT NULL DEFAULT 0,
    "avgLatencyMs" DOUBLE PRECISION,
    "lastSeenAt" TIMESTAMPTZ,
    "checkIntervalSec" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "NasHealthLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasreload" (
    "nasipaddress" TEXT NOT NULL,
    "reloadtime" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "nasreload_pkey" PRIMARY KEY ("nasipaddress")
);

-- CreateTable
CREATE TABLE "NatLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceIp" TEXT NOT NULL,
    "sourcePort" INTEGER NOT NULL,
    "destIp" TEXT NOT NULL,
    "destPort" INTEGER NOT NULL,
    "protocol" TEXT NOT NULL,
    "destDomain" TEXT,
    "action" TEXT NOT NULL DEFAULT 'allow',
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "sessionId" UUID,

    CONSTRAINT "NatLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkConfigBackup" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "configData" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "autoBackup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkConfigBackup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkInterface" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ethernet',
    "hwAddress" TEXT,
    "mtu" INTEGER NOT NULL DEFAULT 1500,
    "speed" TEXT,
    "status" TEXT NOT NULL DEFAULT 'down',
    "carrier" BOOLEAN NOT NULL DEFAULT false,
    "isManagement" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "NetworkInterface_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "link" TEXT,
    "icon" TEXT,
    "image" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "readAt" TIMESTAMPTZ,
    "dismissedAt" TIMESTAMPTZ,
    "actionType" TEXT,
    "actionData" TEXT,
    "expiresAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "templateId" UUID,
    "recipientType" TEXT NOT NULL,
    "recipientId" UUID NOT NULL,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "externalId" UUID,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMPTZ,
    "deliveredAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" TEXT DEFAULT '22:00',
    "quietHoursEnd" TEXT DEFAULT '08:00',
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "tableId" UUID,
    "orderNumber" TEXT NOT NULL,
    "guestId" UUID,
    "bookingId" UUID,
    "guestName" TEXT,
    "orderType" TEXT NOT NULL DEFAULT 'dine_in',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "kitchenStatus" TEXT NOT NULL DEFAULT 'pending',
    "kitchenStartedAt" TIMESTAMPTZ,
    "kitchenCompletedAt" TIMESTAMPTZ,
    "folioId" UUID,
    "addToFolio" BOOLEAN NOT NULL DEFAULT false,
    "roomNumber" TEXT,
    "orderCategory" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "estimatedDelivery" INTEGER,
    "notes" TEXT,
    "specialInstructions" TEXT,
    "confirmedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderCategory" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "OrderCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "options" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingSlot" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "number" TEXT NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "type" TEXT NOT NULL DEFAULT 'standard',
    "vehicleType" TEXT NOT NULL DEFAULT 'car',
    "width" DOUBLE PRECISION,
    "length" DOUBLE PRECISION,
    "hasCharging" BOOLEAN NOT NULL DEFAULT false,
    "chargerType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "posX" INTEGER,
    "posY" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ParkingSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" TEXT NOT NULL,
    "gateway" TEXT,
    "gatewayRef" TEXT,
    "gatewayFee" DOUBLE PRECISION,
    "gatewayStatus" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "failoverTo" TEXT,
    "routingDecision" TEXT,
    "cardType" TEXT,
    "cardLast4" TEXT,
    "cardExpiry" TEXT,
    "transactionId" UUID,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundedAt" TIMESTAMPTZ,
    "refundReason" TEXT,
    "guestId" UUID,
    "idempotencyKey" TEXT,
    "processedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentGateway" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "mode" TEXT NOT NULL DEFAULT 'test',
    "apiKey" TEXT,
    "secretKey" TEXT,
    "merchantId" UUID,
    "webhookSecret" TEXT,
    "feePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feeFixed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supportedCurrencies" TEXT NOT NULL DEFAULT 'USD',
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "totalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PaymentGateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSchedule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "scheduleName" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositDueDate" TIMESTAMPTZ,
    "installments" TEXT NOT NULL DEFAULT '[]',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'active',
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PaymentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalAuthentication" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "portalId" UUID NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'voucher',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "config" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PortalAuthentication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalMapping" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "portalId" UUID NOT NULL,
    "vlanId" INTEGER,
    "vlanConfigId" UUID,
    "ssid" TEXT,
    "subnet" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "fallbackPortalId" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PortalMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalPage" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "portalId" UUID NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "title" TEXT,
    "subtitle" TEXT,
    "logoUrl" TEXT,
    "backgroundImage" TEXT,
    "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
    "textColor" TEXT NOT NULL DEFAULT '#1f2937',
    "accentColor" TEXT NOT NULL DEFAULT '#0d9488',
    "termsText" TEXT,
    "termsUrl" TEXT,
    "customCss" TEXT NOT NULL DEFAULT '',
    "customHtml" TEXT NOT NULL DEFAULT '',
    "showSocial" BOOLEAN NOT NULL DEFAULT false,
    "showBranding" BOOLEAN NOT NULL DEFAULT true,
    "formFields" TEXT NOT NULL DEFAULT '{"username":true,"password":true,"roomNumber":false,"phone":false,"voucherCode":false,"terms":true}',
    "authFlow" TEXT NOT NULL DEFAULT 'pms_credentials',
    "socialProviders" TEXT NOT NULL DEFAULT '{"google":false,"facebook":false,"apple":false}',
    "voucherTemplate" TEXT NOT NULL DEFAULT 'default',
    "designSettings" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PortalPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalTemplate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'hotel',
    "thumbnail" TEXT,
    "htmlContent" TEXT NOT NULL,
    "cssContent" TEXT NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PortalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalWhitelist" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "domain" TEXT NOT NULL,
    "path" TEXT,
    "description" TEXT,
    "protocol" TEXT NOT NULL DEFAULT 'https',
    "bypassAuth" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PortalWhitelist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortForwardRule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'tcp',
    "externalPort" INTEGER NOT NULL,
    "internalIp" TEXT NOT NULL,
    "internalPort" INTEGER NOT NULL,
    "sourceIp" TEXT,
    "interfaceId" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PortForwardRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickBlock" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "QuickBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitRule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT,
    "targetIp" TEXT,
    "targetSet" TEXT,
    "downloadRate" TEXT NOT NULL DEFAULT '10mbit',
    "uploadRate" TEXT NOT NULL DEFAULT '5mbit',
    "protocol" TEXT NOT NULL DEFAULT 'all',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "RateLimitRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreventiveMaintenance" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assetId" UUID,
    "frequency" TEXT NOT NULL,
    "frequencyValue" INTEGER,
    "assignedRoleId" UUID,
    "checklist" TEXT NOT NULL DEFAULT '[]',
    "lastCompletedAt" TIMESTAMPTZ,
    "nextDueAt" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'active',
    "estimatedDuration" INTEGER,
    "estimatedCost" DOUBLE PRECISION,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "PreventiveMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceOverride" (
    "id" UUID NOT NULL,
    "ratePlanId" UUID NOT NULL,
    "date" TIMESTAMPTZ NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "minStay" INTEGER,
    "closedToArrival" BOOLEAN NOT NULL DEFAULT false,
    "closedToDeparture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PriceOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "valueType" TEXT NOT NULL DEFAULT 'percentage',
    "conditions" TEXT NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMPTZ NOT NULL,
    "effectiveTo" TIMESTAMPTZ,
    "roomTypes" TEXT NOT NULL DEFAULT '[]',
    "appliedCount" INTEGER NOT NULL DEFAULT 0,
    "lastAppliedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "maxDiscount" DOUBLE PRECISION,
    "minBookingValue" DOUBLE PRECISION,
    "minNights" INTEGER,
    "applicableRoomTypes" TEXT NOT NULL DEFAULT '[]',
    "startsAt" TIMESTAMPTZ NOT NULL,
    "endsAt" TIMESTAMPTZ NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "maxUsesPerUser" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'hotel',
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "country" TEXT NOT NULL,
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "logo" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "checkInTime" TEXT NOT NULL DEFAULT '14:00',
    "checkOutTime" TEXT NOT NULL DEFAULT '11:00',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "taxId" UUID,
    "taxType" TEXT NOT NULL DEFAULT 'gst',
    "defaultTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxComponents" TEXT NOT NULL DEFAULT '[]',
    "serviceChargePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "includeTaxInPrice" BOOLEAN NOT NULL DEFAULT false,
    "totalRooms" INTEGER NOT NULL DEFAULT 0,
    "totalFloors" INTEGER NOT NULL DEFAULT 0,
    "noShowSettings" TEXT NOT NULL DEFAULT '{"noShowBufferHours":1,"autoProcessNoShows":false,"noShowNotificationEnabled":true}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,
    "brandId" UUID,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomVlan" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "vlanId" INTEGER NOT NULL,
    "subnet" TEXT NOT NULL DEFAULT '10.1.0.0/28',
    "gateway" TEXT NOT NULL DEFAULT '10.1.0.1',
    "parentInterfaceId" UUID,
    "role" TEXT NOT NULL DEFAULT 'guest',
    "mtu" INTEGER NOT NULL DEFAULT 1500,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "roomType" TEXT NOT NULL DEFAULT 'standard',
    "bandwidthPlanId" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "description" TEXT,
    "firewallRulesGenerated" BOOLEAN NOT NULL DEFAULT false,
    "lastProvisionedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "RoomVlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "orderDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMPTZ,
    "receivedDate" TIMESTAMPTZ,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "stockItemId" UUID NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "receivedQuantity" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radacct" (
    "radacctid" BIGSERIAL NOT NULL,
    "acctsessionid" TEXT NOT NULL DEFAULT '',
    "acctuniqueid" TEXT NOT NULL,
    "username" TEXT,
    "realm" TEXT,
    "nasipaddress" TEXT NOT NULL,
    "nasportid" TEXT,
    "nasporttype" TEXT,
    "acctstarttime" TIMESTAMPTZ,
    "acctupdatetime" TIMESTAMPTZ,
    "acctstoptime" TIMESTAMPTZ,
    "acctinterval" BIGINT,
    "acctsessiontime" BIGINT,
    "acctauthentic" TEXT,
    "connectinfo_start" TEXT,
    "connectinfo_stop" TEXT,
    "acctinputoctets" BIGINT DEFAULT 0,
    "acctoutputoctets" BIGINT DEFAULT 0,
    "acctinputgigawords" BIGINT DEFAULT 0,
    "acctoutputgigawords" BIGINT DEFAULT 0,
    "calledstationid" TEXT,
    "callingstationid" TEXT,
    "acctterminatecause" TEXT,
    "servicetype" TEXT,
    "framedprotocol" TEXT,
    "framedipaddress" TEXT,
    "framedipv6address" TEXT,
    "framedipv6prefix" TEXT,
    "framedinterfaceid" TEXT,
    "delegatedipv6prefix" TEXT,
    "acctinputpackets" INTEGER DEFAULT 0,
    "acctoutputpackets" INTEGER DEFAULT 0,
    "acctstatus" TEXT DEFAULT 'start',
    "loginType" TEXT DEFAULT 'portal',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "class" TEXT,

    CONSTRAINT "radacct_pkey" PRIMARY KEY ("radacctid")
);

-- CreateTable
CREATE TABLE "radcheck" (
    "id" UUID NOT NULL,
    "wifiUserId" UUID,
    "username" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "op" TEXT NOT NULL DEFAULT ':=',
    "value" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "radcheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radgroupcheck" (
    "id" UUID NOT NULL,
    "groupname" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "op" TEXT NOT NULL DEFAULT ':=',
    "value" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radgroupcheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radgroupreply" (
    "id" UUID NOT NULL,
    "groupname" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "op" TEXT NOT NULL DEFAULT ':=',
    "value" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radgroupreply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiusAuthLog" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "authResult" TEXT NOT NULL,
    "authType" TEXT,
    "nasIpAddress" TEXT,
    "nasIdentifier" TEXT,
    "callingStationId" UUID,
    "calledStationId" UUID,
    "clientIpAddress" TEXT,
    "replyMessage" TEXT,
    "terminateReason" TEXT,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadiusAuthLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiusCoaLog" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "sessionId" UUID,
    "nasIpAddress" TEXT,
    "sharedSecret" TEXT,
    "attributes" TEXT,
    "result" TEXT NOT NULL,
    "responseCode" TEXT,
    "errorMessage" TEXT,
    "triggeredBy" TEXT NOT NULL,
    "triggeredById" UUID,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadiusCoaLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiusEventUser" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "eventName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "planId" UUID,
    "bandwidthDown" INTEGER NOT NULL DEFAULT 5,
    "bandwidthUp" INTEGER NOT NULL DEFAULT 2,
    "dataLimitMb" INTEGER,
    "validFrom" TIMESTAMPTZ NOT NULL,
    "validUntil" TIMESTAMPTZ NOT NULL,
    "maxSessions" INTEGER NOT NULL DEFAULT 1,
    "guestName" TEXT,
    "guestEmail" TEXT,
    "guestCompany" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "usedAt" TIMESTAMPTZ,
    "firstUsedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "RadiusEventUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiusMacAuth" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "macAddress" TEXT NOT NULL,
    "username" TEXT,
    "guestId" UUID,
    "guestName" TEXT,
    "description" TEXT,
    "autoLogin" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMPTZ,
    "lastSeenAt" TIMESTAMPTZ,
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "bandwidthDown" INTEGER,
    "bandwidthUp" INTEGER,
    "sessionTimeout" INTEGER,
    "dataLimitMB" INTEGER,
    "groupName" TEXT,
    "planId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "RadiusMacAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiusNAS" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "shortname" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "ports" TEXT,
    "secret" TEXT NOT NULL,
    "server" TEXT,
    "community" TEXT,
    "description" TEXT,
    "coaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "coaPort" INTEGER NOT NULL DEFAULT 3799,
    "authPort" INTEGER NOT NULL DEFAULT 1812,
    "acctPort" INTEGER NOT NULL DEFAULT 1813,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSeenAt" TIMESTAMPTZ,
    "lastWentOnlineAt" TIMESTAMPTZ,
    "lastWentOfflineAt" TIMESTAMPTZ,
    "totalAuths" INTEGER NOT NULL DEFAULT 0,
    "totalAccts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "RadiusNAS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiusProvisioningLog" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "guestId" UUID,
    "bookingId" UUID,
    "userId" UUID,
    "result" TEXT NOT NULL,
    "details" TEXT,
    "error" TEXT,
    "durationMs" INTEGER,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadiusProvisioningLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiusServerConfig" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "serverIp" TEXT NOT NULL DEFAULT '127.0.0.1',
    "serverHostname" TEXT,
    "authPort" INTEGER NOT NULL DEFAULT 1812,
    "acctPort" INTEGER NOT NULL DEFAULT 1813,
    "coaPort" INTEGER NOT NULL DEFAULT 3799,
    "listenAllInterfaces" BOOLEAN NOT NULL DEFAULT true,
    "bindAddress" TEXT NOT NULL DEFAULT '0.0.0.0',
    "maxAuthWait" INTEGER NOT NULL DEFAULT 30,
    "maxAcctWait" INTEGER NOT NULL DEFAULT 30,
    "cleanupSessions" BOOLEAN NOT NULL DEFAULT true,
    "sessionCleanupInterval" INTEGER NOT NULL DEFAULT 3600,
    "logAuth" BOOLEAN NOT NULL DEFAULT true,
    "logAuthBadpass" BOOLEAN NOT NULL DEFAULT false,
    "logAuthGoodpass" BOOLEAN NOT NULL DEFAULT false,
    "logDestination" TEXT NOT NULL DEFAULT 'files',
    "logLevel" TEXT NOT NULL DEFAULT 'info',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "interimUpdateInterval" INTEGER NOT NULL DEFAULT 60,
    "dataCapAction" TEXT NOT NULL DEFAULT 'disconnect',
    "dataCapThrottleRate" TEXT NOT NULL DEFAULT '1M/1M',
    "macAuthEnabled" BOOLEAN NOT NULL DEFAULT false,
    "macAuthBypassPortal" BOOLEAN NOT NULL DEFAULT true,
    "portalWhitelistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "concurrentSessionAction" TEXT NOT NULL DEFAULT 'reject',

    CONSTRAINT "RadiusServerConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radpostauth" (
    "id" BIGSERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "pass" TEXT,
    "reply" TEXT,
    "calledstationid" TEXT,
    "callingstationid" TEXT,
    "authdate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "propertyId" UUID,
    "nasIpAddress" TEXT,
    "clientipaddress" TEXT,
    "class" TEXT,

    CONSTRAINT "radpostauth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radreply" (
    "id" UUID NOT NULL,
    "wifiUserId" UUID,
    "username" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "op" TEXT NOT NULL DEFAULT ':=',
    "value" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "radreply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radusergroup" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "groupname" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radusergroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nas" (
    "id" SERIAL NOT NULL,
    "nasname" TEXT NOT NULL,
    "shortname" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "ports" INTEGER,
    "secret" TEXT NOT NULL,
    "server" TEXT,
    "community" TEXT,
    "description" TEXT,

    CONSTRAINT "nas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatePlan" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "roomTypeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "mealPlan" TEXT NOT NULL DEFAULT 'room_only',
    "minStay" INTEGER NOT NULL DEFAULT 1,
    "maxStay" INTEGER,
    "advanceBookingDays" INTEGER,
    "cancellationPolicy" TEXT,
    "cancellationHours" INTEGER,
    "bookingStartDays" INTEGER,
    "bookingEndDays" INTEGER,
    "promoCode" TEXT,
    "discountPercent" DOUBLE PRECISION,
    "discountAmount" DOUBLE PRECISION,
    "promoStart" TIMESTAMPTZ,
    "promoEnd" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'active',
    "derivedFromId" UUID,
    "derivationType" TEXT,
    "derivationValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "RatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reconciliation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "bankAccountId" UUID NOT NULL,
    "bankTransactionId" UUID NOT NULL,
    "paymentId" UUID,
    "folioId" UUID,
    "matchType" TEXT NOT NULL DEFAULT 'manual',
    "matchConfidence" DOUBLE PRECISION,
    "matchCriteria" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'matched',
    "reconciledAmount" DOUBLE PRECISION NOT NULL,
    "adjustmentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustmentReason" TEXT,
    "reconciledBy" TEXT,
    "reconciledAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationCard" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "checkInDate" TIMESTAMPTZ NOT NULL,
    "checkOutDate" TIMESTAMPTZ NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "roomType" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestNationality" TEXT,
    "guestIdType" TEXT,
    "guestIdNumber" TEXT,
    "guestAddress" TEXT,
    "guestPhone" TEXT,
    "guestEmail" TEXT,
    "purpose" TEXT,
    "vehiclePlate" TEXT,
    "companions" TEXT NOT NULL DEFAULT '[]',
    "specialRequests" TEXT,
    "termsAccepted" BOOLEAN NOT NULL DEFAULT true,
    "acceptedAt" TIMESTAMPTZ,
    "printedAt" TIMESTAMPTZ,
    "printedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "RegistrationCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCache" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "reportType" TEXT NOT NULL,
    "periodStart" TIMESTAMPTZ NOT NULL,
    "periodEnd" TIMESTAMPTZ NOT NULL,
    "data" TEXT NOT NULL,
    "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ReportCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportHistory" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "scheduledReportId" UUID,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT,
    "periodStart" TIMESTAMPTZ,
    "periodEnd" TIMESTAMPTZ,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "errorMessage" TEXT,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMPTZ,
    "metadata" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "ReportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "tableId" UUID,
    "guestId" UUID,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "guestEmail" TEXT,
    "partySize" INTEGER NOT NULL,
    "date" TIMESTAMPTZ NOT NULL,
    "time" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 90,
    "specialRequests" TEXT,
    "occasion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "source" TEXT NOT NULL DEFAULT 'phone',
    "notes" TEXT,
    "seatedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantTable" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "area" TEXT,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "posX" INTEGER,
    "posY" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "shape" TEXT NOT NULL DEFAULT 'round',

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomTypeId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "isAccessible" BOOLEAN NOT NULL DEFAULT false,
    "isSmoking" BOOLEAN NOT NULL DEFAULT false,
    "hasBalcony" BOOLEAN NOT NULL DEFAULT false,
    "hasSeaView" BOOLEAN NOT NULL DEFAULT false,
    "hasMountainView" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'available',
    "smartRoomConfig" TEXT,
    "digitalKeyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "digitalKeySecret" TEXT,
    "housekeepingStatus" TEXT NOT NULL DEFAULT 'clean',
    "lastCleanedAt" TIMESTAMPTZ,
    "lastInspectedAt" TIMESTAMPTZ,
    "inspectedBy" TEXT,
    "hkPriority" TEXT NOT NULL DEFAULT 'normal',
    "hkNotes" TEXT,
    "dnd" BOOLEAN NOT NULL DEFAULT false,
    "currentTaskId" UUID,
    "images" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMoveLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "fromRoomId" UUID NOT NULL,
    "fromRoomNumber" TEXT NOT NULL,
    "toRoomId" UUID NOT NULL,
    "toRoomNumber" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "movedBy" TEXT,
    "previousRate" DOUBLE PRECISION NOT NULL,
    "newRate" DOUBLE PRECISION NOT NULL,
    "rateDifference" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomMoveLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomType" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "maxAdults" INTEGER NOT NULL DEFAULT 2,
    "maxChildren" INTEGER NOT NULL DEFAULT 0,
    "maxOccupancy" INTEGER NOT NULL DEFAULT 2,
    "sizeSqMeters" DOUBLE PRECISION,
    "sizeSqFeet" DOUBLE PRECISION,
    "amenities" TEXT NOT NULL DEFAULT '[]',
    "basePrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "images" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "totalRooms" INTEGER NOT NULL DEFAULT 0,
    "overbookingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "overbookingPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overbookingLimit" INTEGER NOT NULL DEFAULT 0,
    "wifiPlanId" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleAccess" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "daysOfWeek" TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7',
    "startTime" TEXT NOT NULL DEFAULT '00:00',
    "endTime" TEXT NOT NULL DEFAULT '23:59',
    "downloadMbps" INTEGER NOT NULL DEFAULT 0,
    "uploadMbps" INTEGER NOT NULL DEFAULT 0,
    "applyTo" TEXT NOT NULL DEFAULT 'all',
    "applyToPlanId" UUID,
    "bandwidthPolicyId" UUID,
    "action" TEXT NOT NULL DEFAULT 'limit',
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ScheduleAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledNotification" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "templateId" UUID,
    "recipientType" TEXT NOT NULL,
    "recipientId" UUID NOT NULL,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "channels" TEXT NOT NULL DEFAULT '[]',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "scheduledFor" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedAt" TIMESTAMPTZ,
    "sentAt" TIMESTAMPTZ,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ScheduledNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledReport" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "time" TEXT NOT NULL,
    "recipients" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "deliveryMethod" TEXT NOT NULL DEFAULT 'email',
    "filters" TEXT NOT NULL DEFAULT '{}',
    "lastRunAt" TIMESTAMPTZ,
    "nextRunAt" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ScheduledReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cameraId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "description" TEXT,
    "thumbnail" TEXT,
    "recordingId" UUID,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMPTZ,
    "acknowledgedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityIncident" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT NOT NULL,
    "reportedBy" TEXT,
    "assignedTo" UUID,
    "cameraId" UUID,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMPTZ,
    "resolvedBy" TEXT,
    "incidentDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecuritySettings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "maxConcurrentSessions" INTEGER NOT NULL DEFAULT 3,
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 30,
    "passwordExpiryDays" INTEGER NOT NULL DEFAULT 90,
    "minPasswordLength" INTEGER NOT NULL DEFAULT 8,
    "requireUppercase" BOOLEAN NOT NULL DEFAULT false,
    "requireLowercase" BOOLEAN NOT NULL DEFAULT false,
    "requireNumbers" BOOLEAN NOT NULL DEFAULT false,
    "requireSpecialChars" BOOLEAN NOT NULL DEFAULT false,
    "enable2FA" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SecuritySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SegmentMembership" (
    "id" UUID NOT NULL,
    "segmentId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "addedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "guestId" UUID,
    "bookingId" UUID,
    "roomId" UUID,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assignedTo" UUID,
    "assignedAt" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "rating" INTEGER,
    "feedback" TEXT,
    "source" TEXT NOT NULL DEFAULT 'app',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "lastActive" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftTemplate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "shiftType" TEXT NOT NULL DEFAULT 'regular',
    "activeDays" TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    "department" TEXT,
    "minStaff" INTEGER NOT NULL DEFAULT 1,
    "maxStaff" INTEGER,
    "color" TEXT NOT NULL DEFAULT '#0d9488',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ShiftTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SSOConnection" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "samlEntityId" UUID,
    "samlSsoUrl" TEXT,
    "samlSloUrl" TEXT,
    "samlCertificate" TEXT,
    "samlPrivateKey" TEXT,
    "samlNameIdFormat" TEXT DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    "samlSignRequest" BOOLEAN NOT NULL DEFAULT true,
    "samlWantAssertionSigned" BOOLEAN NOT NULL DEFAULT true,
    "ldapUrl" TEXT,
    "ldapBaseDn" TEXT,
    "ldapBindDn" TEXT,
    "ldapBindPassword" TEXT,
    "ldapSearchFilter" TEXT DEFAULT '(mail={email})',
    "ldapUseStartTls" BOOLEAN NOT NULL DEFAULT false,
    "ldapUseSsl" BOOLEAN NOT NULL DEFAULT true,
    "ldapTimeout" INTEGER NOT NULL DEFAULT 30,
    "oidcClientId" UUID,
    "oidcClientSecret" TEXT,
    "oidcDiscoveryUrl" TEXT,
    "oidcAuthorizationUrl" TEXT,
    "oidcTokenUrl" TEXT,
    "oidcUserInfoUrl" TEXT,
    "oidcJwksUrl" TEXT,
    "oidcScopes" TEXT NOT NULL DEFAULT 'openid profile email',
    "oidcUsePkce" BOOLEAN NOT NULL DEFAULT true,
    "emailAttribute" TEXT NOT NULL DEFAULT 'email',
    "firstNameAttribute" TEXT NOT NULL DEFAULT 'givenName',
    "lastNameAttribute" TEXT NOT NULL DEFAULT 'sn',
    "nameAttribute" TEXT NOT NULL DEFAULT 'name',
    "roleAttribute" TEXT,
    "departmentAttribute" TEXT,
    "phoneAttribute" TEXT DEFAULT 'telephoneNumber',
    "autoProvision" BOOLEAN NOT NULL DEFAULT true,
    "autoProvisionRole" TEXT,
    "syncRoles" BOOLEAN NOT NULL DEFAULT false,
    "syncOnLogin" BOOLEAN NOT NULL DEFAULT true,
    "allowedDomains" TEXT,
    "lastSyncAt" TIMESTAMPTZ,
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "testConnectionAt" TIMESTAMPTZ,
    "testConnectionStatus" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SSOConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SSOSession" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "userId" UUID,
    "ssoProviderId" UUID,
    "attributes" TEXT NOT NULL DEFAULT '{}',
    "sessionId" UUID,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "initiatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authenticatedAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "terminatedAt" TIMESTAMPTZ,
    "terminatedReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SSOSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'present',
    "checkIn" TIMESTAMPTZ,
    "checkOut" TIMESTAMPTZ,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyLeaveMinutes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffChannel" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'team',
    "department" TEXT,
    "createdBy" UUID,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMPTZ,
    "lastMessage" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "StaffChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffChannelMember" (
    "id" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "lastReadAt" TIMESTAMPTZ,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffChannelMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffChatMessage" (
    "id" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "replyToId" UUID,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMPTZ,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "sentAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readBy" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "StaffChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffLeave" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "leaveType" TEXT NOT NULL,
    "startDate" TIMESTAMPTZ NOT NULL,
    "endDate" TIMESTAMPTZ NOT NULL,
    "totalDays" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "rejectionReason" TEXT,
    "attachmentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "StaffLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPerformance" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "reviewPeriod" TEXT NOT NULL,
    "reviewYear" INTEGER NOT NULL,
    "reviewDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallRating" DOUBLE PRECISION,
    "punctualityRating" DOUBLE PRECISION,
    "qualityRating" DOUBLE PRECISION,
    "teamworkRating" DOUBLE PRECISION,
    "communicationRating" DOUBLE PRECISION,
    "initiativeRating" DOUBLE PRECISION,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" DOUBLE PRECISION,
    "attendanceRate" DOUBLE PRECISION,
    "customerRating" DOUBLE PRECISION,
    "goalsSet" INTEGER NOT NULL DEFAULT 0,
    "goalsAchieved" INTEGER NOT NULL DEFAULT 0,
    "goalsComments" TEXT,
    "strengths" TEXT,
    "areasOfImprovement" TEXT,
    "achievements" TEXT,
    "reviewedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "acknowledgedAt" TIMESTAMPTZ,
    "employeeComments" TEXT,
    "nextReviewDate" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "StaffPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSchedule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "userId" UUID NOT NULL,
    "shiftTemplateId" UUID,
    "date" TIMESTAMPTZ NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "department" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "assignedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "StaffSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffShift" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" TIMESTAMPTZ NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "shiftType" TEXT NOT NULL DEFAULT 'regular',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "clockIn" TIMESTAMPTZ,
    "clockOut" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "StaffShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSkill" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "skillName" TEXT NOT NULL,
    "skillLevel" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL DEFAULT 'general',
    "certified" BOOLEAN NOT NULL DEFAULT false,
    "certifiedAt" TIMESTAMPTZ,
    "certifiedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "StaffSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffWorkload" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "propertyId" UUID,
    "date" TIMESTAMPTZ NOT NULL,
    "totalTasks" INTEGER NOT NULL DEFAULT 0,
    "completedTasks" INTEGER NOT NULL DEFAULT 0,
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "capacityMinutes" INTEGER NOT NULL DEFAULT 480,
    "efficiency" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "StaffWorkload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaticRoute" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "metric" INTEGER NOT NULL DEFAULT 100,
    "interfaceName" TEXT,
    "protocol" TEXT NOT NULL DEFAULT 'static',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "StaticRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockConsumption" (
    "id" UUID NOT NULL,
    "stockItemId" UUID NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "reference" TEXT,
    "cost" DOUBLE PRECISION,
    "notes" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxQuantity" DOUBLE PRECISION,
    "reorderPoint" DOUBLE PRECISION,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lowStockAlert" BOOLEAN NOT NULL DEFAULT true,
    "expiryDate" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "planName" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentPeriodStart" TIMESTAMPTZ NOT NULL,
    "currentPeriodEnd" TIMESTAMPTZ NOT NULL,
    "cancelledAt" TIMESTAMPTZ,
    "paymentMethodId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionInvoice" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issuedAt" TIMESTAMPTZ,
    "dueAt" TIMESTAMPTZ,
    "paidAt" TIMESTAMPTZ,
    "pdfUrl" TEXT,
    "paymentId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" DOUBLE PRECISION NOT NULL,
    "yearlyPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "maxProperties" INTEGER,
    "maxUsers" INTEGER,
    "maxRooms" INTEGER,
    "storageLimitMb" INTEGER,
    "features" TEXT NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyslogServer" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'udp',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 514,
    "format" TEXT NOT NULL DEFAULT 'ietf',
    "facility" TEXT NOT NULL DEFAULT 'local1',
    "severity" TEXT NOT NULL DEFAULT 'info',
    "categories" TEXT NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "tlsCertPath" TEXT,
    "tlsVerify" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SyslogServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemNetworkHealth" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "hostname" TEXT,
    "kernelVersion" TEXT,
    "uptime" INTEGER NOT NULL DEFAULT 0,
    "cpuUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ramTotal" INTEGER NOT NULL DEFAULT 0,
    "ramUsed" INTEGER NOT NULL DEFAULT 0,
    "diskTotal" INTEGER NOT NULL DEFAULT 0,
    "diskUsed" INTEGER NOT NULL DEFAULT 0,
    "cpuTemperature" DOUBLE PRECISION,
    "services" TEXT NOT NULL DEFAULT '{}',
    "lastUpdated" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SystemNetworkHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID,
    "assignedTo" UUID,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledAt" TIMESTAMPTZ,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "estimatedDuration" INTEGER,
    "actualDuration" INTEGER,
    "roomStatusBefore" TEXT,
    "roomStatusAfter" TEXT,
    "notes" TEXT,
    "completionNotes" TEXT,
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "deadline" TIMESTAMPTZ,
    "createdBy" UUID,
    "qualityScore" INTEGER,
    "subtasks" TEXT NOT NULL DEFAULT '[]',
    "serviceRequestId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignmentSuggestion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "suggestedUserId" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "factors" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ,
    "acceptedAt" TIMESTAMPTZ,
    "rejectedAt" TIMESTAMPTZ,

    CONSTRAINT "TaskAssignmentSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxReport" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "reportNumber" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'india',
    "periodStart" TIMESTAMPTZ NOT NULL,
    "periodEnd" TIMESTAMPTZ NOT NULL,
    "filingDueDate" TIMESTAMPTZ,
    "grossRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxableRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxCollected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRefundable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustmentReason" TEXT,
    "cgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "igstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cessAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stateTaxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "localTaxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatOutput" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatInput" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "exemptTransactions" INTEGER NOT NULL DEFAULT 0,
    "exportTransactions" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "filedAt" TIMESTAMPTZ,
    "filedBy" TEXT,
    "filingReference" TEXT,
    "paymentReference" TEXT,
    "paidAt" TIMESTAMPTZ,
    "attachmentUrl" TEXT,
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TaxReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "email" CITEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "language" TEXT NOT NULL DEFAULT 'en',
    "plan" TEXT NOT NULL DEFAULT 'trial',
    "status" TEXT NOT NULL DEFAULT 'trial',
    "trialEndsAt" TIMESTAMPTZ,
    "subscriptionStartsAt" TIMESTAMPTZ,
    "subscriptionEndsAt" TIMESTAMPTZ,
    "maxProperties" INTEGER NOT NULL DEFAULT 1,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "maxRooms" INTEGER NOT NULL DEFAULT 50,
    "storageLimitMb" INTEGER NOT NULL DEFAULT 500,
    "features" TEXT NOT NULL DEFAULT '{}',
    "settings" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "category" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "maxParticipants" INTEGER NOT NULL DEFAULT 10,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "tags" TEXT,
    "highlights" TEXT,
    "whatToBring" TEXT,
    "cancellationPolicy" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "totalBookings" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceBooking" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "experienceId" UUID NOT NULL,
    "guestId" UUID,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "bookingDate" TIMESTAMPTZ NOT NULL,
    "bookingTime" TEXT NOT NULL,
    "numberOfGuests" INTEGER NOT NULL DEFAULT 1,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "specialRequests" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirmedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "ExperienceBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperiencePricing" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "experienceId" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'rule',
    "seasonName" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "capacity" INTEGER,
    "startDate" TIMESTAMPTZ,
    "endDate" TIMESTAMPTZ,
    "priceMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "minGuests" INTEGER NOT NULL DEFAULT 1,
    "maxGuests" INTEGER,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ExperiencePricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceVendor" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "category" TEXT,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfsc" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "ExperienceVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceFeedback" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "experienceBookingId" UUID,
    "experienceId" UUID NOT NULL,
    "guestId" UUID,
    "guestName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "reviewText" TEXT,
    "category" TEXT,
    "staffResponse" TEXT,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ExperienceFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatAttachment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatTransfer" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "fromUserId" UUID NOT NULL,
    "toUserId" UUID NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "endpoint" TEXT,
    "method" TEXT,
    "statusCode" INTEGER,
    "dataSize" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" UUID,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageSummary" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "apiCalls" INTEGER NOT NULL DEFAULT 0,
    "apiCallsMonth" INTEGER NOT NULL DEFAULT 0,
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "messagesMonth" INTEGER NOT NULL DEFAULT 0,
    "emailsSent" INTEGER NOT NULL DEFAULT 0,
    "emailsMonth" INTEGER NOT NULL DEFAULT 0,
    "smsSent" INTEGER NOT NULL DEFAULT 0,
    "smsMonth" INTEGER NOT NULL DEFAULT 0,
    "storageUsedMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "storageFiles" INTEGER NOT NULL DEFAULT 0,
    "webhooksSent" INTEGER NOT NULL DEFAULT 0,
    "webhooksMonth" INTEGER NOT NULL DEFAULT 0,
    "lastApiCallAt" TIMESTAMPTZ,
    "lastMessageAt" TIMESTAMPTZ,
    "lastStorageUploadAt" TIMESTAMPTZ,
    "lastResetAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "UsageSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMPTZ,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "avatar" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "roleId" UUID,
    "lastLoginAt" TIMESTAMPTZ,
    "lastLoginIp" TEXT,
    "passwordChangedAt" TIMESTAMPTZ,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "backupCodes" TEXT,
    "preferences" TEXT NOT NULL DEFAULT '{}',
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "invitedAt" TIMESTAMPTZ,
    "invitedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFcmToken" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "deviceId" UUID,
    "deviceType" TEXT NOT NULL DEFAULT 'web',
    "deviceName" TEXT,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "UserFcmToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTutorial" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tutorialKey" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMPTZ,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "UserTutorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "guestId" UUID,
    "bookingId" UUID,
    "licensePlate" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "color" TEXT,
    "year" INTEGER,
    "slotId" UUID,
    "entryTime" TIMESTAMPTZ,
    "exitTime" TIMESTAMPTZ,
    "parkingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'parked',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "type" TEXT NOT NULL,
    "paymentTerms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "portalEmail" TEXT,
    "portalPassword" TEXT,
    "portalToken" TEXT,
    "portalTokenExpires" TIMESTAMPTZ,
    "lastPortalLogin" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPayment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "workOrderId" UUID,
    "paymentNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT NOT NULL DEFAULT 'bank_transfer',
    "paymentDate" TIMESTAMPTZ,
    "dueDate" TIMESTAMPTZ,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "checkNumber" TEXT,
    "transactionRef" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "VendorPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VlanConfig" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "parentInterfaceId" UUID NOT NULL,
    "vlanId" INTEGER NOT NULL,
    "subInterface" TEXT NOT NULL,
    "description" TEXT,
    "mtu" INTEGER NOT NULL DEFAULT 1500,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "VlanConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "roomTypeId" UUID NOT NULL,
    "checkIn" TIMESTAMPTZ NOT NULL,
    "checkOut" TIMESTAMPTZ NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "notes" TEXT,
    "bookingId" UUID,
    "convertedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WanFailover" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "primaryWanId" UUID NOT NULL,
    "backupWanId" UUID NOT NULL,
    "healthCheckUrl" TEXT NOT NULL DEFAULT 'https://1.1.1.1',
    "healthCheckInterval" INTEGER NOT NULL DEFAULT 30,
    "failoverThreshold" INTEGER NOT NULL DEFAULT 3,
    "autoSwitchback" BOOLEAN NOT NULL DEFAULT true,
    "switchbackDelay" INTEGER NOT NULL DEFAULT 300,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WanFailover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebCategory" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryType" TEXT NOT NULL DEFAULT 'custom',
    "isUploadRestricted" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "implementationOn" TEXT NOT NULL DEFAULT 'block',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WebCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebCategorySchedule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "webCategoryId" UUID NOT NULL,
    "scheduleAccessId" UUID,
    "isAllow" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "startTime" TEXT NOT NULL DEFAULT '00:00',
    "endTime" TEXT NOT NULL DEFAULT '23:59',
    "daysOfWeek" TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WebCategorySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDeliveryLog" (
    "id" UUID NOT NULL,
    "endpointId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "statusCode" INTEGER,
    "response" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "nextRetryAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT NOT NULL DEFAULT '[]',
    "secret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "failedCalls" INTEGER NOT NULL DEFAULT 0,
    "lastCalledAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WiFiAAAConfig" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "defaultPlanId" UUID,
    "defaultDownloadSpeed" INTEGER NOT NULL DEFAULT 10,
    "defaultUploadSpeed" INTEGER NOT NULL DEFAULT 10,
    "defaultSessionLimit" INTEGER,
    "defaultDataLimit" INTEGER,
    "autoProvisionOnCheckin" BOOLEAN NOT NULL DEFAULT true,
    "autoDeprovisionOnCheckout" BOOLEAN NOT NULL DEFAULT true,
    "autoDeprovisionDelay" INTEGER NOT NULL DEFAULT 0,
    "authMethod" TEXT NOT NULL DEFAULT 'pap',
    "allowMacAuth" BOOLEAN NOT NULL DEFAULT false,
    "accountingSyncInterval" INTEGER NOT NULL DEFAULT 5,
    "lastSyncAt" TIMESTAMPTZ,
    "lastSyncId" UUID,
    "maxConcurrentSessions" INTEGER NOT NULL DEFAULT 3,
    "sessionTimeoutPolicy" TEXT NOT NULL DEFAULT 'hard',
    "portalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "portalTitle" TEXT,
    "portalLogo" TEXT,
    "portalTerms" TEXT,
    "portalRedirectUrl" TEXT,
    "portalBrandColor" TEXT NOT NULL DEFAULT '#0d9488',
    "voucherPortalUrl" TEXT,
    "usernameFormat" TEXT NOT NULL DEFAULT 'room_random',
    "usernamePrefix" TEXT,
    "usernameCase" TEXT NOT NULL DEFAULT 'lowercase',
    "usernameMinLength" INTEGER NOT NULL DEFAULT 4,
    "usernameMaxLength" INTEGER NOT NULL DEFAULT 32,
    "passwordFormat" TEXT NOT NULL DEFAULT 'random_alphanumeric',
    "passwordFixedValue" TEXT,
    "passwordLength" INTEGER NOT NULL DEFAULT 8,
    "passwordIncludeUppercase" BOOLEAN NOT NULL DEFAULT true,
    "passwordIncludeNumbers" BOOLEAN NOT NULL DEFAULT true,
    "passwordIncludeSymbols" BOOLEAN NOT NULL DEFAULT false,
    "credentialSeparator" TEXT NOT NULL DEFAULT '_',
    "credentialPrintOnVoucher" BOOLEAN NOT NULL DEFAULT true,
    "credentialShowInPortal" BOOLEAN NOT NULL DEFAULT true,
    "duplicateUsernameAction" TEXT NOT NULL DEFAULT 'append_random',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WiFiAAAConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WiFiAccountingSync" (
    "id" UUID NOT NULL,
    "lastRadAcctId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WiFiAccountingSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WiFiGateway" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ipAddress" TEXT NOT NULL,
    "macAddress" TEXT,
    "vendor" TEXT NOT NULL,
    "model" TEXT,
    "version" TEXT,
    "radiusSecret" TEXT NOT NULL,
    "radiusAuthPort" INTEGER NOT NULL DEFAULT 1812,
    "radiusAcctPort" INTEGER NOT NULL DEFAULT 1813,
    "coaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "coaPort" INTEGER NOT NULL DEFAULT 3799,
    "coaSecret" TEXT,
    "captivePortalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "captivePortalUrl" TEXT,
    "splashPageId" UUID,
    "defaultVlan" INTEGER,
    "guestVlan" INTEGER,
    "staffVlan" INTEGER,
    "managementUrl" TEXT,
    "apiUsername" TEXT,
    "apiPassword" TEXT,
    "apiPort" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSeenAt" TIMESTAMPTZ,
    "firmwareVersion" TEXT,
    "totalClients" INTEGER NOT NULL DEFAULT 0,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WiFiGateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpPool" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "gateway" INET,
    "subnet" INET,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "captivePortal" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "IpPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpPoolRange" (
    "id" UUID NOT NULL,
    "poolId" UUID NOT NULL,
    "startIp" INET NOT NULL,
    "endIp" INET NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IpPoolRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WiFiPlan" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "downloadSpeed" INTEGER NOT NULL,
    "uploadSpeed" INTEGER NOT NULL,
    "dataLimit" INTEGER,
    "sessionLimit" INTEGER,
    "sessionTimeoutSec" INTEGER,
    "idleTimeoutSec" INTEGER,
    "maxDevices" INTEGER NOT NULL DEFAULT 1,
    "fupPolicyId" UUID,
    "ipPoolId" UUID,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "validityDays" INTEGER NOT NULL DEFAULT 1,
    "validityMinutes" INTEGER NOT NULL DEFAULT 1440,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WiFiPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WiFiSession" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID,
    "guestId" UUID,
    "bookingId" UUID,
    "username" TEXT,
    "acctUniqueId" TEXT,
    "macAddress" TEXT NOT NULL,
    "ipAddress" TEXT,
    "deviceName" TEXT,
    "deviceType" TEXT,
    "startTime" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMPTZ,
    "dataUsed" BIGINT NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "authMethod" TEXT NOT NULL DEFAULT 'voucher',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WiFiSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WiFiUser" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "guestId" UUID,
    "bookingId" UUID,
    "userType" TEXT NOT NULL DEFAULT 'guest',
    "planId" UUID,
    "ipPoolId" UUID,
    "validFrom" TIMESTAMPTZ NOT NULL,
    "validUntil" TIMESTAMPTZ NOT NULL,
    "maxSessions" INTEGER NOT NULL DEFAULT 1,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "totalBytesIn" BIGINT NOT NULL DEFAULT 0,
    "totalBytesOut" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "radiusSynced" BOOLEAN NOT NULL DEFAULT false,
    "radiusSyncedAt" TIMESTAMPTZ,
    "lastAccountingAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WiFiUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WiFiUserStatusHistory" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "userId" UUID,
    "oldStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "changedBy" TEXT,
    "changeReason" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WiFiUserStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WiFiVoucher" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "guestId" UUID,
    "bookingId" UUID,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMPTZ,
    "validFrom" TIMESTAMPTZ NOT NULL,
    "validUntil" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "issuedTo" TEXT,
    "issuedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WiFiVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "vendorId" UUID,
    "roomId" UUID,
    "assetId" UUID,
    "workOrderNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'general',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT,
    "assignedAt" TIMESTAMPTZ,
    "scheduledDate" TIMESTAMPTZ,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "estimatedHours" DOUBLE PRECISION,
    "actualHours" DOUBLE PRECISION,
    "notes" TEXT,
    "completionNotes" TEXT,
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "vendorNotes" TEXT,
    "rating" INTEGER,
    "feedback" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuModifier" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "selectionType" TEXT NOT NULL DEFAULT 'optional',
    "minSelections" INTEGER NOT NULL DEFAULT 0,
    "maxSelections" INTEGER NOT NULL DEFAULT 1,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "MenuModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuModifierOption" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "modifierGroupId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "priceAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MenuModifierOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuVariant" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "sku" TEXT,
    "calories" INTEGER,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MenuVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lowStockThreshold" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "reorderLevel" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "supplierName" TEXT,
    "supplierContact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'in_stock',
    "lastRestocked" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "previousStock" DOUBLE PRECISION NOT NULL,
    "newStock" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "performedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "instructions" TEXT,
    "prepTime" INTEGER NOT NULL DEFAULT 0,
    "cookTime" INTEGER NOT NULL DEFAULT 0,
    "yield" INTEGER NOT NULL DEFAULT 1,
    "costPerServing" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "costPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableMerge" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "tableIds" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL,
    "mergedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "splitAt" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'merged',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TableMerge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDiscount" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "couponCode" TEXT,
    "authorizedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentToken" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "guestId" UUID NOT NULL,
    "folioId" UUID,
    "tokenType" TEXT NOT NULL,
    "gatewayTokenId" TEXT NOT NULL,
    "cardType" TEXT,
    "cardLast4" TEXT,
    "cardExpiryMonth" INTEGER,
    "cardExpiryYear" INTEGER,
    "cardBrand" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PaymentToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledCharge" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "chargeType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "frequency" TEXT NOT NULL,
    "startDate" TIMESTAMPTZ NOT NULL,
    "endDate" TIMESTAMPTZ,
    "nextExecutionAt" TIMESTAMPTZ NOT NULL,
    "lastExecutedAt" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxAmount" DOUBLE PRECISION,
    "executedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ScheduledCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationPenalty" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "folioId" UUID,
    "policyId" UUID NOT NULL,
    "policyName" TEXT NOT NULL,
    "penaltyType" TEXT NOT NULL,
    "penaltyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "originalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "penaltyPercent" DOUBLE PRECISION,
    "penaltyNights" INTEGER,
    "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT,
    "exemptionType" TEXT,
    "exemptionDetails" TEXT,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CancellationPenalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyCard" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "guestId" UUID,
    "bookingId" UUID,
    "cardNumber" TEXT NOT NULL,
    "cardType" TEXT NOT NULL DEFAULT 'physical',
    "issuerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "issuedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMPTZ,
    "deactivatedAt" TIMESTAMPTZ,
    "returnedAt" TIMESTAMPTZ,
    "returnReason" TEXT,
    "accessLevel" TEXT NOT NULL DEFAULT 'standard',
    "validFrom" TIMESTAMPTZ NOT NULL,
    "validTo" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "KeyCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveillanceConfig" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "configType" TEXT NOT NULL,
    "settings" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SurveillanceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingPass" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "vehicleId" UUID,
    "slotId" UUID,
    "holderName" TEXT NOT NULL,
    "holderEmail" TEXT,
    "holderPhone" TEXT,
    "licensePlate" TEXT NOT NULL,
    "startDate" TIMESTAMPTZ NOT NULL,
    "endDate" TIMESTAMPTZ NOT NULL,
    "duration" TEXT NOT NULL DEFAULT 'monthly',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'active',
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "paymentStatus" TEXT NOT NULL DEFAULT 'paid',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ParkingPass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransfer" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "fromPropertyId" UUID NOT NULL,
    "toPropertyId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "requestedBy" UUID,
    "approvedBy" UUID,
    "completedBy" UUID,
    "reason" TEXT,
    "notes" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "rejectedAt" TIMESTAMPTZ,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "InventoryTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransferItem" (
    "id" UUID NOT NULL,
    "transferId" UUID NOT NULL,
    "stockItemId" UUID NOT NULL,
    "stockItemName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "InventoryTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignAbTest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "splitPercentage" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "openedCount" INTEGER NOT NULL DEFAULT 0,
    "clickedCount" INTEGER NOT NULL DEFAULT 0,
    "conversionCount" INTEGER NOT NULL DEFAULT 0,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "declaredAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CampaignAbTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorSyncLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "competitorName" TEXT NOT NULL,
    "syncType" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'success',
    "pricesCollected" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMPTZ NOT NULL,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationPlan" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "maxProperties" INTEGER NOT NULL DEFAULT 1,
    "maxRoomsPerProperty" INTEGER NOT NULL DEFAULT 50,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "maxStaff" INTEGER NOT NULL DEFAULT 10,
    "features" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "trialDays" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "RegistrationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseKey" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "planId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "generatedBy" UUID,
    "generatedFor" TEXT,
    "activatedBy" UUID,
    "activatedAt" TIMESTAMPTZ,
    "tenantId" UUID,
    "expiresAt" TIMESTAMPTZ,
    "note" TEXT,
    "batchId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LicenseKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceProfile" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "wifiUserId" UUID NOT NULL,
    "guestId" UUID,
    "fingerprintHash" TEXT NOT NULL,
    "storageToken" TEXT,
    "macAddress" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceName" TEXT,
    "deviceType" TEXT,
    "fingerprintData" TEXT,
    "authCount" INTEGER NOT NULL DEFAULT 0,
    "lastAuthAt" TIMESTAMPTZ,
    "firstSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DeviceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NightAudit" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "auditDate" TIMESTAMPTZ NOT NULL,
    "businessDayDate" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedBy" UUID NOT NULL,
    "completedBy" UUID,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,
    "roomRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fbRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roomChargesPosted" INTEGER NOT NULL DEFAULT 0,
    "noShowsProcessed" INTEGER NOT NULL DEFAULT 0,
    "roomsReconciled" INTEGER NOT NULL DEFAULT 0,
    "discrepancies" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "autoPostedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "NightAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NightAuditStep" (
    "id" UUID NOT NULL,
    "nightAuditId" UUID NOT NULL,
    "stepName" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "performedBy" UUID,
    "result" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NightAuditStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NightAuditLog" (
    "id" UUID NOT NULL,
    "nightAuditId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" UUID,
    "oldValue" TEXT,
    "newValue" TEXT,
    "performedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NightAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelAgent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "agencyName" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "taxId" TEXT,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionType" TEXT NOT NULL DEFAULT 'percentage',
    "creditLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentTerms" TEXT NOT NULL DEFAULT 'net_30',
    "status" TEXT NOT NULL DEFAULT 'active',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TravelAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityLedgerInvoice" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "travelAgentId" UUID,
    "accountName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMPTZ NOT NULL,
    "dueDate" TIMESTAMPTZ NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CityLedgerInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityLedgerPayment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT,
    "reference" TEXT,
    "paidAt" TIMESTAMPTZ NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityLedgerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityLedgerItem" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "folioId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityLedgerItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" UUID,
    "commissionType" TEXT NOT NULL DEFAULT 'percentage',
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxAmount" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMPTZ NOT NULL,
    "validUntil" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceName" TEXT,
    "bookingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'accrued',
    "invoicedAt" TIMESTAMPTZ,
    "paidAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CommissionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPayment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "commissionRecordIds" TEXT NOT NULL DEFAULT '[]',
    "payeeName" TEXT NOT NULL,
    "payeeType" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT,
    "reference" TEXT,
    "paidAt" TIMESTAMPTZ NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinibarItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'beverage',
    "sku" TEXT,
    "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MinibarItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinibarSetup" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "itemJson" TEXT NOT NULL DEFAULT '[]',
    "lastRestockedAt" TIMESTAMPTZ,
    "restockedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MinibarSetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinibarConsumption" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMPTZ NOT NULL,
    "postedToFolio" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMPTZ,
    "consumedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinibarConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostFoundItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "itemType" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "description" TEXT NOT NULL,
    "locationFound" TEXT,
    "roomId" UUID,
    "foundBy" TEXT,
    "finderContact" TEXT,
    "foundAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photos" TEXT NOT NULL DEFAULT '[]',
    "guestId" UUID,
    "bookingId" UUID,
    "storageLocation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'reported',
    "matchedAt" TIMESTAMPTZ,
    "returnedTo" TEXT,
    "returnedAt" TIMESTAMPTZ,
    "disposalReason" TEXT,
    "disposedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LostFoundItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaundryItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'guest',
    "serviceType" TEXT NOT NULL DEFAULT 'wash',
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "turnaroundHours" INTEGER NOT NULL DEFAULT 24,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LaundryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaundryOrder" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "bookingId" UUID,
    "guestId" UUID,
    "roomId" UUID NOT NULL,
    "orderType" TEXT NOT NULL DEFAULT 'guest',
    "status" TEXT NOT NULL DEFAULT 'received',
    "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMPTZ,
    "deliveredAt" TIMESTAMPTZ,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentMethod" TEXT NOT NULL DEFAULT 'room_charge',
    "folioId" UUID,
    "postedToFolio" BOOLEAN NOT NULL DEFAULT false,
    "specialInstructions" TEXT,
    "collectedBy" UUID,
    "deliveredBy" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LaundryOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaundryOrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "itemName" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL DEFAULT 'wash',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'received',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaundryOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagePlan" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseRoomTypeId" UUID NOT NULL,
    "roomRateInclusive" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMPTZ NOT NULL,
    "endDate" TIMESTAMPTZ NOT NULL,
    "minNights" INTEGER NOT NULL DEFAULT 1,
    "maxNights" INTEGER,
    "totalBasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PackagePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageComponent" (
    "id" UUID NOT NULL,
    "packagePlanId" UUID NOT NULL,
    "componentType" TEXT NOT NULL,
    "referenceId" UUID,
    "referenceName" TEXT,
    "includedQty" INTEGER NOT NULL DEFAULT 1,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isIncluded" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageRate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "packagePlanId" UUID NOT NULL,
    "roomTypeId" UUID NOT NULL,
    "startDate" TIMESTAMPTZ NOT NULL,
    "endDate" TIMESTAMPTZ NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "minStay" INTEGER NOT NULL DEFAULT 1,
    "maxStay" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledChargeExecution" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "scheduledChargeId" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "executedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executionDate" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "error" TEXT,
    "postedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledChargeExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueAccount" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'revenue',
    "category" TEXT NOT NULL DEFAULT 'miscellaneous',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "RevenueAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostingRule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "chargeCategory" TEXT,
    "chargeType" TEXT,
    "revenueAccountId" UUID NOT NULL,
    "taxTreatment" TEXT NOT NULL DEFAULT 'taxable',
    "autoPost" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditions" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PostingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostingLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "folioLineItemId" UUID,
    "chargeAmount" DOUBLE PRECISION NOT NULL,
    "revenueAccountCode" TEXT NOT NULL,
    "postedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedBy" TEXT,
    "autoPosted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GstSettings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "gstin" TEXT,
    "legalName" TEXT,
    "tradeName" TEXT,
    "stateCode" TEXT DEFAULT '',
    "stateName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "pincode" TEXT,
    "registrationType" TEXT DEFAULT 'regular',
    "scheme" TEXT DEFAULT 'regular',
    "gstEntityType" TEXT DEFAULT 'proprietary',
    "fssaiLicenseNo" TEXT,
    "tcsRate" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "tcsThreshold" DOUBLE PRECISION NOT NULL DEFAULT 100000,
    "tds194cRate" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "tds194hRate" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "tds194jRate" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "panNumber" TEXT,
    "aadhaarNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GstSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GstSacCode" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "serviceType" TEXT NOT NULL,
    "sacCode" TEXT NOT NULL,
    "description" TEXT,
    "cgstRate" DOUBLE PRECISION NOT NULL DEFAULT 0.09,
    "sgstRate" DOUBLE PRECISION NOT NULL DEFAULT 0.09,
    "igstRate" DOUBLE PRECISION NOT NULL DEFAULT 0.18,
    "cessRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GstSacCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GstEInvoice" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "invoiceId" UUID,
    "folioId" UUID,
    "bookingId" UUID,
    "guestId" UUID,
    "irn" TEXT,
    "signedInvoice" TEXT,
    "ackNo" TEXT,
    "ackDate" TIMESTAMPTZ,
    "signedQrCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "supplyType" TEXT NOT NULL DEFAULT 'b2b',
    "placeOfSupply" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMPTZ,
    "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCgst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSgst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalIgst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCess" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "ecomGstin" TEXT,
    "errorDetails" TEXT,
    "generatedBy" UUID,
    "cancelledAt" TIMESTAMPTZ,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "gstSettingsId" UUID,

    CONSTRAINT "GstEInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GstReturn" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "returnType" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "fromMonth" INTEGER NOT NULL,
    "fromYear" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalOutwardSupply" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTaxableValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCgst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSgst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalIgst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCess" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTaxLiability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalItcClaimed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netTaxPayable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "filedDate" TIMESTAMPTZ,
    "arn" TEXT,
    "jsonData" TEXT,
    "notes" TEXT,
    "filedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GstReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TcsRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "bookingId" UUID,
    "guestId" UUID,
    "folioId" UUID,
    "collectionDate" TIMESTAMPTZ NOT NULL,
    "panNumber" TEXT,
    "guestName" TEXT,
    "guestAddress" TEXT,
    "bookingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tcsRate" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "tcsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thresholdExceeded" BOOLEAN NOT NULL DEFAULT false,
    "challanNo" TEXT,
    "challanDate" TIMESTAMPTZ,
    "depositedAmount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'collected',
    "period" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TcsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TdsRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID,
    "vendorId" UUID,
    "vendorName" TEXT,
    "panNumber" TEXT,
    "section" TEXT NOT NULL,
    "paymentDate" TIMESTAMPTZ NOT NULL,
    "paymentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tdsRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tdsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "challanNo" TEXT,
    "challanDate" TIMESTAMPTZ,
    "depositedAmount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'deducted',
    "period" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TdsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CaptivePortalToVlanConfig" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_CaptivePortalToVlanConfig_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ModifierItems" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ModifierItems_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_GstSacCodeToGstSettings" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_GstSacCodeToGstSettings_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "AdCampaign_tenantId_idx" ON "AdCampaign"("tenantId");

-- CreateIndex
CREATE INDEX "AdCampaign_status_idx" ON "AdCampaign"("status");

-- CreateIndex
CREATE INDEX "AdCampaign_platform_idx" ON "AdCampaign"("platform");

-- CreateIndex
CREATE INDEX "AdCampaign_type_idx" ON "AdCampaign"("type");

-- CreateIndex
CREATE INDEX "AdPerformance_campaignId_idx" ON "AdPerformance"("campaignId");

-- CreateIndex
CREATE INDEX "AdPerformance_date_idx" ON "AdPerformance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AdPerformance_campaignId_date_key" ON "AdPerformance"("campaignId", "date");

-- CreateIndex
CREATE INDEX "AISuggestion_tenantId_idx" ON "AISuggestion"("tenantId");

-- CreateIndex
CREATE INDEX "AISuggestion_type_idx" ON "AISuggestion"("type");

-- CreateIndex
CREATE INDEX "AISuggestion_status_idx" ON "AISuggestion"("status");

-- CreateIndex
CREATE INDEX "Amenity_tenantId_idx" ON "Amenity"("tenantId");

-- CreateIndex
CREATE INDEX "Amenity_category_idx" ON "Amenity"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Amenity_tenantId_name_key" ON "Amenity"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Asset_tenantId_idx" ON "Asset"("tenantId");

-- CreateIndex
CREATE INDEX "Asset_propertyId_idx" ON "Asset"("propertyId");

-- CreateIndex
CREATE INDEX "Asset_roomId_idx" ON "Asset"("roomId");

-- CreateIndex
CREATE INDEX "Asset_category_idx" ON "Asset"("category");

-- CreateIndex
CREATE INDEX "Asset_status_idx" ON "Asset"("status");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AiConversation_tenantId_idx" ON "AiConversation"("tenantId");

-- CreateIndex
CREATE INDEX "AiConversation_userId_idx" ON "AiConversation"("userId");

-- CreateIndex
CREATE INDEX "AiConversation_createdAt_idx" ON "AiConversation"("createdAt");

-- CreateIndex
CREATE INDEX "AiConversationMessage_conversationId_idx" ON "AiConversationMessage"("conversationId");

-- CreateIndex
CREATE INDEX "AiConversationMessage_createdAt_idx" ON "AiConversationMessage"("createdAt");

-- CreateIndex
CREATE INDEX "AutomationExecutionLog_ruleId_idx" ON "AutomationExecutionLog"("ruleId");

-- CreateIndex
CREATE INDEX "AutomationExecutionLog_executedAt_idx" ON "AutomationExecutionLog"("executedAt");

-- CreateIndex
CREATE INDEX "AutomationRule_tenantId_idx" ON "AutomationRule"("tenantId");

-- CreateIndex
CREATE INDEX "AutomationRule_triggerEvent_idx" ON "AutomationRule"("triggerEvent");

-- CreateIndex
CREATE INDEX "BandwidthPolicy_tenantId_idx" ON "BandwidthPolicy"("tenantId");

-- CreateIndex
CREATE INDEX "BandwidthPolicy_propertyId_idx" ON "BandwidthPolicy"("propertyId");

-- CreateIndex
CREATE INDEX "BandwidthPolicy_planId_idx" ON "BandwidthPolicy"("planId");

-- CreateIndex
CREATE INDEX "BandwidthPolicy_enabled_idx" ON "BandwidthPolicy"("enabled");

-- CreateIndex
CREATE INDEX "BandwidthPolicyDetail_tenantId_idx" ON "BandwidthPolicyDetail"("tenantId");

-- CreateIndex
CREATE INDEX "BandwidthPolicyDetail_bandwidthPolicyId_idx" ON "BandwidthPolicyDetail"("bandwidthPolicyId");

-- CreateIndex
CREATE INDEX "BandwidthPolicyDetail_scheduleAccessId_idx" ON "BandwidthPolicyDetail"("scheduleAccessId");

-- CreateIndex
CREATE INDEX "BandwidthPolicyDetail_isEnabled_idx" ON "BandwidthPolicyDetail"("isEnabled");

-- CreateIndex
CREATE INDEX "BandwidthPool_tenantId_idx" ON "BandwidthPool"("tenantId");

-- CreateIndex
CREATE INDEX "BandwidthPool_propertyId_idx" ON "BandwidthPool"("propertyId");

-- CreateIndex
CREATE INDEX "BandwidthPool_vlanId_idx" ON "BandwidthPool"("vlanId");

-- CreateIndex
CREATE INDEX "BandwidthPool_enabled_idx" ON "BandwidthPool"("enabled");

-- CreateIndex
CREATE INDEX "BandwidthTopup_propertyId_idx" ON "BandwidthTopup"("propertyId");

-- CreateIndex
CREATE INDEX "BandwidthTopup_tenantId_idx" ON "BandwidthTopup"("tenantId");

-- CreateIndex
CREATE INDEX "BandwidthTopup_enabled_idx" ON "BandwidthTopup"("enabled");

-- CreateIndex
CREATE INDEX "BandwidthUsageDaily_tenantId_idx" ON "BandwidthUsageDaily"("tenantId");

-- CreateIndex
CREATE INDEX "BandwidthUsageDaily_propertyId_idx" ON "BandwidthUsageDaily"("propertyId");

-- CreateIndex
CREATE INDEX "BandwidthUsageDaily_date_idx" ON "BandwidthUsageDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "BandwidthUsageDaily_propertyId_date_key" ON "BandwidthUsageDaily"("propertyId", "date");

-- CreateIndex
CREATE INDEX "BandwidthUsageSession_tenantId_idx" ON "BandwidthUsageSession"("tenantId");

-- CreateIndex
CREATE INDEX "BandwidthUsageSession_propertyId_idx" ON "BandwidthUsageSession"("propertyId");

-- CreateIndex
CREATE INDEX "BandwidthUsageSession_sessionId_idx" ON "BandwidthUsageSession"("sessionId");

-- CreateIndex
CREATE INDEX "BandwidthUsageSession_ipAddress_idx" ON "BandwidthUsageSession"("ipAddress");

-- CreateIndex
CREATE INDEX "BandwidthUsageSession_startedAt_idx" ON "BandwidthUsageSession"("startedAt");

-- CreateIndex
CREATE INDEX "BandwidthUsageSession_endedAt_idx" ON "BandwidthUsageSession"("endedAt");

-- CreateIndex
CREATE INDEX "BankAccount_tenantId_idx" ON "BankAccount"("tenantId");

-- CreateIndex
CREATE INDEX "BankAccount_bankName_idx" ON "BankAccount"("bankName");

-- CreateIndex
CREATE INDEX "BankAccount_status_idx" ON "BankAccount"("status");

-- CreateIndex
CREATE INDEX "BankTransaction_tenantId_idx" ON "BankTransaction"("tenantId");

-- CreateIndex
CREATE INDEX "BankTransaction_bankAccountId_idx" ON "BankTransaction"("bankAccountId");

-- CreateIndex
CREATE INDEX "BankTransaction_transactionDate_idx" ON "BankTransaction"("transactionDate");

-- CreateIndex
CREATE INDEX "BankTransaction_isReconciled_idx" ON "BankTransaction"("isReconciled");

-- CreateIndex
CREATE INDEX "BankTransaction_transactionType_idx" ON "BankTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "BankTransaction_importBatchId_idx" ON "BankTransaction"("importBatchId");

-- CreateIndex
CREATE INDEX "BondConfig_tenantId_idx" ON "BondConfig"("tenantId");

-- CreateIndex
CREATE INDEX "BondConfig_propertyId_idx" ON "BondConfig"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "BondConfig_propertyId_name_key" ON "BondConfig"("propertyId", "name");

-- CreateIndex
CREATE INDEX "BondMember_bondConfigId_idx" ON "BondMember"("bondConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "BondMember_bondConfigId_interfaceId_key" ON "BondMember"("bondConfigId", "interfaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_confirmationCode_key" ON "Booking"("confirmationCode");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_portalToken_key" ON "Booking"("portalToken");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_idempotencyKey_key" ON "Booking"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Booking_tenantId_idx" ON "Booking"("tenantId");

-- CreateIndex
CREATE INDEX "Booking_propertyId_idx" ON "Booking"("propertyId");

-- CreateIndex
CREATE INDEX "Booking_primaryGuestId_idx" ON "Booking"("primaryGuestId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_checkIn_idx" ON "Booking"("checkIn");

-- CreateIndex
CREATE INDEX "Booking_checkOut_idx" ON "Booking"("checkOut");

-- CreateIndex
CREATE INDEX "Booking_groupId_idx" ON "Booking"("groupId");

-- CreateIndex
CREATE INDEX "Booking_tenantId_propertyId_status_idx" ON "Booking"("tenantId", "propertyId", "status");

-- CreateIndex
CREATE INDEX "Booking_tenantId_checkIn_idx" ON "Booking"("tenantId", "checkIn");

-- CreateIndex
CREATE INDEX "Booking_tenantId_checkOut_idx" ON "Booking"("tenantId", "checkOut");

-- CreateIndex
CREATE INDEX "BookingAuditLog_bookingId_idx" ON "BookingAuditLog"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_code_key" ON "Brand"("code");

-- CreateIndex
CREATE INDEX "Brand_tenantId_idx" ON "Brand"("tenantId");

-- CreateIndex
CREATE INDEX "BridgeConfig_tenantId_idx" ON "BridgeConfig"("tenantId");

-- CreateIndex
CREATE INDEX "BridgeConfig_propertyId_idx" ON "BridgeConfig"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "BridgeConfig_propertyId_name_key" ON "BridgeConfig"("propertyId", "name");

-- CreateIndex
CREATE INDEX "Camera_propertyId_idx" ON "Camera"("propertyId");

-- CreateIndex
CREATE INDEX "CameraEvent_tenantId_idx" ON "CameraEvent"("tenantId");

-- CreateIndex
CREATE INDEX "CameraEvent_cameraId_idx" ON "CameraEvent"("cameraId");

-- CreateIndex
CREATE INDEX "CameraEvent_timestamp_idx" ON "CameraEvent"("timestamp");

-- CreateIndex
CREATE INDEX "CameraGroup_propertyId_idx" ON "CameraGroup"("propertyId");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_idx" ON "Campaign"("tenantId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignSegment_campaignId_segmentId_key" ON "CampaignSegment"("campaignId", "segmentId");

-- CreateIndex
CREATE INDEX "CancellationPolicy_tenantId_idx" ON "CancellationPolicy"("tenantId");

-- CreateIndex
CREATE INDEX "CancellationPolicy_propertyId_idx" ON "CancellationPolicy"("propertyId");

-- CreateIndex
CREATE INDEX "CancellationPolicy_ratePlanId_idx" ON "CancellationPolicy"("ratePlanId");

-- CreateIndex
CREATE INDEX "CancellationPolicy_isActive_idx" ON "CancellationPolicy"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CaptivePortal_slug_key" ON "CaptivePortal"("slug");

-- CreateIndex
CREATE INDEX "CaptivePortal_tenantId_idx" ON "CaptivePortal"("tenantId");

-- CreateIndex
CREATE INDEX "CaptivePortal_propertyId_idx" ON "CaptivePortal"("propertyId");

-- CreateIndex
CREATE INDEX "CaptivePortal_enabled_idx" ON "CaptivePortal"("enabled");

-- CreateIndex
CREATE INDEX "ChannelConnection_tenantId_idx" ON "ChannelConnection"("tenantId");

-- CreateIndex
CREATE INDEX "ChannelConnection_channel_idx" ON "ChannelConnection"("channel");

-- CreateIndex
CREATE INDEX "ChannelConnection_status_idx" ON "ChannelConnection"("status");

-- CreateIndex
CREATE INDEX "ChannelDeadLetterQueue_tenantId_idx" ON "ChannelDeadLetterQueue"("tenantId");

-- CreateIndex
CREATE INDEX "ChannelDeadLetterQueue_channelCode_idx" ON "ChannelDeadLetterQueue"("channelCode");

-- CreateIndex
CREATE INDEX "ChannelDeadLetterQueue_createdAt_idx" ON "ChannelDeadLetterQueue"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelMapping_connectionId_roomTypeId_ratePlanId_key" ON "ChannelMapping"("connectionId", "roomTypeId", "ratePlanId");

-- CreateIndex
CREATE INDEX "ChannelRestriction_connectionId_idx" ON "ChannelRestriction"("connectionId");

-- CreateIndex
CREATE INDEX "ChannelRestriction_roomTypeId_idx" ON "ChannelRestriction"("roomTypeId");

-- CreateIndex
CREATE INDEX "ChannelRestriction_startDate_endDate_idx" ON "ChannelRestriction"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelRestriction_connectionId_roomTypeId_startDate_key" ON "ChannelRestriction"("connectionId", "roomTypeId", "startDate");

-- CreateIndex
CREATE INDEX "ChannelRetryQueue_tenantId_idx" ON "ChannelRetryQueue"("tenantId");

-- CreateIndex
CREATE INDEX "ChannelRetryQueue_status_idx" ON "ChannelRetryQueue"("status");

-- CreateIndex
CREATE INDEX "ChannelRetryQueue_nextRetryAt_idx" ON "ChannelRetryQueue"("nextRetryAt");

-- CreateIndex
CREATE INDEX "ChannelRetryQueue_channelCode_idx" ON "ChannelRetryQueue"("channelCode");

-- CreateIndex
CREATE INDEX "ChannelSyncLog_connectionId_idx" ON "ChannelSyncLog"("connectionId");

-- CreateIndex
CREATE INDEX "ChannelSyncLog_createdAt_idx" ON "ChannelSyncLog"("createdAt");

-- CreateIndex
CREATE INDEX "ChatConversation_tenantId_idx" ON "ChatConversation"("tenantId");

-- CreateIndex
CREATE INDEX "ChatConversation_propertyId_idx" ON "ChatConversation"("propertyId");

-- CreateIndex
CREATE INDEX "ChatConversation_guestId_idx" ON "ChatConversation"("guestId");

-- CreateIndex
CREATE INDEX "ChatConversation_status_idx" ON "ChatConversation"("status");

-- CreateIndex
CREATE INDEX "ChatConversation_channel_idx" ON "ChatConversation"("channel");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");

-- CreateIndex
CREATE INDEX "CoaSessionDetail_propertyId_idx" ON "CoaSessionDetail"("propertyId");

-- CreateIndex
CREATE INDEX "CoaSessionDetail_tenantId_idx" ON "CoaSessionDetail"("tenantId");

-- CreateIndex
CREATE INDEX "CoaSessionDetail_sessionId_idx" ON "CoaSessionDetail"("sessionId");

-- CreateIndex
CREATE INDEX "CoaSessionDetail_username_idx" ON "CoaSessionDetail"("username");

-- CreateIndex
CREATE INDEX "CoaSessionDetail_userId_idx" ON "CoaSessionDetail"("userId");

-- CreateIndex
CREATE INDEX "CoaSessionDetail_coaType_idx" ON "CoaSessionDetail"("coaType");

-- CreateIndex
CREATE INDEX "CoaSessionDetail_createdAt_idx" ON "CoaSessionDetail"("createdAt");

-- CreateIndex
CREATE INDEX "CommunicationChannel_tenantId_idx" ON "CommunicationChannel"("tenantId");

-- CreateIndex
CREATE INDEX "CommunicationChannel_status_idx" ON "CommunicationChannel"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationChannel_tenantId_type_key" ON "CommunicationChannel"("tenantId", "type");

-- CreateIndex
CREATE INDEX "CompetitorPrice_tenantId_idx" ON "CompetitorPrice"("tenantId");

-- CreateIndex
CREATE INDEX "CompetitorPrice_propertyId_idx" ON "CompetitorPrice"("propertyId");

-- CreateIndex
CREATE INDEX "CompetitorPrice_date_idx" ON "CompetitorPrice"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorPrice_propertyId_competitorName_date_key" ON "CompetitorPrice"("propertyId", "competitorName", "date");

-- CreateIndex
CREATE INDEX "ConsentRecord_tenantId_idx" ON "ConsentRecord"("tenantId");

-- CreateIndex
CREATE INDEX "ConsentRecord_guestId_idx" ON "ConsentRecord"("guestId");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");

-- CreateIndex
CREATE INDEX "ConsentRecord_consentType_idx" ON "ConsentRecord"("consentType");

-- CreateIndex
CREATE INDEX "ConsentRecord_granted_idx" ON "ConsentRecord"("granted");

-- CreateIndex
CREATE INDEX "ConsentRecord_createdAt_idx" ON "ConsentRecord"("createdAt");

-- CreateIndex
CREATE INDEX "ContentFilter_tenantId_idx" ON "ContentFilter"("tenantId");

-- CreateIndex
CREATE INDEX "ContentFilter_propertyId_idx" ON "ContentFilter"("propertyId");

-- CreateIndex
CREATE INDEX "ContentFilter_category_idx" ON "ContentFilter"("category");

-- CreateIndex
CREATE INDEX "ContentFilter_enabled_idx" ON "ContentFilter"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_creditNoteNumber_key" ON "CreditNote"("creditNoteNumber");

-- CreateIndex
CREATE INDEX "CreditNote_tenantId_idx" ON "CreditNote"("tenantId");

-- CreateIndex
CREATE INDEX "CreditNote_propertyId_idx" ON "CreditNote"("propertyId");

-- CreateIndex
CREATE INDEX "CreditNote_folioId_idx" ON "CreditNote"("folioId");

-- CreateIndex
CREATE INDEX "CreditNote_guestId_idx" ON "CreditNote"("guestId");

-- CreateIndex
CREATE INDEX "CreditNote_status_idx" ON "CreditNote"("status");

-- CreateIndex
CREATE INDEX "CreditNote_bookingId_idx" ON "CreditNote"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "DemandForecast_date_key" ON "DemandForecast"("date");

-- CreateIndex
CREATE INDEX "DemandForecast_tenantId_idx" ON "DemandForecast"("tenantId");

-- CreateIndex
CREATE INDEX "DemandForecast_propertyId_idx" ON "DemandForecast"("propertyId");

-- CreateIndex
CREATE INDEX "DemandForecast_date_idx" ON "DemandForecast"("date");

-- CreateIndex
CREATE INDEX "DhcpBlacklist_tenantId_idx" ON "DhcpBlacklist"("tenantId");

-- CreateIndex
CREATE INDEX "DhcpBlacklist_propertyId_idx" ON "DhcpBlacklist"("propertyId");

-- CreateIndex
CREATE INDEX "DhcpBlacklist_subnetId_idx" ON "DhcpBlacklist"("subnetId");

-- CreateIndex
CREATE INDEX "DhcpBlacklist_macAddress_idx" ON "DhcpBlacklist"("macAddress");

-- CreateIndex
CREATE INDEX "DhcpHostnameFilter_tenantId_idx" ON "DhcpHostnameFilter"("tenantId");

-- CreateIndex
CREATE INDEX "DhcpHostnameFilter_propertyId_idx" ON "DhcpHostnameFilter"("propertyId");

-- CreateIndex
CREATE INDEX "DhcpHostnameFilter_subnetId_idx" ON "DhcpHostnameFilter"("subnetId");

-- CreateIndex
CREATE INDEX "DhcpLease_tenantId_idx" ON "DhcpLease"("tenantId");

-- CreateIndex
CREATE INDEX "DhcpLease_propertyId_idx" ON "DhcpLease"("propertyId");

-- CreateIndex
CREATE INDEX "DhcpLease_macAddress_idx" ON "DhcpLease"("macAddress");

-- CreateIndex
CREATE INDEX "DhcpLease_state_idx" ON "DhcpLease"("state");

-- CreateIndex
CREATE INDEX "DhcpLease_leaseEnd_idx" ON "DhcpLease"("leaseEnd");

-- CreateIndex
CREATE UNIQUE INDEX "DhcpLease_subnetId_ipAddress_key" ON "DhcpLease"("subnetId", "ipAddress");

-- CreateIndex
CREATE INDEX "DhcpLeaseScript_tenantId_idx" ON "DhcpLeaseScript"("tenantId");

-- CreateIndex
CREATE INDEX "DhcpLeaseScript_propertyId_idx" ON "DhcpLeaseScript"("propertyId");

-- CreateIndex
CREATE INDEX "DhcpLeaseScript_enabled_idx" ON "DhcpLeaseScript"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "DhcpLeaseScript_tenantId_scriptPath_key" ON "DhcpLeaseScript"("tenantId", "scriptPath");

-- CreateIndex
CREATE INDEX "DhcpOption_tenantId_idx" ON "DhcpOption"("tenantId");

-- CreateIndex
CREATE INDEX "DhcpOption_propertyId_idx" ON "DhcpOption"("propertyId");

-- CreateIndex
CREATE INDEX "DhcpOption_subnetId_idx" ON "DhcpOption"("subnetId");

-- CreateIndex
CREATE INDEX "DhcpOption_code_idx" ON "DhcpOption"("code");

-- CreateIndex
CREATE INDEX "DhcpReservation_tenantId_idx" ON "DhcpReservation"("tenantId");

-- CreateIndex
CREATE INDEX "DhcpReservation_propertyId_idx" ON "DhcpReservation"("propertyId");

-- CreateIndex
CREATE INDEX "DhcpReservation_macAddress_idx" ON "DhcpReservation"("macAddress");

-- CreateIndex
CREATE UNIQUE INDEX "DhcpReservation_subnetId_macAddress_key" ON "DhcpReservation"("subnetId", "macAddress");

-- CreateIndex
CREATE UNIQUE INDEX "DhcpReservation_subnetId_ipAddress_key" ON "DhcpReservation"("subnetId", "ipAddress");

-- CreateIndex
CREATE INDEX "DhcpSubnet_tenantId_idx" ON "DhcpSubnet"("tenantId");

-- CreateIndex
CREATE INDEX "DhcpSubnet_propertyId_idx" ON "DhcpSubnet"("propertyId");

-- CreateIndex
CREATE INDEX "DhcpSubnet_subnet_idx" ON "DhcpSubnet"("subnet");

-- CreateIndex
CREATE INDEX "DhcpSubnet_enabled_idx" ON "DhcpSubnet"("enabled");

-- CreateIndex
CREATE INDEX "DhcpTagRule_tenantId_idx" ON "DhcpTagRule"("tenantId");

-- CreateIndex
CREATE INDEX "DhcpTagRule_propertyId_idx" ON "DhcpTagRule"("propertyId");

-- CreateIndex
CREATE INDEX "DhcpTagRule_subnetId_idx" ON "DhcpTagRule"("subnetId");

-- CreateIndex
CREATE INDEX "DhcpTagRule_matchType_idx" ON "DhcpTagRule"("matchType");

-- CreateIndex
CREATE INDEX "DhcpTagRule_setTag_idx" ON "DhcpTagRule"("setTag");

-- CreateIndex
CREATE INDEX "DigitalKeyAccessLog_tenantId_idx" ON "DigitalKeyAccessLog"("tenantId");

-- CreateIndex
CREATE INDEX "DigitalKeyAccessLog_roomId_idx" ON "DigitalKeyAccessLog"("roomId");

-- CreateIndex
CREATE INDEX "DigitalKeyAccessLog_guestId_idx" ON "DigitalKeyAccessLog"("guestId");

-- CreateIndex
CREATE INDEX "DigitalKeyAccessLog_accessedAt_idx" ON "DigitalKeyAccessLog"("accessedAt");

-- CreateIndex
CREATE INDEX "Discount_tenantId_idx" ON "Discount"("tenantId");

-- CreateIndex
CREATE INDEX "Discount_code_idx" ON "Discount"("code");

-- CreateIndex
CREATE INDEX "Discount_isActive_idx" ON "Discount"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_tenantId_code_key" ON "Discount"("tenantId", "code");

-- CreateIndex
CREATE INDEX "DnsRecord_tenantId_idx" ON "DnsRecord"("tenantId");

-- CreateIndex
CREATE INDEX "DnsRecord_zoneId_idx" ON "DnsRecord"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "DnsRecord_zoneId_name_type_key" ON "DnsRecord"("zoneId", "name", "type");

-- CreateIndex
CREATE INDEX "DnsRedirectRule_tenantId_idx" ON "DnsRedirectRule"("tenantId");

-- CreateIndex
CREATE INDEX "DnsRedirectRule_propertyId_idx" ON "DnsRedirectRule"("propertyId");

-- CreateIndex
CREATE INDEX "DnsRedirectRule_enabled_idx" ON "DnsRedirectRule"("enabled");

-- CreateIndex
CREATE INDEX "DnsRedirectRule_priority_idx" ON "DnsRedirectRule"("priority");

-- CreateIndex
CREATE INDEX "DnsZone_tenantId_idx" ON "DnsZone"("tenantId");

-- CreateIndex
CREATE INDEX "DnsZone_propertyId_idx" ON "DnsZone"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "DnsZone_propertyId_domain_key" ON "DnsZone"("propertyId", "domain");

-- CreateIndex
CREATE INDEX "EnergyMetric_tenantId_idx" ON "EnergyMetric"("tenantId");

-- CreateIndex
CREATE INDEX "EnergyMetric_date_idx" ON "EnergyMetric"("date");

-- CreateIndex
CREATE UNIQUE INDEX "EnergyMetric_propertyId_date_key" ON "EnergyMetric"("propertyId", "date");

-- CreateIndex
CREATE INDEX "Event_tenantId_idx" ON "Event"("tenantId");

-- CreateIndex
CREATE INDEX "Event_propertyId_idx" ON "Event"("propertyId");

-- CreateIndex
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");

-- CreateIndex
CREATE INDEX "EventResource_eventId_idx" ON "EventResource"("eventId");

-- CreateIndex
CREATE INDEX "EventResource_category_idx" ON "EventResource"("category");

-- CreateIndex
CREATE INDEX "EventResource_status_idx" ON "EventResource"("status");

-- CreateIndex
CREATE INDEX "EventSpace_propertyId_idx" ON "EventSpace"("propertyId");

-- CreateIndex
CREATE INDEX "ExchangeRate_tenantId_idx" ON "ExchangeRate"("tenantId");

-- CreateIndex
CREATE INDEX "ExchangeRate_fromCurrency_idx" ON "ExchangeRate"("fromCurrency");

-- CreateIndex
CREATE INDEX "ExchangeRate_toCurrency_idx" ON "ExchangeRate"("toCurrency");

-- CreateIndex
CREATE INDEX "ExchangeRate_isActive_idx" ON "ExchangeRate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_tenantId_fromCurrency_toCurrency_validFrom_key" ON "ExchangeRate"("tenantId", "fromCurrency", "toCurrency", "validFrom");

-- CreateIndex
CREATE INDEX "ExternalReview_tenantId_idx" ON "ExternalReview"("tenantId");

-- CreateIndex
CREATE INDEX "ExternalReview_propertyId_idx" ON "ExternalReview"("propertyId");

-- CreateIndex
CREATE INDEX "ExternalReview_source_idx" ON "ExternalReview"("source");

-- CreateIndex
CREATE INDEX "ExternalReview_reviewDate_idx" ON "ExternalReview"("reviewDate");

-- CreateIndex
CREATE INDEX "FairAccessPolicy_propertyId_idx" ON "FairAccessPolicy"("propertyId");

-- CreateIndex
CREATE INDEX "FairAccessPolicy_tenantId_idx" ON "FairAccessPolicy"("tenantId");

-- CreateIndex
CREATE INDEX "FairAccessPolicy_isEnabled_idx" ON "FairAccessPolicy"("isEnabled");

-- CreateIndex
CREATE INDEX "FairAccessPolicy_cycleType_idx" ON "FairAccessPolicy"("cycleType");

-- CreateIndex
CREATE INDEX "fup_switch_log_triggered_idx" ON "fup_switch_log"("triggered_at");

-- CreateIndex
CREATE INDEX "fup_switch_log_username_idx" ON "fup_switch_log"("username");

-- CreateIndex
CREATE INDEX "idx_fup_switch_log_created_at" ON "fup_switch_log"("created_at");

-- CreateIndex
CREATE INDEX "FeatureAnnouncement_status_idx" ON "FeatureAnnouncement"("status");

-- CreateIndex
CREATE INDEX "FirewallRule_tenantId_idx" ON "FirewallRule"("tenantId");

-- CreateIndex
CREATE INDEX "FirewallRule_propertyId_idx" ON "FirewallRule"("propertyId");

-- CreateIndex
CREATE INDEX "FirewallRule_zoneId_idx" ON "FirewallRule"("zoneId");

-- CreateIndex
CREATE INDEX "FirewallRule_enabled_idx" ON "FirewallRule"("enabled");

-- CreateIndex
CREATE INDEX "FirewallRule_priority_idx" ON "FirewallRule"("priority");

-- CreateIndex
CREATE INDEX "FirewallSchedule_tenantId_idx" ON "FirewallSchedule"("tenantId");

-- CreateIndex
CREATE INDEX "FirewallSchedule_propertyId_idx" ON "FirewallSchedule"("propertyId");

-- CreateIndex
CREATE INDEX "FirewallZone_tenantId_idx" ON "FirewallZone"("tenantId");

-- CreateIndex
CREATE INDEX "FirewallZone_propertyId_idx" ON "FirewallZone"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "FirewallZone_propertyId_name_key" ON "FirewallZone"("propertyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FloorPlan_propertyId_floor_key" ON "FloorPlan"("propertyId", "floor");

-- CreateIndex
CREATE INDEX "FloorPlanRoom_floorPlanId_idx" ON "FloorPlanRoom"("floorPlanId");

-- CreateIndex
CREATE INDEX "FloorPlanRoom_roomId_idx" ON "FloorPlanRoom"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "FloorPlanRoom_floorPlanId_roomId_key" ON "FloorPlanRoom"("floorPlanId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "Folio_folioNumber_key" ON "Folio"("folioNumber");

-- CreateIndex
CREATE INDEX "Folio_tenantId_idx" ON "Folio"("tenantId");

-- CreateIndex
CREATE INDEX "Folio_bookingId_idx" ON "Folio"("bookingId");

-- CreateIndex
CREATE INDEX "Folio_guestId_idx" ON "Folio"("guestId");

-- CreateIndex
CREATE INDEX "FolioLineItem_folioId_idx" ON "FolioLineItem"("folioId");

-- CreateIndex
CREATE INDEX "FolioLineItem_discountId_idx" ON "FolioLineItem"("discountId");

-- CreateIndex
CREATE INDEX "FolioTransfer_tenantId_idx" ON "FolioTransfer"("tenantId");

-- CreateIndex
CREATE INDEX "FolioTransfer_propertyId_idx" ON "FolioTransfer"("propertyId");

-- CreateIndex
CREATE INDEX "FolioTransfer_fromFolioId_idx" ON "FolioTransfer"("fromFolioId");

-- CreateIndex
CREATE INDEX "FolioTransfer_toFolioId_idx" ON "FolioTransfer"("toFolioId");

-- CreateIndex
CREATE INDEX "FolioTransfer_bookingId_idx" ON "FolioTransfer"("bookingId");

-- CreateIndex
CREATE INDEX "GDPRRequest_tenantId_idx" ON "GDPRRequest"("tenantId");

-- CreateIndex
CREATE INDEX "GDPRRequest_guestId_idx" ON "GDPRRequest"("guestId");

-- CreateIndex
CREATE INDEX "GDPRRequest_requestType_idx" ON "GDPRRequest"("requestType");

-- CreateIndex
CREATE INDEX "GDPRRequest_status_idx" ON "GDPRRequest"("status");

-- CreateIndex
CREATE INDEX "GDPRRequest_createdAt_idx" ON "GDPRRequest"("createdAt");

-- CreateIndex
CREATE INDEX "GDPRRequest_expiresAt_idx" ON "GDPRRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "GoogleHotelAdsConnection_tenantId_idx" ON "GoogleHotelAdsConnection"("tenantId");

-- CreateIndex
CREATE INDEX "GoogleHotelAdsConnection_status_idx" ON "GoogleHotelAdsConnection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleHotelAdsConnection_tenantId_propertyId_key" ON "GoogleHotelAdsConnection"("tenantId", "propertyId");

-- CreateIndex
CREATE INDEX "GroupBooking_tenantId_idx" ON "GroupBooking"("tenantId");

-- CreateIndex
CREATE INDEX "GroupBooking_propertyId_idx" ON "GroupBooking"("propertyId");

-- CreateIndex
CREATE INDEX "Guest_tenantId_idx" ON "Guest"("tenantId");

-- CreateIndex
CREATE INDEX "Guest_email_idx" ON "Guest"("email");

-- CreateIndex
CREATE INDEX "Guest_tenantId_email_idx" ON "Guest"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Guest_phone_idx" ON "Guest"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "GuestBehavior_guestId_key" ON "GuestBehavior"("guestId");

-- CreateIndex
CREATE INDEX "GuestBehavior_tenantId_idx" ON "GuestBehavior"("tenantId");

-- CreateIndex
CREATE INDEX "GuestBehavior_guestId_idx" ON "GuestBehavior"("guestId");

-- CreateIndex
CREATE INDEX "GuestBehavior_isRepeatGuest_idx" ON "GuestBehavior"("isRepeatGuest");

-- CreateIndex
CREATE INDEX "GuestDocument_guestId_idx" ON "GuestDocument"("guestId");

-- CreateIndex
CREATE INDEX "GuestFeedback_guestId_idx" ON "GuestFeedback"("guestId");

-- CreateIndex
CREATE INDEX "GuestFeedback_propertyId_idx" ON "GuestFeedback"("propertyId");

-- CreateIndex
CREATE INDEX "GuestJourney_tenantId_idx" ON "GuestJourney"("tenantId");

-- CreateIndex
CREATE INDEX "GuestJourney_guestId_idx" ON "GuestJourney"("guestId");

-- CreateIndex
CREATE INDEX "GuestJourney_stage_idx" ON "GuestJourney"("stage");

-- CreateIndex
CREATE INDEX "GuestJourney_occurredAt_idx" ON "GuestJourney"("occurredAt");

-- CreateIndex
CREATE INDEX "GuestRecommendation_tenantId_idx" ON "GuestRecommendation"("tenantId");

-- CreateIndex
CREATE INDEX "GuestRecommendation_guestId_idx" ON "GuestRecommendation"("guestId");

-- CreateIndex
CREATE INDEX "GuestRecommendation_status_idx" ON "GuestRecommendation"("status");

-- CreateIndex
CREATE INDEX "GuestRecommendation_expiresAt_idx" ON "GuestRecommendation"("expiresAt");

-- CreateIndex
CREATE INDEX "GuestReview_guestId_idx" ON "GuestReview"("guestId");

-- CreateIndex
CREATE INDEX "GuestReview_propertyId_idx" ON "GuestReview"("propertyId");

-- CreateIndex
CREATE INDEX "GuestSegment_tenantId_idx" ON "GuestSegment"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestStay_guestId_bookingId_key" ON "GuestStay"("guestId", "bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "HelpArticle_slug_key" ON "HelpArticle"("slug");

-- CreateIndex
CREATE INDEX "HelpArticle_category_idx" ON "HelpArticle"("category");

-- CreateIndex
CREATE INDEX "HelpArticle_status_idx" ON "HelpArticle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HelpCategory_slug_key" ON "HelpCategory"("slug");

-- CreateIndex
CREATE INDEX "HelpCategory_parentId_idx" ON "HelpCategory"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_key" ON "IdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "IdempotencyKey_key_idx" ON "IdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "IdempotencyKey_tenantId_idx" ON "IdempotencyKey"("tenantId");

-- CreateIndex
CREATE INDEX "InspectionResult_tenantId_idx" ON "InspectionResult"("tenantId");

-- CreateIndex
CREATE INDEX "InspectionResult_propertyId_idx" ON "InspectionResult"("propertyId");

-- CreateIndex
CREATE INDEX "InspectionResult_roomId_idx" ON "InspectionResult"("roomId");

-- CreateIndex
CREATE INDEX "InspectionResult_taskId_idx" ON "InspectionResult"("taskId");

-- CreateIndex
CREATE INDEX "InspectionResult_templateId_idx" ON "InspectionResult"("templateId");

-- CreateIndex
CREATE INDEX "InspectionResult_inspectorId_idx" ON "InspectionResult"("inspectorId");

-- CreateIndex
CREATE INDEX "InspectionResult_completedAt_idx" ON "InspectionResult"("completedAt");

-- CreateIndex
CREATE INDEX "InspectionTemplate_tenantId_idx" ON "InspectionTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "InspectionTemplate_propertyId_idx" ON "InspectionTemplate"("propertyId");

-- CreateIndex
CREATE INDEX "InspectionTemplate_roomType_idx" ON "InspectionTemplate"("roomType");

-- CreateIndex
CREATE INDEX "InspectionTemplate_isActive_idx" ON "InspectionTemplate"("isActive");

-- CreateIndex
CREATE INDEX "Integration_tenantId_idx" ON "Integration"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_tenantId_type_provider_key" ON "Integration"("tenantId", "type", "provider");

-- CreateIndex
CREATE INDEX "InterfaceAlias_tenantId_idx" ON "InterfaceAlias"("tenantId");

-- CreateIndex
CREATE INDEX "InterfaceAlias_propertyId_idx" ON "InterfaceAlias"("propertyId");

-- CreateIndex
CREATE INDEX "InterfaceAlias_interfaceId_idx" ON "InterfaceAlias"("interfaceId");

-- CreateIndex
CREATE UNIQUE INDEX "InterfaceAlias_propertyId_interfaceId_ipAddress_key" ON "InterfaceAlias"("propertyId", "interfaceId", "ipAddress");

-- CreateIndex
CREATE INDEX "InterfaceConfig_tenantId_idx" ON "InterfaceConfig"("tenantId");

-- CreateIndex
CREATE INDEX "InterfaceConfig_propertyId_idx" ON "InterfaceConfig"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "InterfaceConfig_propertyId_interfaceId_key" ON "InterfaceConfig"("propertyId", "interfaceId");

-- CreateIndex
CREATE INDEX "InterfaceRole_tenantId_idx" ON "InterfaceRole"("tenantId");

-- CreateIndex
CREATE INDEX "InterfaceRole_propertyId_idx" ON "InterfaceRole"("propertyId");

-- CreateIndex
CREATE INDEX "InterfaceRole_role_idx" ON "InterfaceRole"("role");

-- CreateIndex
CREATE UNIQUE INDEX "InterfaceRole_propertyId_interfaceId_key" ON "InterfaceRole"("propertyId", "interfaceId");

-- CreateIndex
CREATE INDEX "InventoryLock_tenantId_idx" ON "InventoryLock"("tenantId");

-- CreateIndex
CREATE INDEX "InventoryLock_propertyId_idx" ON "InventoryLock"("propertyId");

-- CreateIndex
CREATE INDEX "InventoryLock_roomId_idx" ON "InventoryLock"("roomId");

-- CreateIndex
CREATE INDEX "InventoryLock_roomTypeId_idx" ON "InventoryLock"("roomTypeId");

-- CreateIndex
CREATE INDEX "InventoryLock_sessionId_idx" ON "InventoryLock"("sessionId");

-- CreateIndex
CREATE INDEX "InventoryLock_expiresAt_idx" ON "InventoryLock"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE INDEX "Invoice_isRecurring_recurringNextDate_idx" ON "Invoice"("isRecurring", "recurringNextDate");

-- CreateIndex
CREATE INDEX "InvoiceTemplate_tenantId_idx" ON "InvoiceTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "FolioLineItemAudit_tenantId_idx" ON "FolioLineItemAudit"("tenantId");

-- CreateIndex
CREATE INDEX "FolioLineItemAudit_folioId_idx" ON "FolioLineItemAudit"("folioId");

-- CreateIndex
CREATE INDEX "FolioLineItemAudit_lineItemId_idx" ON "FolioLineItemAudit"("lineItemId");

-- CreateIndex
CREATE INDEX "FolioLineItemAudit_createdAt_idx" ON "FolioLineItemAudit"("createdAt");

-- CreateIndex
CREATE INDEX "IoTCommand_deviceId_idx" ON "IoTCommand"("deviceId");

-- CreateIndex
CREATE INDEX "IoTCommand_status_idx" ON "IoTCommand"("status");

-- CreateIndex
CREATE INDEX "IoTDevice_tenantId_idx" ON "IoTDevice"("tenantId");

-- CreateIndex
CREATE INDEX "IoTDevice_propertyId_idx" ON "IoTDevice"("propertyId");

-- CreateIndex
CREATE INDEX "IoTDevice_roomId_idx" ON "IoTDevice"("roomId");

-- CreateIndex
CREATE INDEX "IoTReading_deviceId_idx" ON "IoTReading"("deviceId");

-- CreateIndex
CREATE INDEX "IoTReading_timestamp_idx" ON "IoTReading"("timestamp");

-- CreateIndex
CREATE INDEX "KioskSettings_propertyId_idx" ON "KioskSettings"("propertyId");

-- CreateIndex
CREATE INDEX "KioskSettings_tenantId_idx" ON "KioskSettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "KioskSettings_propertyId_key" ON "KioskSettings"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_acctSessionId_key" ON "LiveSession"("acctSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_username_key" ON "LiveSession"("username");

-- CreateIndex
CREATE INDEX "LiveSession_propertyId_idx" ON "LiveSession"("propertyId");

-- CreateIndex
CREATE INDEX "LiveSession_tenantId_idx" ON "LiveSession"("tenantId");

-- CreateIndex
CREATE INDEX "LiveSession_username_idx" ON "LiveSession"("username");

-- CreateIndex
CREATE INDEX "LiveSession_nasIpAddress_idx" ON "LiveSession"("nasIpAddress");

-- CreateIndex
CREATE INDEX "LiveSession_status_idx" ON "LiveSession"("status");

-- CreateIndex
CREATE INDEX "LiveSession_userId_idx" ON "LiveSession"("userId");

-- CreateIndex
CREATE INDEX "LiveSession_framedIpAddress_idx" ON "LiveSession"("framedIpAddress");

-- CreateIndex
CREATE INDEX "LiveSession_macAddress_idx" ON "LiveSession"("macAddress");

-- CreateIndex
CREATE INDEX "LoyaltyPointTransaction_tenantId_idx" ON "LoyaltyPointTransaction"("tenantId");

-- CreateIndex
CREATE INDEX "LoyaltyPointTransaction_guestId_idx" ON "LoyaltyPointTransaction"("guestId");

-- CreateIndex
CREATE INDEX "LoyaltyPointTransaction_type_idx" ON "LoyaltyPointTransaction"("type");

-- CreateIndex
CREATE INDEX "LoyaltyPointTransaction_expiresAt_idx" ON "LoyaltyPointTransaction"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyRedemption_redemptionCode_key" ON "LoyaltyRedemption"("redemptionCode");

-- CreateIndex
CREATE INDEX "LoyaltyRedemption_tenantId_idx" ON "LoyaltyRedemption"("tenantId");

-- CreateIndex
CREATE INDEX "LoyaltyRedemption_guestId_idx" ON "LoyaltyRedemption"("guestId");

-- CreateIndex
CREATE INDEX "LoyaltyRedemption_rewardId_idx" ON "LoyaltyRedemption"("rewardId");

-- CreateIndex
CREATE INDEX "LoyaltyRedemption_status_idx" ON "LoyaltyRedemption"("status");

-- CreateIndex
CREATE INDEX "LoyaltyRedemption_redemptionCode_idx" ON "LoyaltyRedemption"("redemptionCode");

-- CreateIndex
CREATE INDEX "LoyaltyReward_tenantId_idx" ON "LoyaltyReward"("tenantId");

-- CreateIndex
CREATE INDEX "LoyaltyReward_category_idx" ON "LoyaltyReward"("category");

-- CreateIndex
CREATE INDEX "LoyaltyReward_isAvailable_idx" ON "LoyaltyReward"("isAvailable");

-- CreateIndex
CREATE INDEX "LoyaltyTier_tenantId_idx" ON "LoyaltyTier"("tenantId");

-- CreateIndex
CREATE INDEX "LoyaltyTier_minPoints_idx" ON "LoyaltyTier"("minPoints");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyTier_tenantId_name_key" ON "LoyaltyTier"("tenantId", "name");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_tenantId_idx" ON "LoyaltyTransaction"("tenantId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_guestId_idx" ON "LoyaltyTransaction"("guestId");

-- CreateIndex
CREATE INDEX "MacFilter_tenantId_idx" ON "MacFilter"("tenantId");

-- CreateIndex
CREATE INDEX "MacFilter_propertyId_idx" ON "MacFilter"("propertyId");

-- CreateIndex
CREATE INDEX "MacFilter_listType_idx" ON "MacFilter"("listType");

-- CreateIndex
CREATE INDEX "MacFilter_enabled_idx" ON "MacFilter"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "MacFilter_propertyId_macAddress_key" ON "MacFilter"("propertyId", "macAddress");

-- CreateIndex
CREATE INDEX "MaintenanceBlock_tenantId_idx" ON "MaintenanceBlock"("tenantId");

-- CreateIndex
CREATE INDEX "MaintenanceBlock_propertyId_idx" ON "MaintenanceBlock"("propertyId");

-- CreateIndex
CREATE INDEX "MaintenanceBlock_roomId_idx" ON "MaintenanceBlock"("roomId");

-- CreateIndex
CREATE INDEX "MaintenanceBlock_status_idx" ON "MaintenanceBlock"("status");

-- CreateIndex
CREATE INDEX "MaintenanceBlock_startDate_idx" ON "MaintenanceBlock"("startDate");

-- CreateIndex
CREATE INDEX "MaintenanceBlock_endDate_idx" ON "MaintenanceBlock"("endDate");

-- CreateIndex
CREATE INDEX "ManualTransaction_tenantId_idx" ON "ManualTransaction"("tenantId");

-- CreateIndex
CREATE INDEX "ManualTransaction_paymentId_idx" ON "ManualTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "ManualTransaction_status_idx" ON "ManualTransaction"("status");

-- CreateIndex
CREATE INDEX "MenuItem_propertyId_idx" ON "MenuItem"("propertyId");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "MessageTemplate_tenantId_idx" ON "MessageTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "MessageTemplate_channel_idx" ON "MessageTemplate"("channel");

-- CreateIndex
CREATE INDEX "MessageTemplate_category_idx" ON "MessageTemplate"("category");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_tenantId_name_channel_key" ON "MessageTemplate"("tenantId", "name", "channel");

-- CreateIndex
CREATE INDEX "MetasearchConnection_tenantId_idx" ON "MetasearchConnection"("tenantId");

-- CreateIndex
CREATE INDEX "MetasearchConnection_platform_idx" ON "MetasearchConnection"("platform");

-- CreateIndex
CREATE INDEX "MetasearchConnection_status_idx" ON "MetasearchConnection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MetasearchConnection_tenantId_propertyId_platform_key" ON "MetasearchConnection"("tenantId", "propertyId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "MultiWanConfig_propertyId_key" ON "MultiWanConfig"("propertyId");

-- CreateIndex
CREATE INDEX "MultiWanConfig_tenantId_idx" ON "MultiWanConfig"("tenantId");

-- CreateIndex
CREATE INDEX "Gateway_tenantId_idx" ON "Gateway"("tenantId");

-- CreateIndex
CREATE INDEX "Gateway_propertyId_idx" ON "Gateway"("propertyId");

-- CreateIndex
CREATE INDEX "Gateway_multiWanConfigId_idx" ON "Gateway"("multiWanConfigId");

-- CreateIndex
CREATE INDEX "Gateway_backupGatewayId_idx" ON "Gateway"("backupGatewayId");

-- CreateIndex
CREATE UNIQUE INDEX "Gateway_multiWanConfigId_interfaceName_key" ON "Gateway"("multiWanConfigId", "interfaceName");

-- CreateIndex
CREATE INDEX "GatewayHealthRule_gatewayId_idx" ON "GatewayHealthRule"("gatewayId");

-- CreateIndex
CREATE INDEX "GatewayHealthRule_tenantId_idx" ON "GatewayHealthRule"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "GatewayHealthRule_gatewayId_sortOrder_key" ON "GatewayHealthRule"("gatewayId", "sortOrder");

-- CreateIndex
CREATE INDEX "GatewayExplicitRoute_gatewayId_idx" ON "GatewayExplicitRoute"("gatewayId");

-- CreateIndex
CREATE INDEX "GatewayExplicitRoute_tenantId_idx" ON "GatewayExplicitRoute"("tenantId");

-- CreateIndex
CREATE INDEX "GatewayExplicitRoute_propertyId_idx" ON "GatewayExplicitRoute"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "GatewayExplicitRoute_gatewayId_network_key" ON "GatewayExplicitRoute"("gatewayId", "network");

-- CreateIndex
CREATE INDEX "GatewayFwmark_gatewayId_idx" ON "GatewayFwmark"("gatewayId");

-- CreateIndex
CREATE INDEX "GatewayFwmark_tenantId_idx" ON "GatewayFwmark"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "GatewayFwmark_gatewayId_fwmarkValue_key" ON "GatewayFwmark"("gatewayId", "fwmarkValue");

-- CreateIndex
CREATE INDEX "NasHealthLog_propertyId_idx" ON "NasHealthLog"("propertyId");

-- CreateIndex
CREATE INDEX "NasHealthLog_tenantId_idx" ON "NasHealthLog"("tenantId");

-- CreateIndex
CREATE INDEX "NasHealthLog_nasIpAddress_idx" ON "NasHealthLog"("nasIpAddress");

-- CreateIndex
CREATE INDEX "NasHealthLog_isOnline_idx" ON "NasHealthLog"("isOnline");

-- CreateIndex
CREATE INDEX "NasHealthLog_createdAt_idx" ON "NasHealthLog"("createdAt");

-- CreateIndex
CREATE INDEX "NatLog_tenantId_idx" ON "NatLog"("tenantId");

-- CreateIndex
CREATE INDEX "NatLog_propertyId_idx" ON "NatLog"("propertyId");

-- CreateIndex
CREATE INDEX "NatLog_timestamp_idx" ON "NatLog"("timestamp");

-- CreateIndex
CREATE INDEX "NatLog_sourceIp_idx" ON "NatLog"("sourceIp");

-- CreateIndex
CREATE INDEX "NatLog_destDomain_idx" ON "NatLog"("destDomain");

-- CreateIndex
CREATE INDEX "NatLog_sessionId_idx" ON "NatLog"("sessionId");

-- CreateIndex
CREATE INDEX "NetworkConfigBackup_tenantId_idx" ON "NetworkConfigBackup"("tenantId");

-- CreateIndex
CREATE INDEX "NetworkConfigBackup_propertyId_idx" ON "NetworkConfigBackup"("propertyId");

-- CreateIndex
CREATE INDEX "NetworkConfigBackup_createdAt_idx" ON "NetworkConfigBackup"("createdAt");

-- CreateIndex
CREATE INDEX "NetworkInterface_tenantId_idx" ON "NetworkInterface"("tenantId");

-- CreateIndex
CREATE INDEX "NetworkInterface_propertyId_idx" ON "NetworkInterface"("propertyId");

-- CreateIndex
CREATE INDEX "NetworkInterface_status_idx" ON "NetworkInterface"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkInterface_propertyId_name_key" ON "NetworkInterface"("propertyId", "name");

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_readAt_idx" ON "Notification"("readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");

-- CreateIndex
CREATE INDEX "NotificationLog_tenantId_idx" ON "NotificationLog"("tenantId");

-- CreateIndex
CREATE INDEX "NotificationLog_recipientId_idx" ON "NotificationLog"("recipientId");

-- CreateIndex
CREATE INDEX "NotificationLog_status_idx" ON "NotificationLog"("status");

-- CreateIndex
CREATE INDEX "NotificationPreference_tenantId_idx" ON "NotificationPreference"("tenantId");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_category_key" ON "NotificationPreference"("userId", "category");

-- CreateIndex
CREATE INDEX "NotificationTemplate_tenantId_idx" ON "NotificationTemplate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_tenantId_triggerEvent_type_key" ON "NotificationTemplate"("tenantId", "triggerEvent", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_tenantId_idx" ON "Order"("tenantId");

-- CreateIndex
CREATE INDEX "Order_propertyId_idx" ON "Order"("propertyId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_roomNumber_idx" ON "Order"("roomNumber");

-- CreateIndex
CREATE INDEX "OrderCategory_propertyId_idx" ON "OrderCategory"("propertyId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "ParkingSlot_tenantId_idx" ON "ParkingSlot"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingSlot_tenantId_number_key" ON "ParkingSlot"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

-- CreateIndex
CREATE INDEX "Payment_folioId_idx" ON "Payment"("folioId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_tenantId_status_idx" ON "Payment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Payment_gateway_idx" ON "Payment"("gateway");

-- CreateIndex
CREATE INDEX "Payment_gatewayRef_idx" ON "Payment"("gatewayRef");

-- CreateIndex
CREATE INDEX "PaymentGateway_tenantId_idx" ON "PaymentGateway"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentGateway_status_idx" ON "PaymentGateway"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentGateway_tenantId_provider_key" ON "PaymentGateway"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "PaymentSchedule_tenantId_idx" ON "PaymentSchedule"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentSchedule_propertyId_idx" ON "PaymentSchedule"("propertyId");

-- CreateIndex
CREATE INDEX "PaymentSchedule_folioId_idx" ON "PaymentSchedule"("folioId");

-- CreateIndex
CREATE INDEX "PaymentSchedule_bookingId_idx" ON "PaymentSchedule"("bookingId");

-- CreateIndex
CREATE INDEX "PaymentSchedule_status_idx" ON "PaymentSchedule"("status");

-- CreateIndex
CREATE INDEX "PortalAuthentication_tenantId_idx" ON "PortalAuthentication"("tenantId");

-- CreateIndex
CREATE INDEX "PortalAuthentication_propertyId_idx" ON "PortalAuthentication"("propertyId");

-- CreateIndex
CREATE INDEX "PortalAuthentication_portalId_idx" ON "PortalAuthentication"("portalId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalAuthentication_portalId_method_key" ON "PortalAuthentication"("portalId", "method");

-- CreateIndex
CREATE INDEX "PortalMapping_tenantId_idx" ON "PortalMapping"("tenantId");

-- CreateIndex
CREATE INDEX "PortalMapping_propertyId_idx" ON "PortalMapping"("propertyId");

-- CreateIndex
CREATE INDEX "PortalMapping_portalId_idx" ON "PortalMapping"("portalId");

-- CreateIndex
CREATE INDEX "PortalMapping_ssid_idx" ON "PortalMapping"("ssid");

-- CreateIndex
CREATE INDEX "PortalMapping_enabled_idx" ON "PortalMapping"("enabled");

-- CreateIndex
CREATE INDEX "PortalPage_tenantId_idx" ON "PortalPage"("tenantId");

-- CreateIndex
CREATE INDEX "PortalPage_portalId_idx" ON "PortalPage"("portalId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalPage_portalId_language_key" ON "PortalPage"("portalId", "language");

-- CreateIndex
CREATE INDEX "PortalTemplate_tenantId_idx" ON "PortalTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "PortalTemplate_category_idx" ON "PortalTemplate"("category");

-- CreateIndex
CREATE INDEX "PortalWhitelist_propertyId_idx" ON "PortalWhitelist"("propertyId");

-- CreateIndex
CREATE INDEX "PortalWhitelist_domain_idx" ON "PortalWhitelist"("domain");

-- CreateIndex
CREATE INDEX "PortalWhitelist_status_idx" ON "PortalWhitelist"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PortalWhitelist_propertyId_domain_path_key" ON "PortalWhitelist"("propertyId", "domain", "path");

-- CreateIndex
CREATE INDEX "PortForwardRule_tenantId_idx" ON "PortForwardRule"("tenantId");

-- CreateIndex
CREATE INDEX "PortForwardRule_propertyId_idx" ON "PortForwardRule"("propertyId");

-- CreateIndex
CREATE INDEX "PortForwardRule_enabled_idx" ON "PortForwardRule"("enabled");

-- CreateIndex
CREATE INDEX "QuickBlock_tenantId_idx" ON "QuickBlock"("tenantId");

-- CreateIndex
CREATE INDEX "QuickBlock_propertyId_idx" ON "QuickBlock"("propertyId");

-- CreateIndex
CREATE INDEX "QuickBlock_type_idx" ON "QuickBlock"("type");

-- CreateIndex
CREATE INDEX "QuickBlock_enabled_idx" ON "QuickBlock"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "QuickBlock_propertyId_type_value_key" ON "QuickBlock"("propertyId", "type", "value");

-- CreateIndex
CREATE INDEX "RateLimitRule_tenantId_idx" ON "RateLimitRule"("tenantId");

-- CreateIndex
CREATE INDEX "RateLimitRule_propertyId_idx" ON "RateLimitRule"("propertyId");

-- CreateIndex
CREATE INDEX "RateLimitRule_enabled_idx" ON "RateLimitRule"("enabled");

-- CreateIndex
CREATE INDEX "PreventiveMaintenance_tenantId_idx" ON "PreventiveMaintenance"("tenantId");

-- CreateIndex
CREATE INDEX "PreventiveMaintenance_propertyId_idx" ON "PreventiveMaintenance"("propertyId");

-- CreateIndex
CREATE INDEX "PreventiveMaintenance_assetId_idx" ON "PreventiveMaintenance"("assetId");

-- CreateIndex
CREATE INDEX "PreventiveMaintenance_nextDueAt_idx" ON "PreventiveMaintenance"("nextDueAt");

-- CreateIndex
CREATE INDEX "PreventiveMaintenance_status_idx" ON "PreventiveMaintenance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PriceOverride_ratePlanId_date_key" ON "PriceOverride"("ratePlanId", "date");

-- CreateIndex
CREATE INDEX "PricingRule_tenantId_idx" ON "PricingRule"("tenantId");

-- CreateIndex
CREATE INDEX "PricingRule_propertyId_idx" ON "PricingRule"("propertyId");

-- CreateIndex
CREATE INDEX "PricingRule_type_idx" ON "PricingRule"("type");

-- CreateIndex
CREATE INDEX "PricingRule_isActive_idx" ON "PricingRule"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_tenantId_idx" ON "Promotion"("tenantId");

-- CreateIndex
CREATE INDEX "Promotion_code_idx" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "Property_tenantId_idx" ON "Property"("tenantId");

-- CreateIndex
CREATE INDEX "Property_brandId_idx" ON "Property"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_tenantId_slug_key" ON "Property"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "RoomVlan_tenantId_idx" ON "RoomVlan"("tenantId");

-- CreateIndex
CREATE INDEX "RoomVlan_propertyId_idx" ON "RoomVlan"("propertyId");

-- CreateIndex
CREATE INDEX "RoomVlan_vlanId_idx" ON "RoomVlan"("vlanId");

-- CreateIndex
CREATE INDEX "RoomVlan_status_idx" ON "RoomVlan"("status");

-- CreateIndex
CREATE INDEX "RoomVlan_floor_idx" ON "RoomVlan"("floor");

-- CreateIndex
CREATE INDEX "RoomVlan_parentInterfaceId_idx" ON "RoomVlan"("parentInterfaceId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomVlan_propertyId_roomNumber_key" ON "RoomVlan"("propertyId", "roomNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RoomVlan_propertyId_vlanId_key" ON "RoomVlan"("propertyId", "vlanId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_orderNumber_key" ON "PurchaseOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_tenantId_idx" ON "PurchaseOrder"("tenantId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "radacct_acctuniqueid_key" ON "radacct"("acctuniqueid");

-- CreateIndex
CREATE INDEX "radacct_active_session_idx" ON "radacct"("acctuniqueid");

-- CreateIndex
CREATE INDEX "radacct_bulk_close" ON "radacct"("nasipaddress", "acctstarttime");

-- CreateIndex
CREATE INDEX "radacct_start_user_idx" ON "radacct"("acctstarttime", "username");

-- CreateIndex
CREATE INDEX "radcheck_username_idx" ON "radcheck"("username");

-- CreateIndex
CREATE INDEX "radcheck_attribute_idx" ON "radcheck"("attribute");

-- CreateIndex
CREATE INDEX "radgroupcheck_groupname_idx" ON "radgroupcheck"("groupname");

-- CreateIndex
CREATE INDEX "radgroupreply_groupname_idx" ON "radgroupreply"("groupname");

-- CreateIndex
CREATE INDEX "RadiusAuthLog_propertyId_idx" ON "RadiusAuthLog"("propertyId");

-- CreateIndex
CREATE INDEX "RadiusAuthLog_username_idx" ON "RadiusAuthLog"("username");

-- CreateIndex
CREATE INDEX "RadiusAuthLog_authResult_idx" ON "RadiusAuthLog"("authResult");

-- CreateIndex
CREATE INDEX "RadiusAuthLog_timestamp_idx" ON "RadiusAuthLog"("timestamp");

-- CreateIndex
CREATE INDEX "RadiusAuthLog_callingStationId_idx" ON "RadiusAuthLog"("callingStationId");

-- CreateIndex
CREATE INDEX "RadiusCoaLog_propertyId_idx" ON "RadiusCoaLog"("propertyId");

-- CreateIndex
CREATE INDEX "RadiusCoaLog_action_idx" ON "RadiusCoaLog"("action");

-- CreateIndex
CREATE INDEX "RadiusCoaLog_username_idx" ON "RadiusCoaLog"("username");

-- CreateIndex
CREATE INDEX "RadiusCoaLog_result_idx" ON "RadiusCoaLog"("result");

-- CreateIndex
CREATE INDEX "RadiusCoaLog_timestamp_idx" ON "RadiusCoaLog"("timestamp");

-- CreateIndex
CREATE INDEX "RadiusEventUser_propertyId_idx" ON "RadiusEventUser"("propertyId");

-- CreateIndex
CREATE INDEX "RadiusEventUser_eventId_idx" ON "RadiusEventUser"("eventId");

-- CreateIndex
CREATE INDEX "RadiusEventUser_status_idx" ON "RadiusEventUser"("status");

-- CreateIndex
CREATE INDEX "RadiusEventUser_validUntil_idx" ON "RadiusEventUser"("validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "RadiusEventUser_username_key" ON "RadiusEventUser"("username");

-- CreateIndex
CREATE INDEX "RadiusMacAuth_propertyId_idx" ON "RadiusMacAuth"("propertyId");

-- CreateIndex
CREATE INDEX "RadiusMacAuth_macAddress_idx" ON "RadiusMacAuth"("macAddress");

-- CreateIndex
CREATE INDEX "RadiusMacAuth_status_idx" ON "RadiusMacAuth"("status");

-- CreateIndex
CREATE INDEX "RadiusMacAuth_guestId_idx" ON "RadiusMacAuth"("guestId");

-- CreateIndex
CREATE INDEX "RadiusMacAuth_planId_idx" ON "RadiusMacAuth"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "RadiusMacAuth_propertyId_macAddress_key" ON "RadiusMacAuth"("propertyId", "macAddress");

-- CreateIndex
CREATE INDEX "RadiusNAS_tenantId_idx" ON "RadiusNAS"("tenantId");

-- CreateIndex
CREATE INDEX "RadiusNAS_propertyId_idx" ON "RadiusNAS"("propertyId");

-- CreateIndex
CREATE INDEX "RadiusNAS_status_idx" ON "RadiusNAS"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RadiusNAS_propertyId_ipAddress_key" ON "RadiusNAS"("propertyId", "ipAddress");

-- CreateIndex
CREATE UNIQUE INDEX "RadiusNAS_propertyId_shortname_key" ON "RadiusNAS"("propertyId", "shortname");

-- CreateIndex
CREATE INDEX "RadiusProvisioningLog_propertyId_idx" ON "RadiusProvisioningLog"("propertyId");

-- CreateIndex
CREATE INDEX "RadiusProvisioningLog_action_idx" ON "RadiusProvisioningLog"("action");

-- CreateIndex
CREATE INDEX "RadiusProvisioningLog_username_idx" ON "RadiusProvisioningLog"("username");

-- CreateIndex
CREATE INDEX "RadiusProvisioningLog_result_idx" ON "RadiusProvisioningLog"("result");

-- CreateIndex
CREATE INDEX "RadiusProvisioningLog_timestamp_idx" ON "RadiusProvisioningLog"("timestamp");

-- CreateIndex
CREATE INDEX "RadiusProvisioningLog_bookingId_idx" ON "RadiusProvisioningLog"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "RadiusServerConfig_propertyId_key" ON "RadiusServerConfig"("propertyId");

-- CreateIndex
CREATE INDEX "RadiusServerConfig_tenantId_idx" ON "RadiusServerConfig"("tenantId");

-- CreateIndex
CREATE INDEX "radreply_username_idx" ON "radreply"("username");

-- CreateIndex
CREATE INDEX "radreply_attribute_idx" ON "radreply"("attribute");

-- CreateIndex
CREATE INDEX "radusergroup_username_idx" ON "radusergroup"("username");

-- CreateIndex
CREATE INDEX "radusergroup_groupname_idx" ON "radusergroup"("groupname");

-- CreateIndex
CREATE INDEX "nas_nasname_idx" ON "nas"("nasname");

-- CreateIndex
CREATE INDEX "RatePlan_tenantId_idx" ON "RatePlan"("tenantId");

-- CreateIndex
CREATE INDEX "RatePlan_roomTypeId_idx" ON "RatePlan"("roomTypeId");

-- CreateIndex
CREATE INDEX "RatePlan_derivedFromId_idx" ON "RatePlan"("derivedFromId");

-- CreateIndex
CREATE UNIQUE INDEX "RatePlan_tenantId_roomTypeId_code_key" ON "RatePlan"("tenantId", "roomTypeId", "code");

-- CreateIndex
CREATE INDEX "Reconciliation_tenantId_idx" ON "Reconciliation"("tenantId");

-- CreateIndex
CREATE INDEX "Reconciliation_bankAccountId_idx" ON "Reconciliation"("bankAccountId");

-- CreateIndex
CREATE INDEX "Reconciliation_bankTransactionId_idx" ON "Reconciliation"("bankTransactionId");

-- CreateIndex
CREATE INDEX "Reconciliation_paymentId_idx" ON "Reconciliation"("paymentId");

-- CreateIndex
CREATE INDEX "Reconciliation_status_idx" ON "Reconciliation"("status");

-- CreateIndex
CREATE INDEX "Reconciliation_reconciledAt_idx" ON "Reconciliation"("reconciledAt");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationCard_cardNumber_key" ON "RegistrationCard"("cardNumber");

-- CreateIndex
CREATE INDEX "RegistrationCard_tenantId_idx" ON "RegistrationCard"("tenantId");

-- CreateIndex
CREATE INDEX "RegistrationCard_propertyId_idx" ON "RegistrationCard"("propertyId");

-- CreateIndex
CREATE INDEX "RegistrationCard_bookingId_idx" ON "RegistrationCard"("bookingId");

-- CreateIndex
CREATE INDEX "RegistrationCard_guestId_idx" ON "RegistrationCard"("guestId");

-- CreateIndex
CREATE INDEX "RegistrationCard_cardNumber_idx" ON "RegistrationCard"("cardNumber");

-- CreateIndex
CREATE INDEX "ReportCache_tenantId_idx" ON "ReportCache"("tenantId");

-- CreateIndex
CREATE INDEX "ReportCache_expiresAt_idx" ON "ReportCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCache_tenantId_reportType_periodStart_periodEnd_key" ON "ReportCache"("tenantId", "reportType", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "ReportHistory_tenantId_idx" ON "ReportHistory"("tenantId");

-- CreateIndex
CREATE INDEX "ReportHistory_type_idx" ON "ReportHistory"("type");

-- CreateIndex
CREATE INDEX "ReportHistory_generatedAt_idx" ON "ReportHistory"("generatedAt");

-- CreateIndex
CREATE INDEX "Reservation_propertyId_idx" ON "Reservation"("propertyId");

-- CreateIndex
CREATE INDEX "Reservation_date_idx" ON "Reservation"("date");

-- CreateIndex
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");

-- CreateIndex
CREATE INDEX "Reservation_tableId_idx" ON "Reservation"("tableId");

-- CreateIndex
CREATE INDEX "RestaurantTable_propertyId_idx" ON "RestaurantTable"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTable_propertyId_number_key" ON "RestaurantTable"("propertyId", "number");

-- CreateIndex
CREATE INDEX "Role_tenantId_idx" ON "Role"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_name_key" ON "Role"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Room_currentTaskId_key" ON "Room"("currentTaskId");

-- CreateIndex
CREATE INDEX "Room_propertyId_idx" ON "Room"("propertyId");

-- CreateIndex
CREATE INDEX "Room_roomTypeId_idx" ON "Room"("roomTypeId");

-- CreateIndex
CREATE INDEX "Room_status_idx" ON "Room"("status");

-- CreateIndex
CREATE INDEX "Room_housekeepingStatus_idx" ON "Room"("housekeepingStatus");

-- CreateIndex
CREATE INDEX "Room_propertyId_status_idx" ON "Room"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Room_currentTaskId_idx" ON "Room"("currentTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_propertyId_number_key" ON "Room"("propertyId", "number");

-- CreateIndex
CREATE INDEX "RoomMoveLog_tenantId_idx" ON "RoomMoveLog"("tenantId");

-- CreateIndex
CREATE INDEX "RoomMoveLog_propertyId_idx" ON "RoomMoveLog"("propertyId");

-- CreateIndex
CREATE INDEX "RoomMoveLog_bookingId_idx" ON "RoomMoveLog"("bookingId");

-- CreateIndex
CREATE INDEX "RoomMoveLog_guestId_idx" ON "RoomMoveLog"("guestId");

-- CreateIndex
CREATE INDEX "RoomMoveLog_createdAt_idx" ON "RoomMoveLog"("createdAt");

-- CreateIndex
CREATE INDEX "RoomType_propertyId_idx" ON "RoomType"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_propertyId_code_key" ON "RoomType"("propertyId", "code");

-- CreateIndex
CREATE INDEX "ScheduleAccess_tenantId_idx" ON "ScheduleAccess"("tenantId");

-- CreateIndex
CREATE INDEX "ScheduleAccess_propertyId_idx" ON "ScheduleAccess"("propertyId");

-- CreateIndex
CREATE INDEX "ScheduleAccess_enabled_idx" ON "ScheduleAccess"("enabled");

-- CreateIndex
CREATE INDEX "ScheduledNotification_tenantId_idx" ON "ScheduledNotification"("tenantId");

-- CreateIndex
CREATE INDEX "ScheduledNotification_recipientId_idx" ON "ScheduledNotification"("recipientId");

-- CreateIndex
CREATE INDEX "ScheduledNotification_status_idx" ON "ScheduledNotification"("status");

-- CreateIndex
CREATE INDEX "ScheduledNotification_scheduledFor_idx" ON "ScheduledNotification"("scheduledFor");

-- CreateIndex
CREATE INDEX "ScheduledNotification_nextRetryAt_idx" ON "ScheduledNotification"("nextRetryAt");

-- CreateIndex
CREATE INDEX "ScheduledReport_tenantId_idx" ON "ScheduledReport"("tenantId");

-- CreateIndex
CREATE INDEX "SecurityEvent_tenantId_idx" ON "SecurityEvent"("tenantId");

-- CreateIndex
CREATE INDEX "SecurityEvent_cameraId_idx" ON "SecurityEvent"("cameraId");

-- CreateIndex
CREATE INDEX "SecurityEvent_severity_idx" ON "SecurityEvent"("severity");

-- CreateIndex
CREATE INDEX "SecurityEvent_timestamp_idx" ON "SecurityEvent"("timestamp");

-- CreateIndex
CREATE INDEX "SecurityEvent_acknowledged_idx" ON "SecurityEvent"("acknowledged");

-- CreateIndex
CREATE INDEX "SecurityIncident_tenantId_idx" ON "SecurityIncident"("tenantId");

-- CreateIndex
CREATE INDEX "SecurityIncident_status_idx" ON "SecurityIncident"("status");

-- CreateIndex
CREATE INDEX "SecurityIncident_severity_idx" ON "SecurityIncident"("severity");

-- CreateIndex
CREATE INDEX "SecurityIncident_incidentDate_idx" ON "SecurityIncident"("incidentDate");

-- CreateIndex
CREATE INDEX "SecuritySettings_tenantId_idx" ON "SecuritySettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SecuritySettings_tenantId_key" ON "SecuritySettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SegmentMembership_segmentId_guestId_key" ON "SegmentMembership"("segmentId", "guestId");

-- CreateIndex
CREATE INDEX "ServiceRequest_tenantId_idx" ON "ServiceRequest"("tenantId");

-- CreateIndex
CREATE INDEX "ServiceRequest_propertyId_idx" ON "ServiceRequest"("propertyId");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_idx" ON "ServiceRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshToken_key" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "ShiftTemplate_tenantId_idx" ON "ShiftTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "SSOConnection_tenantId_idx" ON "SSOConnection"("tenantId");

-- CreateIndex
CREATE INDEX "SSOConnection_type_idx" ON "SSOConnection"("type");

-- CreateIndex
CREATE INDEX "SSOConnection_status_idx" ON "SSOConnection"("status");

-- CreateIndex
CREATE INDEX "SSOSession_connectionId_idx" ON "SSOSession"("connectionId");

-- CreateIndex
CREATE INDEX "SSOSession_userId_idx" ON "SSOSession"("userId");

-- CreateIndex
CREATE INDEX "SSOSession_ssoProviderId_idx" ON "SSOSession"("ssoProviderId");

-- CreateIndex
CREATE INDEX "SSOSession_sessionId_idx" ON "SSOSession"("sessionId");

-- CreateIndex
CREATE INDEX "SSOSession_expiresAt_idx" ON "SSOSession"("expiresAt");

-- CreateIndex
CREATE INDEX "StaffAttendance_tenantId_idx" ON "StaffAttendance"("tenantId");

-- CreateIndex
CREATE INDEX "StaffAttendance_date_idx" ON "StaffAttendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_userId_date_key" ON "StaffAttendance"("userId", "date");

-- CreateIndex
CREATE INDEX "StaffChannel_tenantId_idx" ON "StaffChannel"("tenantId");

-- CreateIndex
CREATE INDEX "StaffChannel_type_idx" ON "StaffChannel"("type");

-- CreateIndex
CREATE INDEX "StaffChannel_department_idx" ON "StaffChannel"("department");

-- CreateIndex
CREATE INDEX "StaffChannelMember_channelId_idx" ON "StaffChannelMember"("channelId");

-- CreateIndex
CREATE INDEX "StaffChannelMember_userId_idx" ON "StaffChannelMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffChannelMember_channelId_userId_key" ON "StaffChannelMember"("channelId", "userId");

-- CreateIndex
CREATE INDEX "StaffChatMessage_channelId_idx" ON "StaffChatMessage"("channelId");

-- CreateIndex
CREATE INDEX "StaffChatMessage_senderId_idx" ON "StaffChatMessage"("senderId");

-- CreateIndex
CREATE INDEX "StaffChatMessage_sentAt_idx" ON "StaffChatMessage"("sentAt");

-- CreateIndex
CREATE INDEX "StaffLeave_tenantId_idx" ON "StaffLeave"("tenantId");

-- CreateIndex
CREATE INDEX "StaffLeave_userId_idx" ON "StaffLeave"("userId");

-- CreateIndex
CREATE INDEX "StaffLeave_status_idx" ON "StaffLeave"("status");

-- CreateIndex
CREATE INDEX "StaffLeave_startDate_idx" ON "StaffLeave"("startDate");

-- CreateIndex
CREATE INDEX "StaffPerformance_tenantId_idx" ON "StaffPerformance"("tenantId");

-- CreateIndex
CREATE INDEX "StaffPerformance_userId_idx" ON "StaffPerformance"("userId");

-- CreateIndex
CREATE INDEX "StaffPerformance_reviewYear_idx" ON "StaffPerformance"("reviewYear");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPerformance_userId_reviewPeriod_reviewYear_key" ON "StaffPerformance"("userId", "reviewPeriod", "reviewYear");

-- CreateIndex
CREATE INDEX "StaffSchedule_tenantId_idx" ON "StaffSchedule"("tenantId");

-- CreateIndex
CREATE INDEX "StaffSchedule_userId_idx" ON "StaffSchedule"("userId");

-- CreateIndex
CREATE INDEX "StaffSchedule_date_idx" ON "StaffSchedule"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffSchedule_userId_date_key" ON "StaffSchedule"("userId", "date");

-- CreateIndex
CREATE INDEX "StaffShift_tenantId_idx" ON "StaffShift"("tenantId");

-- CreateIndex
CREATE INDEX "StaffShift_userId_idx" ON "StaffShift"("userId");

-- CreateIndex
CREATE INDEX "StaffShift_date_idx" ON "StaffShift"("date");

-- CreateIndex
CREATE INDEX "StaffSkill_tenantId_idx" ON "StaffSkill"("tenantId");

-- CreateIndex
CREATE INDEX "StaffSkill_userId_idx" ON "StaffSkill"("userId");

-- CreateIndex
CREATE INDEX "StaffSkill_category_idx" ON "StaffSkill"("category");

-- CreateIndex
CREATE UNIQUE INDEX "StaffSkill_userId_skillName_key" ON "StaffSkill"("userId", "skillName");

-- CreateIndex
CREATE INDEX "StaffWorkload_tenantId_idx" ON "StaffWorkload"("tenantId");

-- CreateIndex
CREATE INDEX "StaffWorkload_userId_idx" ON "StaffWorkload"("userId");

-- CreateIndex
CREATE INDEX "StaffWorkload_date_idx" ON "StaffWorkload"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffWorkload_userId_date_key" ON "StaffWorkload"("userId", "date");

-- CreateIndex
CREATE INDEX "StaticRoute_tenantId_idx" ON "StaticRoute"("tenantId");

-- CreateIndex
CREATE INDEX "StaticRoute_propertyId_idx" ON "StaticRoute"("propertyId");

-- CreateIndex
CREATE INDEX "StaticRoute_enabled_idx" ON "StaticRoute"("enabled");

-- CreateIndex
CREATE INDEX "StaticRoute_isDefault_idx" ON "StaticRoute"("isDefault");

-- CreateIndex
CREATE INDEX "StockConsumption_stockItemId_idx" ON "StockConsumption"("stockItemId");

-- CreateIndex
CREATE INDEX "StockItem_tenantId_idx" ON "StockItem"("tenantId");

-- CreateIndex
CREATE INDEX "StockItem_expiryDate_idx" ON "StockItem"("expiryDate");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionInvoice_invoiceNumber_key" ON "SubscriptionInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_subscriptionId_idx" ON "SubscriptionInvoice"("subscriptionId");

-- CreateIndex
CREATE INDEX "SyslogServer_tenantId_idx" ON "SyslogServer"("tenantId");

-- CreateIndex
CREATE INDEX "SyslogServer_propertyId_idx" ON "SyslogServer"("propertyId");

-- CreateIndex
CREATE INDEX "SyslogServer_enabled_idx" ON "SyslogServer"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "SystemNetworkHealth_propertyId_key" ON "SystemNetworkHealth"("propertyId");

-- CreateIndex
CREATE INDEX "SystemNetworkHealth_tenantId_idx" ON "SystemNetworkHealth"("tenantId");

-- CreateIndex
CREATE INDEX "Task_tenantId_idx" ON "Task"("tenantId");

-- CreateIndex
CREATE INDEX "Task_propertyId_idx" ON "Task"("propertyId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_assignedTo_idx" ON "Task"("assignedTo");

-- CreateIndex
CREATE INDEX "Task_roomId_idx" ON "Task"("roomId");

-- CreateIndex
CREATE INDEX "Task_propertyId_status_idx" ON "Task"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Task_tenantId_propertyId_status_idx" ON "Task"("tenantId", "propertyId", "status");

-- CreateIndex
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- CreateIndex
CREATE INDEX "TaskAssignmentSuggestion_tenantId_idx" ON "TaskAssignmentSuggestion"("tenantId");

-- CreateIndex
CREATE INDEX "TaskAssignmentSuggestion_taskId_idx" ON "TaskAssignmentSuggestion"("taskId");

-- CreateIndex
CREATE INDEX "TaskAssignmentSuggestion_suggestedUserId_idx" ON "TaskAssignmentSuggestion"("suggestedUserId");

-- CreateIndex
CREATE INDEX "TaskAssignmentSuggestion_status_idx" ON "TaskAssignmentSuggestion"("status");

-- CreateIndex
CREATE INDEX "TaskAssignmentSuggestion_expiresAt_idx" ON "TaskAssignmentSuggestion"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaxReport_reportNumber_key" ON "TaxReport"("reportNumber");

-- CreateIndex
CREATE INDEX "TaxReport_tenantId_idx" ON "TaxReport"("tenantId");

-- CreateIndex
CREATE INDEX "TaxReport_propertyId_idx" ON "TaxReport"("propertyId");

-- CreateIndex
CREATE INDEX "TaxReport_reportType_idx" ON "TaxReport"("reportType");

-- CreateIndex
CREATE INDEX "TaxReport_jurisdiction_idx" ON "TaxReport"("jurisdiction");

-- CreateIndex
CREATE INDEX "TaxReport_periodStart_periodEnd_idx" ON "TaxReport"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "TaxReport_status_idx" ON "TaxReport"("status");

-- CreateIndex
CREATE INDEX "TaxReport_filingDueDate_idx" ON "TaxReport"("filingDueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Experience_tenantId_idx" ON "Experience"("tenantId");

-- CreateIndex
CREATE INDEX "Experience_status_idx" ON "Experience"("status");

-- CreateIndex
CREATE INDEX "Experience_categoryId_idx" ON "Experience"("categoryId");

-- CreateIndex
CREATE INDEX "ExperienceBooking_tenantId_idx" ON "ExperienceBooking"("tenantId");

-- CreateIndex
CREATE INDEX "ExperienceBooking_experienceId_idx" ON "ExperienceBooking"("experienceId");

-- CreateIndex
CREATE INDEX "ExperienceBooking_status_idx" ON "ExperienceBooking"("status");

-- CreateIndex
CREATE INDEX "ExperienceBooking_bookingDate_idx" ON "ExperienceBooking"("bookingDate");

-- CreateIndex
CREATE INDEX "ExperiencePricing_tenantId_idx" ON "ExperiencePricing"("tenantId");

-- CreateIndex
CREATE INDEX "ExperiencePricing_experienceId_idx" ON "ExperiencePricing"("experienceId");

-- CreateIndex
CREATE INDEX "ExperiencePricing_type_idx" ON "ExperiencePricing"("type");

-- CreateIndex
CREATE INDEX "ExperienceVendor_tenantId_idx" ON "ExperienceVendor"("tenantId");

-- CreateIndex
CREATE INDEX "ExperienceVendor_status_idx" ON "ExperienceVendor"("status");

-- CreateIndex
CREATE INDEX "ExperienceFeedback_tenantId_idx" ON "ExperienceFeedback"("tenantId");

-- CreateIndex
CREATE INDEX "ExperienceFeedback_experienceId_idx" ON "ExperienceFeedback"("experienceId");

-- CreateIndex
CREATE INDEX "ExperienceFeedback_rating_idx" ON "ExperienceFeedback"("rating");

-- CreateIndex
CREATE INDEX "ChatAttachment_tenantId_idx" ON "ChatAttachment"("tenantId");

-- CreateIndex
CREATE INDEX "ChatAttachment_conversationId_idx" ON "ChatAttachment"("conversationId");

-- CreateIndex
CREATE INDEX "ChatTransfer_tenantId_idx" ON "ChatTransfer"("tenantId");

-- CreateIndex
CREATE INDEX "ChatTransfer_conversationId_idx" ON "ChatTransfer"("conversationId");

-- CreateIndex
CREATE INDEX "UsageLog_tenantId_idx" ON "UsageLog"("tenantId");

-- CreateIndex
CREATE INDEX "UsageLog_type_idx" ON "UsageLog"("type");

-- CreateIndex
CREATE INDEX "UsageLog_createdAt_idx" ON "UsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "UsageLog_tenantId_type_createdAt_idx" ON "UsageLog"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UsageSummary_tenantId_key" ON "UsageSummary"("tenantId");

-- CreateIndex
CREATE INDEX "UsageSummary_tenantId_idx" ON "UsageSummary"("tenantId");

-- CreateIndex
CREATE INDEX "UsageSummary_lastResetAt_idx" ON "UsageSummary"("lastResetAt");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "UserFcmToken_token_key" ON "UserFcmToken"("token");

-- CreateIndex
CREATE INDEX "UserFcmToken_tenantId_idx" ON "UserFcmToken"("tenantId");

-- CreateIndex
CREATE INDEX "UserFcmToken_userId_idx" ON "UserFcmToken"("userId");

-- CreateIndex
CREATE INDEX "UserFcmToken_token_idx" ON "UserFcmToken"("token");

-- CreateIndex
CREATE INDEX "UserFcmToken_isActive_idx" ON "UserFcmToken"("isActive");

-- CreateIndex
CREATE INDEX "UserTutorial_tenantId_idx" ON "UserTutorial"("tenantId");

-- CreateIndex
CREATE INDEX "UserTutorial_userId_idx" ON "UserTutorial"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTutorial_userId_tutorialKey_key" ON "UserTutorial"("userId", "tutorialKey");

-- CreateIndex
CREATE INDEX "Vehicle_tenantId_idx" ON "Vehicle"("tenantId");

-- CreateIndex
CREATE INDEX "Vehicle_licensePlate_idx" ON "Vehicle"("licensePlate");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_portalEmail_key" ON "Vendor"("portalEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_portalToken_key" ON "Vendor"("portalToken");

-- CreateIndex
CREATE INDEX "Vendor_tenantId_idx" ON "Vendor"("tenantId");

-- CreateIndex
CREATE INDEX "Vendor_type_idx" ON "Vendor"("type");

-- CreateIndex
CREATE INDEX "Vendor_status_idx" ON "Vendor"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPayment_paymentNumber_key" ON "VendorPayment"("paymentNumber");

-- CreateIndex
CREATE INDEX "VendorPayment_tenantId_idx" ON "VendorPayment"("tenantId");

-- CreateIndex
CREATE INDEX "VendorPayment_vendorId_idx" ON "VendorPayment"("vendorId");

-- CreateIndex
CREATE INDEX "VendorPayment_workOrderId_idx" ON "VendorPayment"("workOrderId");

-- CreateIndex
CREATE INDEX "VendorPayment_status_idx" ON "VendorPayment"("status");

-- CreateIndex
CREATE INDEX "VendorPayment_dueDate_idx" ON "VendorPayment"("dueDate");

-- CreateIndex
CREATE INDEX "VlanConfig_tenantId_idx" ON "VlanConfig"("tenantId");

-- CreateIndex
CREATE INDEX "VlanConfig_propertyId_idx" ON "VlanConfig"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "VlanConfig_propertyId_vlanId_key" ON "VlanConfig"("propertyId", "vlanId");

-- CreateIndex
CREATE UNIQUE INDEX "VlanConfig_propertyId_subInterface_key" ON "VlanConfig"("propertyId", "subInterface");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_bookingId_key" ON "WaitlistEntry"("bookingId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_tenantId_idx" ON "WaitlistEntry"("tenantId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_propertyId_idx" ON "WaitlistEntry"("propertyId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_status_idx" ON "WaitlistEntry"("status");

-- CreateIndex
CREATE INDEX "WanFailover_tenantId_idx" ON "WanFailover"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "WanFailover_propertyId_key" ON "WanFailover"("propertyId");

-- CreateIndex
CREATE INDEX "WebCategory_propertyId_idx" ON "WebCategory"("propertyId");

-- CreateIndex
CREATE INDEX "WebCategory_tenantId_idx" ON "WebCategory"("tenantId");

-- CreateIndex
CREATE INDEX "WebCategory_categoryType_idx" ON "WebCategory"("categoryType");

-- CreateIndex
CREATE INDEX "WebCategory_enabled_idx" ON "WebCategory"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "WebCategory_propertyId_name_key" ON "WebCategory"("propertyId", "name");

-- CreateIndex
CREATE INDEX "WebCategorySchedule_propertyId_idx" ON "WebCategorySchedule"("propertyId");

-- CreateIndex
CREATE INDEX "WebCategorySchedule_tenantId_idx" ON "WebCategorySchedule"("tenantId");

-- CreateIndex
CREATE INDEX "WebCategorySchedule_webCategoryId_idx" ON "WebCategorySchedule"("webCategoryId");

-- CreateIndex
CREATE INDEX "WebCategorySchedule_scheduleAccessId_idx" ON "WebCategorySchedule"("scheduleAccessId");

-- CreateIndex
CREATE INDEX "WebhookDeliveryLog_endpointId_idx" ON "WebhookDeliveryLog"("endpointId");

-- CreateIndex
CREATE INDEX "WebhookDeliveryLog_status_idx" ON "WebhookDeliveryLog"("status");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_tenantId_idx" ON "WebhookEndpoint"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "WiFiAAAConfig_propertyId_key" ON "WiFiAAAConfig"("propertyId");

-- CreateIndex
CREATE INDEX "WiFiAAAConfig_tenantId_idx" ON "WiFiAAAConfig"("tenantId");

-- CreateIndex
CREATE INDEX "WiFiGateway_tenantId_idx" ON "WiFiGateway"("tenantId");

-- CreateIndex
CREATE INDEX "WiFiGateway_propertyId_idx" ON "WiFiGateway"("propertyId");

-- CreateIndex
CREATE INDEX "WiFiGateway_vendor_idx" ON "WiFiGateway"("vendor");

-- CreateIndex
CREATE INDEX "WiFiGateway_status_idx" ON "WiFiGateway"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WiFiGateway_propertyId_ipAddress_key" ON "WiFiGateway"("propertyId", "ipAddress");

-- CreateIndex
CREATE INDEX "IpPool_tenantId_idx" ON "IpPool"("tenantId");

-- CreateIndex
CREATE INDEX "IpPool_propertyId_idx" ON "IpPool"("propertyId");

-- CreateIndex
CREATE INDEX "IpPool_isDefault_idx" ON "IpPool"("isDefault");

-- CreateIndex
CREATE INDEX "IpPool_captivePortal_idx" ON "IpPool"("captivePortal");

-- CreateIndex
CREATE UNIQUE INDEX "IpPool_tenantId_name_key" ON "IpPool"("tenantId", "name");

-- CreateIndex
CREATE INDEX "IpPoolRange_poolId_idx" ON "IpPoolRange"("poolId");

-- CreateIndex
CREATE INDEX "WiFiPlan_tenantId_idx" ON "WiFiPlan"("tenantId");

-- CreateIndex
CREATE INDEX "WiFiPlan_ipPoolId_idx" ON "WiFiPlan"("ipPoolId");

-- CreateIndex
CREATE INDEX "WiFiSession_tenantId_idx" ON "WiFiSession"("tenantId");

-- CreateIndex
CREATE INDEX "WiFiSession_macAddress_idx" ON "WiFiSession"("macAddress");

-- CreateIndex
CREATE INDEX "WiFiSession_guestId_idx" ON "WiFiSession"("guestId");

-- CreateIndex
CREATE INDEX "WiFiSession_username_idx" ON "WiFiSession"("username");

-- CreateIndex
CREATE INDEX "WiFiSession_acctUniqueId_idx" ON "WiFiSession"("acctUniqueId");

-- CreateIndex
CREATE UNIQUE INDEX "WiFiUser_username_key" ON "WiFiUser"("username");

-- CreateIndex
CREATE INDEX "WiFiUser_tenantId_idx" ON "WiFiUser"("tenantId");

-- CreateIndex
CREATE INDEX "WiFiUser_propertyId_idx" ON "WiFiUser"("propertyId");

-- CreateIndex
CREATE INDEX "WiFiUser_username_idx" ON "WiFiUser"("username");

-- CreateIndex
CREATE INDEX "WiFiUser_guestId_idx" ON "WiFiUser"("guestId");

-- CreateIndex
CREATE INDEX "WiFiUser_bookingId_idx" ON "WiFiUser"("bookingId");

-- CreateIndex
CREATE INDEX "WiFiUser_status_idx" ON "WiFiUser"("status");

-- CreateIndex
CREATE INDEX "WiFiUser_ipPoolId_idx" ON "WiFiUser"("ipPoolId");

-- CreateIndex
CREATE INDEX "WiFiUserStatusHistory_propertyId_idx" ON "WiFiUserStatusHistory"("propertyId");

-- CreateIndex
CREATE INDEX "WiFiUserStatusHistory_tenantId_idx" ON "WiFiUserStatusHistory"("tenantId");

-- CreateIndex
CREATE INDEX "WiFiUserStatusHistory_username_idx" ON "WiFiUserStatusHistory"("username");

-- CreateIndex
CREATE INDEX "WiFiUserStatusHistory_userId_idx" ON "WiFiUserStatusHistory"("userId");

-- CreateIndex
CREATE INDEX "WiFiUserStatusHistory_createdAt_idx" ON "WiFiUserStatusHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WiFiVoucher_code_key" ON "WiFiVoucher"("code");

-- CreateIndex
CREATE INDEX "WiFiVoucher_tenantId_idx" ON "WiFiVoucher"("tenantId");

-- CreateIndex
CREATE INDEX "WiFiVoucher_code_idx" ON "WiFiVoucher"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_workOrderNumber_key" ON "WorkOrder"("workOrderNumber");

-- CreateIndex
CREATE INDEX "WorkOrder_tenantId_idx" ON "WorkOrder"("tenantId");

-- CreateIndex
CREATE INDEX "WorkOrder_propertyId_idx" ON "WorkOrder"("propertyId");

-- CreateIndex
CREATE INDEX "WorkOrder_vendorId_idx" ON "WorkOrder"("vendorId");

-- CreateIndex
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

-- CreateIndex
CREATE INDEX "WorkOrder_priority_idx" ON "WorkOrder"("priority");

-- CreateIndex
CREATE INDEX "WorkOrder_type_idx" ON "WorkOrder"("type");

-- CreateIndex
CREATE INDEX "WorkOrder_scheduledDate_idx" ON "WorkOrder"("scheduledDate");

-- CreateIndex
CREATE INDEX "MenuModifier_propertyId_idx" ON "MenuModifier"("propertyId");

-- CreateIndex
CREATE INDEX "MenuModifier_isAvailable_idx" ON "MenuModifier"("isAvailable");

-- CreateIndex
CREATE INDEX "MenuModifierOption_propertyId_idx" ON "MenuModifierOption"("propertyId");

-- CreateIndex
CREATE INDEX "MenuModifierOption_modifierGroupId_idx" ON "MenuModifierOption"("modifierGroupId");

-- CreateIndex
CREATE INDEX "MenuVariant_propertyId_idx" ON "MenuVariant"("propertyId");

-- CreateIndex
CREATE INDEX "MenuVariant_menuItemId_idx" ON "MenuVariant"("menuItemId");

-- CreateIndex
CREATE INDEX "InventoryItem_propertyId_idx" ON "InventoryItem"("propertyId");

-- CreateIndex
CREATE INDEX "InventoryItem_status_idx" ON "InventoryItem"("status");

-- CreateIndex
CREATE INDEX "InventoryMovement_propertyId_idx" ON "InventoryMovement"("propertyId");

-- CreateIndex
CREATE INDEX "InventoryMovement_inventoryItemId_idx" ON "InventoryMovement"("inventoryItemId");

-- CreateIndex
CREATE INDEX "Recipe_tenantId_idx" ON "Recipe"("tenantId");

-- CreateIndex
CREATE INDEX "Recipe_menuItemId_idx" ON "Recipe"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_menuItemId_key" ON "Recipe"("menuItemId");

-- CreateIndex
CREATE INDEX "RecipeIngredient_tenantId_idx" ON "RecipeIngredient"("tenantId");

-- CreateIndex
CREATE INDEX "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");

-- CreateIndex
CREATE INDEX "TableMerge_tenantId_idx" ON "TableMerge"("tenantId");

-- CreateIndex
CREATE INDEX "TableMerge_status_idx" ON "TableMerge"("status");

-- CreateIndex
CREATE INDEX "TableMerge_propertyId_idx" ON "TableMerge"("propertyId");

-- CreateIndex
CREATE INDEX "OrderDiscount_tenantId_idx" ON "OrderDiscount"("tenantId");

-- CreateIndex
CREATE INDEX "OrderDiscount_orderId_idx" ON "OrderDiscount"("orderId");

-- CreateIndex
CREATE INDEX "PaymentToken_tenantId_idx" ON "PaymentToken"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentToken_propertyId_idx" ON "PaymentToken"("propertyId");

-- CreateIndex
CREATE INDEX "PaymentToken_guestId_idx" ON "PaymentToken"("guestId");

-- CreateIndex
CREATE INDEX "PaymentToken_folioId_idx" ON "PaymentToken"("folioId");

-- CreateIndex
CREATE INDEX "PaymentToken_status_idx" ON "PaymentToken"("status");

-- CreateIndex
CREATE INDEX "ScheduledCharge_tenantId_idx" ON "ScheduledCharge"("tenantId");

-- CreateIndex
CREATE INDEX "ScheduledCharge_propertyId_idx" ON "ScheduledCharge"("propertyId");

-- CreateIndex
CREATE INDEX "ScheduledCharge_folioId_idx" ON "ScheduledCharge"("folioId");

-- CreateIndex
CREATE INDEX "ScheduledCharge_bookingId_idx" ON "ScheduledCharge"("bookingId");

-- CreateIndex
CREATE INDEX "ScheduledCharge_isActive_idx" ON "ScheduledCharge"("isActive");

-- CreateIndex
CREATE INDEX "ScheduledCharge_nextExecutionAt_idx" ON "ScheduledCharge"("nextExecutionAt");

-- CreateIndex
CREATE INDEX "CancellationPenalty_tenantId_idx" ON "CancellationPenalty"("tenantId");

-- CreateIndex
CREATE INDEX "CancellationPenalty_bookingId_idx" ON "CancellationPenalty"("bookingId");

-- CreateIndex
CREATE INDEX "CancellationPenalty_folioId_idx" ON "CancellationPenalty"("folioId");

-- CreateIndex
CREATE INDEX "CancellationPenalty_policyId_idx" ON "CancellationPenalty"("policyId");

-- CreateIndex
CREATE INDEX "CancellationPenalty_status_idx" ON "CancellationPenalty"("status");

-- CreateIndex
CREATE UNIQUE INDEX "KeyCard_cardNumber_key" ON "KeyCard"("cardNumber");

-- CreateIndex
CREATE INDEX "KeyCard_tenantId_idx" ON "KeyCard"("tenantId");

-- CreateIndex
CREATE INDEX "KeyCard_propertyId_idx" ON "KeyCard"("propertyId");

-- CreateIndex
CREATE INDEX "KeyCard_roomId_idx" ON "KeyCard"("roomId");

-- CreateIndex
CREATE INDEX "KeyCard_guestId_idx" ON "KeyCard"("guestId");

-- CreateIndex
CREATE INDEX "KeyCard_bookingId_idx" ON "KeyCard"("bookingId");

-- CreateIndex
CREATE INDEX "KeyCard_status_idx" ON "KeyCard"("status");

-- CreateIndex
CREATE INDEX "KeyCard_cardNumber_idx" ON "KeyCard"("cardNumber");

-- CreateIndex
CREATE INDEX "KeyCard_validFrom_idx" ON "KeyCard"("validFrom");

-- CreateIndex
CREATE INDEX "KeyCard_validTo_idx" ON "KeyCard"("validTo");

-- CreateIndex
CREATE INDEX "SurveillanceConfig_tenantId_idx" ON "SurveillanceConfig"("tenantId");

-- CreateIndex
CREATE INDEX "SurveillanceConfig_propertyId_idx" ON "SurveillanceConfig"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveillanceConfig_tenantId_propertyId_configType_key" ON "SurveillanceConfig"("tenantId", "propertyId", "configType");

-- CreateIndex
CREATE INDEX "ParkingPass_tenantId_idx" ON "ParkingPass"("tenantId");

-- CreateIndex
CREATE INDEX "ParkingPass_propertyId_idx" ON "ParkingPass"("propertyId");

-- CreateIndex
CREATE INDEX "ParkingPass_status_idx" ON "ParkingPass"("status");

-- CreateIndex
CREATE INDEX "ParkingPass_endDate_idx" ON "ParkingPass"("endDate");

-- CreateIndex
CREATE INDEX "InventoryTransfer_tenantId_idx" ON "InventoryTransfer"("tenantId");

-- CreateIndex
CREATE INDEX "InventoryTransfer_fromPropertyId_idx" ON "InventoryTransfer"("fromPropertyId");

-- CreateIndex
CREATE INDEX "InventoryTransfer_toPropertyId_idx" ON "InventoryTransfer"("toPropertyId");

-- CreateIndex
CREATE INDEX "InventoryTransfer_status_idx" ON "InventoryTransfer"("status");

-- CreateIndex
CREATE INDEX "InventoryTransferItem_transferId_idx" ON "InventoryTransferItem"("transferId");

-- CreateIndex
CREATE INDEX "InventoryTransferItem_stockItemId_idx" ON "InventoryTransferItem"("stockItemId");

-- CreateIndex
CREATE INDEX "CampaignAbTest_tenantId_idx" ON "CampaignAbTest"("tenantId");

-- CreateIndex
CREATE INDEX "CampaignAbTest_campaignId_idx" ON "CampaignAbTest"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignAbTest_campaignId_variantLabel_key" ON "CampaignAbTest"("campaignId", "variantLabel");

-- CreateIndex
CREATE INDEX "CompetitorSyncLog_tenantId_idx" ON "CompetitorSyncLog"("tenantId");

-- CreateIndex
CREATE INDEX "CompetitorSyncLog_propertyId_idx" ON "CompetitorSyncLog"("propertyId");

-- CreateIndex
CREATE INDEX "CompetitorSyncLog_competitorName_idx" ON "CompetitorSyncLog"("competitorName");

-- CreateIndex
CREATE INDEX "CompetitorSyncLog_startedAt_idx" ON "CompetitorSyncLog"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationPlan_name_key" ON "RegistrationPlan"("name");

-- CreateIndex
CREATE INDEX "RegistrationPlan_isActive_idx" ON "RegistrationPlan"("isActive");

-- CreateIndex
CREATE INDEX "RegistrationPlan_sortOrder_idx" ON "RegistrationPlan"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseKey_key_key" ON "LicenseKey"("key");

-- CreateIndex
CREATE INDEX "LicenseKey_key_idx" ON "LicenseKey"("key");

-- CreateIndex
CREATE INDEX "LicenseKey_planId_idx" ON "LicenseKey"("planId");

-- CreateIndex
CREATE INDEX "LicenseKey_status_idx" ON "LicenseKey"("status");

-- CreateIndex
CREATE INDEX "LicenseKey_batchId_idx" ON "LicenseKey"("batchId");

-- CreateIndex
CREATE INDEX "LicenseKey_activatedBy_idx" ON "LicenseKey"("activatedBy");

-- CreateIndex
CREATE INDEX "LicenseKey_tenantId_idx" ON "LicenseKey"("tenantId");

-- CreateIndex
CREATE INDEX "DeviceProfile_wifiUserId_idx" ON "DeviceProfile"("wifiUserId");

-- CreateIndex
CREATE INDEX "DeviceProfile_guestId_idx" ON "DeviceProfile"("guestId");

-- CreateIndex
CREATE INDEX "DeviceProfile_macAddress_idx" ON "DeviceProfile"("macAddress");

-- CreateIndex
CREATE INDEX "DeviceProfile_tenantId_propertyId_lastSeenAt_idx" ON "DeviceProfile"("tenantId", "propertyId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "DeviceProfile_isActive_idx" ON "DeviceProfile"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceProfile_fingerprintHash_propertyId_key" ON "DeviceProfile"("fingerprintHash", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceProfile_storageToken_propertyId_key" ON "DeviceProfile"("storageToken", "propertyId");

-- CreateIndex
CREATE INDEX "NightAudit_tenantId_idx" ON "NightAudit"("tenantId");

-- CreateIndex
CREATE INDEX "NightAudit_propertyId_idx" ON "NightAudit"("propertyId");

-- CreateIndex
CREATE INDEX "NightAudit_auditDate_idx" ON "NightAudit"("auditDate");

-- CreateIndex
CREATE INDEX "NightAudit_businessDayDate_idx" ON "NightAudit"("businessDayDate");

-- CreateIndex
CREATE INDEX "NightAudit_status_idx" ON "NightAudit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NightAudit_propertyId_businessDayDate_key" ON "NightAudit"("propertyId", "businessDayDate");

-- CreateIndex
CREATE INDEX "NightAuditStep_nightAuditId_idx" ON "NightAuditStep"("nightAuditId");

-- CreateIndex
CREATE INDEX "NightAuditStep_stepOrder_idx" ON "NightAuditStep"("stepOrder");

-- CreateIndex
CREATE INDEX "NightAuditLog_nightAuditId_idx" ON "NightAuditLog"("nightAuditId");

-- CreateIndex
CREATE INDEX "NightAuditLog_entityType_entityId_idx" ON "NightAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "NightAuditLog_createdAt_idx" ON "NightAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "TravelAgent_tenantId_idx" ON "TravelAgent"("tenantId");

-- CreateIndex
CREATE INDEX "TravelAgent_propertyId_idx" ON "TravelAgent"("propertyId");

-- CreateIndex
CREATE INDEX "TravelAgent_status_idx" ON "TravelAgent"("status");

-- CreateIndex
CREATE INDEX "TravelAgent_isActive_idx" ON "TravelAgent"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TravelAgent_tenantId_code_key" ON "TravelAgent"("tenantId", "code");

-- CreateIndex
CREATE INDEX "CityLedgerInvoice_tenantId_idx" ON "CityLedgerInvoice"("tenantId");

-- CreateIndex
CREATE INDEX "CityLedgerInvoice_propertyId_idx" ON "CityLedgerInvoice"("propertyId");

-- CreateIndex
CREATE INDEX "CityLedgerInvoice_travelAgentId_idx" ON "CityLedgerInvoice"("travelAgentId");

-- CreateIndex
CREATE INDEX "CityLedgerInvoice_accountType_idx" ON "CityLedgerInvoice"("accountType");

-- CreateIndex
CREATE INDEX "CityLedgerInvoice_status_idx" ON "CityLedgerInvoice"("status");

-- CreateIndex
CREATE INDEX "CityLedgerInvoice_invoiceDate_idx" ON "CityLedgerInvoice"("invoiceDate");

-- CreateIndex
CREATE INDEX "CityLedgerInvoice_dueDate_idx" ON "CityLedgerInvoice"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "CityLedgerInvoice_tenantId_invoiceNumber_key" ON "CityLedgerInvoice"("tenantId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "CityLedgerPayment_tenantId_idx" ON "CityLedgerPayment"("tenantId");

-- CreateIndex
CREATE INDEX "CityLedgerPayment_propertyId_idx" ON "CityLedgerPayment"("propertyId");

-- CreateIndex
CREATE INDEX "CityLedgerPayment_invoiceId_idx" ON "CityLedgerPayment"("invoiceId");

-- CreateIndex
CREATE INDEX "CityLedgerPayment_paidAt_idx" ON "CityLedgerPayment"("paidAt");

-- CreateIndex
CREATE INDEX "CityLedgerItem_invoiceId_idx" ON "CityLedgerItem"("invoiceId");

-- CreateIndex
CREATE INDEX "CityLedgerItem_folioId_idx" ON "CityLedgerItem"("folioId");

-- CreateIndex
CREATE INDEX "CommissionRule_tenantId_idx" ON "CommissionRule"("tenantId");

-- CreateIndex
CREATE INDEX "CommissionRule_propertyId_idx" ON "CommissionRule"("propertyId");

-- CreateIndex
CREATE INDEX "CommissionRule_sourceType_idx" ON "CommissionRule"("sourceType");

-- CreateIndex
CREATE INDEX "CommissionRule_isActive_idx" ON "CommissionRule"("isActive");

-- CreateIndex
CREATE INDEX "CommissionRule_validFrom_validUntil_idx" ON "CommissionRule"("validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "CommissionRecord_tenantId_idx" ON "CommissionRecord"("tenantId");

-- CreateIndex
CREATE INDEX "CommissionRecord_propertyId_idx" ON "CommissionRecord"("propertyId");

-- CreateIndex
CREATE INDEX "CommissionRecord_ruleId_idx" ON "CommissionRecord"("ruleId");

-- CreateIndex
CREATE INDEX "CommissionRecord_bookingId_idx" ON "CommissionRecord"("bookingId");

-- CreateIndex
CREATE INDEX "CommissionRecord_status_idx" ON "CommissionRecord"("status");

-- CreateIndex
CREATE INDEX "CommissionRecord_sourceType_idx" ON "CommissionRecord"("sourceType");

-- CreateIndex
CREATE INDEX "CommissionPayment_tenantId_idx" ON "CommissionPayment"("tenantId");

-- CreateIndex
CREATE INDEX "CommissionPayment_propertyId_idx" ON "CommissionPayment"("propertyId");

-- CreateIndex
CREATE INDEX "CommissionPayment_paidAt_idx" ON "CommissionPayment"("paidAt");

-- CreateIndex
CREATE INDEX "CommissionPayment_payeeType_idx" ON "CommissionPayment"("payeeType");

-- CreateIndex
CREATE INDEX "MinibarItem_tenantId_idx" ON "MinibarItem"("tenantId");

-- CreateIndex
CREATE INDEX "MinibarItem_propertyId_idx" ON "MinibarItem"("propertyId");

-- CreateIndex
CREATE INDEX "MinibarItem_category_idx" ON "MinibarItem"("category");

-- CreateIndex
CREATE INDEX "MinibarItem_isActive_idx" ON "MinibarItem"("isActive");

-- CreateIndex
CREATE INDEX "MinibarItem_sortOrder_idx" ON "MinibarItem"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MinibarSetup_roomId_key" ON "MinibarSetup"("roomId");

-- CreateIndex
CREATE INDEX "MinibarSetup_tenantId_idx" ON "MinibarSetup"("tenantId");

-- CreateIndex
CREATE INDEX "MinibarSetup_propertyId_idx" ON "MinibarSetup"("propertyId");

-- CreateIndex
CREATE INDEX "MinibarSetup_roomId_idx" ON "MinibarSetup"("roomId");

-- CreateIndex
CREATE INDEX "MinibarConsumption_tenantId_idx" ON "MinibarConsumption"("tenantId");

-- CreateIndex
CREATE INDEX "MinibarConsumption_propertyId_idx" ON "MinibarConsumption"("propertyId");

-- CreateIndex
CREATE INDEX "MinibarConsumption_bookingId_idx" ON "MinibarConsumption"("bookingId");

-- CreateIndex
CREATE INDEX "MinibarConsumption_folioId_idx" ON "MinibarConsumption"("folioId");

-- CreateIndex
CREATE INDEX "MinibarConsumption_roomId_idx" ON "MinibarConsumption"("roomId");

-- CreateIndex
CREATE INDEX "MinibarConsumption_consumedAt_idx" ON "MinibarConsumption"("consumedAt");

-- CreateIndex
CREATE INDEX "MinibarConsumption_postedToFolio_idx" ON "MinibarConsumption"("postedToFolio");

-- CreateIndex
CREATE INDEX "LostFoundItem_tenantId_idx" ON "LostFoundItem"("tenantId");

-- CreateIndex
CREATE INDEX "LostFoundItem_propertyId_idx" ON "LostFoundItem"("propertyId");

-- CreateIndex
CREATE INDEX "LostFoundItem_guestId_idx" ON "LostFoundItem"("guestId");

-- CreateIndex
CREATE INDEX "LostFoundItem_roomId_idx" ON "LostFoundItem"("roomId");

-- CreateIndex
CREATE INDEX "LostFoundItem_itemType_idx" ON "LostFoundItem"("itemType");

-- CreateIndex
CREATE INDEX "LostFoundItem_category_idx" ON "LostFoundItem"("category");

-- CreateIndex
CREATE INDEX "LostFoundItem_status_idx" ON "LostFoundItem"("status");

-- CreateIndex
CREATE INDEX "LostFoundItem_foundAt_idx" ON "LostFoundItem"("foundAt");

-- CreateIndex
CREATE INDEX "LaundryItem_tenantId_idx" ON "LaundryItem"("tenantId");

-- CreateIndex
CREATE INDEX "LaundryItem_propertyId_idx" ON "LaundryItem"("propertyId");

-- CreateIndex
CREATE INDEX "LaundryItem_category_idx" ON "LaundryItem"("category");

-- CreateIndex
CREATE INDEX "LaundryItem_isActive_idx" ON "LaundryItem"("isActive");

-- CreateIndex
CREATE INDEX "LaundryItem_sortOrder_idx" ON "LaundryItem"("sortOrder");

-- CreateIndex
CREATE INDEX "LaundryOrder_tenantId_idx" ON "LaundryOrder"("tenantId");

-- CreateIndex
CREATE INDEX "LaundryOrder_propertyId_idx" ON "LaundryOrder"("propertyId");

-- CreateIndex
CREATE INDEX "LaundryOrder_bookingId_idx" ON "LaundryOrder"("bookingId");

-- CreateIndex
CREATE INDEX "LaundryOrder_guestId_idx" ON "LaundryOrder"("guestId");

-- CreateIndex
CREATE INDEX "LaundryOrder_roomId_idx" ON "LaundryOrder"("roomId");

-- CreateIndex
CREATE INDEX "LaundryOrder_folioId_idx" ON "LaundryOrder"("folioId");

-- CreateIndex
CREATE INDEX "LaundryOrder_status_idx" ON "LaundryOrder"("status");

-- CreateIndex
CREATE INDEX "LaundryOrder_receivedAt_idx" ON "LaundryOrder"("receivedAt");

-- CreateIndex
CREATE INDEX "LaundryOrderItem_orderId_idx" ON "LaundryOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "LaundryOrderItem_itemId_idx" ON "LaundryOrderItem"("itemId");

-- CreateIndex
CREATE INDEX "PackagePlan_tenantId_idx" ON "PackagePlan"("tenantId");

-- CreateIndex
CREATE INDEX "PackagePlan_propertyId_idx" ON "PackagePlan"("propertyId");

-- CreateIndex
CREATE INDEX "PackagePlan_status_idx" ON "PackagePlan"("status");

-- CreateIndex
CREATE INDEX "PackagePlan_startDate_endDate_idx" ON "PackagePlan"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "PackagePlan_sortOrder_idx" ON "PackagePlan"("sortOrder");

-- CreateIndex
CREATE INDEX "PackageComponent_packagePlanId_idx" ON "PackageComponent"("packagePlanId");

-- CreateIndex
CREATE INDEX "PackageComponent_componentType_idx" ON "PackageComponent"("componentType");

-- CreateIndex
CREATE INDEX "PackageComponent_sortOrder_idx" ON "PackageComponent"("sortOrder");

-- CreateIndex
CREATE INDEX "PackageRate_tenantId_idx" ON "PackageRate"("tenantId");

-- CreateIndex
CREATE INDEX "PackageRate_propertyId_idx" ON "PackageRate"("propertyId");

-- CreateIndex
CREATE INDEX "PackageRate_packagePlanId_idx" ON "PackageRate"("packagePlanId");

-- CreateIndex
CREATE INDEX "PackageRate_roomTypeId_idx" ON "PackageRate"("roomTypeId");

-- CreateIndex
CREATE INDEX "PackageRate_startDate_endDate_idx" ON "PackageRate"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "PackageRate_status_idx" ON "PackageRate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PackageRate_packagePlanId_roomTypeId_startDate_key" ON "PackageRate"("packagePlanId", "roomTypeId", "startDate");

-- CreateIndex
CREATE INDEX "ScheduledChargeExecution_tenantId_idx" ON "ScheduledChargeExecution"("tenantId");

-- CreateIndex
CREATE INDEX "ScheduledChargeExecution_scheduledChargeId_idx" ON "ScheduledChargeExecution"("scheduledChargeId");

-- CreateIndex
CREATE INDEX "ScheduledChargeExecution_folioId_idx" ON "ScheduledChargeExecution"("folioId");

-- CreateIndex
CREATE INDEX "ScheduledChargeExecution_executionDate_idx" ON "ScheduledChargeExecution"("executionDate");

-- CreateIndex
CREATE INDEX "ScheduledChargeExecution_status_idx" ON "ScheduledChargeExecution"("status");

-- CreateIndex
CREATE INDEX "ScheduledChargeExecution_executedAt_idx" ON "ScheduledChargeExecution"("executedAt");

-- CreateIndex
CREATE INDEX "RevenueAccount_tenantId_idx" ON "RevenueAccount"("tenantId");

-- CreateIndex
CREATE INDEX "RevenueAccount_propertyId_idx" ON "RevenueAccount"("propertyId");

-- CreateIndex
CREATE INDEX "RevenueAccount_accountType_idx" ON "RevenueAccount"("accountType");

-- CreateIndex
CREATE INDEX "RevenueAccount_category_idx" ON "RevenueAccount"("category");

-- CreateIndex
CREATE INDEX "RevenueAccount_isActive_idx" ON "RevenueAccount"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueAccount_tenantId_code_key" ON "RevenueAccount"("tenantId", "code");

-- CreateIndex
CREATE INDEX "PostingRule_tenantId_idx" ON "PostingRule"("tenantId");

-- CreateIndex
CREATE INDEX "PostingRule_propertyId_idx" ON "PostingRule"("propertyId");

-- CreateIndex
CREATE INDEX "PostingRule_chargeCategory_idx" ON "PostingRule"("chargeCategory");

-- CreateIndex
CREATE INDEX "PostingRule_chargeType_idx" ON "PostingRule"("chargeType");

-- CreateIndex
CREATE INDEX "PostingRule_revenueAccountId_idx" ON "PostingRule"("revenueAccountId");

-- CreateIndex
CREATE INDEX "PostingRule_isActive_idx" ON "PostingRule"("isActive");

-- CreateIndex
CREATE INDEX "PostingRule_priority_idx" ON "PostingRule"("priority");

-- CreateIndex
CREATE INDEX "PostingLog_tenantId_idx" ON "PostingLog"("tenantId");

-- CreateIndex
CREATE INDEX "PostingLog_propertyId_idx" ON "PostingLog"("propertyId");

-- CreateIndex
CREATE INDEX "PostingLog_ruleId_idx" ON "PostingLog"("ruleId");

-- CreateIndex
CREATE INDEX "PostingLog_folioId_idx" ON "PostingLog"("folioId");

-- CreateIndex
CREATE INDEX "PostingLog_folioLineItemId_idx" ON "PostingLog"("folioLineItemId");

-- CreateIndex
CREATE INDEX "PostingLog_postedAt_idx" ON "PostingLog"("postedAt");

-- CreateIndex
CREATE INDEX "PostingLog_autoPosted_idx" ON "PostingLog"("autoPosted");

-- CreateIndex
CREATE UNIQUE INDEX "GstSettings_gstin_key" ON "GstSettings"("gstin");

-- CreateIndex
CREATE INDEX "GstSettings_tenantId_idx" ON "GstSettings"("tenantId");

-- CreateIndex
CREATE INDEX "GstSettings_propertyId_idx" ON "GstSettings"("propertyId");

-- CreateIndex
CREATE INDEX "GstSacCode_tenantId_idx" ON "GstSacCode"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "GstSacCode_tenantId_serviceType_key" ON "GstSacCode"("tenantId", "serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "GstEInvoice_irn_key" ON "GstEInvoice"("irn");

-- CreateIndex
CREATE INDEX "GstEInvoice_tenantId_idx" ON "GstEInvoice"("tenantId");

-- CreateIndex
CREATE INDEX "GstEInvoice_propertyId_idx" ON "GstEInvoice"("propertyId");

-- CreateIndex
CREATE INDEX "GstEInvoice_irn_idx" ON "GstEInvoice"("irn");

-- CreateIndex
CREATE INDEX "GstEInvoice_status_idx" ON "GstEInvoice"("status");

-- CreateIndex
CREATE INDEX "GstEInvoice_invoiceDate_idx" ON "GstEInvoice"("invoiceDate");

-- CreateIndex
CREATE INDEX "GstReturn_tenantId_idx" ON "GstReturn"("tenantId");

-- CreateIndex
CREATE INDEX "GstReturn_returnType_idx" ON "GstReturn"("returnType");

-- CreateIndex
CREATE INDEX "GstReturn_period_idx" ON "GstReturn"("period");

-- CreateIndex
CREATE UNIQUE INDEX "GstReturn_tenantId_returnType_period_key" ON "GstReturn"("tenantId", "returnType", "period");

-- CreateIndex
CREATE INDEX "TcsRecord_tenantId_idx" ON "TcsRecord"("tenantId");

-- CreateIndex
CREATE INDEX "TcsRecord_collectionDate_idx" ON "TcsRecord"("collectionDate");

-- CreateIndex
CREATE INDEX "TcsRecord_status_idx" ON "TcsRecord"("status");

-- CreateIndex
CREATE INDEX "TcsRecord_period_idx" ON "TcsRecord"("period");

-- CreateIndex
CREATE INDEX "TdsRecord_tenantId_idx" ON "TdsRecord"("tenantId");

-- CreateIndex
CREATE INDEX "TdsRecord_section_idx" ON "TdsRecord"("section");

-- CreateIndex
CREATE INDEX "TdsRecord_paymentDate_idx" ON "TdsRecord"("paymentDate");

-- CreateIndex
CREATE INDEX "TdsRecord_status_idx" ON "TdsRecord"("status");

-- CreateIndex
CREATE INDEX "TdsRecord_period_idx" ON "TdsRecord"("period");

-- CreateIndex
CREATE INDEX "_CaptivePortalToVlanConfig_B_index" ON "_CaptivePortalToVlanConfig"("B");

-- CreateIndex
CREATE INDEX "_ModifierItems_B_index" ON "_ModifierItems"("B");

-- CreateIndex
CREATE INDEX "_GstSacCodeToGstSettings_B_index" ON "_GstSacCodeToGstSettings"("B");

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPerformance" ADD CONSTRAINT "AdPerformance_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISuggestion" ADD CONSTRAINT "AISuggestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amenity" ADD CONSTRAINT "Amenity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversationMessage" ADD CONSTRAINT "AiConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecutionLog" ADD CONSTRAINT "AutomationExecutionLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandwidthPolicy" ADD CONSTRAINT "BandwidthPolicy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandwidthPolicy" ADD CONSTRAINT "BandwidthPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandwidthPolicyDetail" ADD CONSTRAINT "BandwidthPolicyDetail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandwidthPool" ADD CONSTRAINT "BandwidthPool_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandwidthPool" ADD CONSTRAINT "BandwidthPool_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandwidthTopup" ADD CONSTRAINT "BandwidthTopup_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandwidthTopup" ADD CONSTRAINT "BandwidthTopup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandwidthUsageDaily" ADD CONSTRAINT "BandwidthUsageDaily_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandwidthUsageDaily" ADD CONSTRAINT "BandwidthUsageDaily_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandwidthUsageSession" ADD CONSTRAINT "BandwidthUsageSession_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandwidthUsageSession" ADD CONSTRAINT "BandwidthUsageSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BondConfig" ADD CONSTRAINT "BondConfig_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BondConfig" ADD CONSTRAINT "BondConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BondMember" ADD CONSTRAINT "BondMember_bondConfigId_fkey" FOREIGN KEY ("bondConfigId") REFERENCES "BondConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BondMember" ADD CONSTRAINT "BondMember_interfaceId_fkey" FOREIGN KEY ("interfaceId") REFERENCES "NetworkInterface"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_primaryGuestId_fkey" FOREIGN KEY ("primaryGuestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GroupBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAuditLog" ADD CONSTRAINT "BookingAuditLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeConfig" ADD CONSTRAINT "BridgeConfig_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeConfig" ADD CONSTRAINT "BridgeConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CameraGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraEvent" ADD CONSTRAINT "CameraEvent_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "Camera"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraEvent" ADD CONSTRAINT "CameraEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraGroup" ADD CONSTRAINT "CameraGroup_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSegment" ADD CONSTRAINT "CampaignSegment_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "GuestSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSegment" ADD CONSTRAINT "CampaignSegment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationPolicy" ADD CONSTRAINT "CancellationPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptivePortal" ADD CONSTRAINT "CaptivePortal_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptivePortal" ADD CONSTRAINT "CaptivePortal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelDeadLetterQueue" ADD CONSTRAINT "ChannelDeadLetterQueue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMapping" ADD CONSTRAINT "ChannelMapping_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMapping" ADD CONSTRAINT "ChannelMapping_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMapping" ADD CONSTRAINT "ChannelMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelRestriction" ADD CONSTRAINT "ChannelRestriction_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelRestriction" ADD CONSTRAINT "ChannelRestriction_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelRetryQueue" ADD CONSTRAINT "ChannelRetryQueue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelSyncLog" ADD CONSTRAINT "ChannelSyncLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaSessionDetail" ADD CONSTRAINT "CoaSessionDetail_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaSessionDetail" ADD CONSTRAINT "CoaSessionDetail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationChannel" ADD CONSTRAINT "CommunicationChannel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorPrice" ADD CONSTRAINT "CompetitorPrice_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorPrice" ADD CONSTRAINT "CompetitorPrice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorPrice" ADD CONSTRAINT "CompetitorPrice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentFilter" ADD CONSTRAINT "ContentFilter_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentFilter" ADD CONSTRAINT "ContentFilter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandForecast" ADD CONSTRAINT "DemandForecast_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandForecast" ADD CONSTRAINT "DemandForecast_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandForecast" ADD CONSTRAINT "DemandForecast_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpBlacklist" ADD CONSTRAINT "DhcpBlacklist_subnetId_fkey" FOREIGN KEY ("subnetId") REFERENCES "DhcpSubnet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpBlacklist" ADD CONSTRAINT "DhcpBlacklist_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpBlacklist" ADD CONSTRAINT "DhcpBlacklist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpHostnameFilter" ADD CONSTRAINT "DhcpHostnameFilter_subnetId_fkey" FOREIGN KEY ("subnetId") REFERENCES "DhcpSubnet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpHostnameFilter" ADD CONSTRAINT "DhcpHostnameFilter_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpHostnameFilter" ADD CONSTRAINT "DhcpHostnameFilter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpLease" ADD CONSTRAINT "DhcpLease_subnetId_fkey" FOREIGN KEY ("subnetId") REFERENCES "DhcpSubnet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpLease" ADD CONSTRAINT "DhcpLease_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpLease" ADD CONSTRAINT "DhcpLease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpLeaseScript" ADD CONSTRAINT "DhcpLeaseScript_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpLeaseScript" ADD CONSTRAINT "DhcpLeaseScript_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpOption" ADD CONSTRAINT "DhcpOption_subnetId_fkey" FOREIGN KEY ("subnetId") REFERENCES "DhcpSubnet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpOption" ADD CONSTRAINT "DhcpOption_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpOption" ADD CONSTRAINT "DhcpOption_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpReservation" ADD CONSTRAINT "DhcpReservation_subnetId_fkey" FOREIGN KEY ("subnetId") REFERENCES "DhcpSubnet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpReservation" ADD CONSTRAINT "DhcpReservation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpReservation" ADD CONSTRAINT "DhcpReservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpSubnet" ADD CONSTRAINT "DhcpSubnet_vlanConfigId_fkey" FOREIGN KEY ("vlanConfigId") REFERENCES "VlanConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpSubnet" ADD CONSTRAINT "DhcpSubnet_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpSubnet" ADD CONSTRAINT "DhcpSubnet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpTagRule" ADD CONSTRAINT "DhcpTagRule_subnetId_fkey" FOREIGN KEY ("subnetId") REFERENCES "DhcpSubnet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpTagRule" ADD CONSTRAINT "DhcpTagRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DhcpTagRule" ADD CONSTRAINT "DhcpTagRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnsRecord" ADD CONSTRAINT "DnsRecord_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "DnsZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnsRecord" ADD CONSTRAINT "DnsRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnsRedirectRule" ADD CONSTRAINT "DnsRedirectRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnsRedirectRule" ADD CONSTRAINT "DnsRedirectRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnsZone" ADD CONSTRAINT "DnsZone_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnsZone" ADD CONSTRAINT "DnsZone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyMetric" ADD CONSTRAINT "EnergyMetric_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyMetric" ADD CONSTRAINT "EnergyMetric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "EventSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventResource" ADD CONSTRAINT "EventResource_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSpace" ADD CONSTRAINT "EventSpace_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalReview" ADD CONSTRAINT "ExternalReview_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalReview" ADD CONSTRAINT "ExternalReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairAccessPolicy" ADD CONSTRAINT "FairAccessPolicy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairAccessPolicy" ADD CONSTRAINT "FairAccessPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallRule" ADD CONSTRAINT "FirewallRule_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "FirewallZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallRule" ADD CONSTRAINT "FirewallRule_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "FirewallSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallRule" ADD CONSTRAINT "FirewallRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallRule" ADD CONSTRAINT "FirewallRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallSchedule" ADD CONSTRAINT "FirewallSchedule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallSchedule" ADD CONSTRAINT "FirewallSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallZone" ADD CONSTRAINT "FirewallZone_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallZone" ADD CONSTRAINT "FirewallZone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorPlan" ADD CONSTRAINT "FloorPlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorPlanRoom" ADD CONSTRAINT "FloorPlanRoom_floorPlanId_fkey" FOREIGN KEY ("floorPlanId") REFERENCES "FloorPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorPlanRoom" ADD CONSTRAINT "FloorPlanRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioLineItem" ADD CONSTRAINT "FolioLineItem_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioLineItem" ADD CONSTRAINT "FolioLineItem_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioTransfer" ADD CONSTRAINT "FolioTransfer_fromFolioId_fkey" FOREIGN KEY ("fromFolioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioTransfer" ADD CONSTRAINT "FolioTransfer_toFolioId_fkey" FOREIGN KEY ("toFolioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioTransfer" ADD CONSTRAINT "FolioTransfer_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioTransfer" ADD CONSTRAINT "FolioTransfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GDPRRequest" ADD CONSTRAINT "GDPRRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleHotelAdsConnection" ADD CONSTRAINT "GoogleHotelAdsConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestBehavior" ADD CONSTRAINT "GuestBehavior_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestBehavior" ADD CONSTRAINT "GuestBehavior_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestDocument" ADD CONSTRAINT "GuestDocument_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestFeedback" ADD CONSTRAINT "GuestFeedback_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestJourney" ADD CONSTRAINT "GuestJourney_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestJourney" ADD CONSTRAINT "GuestJourney_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestRecommendation" ADD CONSTRAINT "GuestRecommendation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestRecommendation" ADD CONSTRAINT "GuestRecommendation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestReview" ADD CONSTRAINT "GuestReview_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestReview" ADD CONSTRAINT "GuestReview_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestSegment" ADD CONSTRAINT "GuestSegment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestStay" ADD CONSTRAINT "GuestStay_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestStay" ADD CONSTRAINT "GuestStay_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpCategory" ADD CONSTRAINT "HelpCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "HelpCategory"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "InspectionResult" ADD CONSTRAINT "InspectionResult_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTemplate" ADD CONSTRAINT "InspectionTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterfaceAlias" ADD CONSTRAINT "InterfaceAlias_interfaceId_fkey" FOREIGN KEY ("interfaceId") REFERENCES "NetworkInterface"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterfaceAlias" ADD CONSTRAINT "InterfaceAlias_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterfaceAlias" ADD CONSTRAINT "InterfaceAlias_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterfaceConfig" ADD CONSTRAINT "InterfaceConfig_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterfaceConfig" ADD CONSTRAINT "InterfaceConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterfaceRole" ADD CONSTRAINT "InterfaceRole_interfaceId_fkey" FOREIGN KEY ("interfaceId") REFERENCES "NetworkInterface"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterfaceRole" ADD CONSTRAINT "InterfaceRole_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterfaceRole" ADD CONSTRAINT "InterfaceRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLock" ADD CONSTRAINT "InventoryLock_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLock" ADD CONSTRAINT "InventoryLock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLock" ADD CONSTRAINT "InventoryLock_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLock" ADD CONSTRAINT "InventoryLock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InvoiceTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IoTCommand" ADD CONSTRAINT "IoTCommand_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "IoTDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IoTDevice" ADD CONSTRAINT "IoTDevice_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IoTDevice" ADD CONSTRAINT "IoTDevice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IoTDevice" ADD CONSTRAINT "IoTDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IoTReading" ADD CONSTRAINT "IoTReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "IoTDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KioskSettings" ADD CONSTRAINT "KioskSettings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KioskSettings" ADD CONSTRAINT "KioskSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointTransaction" ADD CONSTRAINT "LoyaltyPointTransaction_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointTransaction" ADD CONSTRAINT "LoyaltyPointTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "LoyaltyReward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyReward" ADD CONSTRAINT "LoyaltyReward_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTier" ADD CONSTRAINT "LoyaltyTier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MacFilter" ADD CONSTRAINT "MacFilter_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MacFilter" ADD CONSTRAINT "MacFilter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceBlock" ADD CONSTRAINT "MaintenanceBlock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceBlock" ADD CONSTRAINT "MaintenanceBlock_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceBlock" ADD CONSTRAINT "MaintenanceBlock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "OrderCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetasearchConnection" ADD CONSTRAINT "MetasearchConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultiWanConfig" ADD CONSTRAINT "MultiWanConfig_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultiWanConfig" ADD CONSTRAINT "MultiWanConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gateway" ADD CONSTRAINT "Gateway_multiWanConfigId_fkey" FOREIGN KEY ("multiWanConfigId") REFERENCES "MultiWanConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gateway" ADD CONSTRAINT "Gateway_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gateway" ADD CONSTRAINT "Gateway_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gateway" ADD CONSTRAINT "Gateway_backupGatewayId_fkey" FOREIGN KEY ("backupGatewayId") REFERENCES "Gateway"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayHealthRule" ADD CONSTRAINT "GatewayHealthRule_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayHealthRule" ADD CONSTRAINT "GatewayHealthRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayExplicitRoute" ADD CONSTRAINT "GatewayExplicitRoute_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayExplicitRoute" ADD CONSTRAINT "GatewayExplicitRoute_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayExplicitRoute" ADD CONSTRAINT "GatewayExplicitRoute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayFwmark" ADD CONSTRAINT "GatewayFwmark_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayFwmark" ADD CONSTRAINT "GatewayFwmark_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NasHealthLog" ADD CONSTRAINT "NasHealthLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NasHealthLog" ADD CONSTRAINT "NasHealthLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NatLog" ADD CONSTRAINT "NatLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NatLog" ADD CONSTRAINT "NatLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkConfigBackup" ADD CONSTRAINT "NetworkConfigBackup_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkConfigBackup" ADD CONSTRAINT "NetworkConfigBackup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkInterface" ADD CONSTRAINT "NetworkInterface_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkInterface" ADD CONSTRAINT "NetworkInterface_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCategory" ADD CONSTRAINT "OrderCategory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSlot" ADD CONSTRAINT "ParkingSlot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSchedule" ADD CONSTRAINT "PaymentSchedule_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSchedule" ADD CONSTRAINT "PaymentSchedule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSchedule" ADD CONSTRAINT "PaymentSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAuthentication" ADD CONSTRAINT "PortalAuthentication_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "CaptivePortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAuthentication" ADD CONSTRAINT "PortalAuthentication_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAuthentication" ADD CONSTRAINT "PortalAuthentication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMapping" ADD CONSTRAINT "PortalMapping_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "CaptivePortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMapping" ADD CONSTRAINT "PortalMapping_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMapping" ADD CONSTRAINT "PortalMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalPage" ADD CONSTRAINT "PortalPage_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "CaptivePortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalPage" ADD CONSTRAINT "PortalPage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalTemplate" ADD CONSTRAINT "PortalTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortForwardRule" ADD CONSTRAINT "PortForwardRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortForwardRule" ADD CONSTRAINT "PortForwardRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickBlock" ADD CONSTRAINT "QuickBlock_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickBlock" ADD CONSTRAINT "QuickBlock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateLimitRule" ADD CONSTRAINT "RateLimitRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateLimitRule" ADD CONSTRAINT "RateLimitRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveMaintenance" ADD CONSTRAINT "PreventiveMaintenance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveMaintenance" ADD CONSTRAINT "PreventiveMaintenance_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceOverride" ADD CONSTRAINT "PriceOverride_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomVlan" ADD CONSTRAINT "RoomVlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomVlan" ADD CONSTRAINT "RoomVlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomVlan" ADD CONSTRAINT "RoomVlan_parentInterfaceId_fkey" FOREIGN KEY ("parentInterfaceId") REFERENCES "NetworkInterface"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomVlan" ADD CONSTRAINT "RoomVlan_bandwidthPlanId_fkey" FOREIGN KEY ("bandwidthPlanId") REFERENCES "BandwidthPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radcheck" ADD CONSTRAINT "radcheck_wifiUserId_fkey" FOREIGN KEY ("wifiUserId") REFERENCES "WiFiUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiusNAS" ADD CONSTRAINT "RadiusNAS_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiusNAS" ADD CONSTRAINT "RadiusNAS_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiusServerConfig" ADD CONSTRAINT "RadiusServerConfig_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiusServerConfig" ADD CONSTRAINT "RadiusServerConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radreply" ADD CONSTRAINT "radreply_wifiUserId_fkey" FOREIGN KEY ("wifiUserId") REFERENCES "WiFiUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_derivedFromId_fkey" FOREIGN KEY ("derivedFromId") REFERENCES "RatePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationCard" ADD CONSTRAINT "RegistrationCard_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationCard" ADD CONSTRAINT "RegistrationCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportHistory" ADD CONSTRAINT "ReportHistory_scheduledReportId_fkey" FOREIGN KEY ("scheduledReportId") REFERENCES "ScheduledReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_currentTaskId_fkey" FOREIGN KEY ("currentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMoveLog" ADD CONSTRAINT "RoomMoveLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMoveLog" ADD CONSTRAINT "RoomMoveLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_wifiPlanId_fkey" FOREIGN KEY ("wifiPlanId") REFERENCES "WiFiPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAccess" ADD CONSTRAINT "ScheduleAccess_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAccess" ADD CONSTRAINT "ScheduleAccess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledNotification" ADD CONSTRAINT "ScheduledNotification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "Camera"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecuritySettings" ADD CONSTRAINT "SecuritySettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentMembership" ADD CONSTRAINT "SegmentMembership_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentMembership" ADD CONSTRAINT "SegmentMembership_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "GuestSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SSOConnection" ADD CONSTRAINT "SSOConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SSOSession" ADD CONSTRAINT "SSOSession_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SSOConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SSOSession" ADD CONSTRAINT "SSOSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffChannel" ADD CONSTRAINT "StaffChannel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffChannelMember" ADD CONSTRAINT "StaffChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "StaffChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffChannelMember" ADD CONSTRAINT "StaffChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffChatMessage" ADD CONSTRAINT "StaffChatMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "StaffChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffChatMessage" ADD CONSTRAINT "StaffChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffChatMessage" ADD CONSTRAINT "StaffChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "StaffChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeave" ADD CONSTRAINT "StaffLeave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeave" ADD CONSTRAINT "StaffLeave_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPerformance" ADD CONSTRAINT "StaffPerformance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPerformance" ADD CONSTRAINT "StaffPerformance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSkill" ADD CONSTRAINT "StaffSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSkill" ADD CONSTRAINT "StaffSkill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWorkload" ADD CONSTRAINT "StaffWorkload_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaticRoute" ADD CONSTRAINT "StaticRoute_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaticRoute" ADD CONSTRAINT "StaticRoute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockConsumption" ADD CONSTRAINT "StockConsumption_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyslogServer" ADD CONSTRAINT "SyslogServer_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyslogServer" ADD CONSTRAINT "SyslogServer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemNetworkHealth" ADD CONSTRAINT "SystemNetworkHealth_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemNetworkHealth" ADD CONSTRAINT "SystemNetworkHealth_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignmentSuggestion" ADD CONSTRAINT "TaskAssignmentSuggestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxReport" ADD CONSTRAINT "TaxReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceBooking" ADD CONSTRAINT "ExperienceBooking_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceBooking" ADD CONSTRAINT "ExperienceBooking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperiencePricing" ADD CONSTRAINT "ExperiencePricing_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperiencePricing" ADD CONSTRAINT "ExperiencePricing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceVendor" ADD CONSTRAINT "ExperienceVendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceFeedback" ADD CONSTRAINT "ExperienceFeedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatTransfer" ADD CONSTRAINT "ChatTransfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatTransfer" ADD CONSTRAINT "ChatTransfer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatTransfer" ADD CONSTRAINT "ChatTransfer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageSummary" ADD CONSTRAINT "UsageSummary_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFcmToken" ADD CONSTRAINT "UserFcmToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFcmToken" ADD CONSTRAINT "UserFcmToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ParkingSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VlanConfig" ADD CONSTRAINT "VlanConfig_parentInterfaceId_fkey" FOREIGN KEY ("parentInterfaceId") REFERENCES "NetworkInterface"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VlanConfig" ADD CONSTRAINT "VlanConfig_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VlanConfig" ADD CONSTRAINT "VlanConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WanFailover" ADD CONSTRAINT "WanFailover_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WanFailover" ADD CONSTRAINT "WanFailover_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebCategory" ADD CONSTRAINT "WebCategory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebCategory" ADD CONSTRAINT "WebCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebCategorySchedule" ADD CONSTRAINT "WebCategorySchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDeliveryLog" ADD CONSTRAINT "WebhookDeliveryLog_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiAAAConfig" ADD CONSTRAINT "WiFiAAAConfig_defaultPlanId_fkey" FOREIGN KEY ("defaultPlanId") REFERENCES "WiFiPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiAAAConfig" ADD CONSTRAINT "WiFiAAAConfig_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiAAAConfig" ADD CONSTRAINT "WiFiAAAConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiGateway" ADD CONSTRAINT "WiFiGateway_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiGateway" ADD CONSTRAINT "WiFiGateway_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpPool" ADD CONSTRAINT "IpPool_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpPoolRange" ADD CONSTRAINT "IpPoolRange_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "IpPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiPlan" ADD CONSTRAINT "WiFiPlan_fupPolicyId_fkey" FOREIGN KEY ("fupPolicyId") REFERENCES "FairAccessPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiPlan" ADD CONSTRAINT "WiFiPlan_ipPoolId_fkey" FOREIGN KEY ("ipPoolId") REFERENCES "IpPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiPlan" ADD CONSTRAINT "WiFiPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiSession" ADD CONSTRAINT "WiFiSession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WiFiPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiSession" ADD CONSTRAINT "WiFiSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiUser" ADD CONSTRAINT "WiFiUser_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WiFiPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiUser" ADD CONSTRAINT "WiFiUser_ipPoolId_fkey" FOREIGN KEY ("ipPoolId") REFERENCES "IpPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiUser" ADD CONSTRAINT "WiFiUser_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiUser" ADD CONSTRAINT "WiFiUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiUserStatusHistory" ADD CONSTRAINT "WiFiUserStatusHistory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiUserStatusHistory" ADD CONSTRAINT "WiFiUserStatusHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiVoucher" ADD CONSTRAINT "WiFiVoucher_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WiFiPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiFiVoucher" ADD CONSTRAINT "WiFiVoucher_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuModifier" ADD CONSTRAINT "MenuModifier_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuModifierOption" ADD CONSTRAINT "MenuModifierOption_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "MenuModifier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuModifierOption" ADD CONSTRAINT "MenuModifierOption_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuVariant" ADD CONSTRAINT "MenuVariant_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuVariant" ADD CONSTRAINT "MenuVariant_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableMerge" ADD CONSTRAINT "TableMerge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableMerge" ADD CONSTRAINT "TableMerge_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentToken" ADD CONSTRAINT "PaymentToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentToken" ADD CONSTRAINT "PaymentToken_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentToken" ADD CONSTRAINT "PaymentToken_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledCharge" ADD CONSTRAINT "ScheduledCharge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledCharge" ADD CONSTRAINT "ScheduledCharge_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledCharge" ADD CONSTRAINT "ScheduledCharge_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledCharge" ADD CONSTRAINT "ScheduledCharge_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationPenalty" ADD CONSTRAINT "CancellationPenalty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationPenalty" ADD CONSTRAINT "CancellationPenalty_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationPenalty" ADD CONSTRAINT "CancellationPenalty_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationPenalty" ADD CONSTRAINT "CancellationPenalty_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "CancellationPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyCard" ADD CONSTRAINT "KeyCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyCard" ADD CONSTRAINT "KeyCard_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyCard" ADD CONSTRAINT "KeyCard_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveillanceConfig" ADD CONSTRAINT "SurveillanceConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveillanceConfig" ADD CONSTRAINT "SurveillanceConfig_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingPass" ADD CONSTRAINT "ParkingPass_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingPass" ADD CONSTRAINT "ParkingPass_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ParkingSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingPass" ADD CONSTRAINT "ParkingPass_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_fromPropertyId_fkey" FOREIGN KEY ("fromPropertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_toPropertyId_fkey" FOREIGN KEY ("toPropertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransferItem" ADD CONSTRAINT "InventoryTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "InventoryTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransferItem" ADD CONSTRAINT "InventoryTransferItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAbTest" ADD CONSTRAINT "CampaignAbTest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorSyncLog" ADD CONSTRAINT "CompetitorSyncLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseKey" ADD CONSTRAINT "LicenseKey_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RegistrationPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_wifiUserId_fkey" FOREIGN KEY ("wifiUserId") REFERENCES "WiFiUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightAudit" ADD CONSTRAINT "NightAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightAudit" ADD CONSTRAINT "NightAudit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightAudit" ADD CONSTRAINT "NightAudit_startedBy_fkey" FOREIGN KEY ("startedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightAudit" ADD CONSTRAINT "NightAudit_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightAuditStep" ADD CONSTRAINT "NightAuditStep_nightAuditId_fkey" FOREIGN KEY ("nightAuditId") REFERENCES "NightAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightAuditLog" ADD CONSTRAINT "NightAuditLog_nightAuditId_fkey" FOREIGN KEY ("nightAuditId") REFERENCES "NightAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelAgent" ADD CONSTRAINT "TravelAgent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelAgent" ADD CONSTRAINT "TravelAgent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityLedgerInvoice" ADD CONSTRAINT "CityLedgerInvoice_travelAgentId_fkey" FOREIGN KEY ("travelAgentId") REFERENCES "TravelAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityLedgerInvoice" ADD CONSTRAINT "CityLedgerInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityLedgerInvoice" ADD CONSTRAINT "CityLedgerInvoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityLedgerPayment" ADD CONSTRAINT "CityLedgerPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CityLedgerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityLedgerPayment" ADD CONSTRAINT "CityLedgerPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityLedgerPayment" ADD CONSTRAINT "CityLedgerPayment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityLedgerItem" ADD CONSTRAINT "CityLedgerItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CityLedgerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "CommissionRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinibarItem" ADD CONSTRAINT "MinibarItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinibarItem" ADD CONSTRAINT "MinibarItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinibarSetup" ADD CONSTRAINT "MinibarSetup_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinibarSetup" ADD CONSTRAINT "MinibarSetup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinibarSetup" ADD CONSTRAINT "MinibarSetup_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinibarConsumption" ADD CONSTRAINT "MinibarConsumption_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinibarConsumption" ADD CONSTRAINT "MinibarConsumption_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinibarConsumption" ADD CONSTRAINT "MinibarConsumption_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinibarConsumption" ADD CONSTRAINT "MinibarConsumption_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinibarConsumption" ADD CONSTRAINT "MinibarConsumption_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostFoundItem" ADD CONSTRAINT "LostFoundItem_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostFoundItem" ADD CONSTRAINT "LostFoundItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostFoundItem" ADD CONSTRAINT "LostFoundItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryItem" ADD CONSTRAINT "LaundryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryItem" ADD CONSTRAINT "LaundryItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryOrder" ADD CONSTRAINT "LaundryOrder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryOrder" ADD CONSTRAINT "LaundryOrder_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryOrder" ADD CONSTRAINT "LaundryOrder_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryOrder" ADD CONSTRAINT "LaundryOrder_collectedBy_fkey" FOREIGN KEY ("collectedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryOrder" ADD CONSTRAINT "LaundryOrder_deliveredBy_fkey" FOREIGN KEY ("deliveredBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryOrder" ADD CONSTRAINT "LaundryOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryOrder" ADD CONSTRAINT "LaundryOrder_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryOrderItem" ADD CONSTRAINT "LaundryOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "LaundryOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePlan" ADD CONSTRAINT "PackagePlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePlan" ADD CONSTRAINT "PackagePlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageComponent" ADD CONSTRAINT "PackageComponent_packagePlanId_fkey" FOREIGN KEY ("packagePlanId") REFERENCES "PackagePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRate" ADD CONSTRAINT "PackageRate_packagePlanId_fkey" FOREIGN KEY ("packagePlanId") REFERENCES "PackagePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRate" ADD CONSTRAINT "PackageRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageRate" ADD CONSTRAINT "PackageRate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledChargeExecution" ADD CONSTRAINT "ScheduledChargeExecution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueAccount" ADD CONSTRAINT "RevenueAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueAccount" ADD CONSTRAINT "RevenueAccount_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_revenueAccountId_fkey" FOREIGN KEY ("revenueAccountId") REFERENCES "RevenueAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingLog" ADD CONSTRAINT "PostingLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PostingRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingLog" ADD CONSTRAINT "PostingLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingLog" ADD CONSTRAINT "PostingLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstSettings" ADD CONSTRAINT "GstSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstSettings" ADD CONSTRAINT "GstSettings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstSacCode" ADD CONSTRAINT "GstSacCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstEInvoice" ADD CONSTRAINT "GstEInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstEInvoice" ADD CONSTRAINT "GstEInvoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstEInvoice" ADD CONSTRAINT "GstEInvoice_gstSettingsId_fkey" FOREIGN KEY ("gstSettingsId") REFERENCES "GstSettings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstReturn" ADD CONSTRAINT "GstReturn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstReturn" ADD CONSTRAINT "GstReturn_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TcsRecord" ADD CONSTRAINT "TcsRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TcsRecord" ADD CONSTRAINT "TcsRecord_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TdsRecord" ADD CONSTRAINT "TdsRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TdsRecord" ADD CONSTRAINT "TdsRecord_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CaptivePortalToVlanConfig" ADD CONSTRAINT "_CaptivePortalToVlanConfig_A_fkey" FOREIGN KEY ("A") REFERENCES "CaptivePortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CaptivePortalToVlanConfig" ADD CONSTRAINT "_CaptivePortalToVlanConfig_B_fkey" FOREIGN KEY ("B") REFERENCES "VlanConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ModifierItems" ADD CONSTRAINT "_ModifierItems_A_fkey" FOREIGN KEY ("A") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ModifierItems" ADD CONSTRAINT "_ModifierItems_B_fkey" FOREIGN KEY ("B") REFERENCES "MenuModifier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GstSacCodeToGstSettings" ADD CONSTRAINT "_GstSacCodeToGstSettings_A_fkey" FOREIGN KEY ("A") REFERENCES "GstSacCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GstSacCodeToGstSettings" ADD CONSTRAINT "_GstSacCodeToGstSettings_B_fkey" FOREIGN KEY ("B") REFERENCES "GstSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

