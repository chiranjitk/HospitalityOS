-- ============================================================
-- 08-staysuite-tables.sql
-- StaySuite-HospitalityOS: Prisma-managed Tables & Indexes
-- Generated from live PostgreSQL 17.4 schema
-- Date: 2026-04-27
-- Tables: 220, Indexes: 770
-- Note: FreeRADIUS/FUP tables are in 01-07 SQL files
-- ============================================================

-- ============================================================
-- Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS citext SCHEMA public;

CREATE TABLE public."_CaptivePortalToVlanConfig" (
    "A" uuid NOT NULL,
    "B" uuid NOT NULL
);


CREATE TABLE public."AdCampaign" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid,
    name text NOT NULL,
    description text,
    type text DEFAULT 'search'::text NOT NULL,
    platform text DEFAULT 'google'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    budget double precision DEFAULT 0 NOT NULL,
    "budgetType" text DEFAULT 'daily'::text NOT NULL,
    "spentAmount" double precision DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "startDate" timestamp with time zone,
    "endDate" timestamp with time zone,
    "bidStrategy" text DEFAULT 'auto'::text NOT NULL,
    "bidAmount" double precision,
    "targetCpa" double precision,
    "targetRoas" double precision,
    targeting text DEFAULT '{}'::text NOT NULL,
    keywords text DEFAULT '[]'::text NOT NULL,
    "negativeKeywords" text DEFAULT '[]'::text NOT NULL,
    "roomTypes" text DEFAULT '[]'::text NOT NULL,
    "ratePlans" text DEFAULT '[]'::text NOT NULL,
    impressions integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    conversions integer DEFAULT 0 NOT NULL,
    revenue double precision DEFAULT 0 NOT NULL,
    ctr double precision DEFAULT 0 NOT NULL,
    cpc double precision DEFAULT 0 NOT NULL,
    "conversionRate" double precision DEFAULT 0 NOT NULL,
    roas double precision DEFAULT 0 NOT NULL,
    "externalId" uuid,
    "externalData" text DEFAULT '{}'::text NOT NULL,
    "lastSyncAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."AdPerformance" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "campaignId" uuid NOT NULL,
    date timestamp with time zone NOT NULL,
    impressions integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    conversions integer DEFAULT 0 NOT NULL,
    cost double precision DEFAULT 0 NOT NULL,
    revenue double precision DEFAULT 0 NOT NULL,
    ctr double precision DEFAULT 0 NOT NULL,
    cpc double precision DEFAULT 0 NOT NULL,
    cpa double precision DEFAULT 0 NOT NULL,
    roas double precision DEFAULT 0 NOT NULL,
    "conversionRate" double precision DEFAULT 0 NOT NULL,
    "avgPosition" double precision,
    "qualityScore" double precision,
    "searchImpShare" double precision,
    "deviceBreakdown" text DEFAULT '{}'::text NOT NULL,
    "sourceBreakdown" text DEFAULT '{}'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."AISuggestion" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    description text,
    impact text DEFAULT 'medium'::text NOT NULL,
    "potentialRevenue" double precision DEFAULT 0 NOT NULL,
    confidence double precision DEFAULT 0.8 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    data text DEFAULT '{}'::text NOT NULL,
    "appliedAt" timestamp with time zone,
    "dismissedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Amenity" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    icon text,
    category text DEFAULT 'general'::text NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Asset" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    description text,
    "roomId" uuid,
    location text,
    "purchasePrice" double precision,
    "purchaseDate" timestamp with time zone,
    "currentValue" double precision,
    "warrantyExpiry" timestamp with time zone,
    "warrantyProvider" text,
    "lastMaintenanceAt" timestamp with time zone,
    "nextMaintenanceAt" timestamp with time zone,
    "maintenanceIntervalDays" integer,
    status text DEFAULT 'active'::text NOT NULL,
    "serialNumber" text,
    "modelNumber" text,
    manufacturer text,
    "conditionScore" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


CREATE TABLE public."AuditLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid,
    module text NOT NULL,
    action text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" uuid,
    "oldValue" text,
    "newValue" text,
    "ipAddress" text,
    "userAgent" text,
    "correlationId" uuid,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."AutomationExecutionLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "ruleId" uuid NOT NULL,
    "triggerData" text,
    status text NOT NULL,
    "errorMessage" text,
    "actionsResult" text,
    "executedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."AutomationRule" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    "triggerEvent" text NOT NULL,
    "triggerConditions" text,
    actions text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "executionCount" integer DEFAULT 0 NOT NULL,
    "lastExecutedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."BandwidthPolicy" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    "downloadKbps" integer DEFAULT 10240 NOT NULL,
    "uploadKbps" integer DEFAULT 10240 NOT NULL,
    "burstDownloadKbps" integer,
    "burstUploadKbps" integer,
    priority integer DEFAULT 5 NOT NULL,
    "planId" uuid,
    description text,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."BandwidthPolicyDetail" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "bandwidthPolicyId" uuid NOT NULL,
    "scheduleAccessId" uuid,
    "downloadLimitBps" integer DEFAULT 0 NOT NULL,
    "uploadLimitBps" integer DEFAULT 0 NOT NULL,
    "guaranteedDownBps" integer DEFAULT 0 NOT NULL,
    "guaranteedUpBps" integer DEFAULT 0 NOT NULL,
    "burstTimeSeconds" integer DEFAULT 0 NOT NULL,
    "burstThresholdBytes" integer DEFAULT 0 NOT NULL,
    "burstUpTimeSeconds" integer DEFAULT 0 NOT NULL,
    "burstUpThresholdBytes" integer DEFAULT 0 NOT NULL,
    "contentionRatio" integer DEFAULT 1 NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    "isEnabled" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."BandwidthPool" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    subnet text,
    "vlanId" integer,
    "totalDownloadKbps" integer DEFAULT 100000 NOT NULL,
    "totalUploadKbps" integer DEFAULT 100000 NOT NULL,
    "perUserDownloadKbps" integer,
    "perUserUploadKbps" integer,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."BandwidthTopup" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    "allottedUploadMb" double precision DEFAULT 0 NOT NULL,
    "allottedDownloadMb" double precision DEFAULT 0 NOT NULL,
    "allottedTotalMb" double precision DEFAULT 0 NOT NULL,
    "applicableType" text DEFAULT 'total'::text NOT NULL,
    "bandwidthPolicyId" uuid,
    price double precision DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "validityMinutes" integer DEFAULT 60 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."BandwidthUsageDaily" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    date timestamp with time zone NOT NULL,
    "totalDownloadMb" double precision DEFAULT 0 NOT NULL,
    "totalUploadMb" double precision DEFAULT 0 NOT NULL,
    "uniqueUsers" integer DEFAULT 0 NOT NULL,
    "peakUsers" integer DEFAULT 0 NOT NULL,
    "peakTime" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."BandwidthUsageSession" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "sessionId" uuid NOT NULL,
    username text,
    "ipAddress" text NOT NULL,
    "macAddress" text,
    "planId" uuid,
    "policyId" uuid,
    "downloadBytes" integer DEFAULT 0 NOT NULL,
    "uploadBytes" integer DEFAULT 0 NOT NULL,
    "durationSeconds" integer DEFAULT 0 NOT NULL,
    "startedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endedAt" timestamp with time zone
);


CREATE TABLE public."BankAccount" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid,
    "accountName" text NOT NULL,
    "accountNumber" text NOT NULL,
    "bankName" text NOT NULL,
    "bankCode" text,
    "accountType" text DEFAULT 'checking'::text NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "openingBalance" double precision DEFAULT 0 NOT NULL,
    "currentBalance" double precision DEFAULT 0 NOT NULL,
    "lastReconciledAt" timestamp with time zone,
    "lastStatementDate" timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


CREATE TABLE public."BankTransaction" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "bankAccountId" uuid NOT NULL,
    "transactionDate" timestamp with time zone NOT NULL,
    "valueDate" timestamp with time zone,
    "transactionType" text NOT NULL,
    amount double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    balance double precision,
    description text,
    reference text,
    "chequeNumber" text,
    "payeeName" text,
    "payeeAccount" text,
    category text,
    "subCategory" text,
    "isReconciled" boolean DEFAULT false NOT NULL,
    "reconciledAt" timestamp with time zone,
    "importSource" text DEFAULT 'manual'::text NOT NULL,
    "importBatchId" uuid,
    "rawLine" text,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


CREATE TABLE public."BondConfig" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    mode text DEFAULT 'active-backup'::text NOT NULL,
    miimon integer DEFAULT 100 NOT NULL,
    "lacpRate" text DEFAULT 'slow'::text NOT NULL,
    "primaryMember" text,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."BondMember" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "bondConfigId" uuid NOT NULL,
    "interfaceId" uuid NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."Booking" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "confirmationCode" text NOT NULL,
    "externalRef" text,
    "primaryGuestId" uuid NOT NULL,
    "roomId" uuid,
    "roomTypeId" uuid NOT NULL,
    "checkIn" timestamp with time zone NOT NULL,
    "checkOut" timestamp with time zone NOT NULL,
    adults integer DEFAULT 1 NOT NULL,
    children integer DEFAULT 0 NOT NULL,
    infants integer DEFAULT 0 NOT NULL,
    "roomRate" double precision DEFAULT 0 NOT NULL,
    taxes double precision DEFAULT 0 NOT NULL,
    fees double precision DEFAULT 0 NOT NULL,
    discount double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "ratePlanId" uuid,
    "promoCode" text,
    source text DEFAULT 'direct'::text NOT NULL,
    "channelId" uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    "actualCheckIn" timestamp with time zone,
    "actualCheckOut" timestamp with time zone,
    "checkedInBy" text,
    "checkedOutBy" text,
    "cancelledAt" timestamp with time zone,
    "cancelledBy" text,
    "cancellationReason" text,
    "specialRequests" text,
    notes text,
    "internalNotes" text,
    "groupId" uuid,
    "isGroupLeader" boolean DEFAULT false NOT NULL,
    "preArrivalSent" boolean DEFAULT false NOT NULL,
    "preArrivalCompleted" boolean DEFAULT false NOT NULL,
    "preArrivalLink" text,
    "preArrivalExpires" timestamp with time zone,
    "kycRequired" boolean DEFAULT false NOT NULL,
    "kycCompleted" boolean DEFAULT false NOT NULL,
    "kycStatus" text DEFAULT 'pending'::text NOT NULL,
    "portalToken" text,
    "portalTokenExpires" timestamp with time zone,
    "eSignature" text,
    "eSignedAt" timestamp with time zone,
    preferences text DEFAULT '{}'::text NOT NULL,
    "idempotencyKey" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


CREATE TABLE public."BookingAuditLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "bookingId" uuid NOT NULL,
    action text NOT NULL,
    "oldStatus" text,
    "newStatus" text,
    notes text,
    "performedBy" text,
    "performedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."Brand" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    logo text,
    "primaryColor" text,
    "secondaryColor" text,
    standards text DEFAULT '{}'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."BridgeConfig" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    "memberInterfaces" text DEFAULT '[]'::text NOT NULL,
    "stpEnabled" boolean DEFAULT false NOT NULL,
    "forwardDelay" integer DEFAULT 15 NOT NULL,
    "helloTime" integer DEFAULT 2 NOT NULL,
    "maxAge" integer DEFAULT 20 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Camera" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "propertyId" uuid NOT NULL,
    "groupId" uuid,
    name text NOT NULL,
    location text,
    "streamUrl" text,
    "streamType" text DEFAULT 'rtsp'::text NOT NULL,
    "isRecording" boolean DEFAULT false NOT NULL,
    "recordingUrl" text,
    status text DEFAULT 'online'::text NOT NULL,
    "posX" integer,
    "posY" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."CameraEvent" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "cameraId" uuid NOT NULL,
    type text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "thumbnailUrl" text,
    "clipUrl" text,
    description text,
    confidence double precision,
    "isAlert" boolean DEFAULT false NOT NULL,
    "alertType" text,
    "acknowledgedBy" text,
    "acknowledgedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."CameraGroup" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Campaign" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    type text NOT NULL,
    subject text,
    content text NOT NULL,
    "templateId" uuid,
    "targetSegments" text DEFAULT '[]'::text NOT NULL,
    "scheduledAt" timestamp with time zone,
    "sentAt" timestamp with time zone,
    "totalRecipients" integer DEFAULT 0 NOT NULL,
    "sentCount" integer DEFAULT 0 NOT NULL,
    "openedCount" integer DEFAULT 0 NOT NULL,
    "clickedCount" integer DEFAULT 0 NOT NULL,
    "bouncedCount" integer DEFAULT 0 NOT NULL,
    "unsubscribedCount" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."CampaignSegment" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "campaignId" uuid NOT NULL,
    "segmentId" uuid NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."CancellationPolicy" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid,
    "ratePlanId" uuid,
    name text NOT NULL,
    description text,
    "freeCancelHoursBefore" integer DEFAULT 48 NOT NULL,
    "penaltyPercent" double precision DEFAULT 50 NOT NULL,
    "noShowPenaltyPercent" double precision DEFAULT 100 NOT NULL,
    "penaltyType" text DEFAULT 'percentage'::text NOT NULL,
    "penaltyFixedAmount" double precision,
    "penaltyNights" integer,
    exceptions text DEFAULT '[]'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."CaptivePortal" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    "listenIp" text DEFAULT '0.0.0.0'::text NOT NULL,
    "listenPort" integer DEFAULT 80 NOT NULL,
    "useSsl" boolean DEFAULT false NOT NULL,
    "sslCertPath" text,
    "sslKeyPath" text,
    enabled boolean DEFAULT true NOT NULL,
    "maxConcurrent" integer DEFAULT 1000 NOT NULL,
    "sessionTimeout" integer DEFAULT 86400 NOT NULL,
    "idleTimeout" integer DEFAULT 3600 NOT NULL,
    "redirectUrl" text,
    "successMessage" text,
    "failMessage" text,
    slug text DEFAULT 'default-zone'::text NOT NULL,
    "roamingMode" text DEFAULT 'auth_origin'::text NOT NULL,
    "allowsRoamingFrom" text DEFAULT '[]'::text NOT NULL,
    "authMethod" text DEFAULT 'voucher'::text NOT NULL,
    "maxBandwidthDown" integer DEFAULT 5242880 NOT NULL,
    "maxBandwidthUp" integer DEFAULT 1048576 NOT NULL,
    "bandwidthPolicy" text DEFAULT 'zone'::text NOT NULL,
    "nasIdentifier" text DEFAULT ''::text NOT NULL,
    "ssidList" text DEFAULT '[]'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ChannelConnection" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    channel text NOT NULL,
    "displayName" text,
    "apiKey" text,
    "apiSecret" text,
    username text,
    password text,
    "clientId" text,
    "clientSecret" text,
    "accessToken" text,
    "refreshToken" text,
    "tokenExpiresAt" timestamp with time zone,
    "hotelId" uuid,
    "propertyId" uuid,
    "listingId" uuid,
    "endpointUrl" text,
    credentials text,
    status text DEFAULT 'pending'::text NOT NULL,
    "lastSyncAt" timestamp with time zone,
    "lastError" text,
    "autoSync" boolean DEFAULT true NOT NULL,
    "syncInterval" integer DEFAULT 60 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ChannelDeadLetterQueue" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid,
    "syncLogId" uuid,
    "channelCode" text NOT NULL,
    operation text NOT NULL,
    payload text DEFAULT '{}'::text NOT NULL,
    error text NOT NULL,
    "attemptCount" integer DEFAULT 0 NOT NULL,
    "originalCreatedAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ChannelMapping" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "connectionId" uuid NOT NULL,
    "roomTypeId" uuid NOT NULL,
    "ratePlanId" uuid,
    "externalRoomId" uuid NOT NULL,
    "externalRoomName" text,
    "externalRateId" uuid,
    "externalRateName" text,
    "syncInventory" boolean DEFAULT true NOT NULL,
    "syncRates" boolean DEFAULT true NOT NULL,
    "syncRestrictions" boolean DEFAULT true NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ChannelRestriction" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "connectionId" uuid NOT NULL,
    "roomTypeId" uuid NOT NULL,
    "startDate" timestamp with time zone NOT NULL,
    "endDate" timestamp with time zone NOT NULL,
    "closedToArrival" boolean DEFAULT false NOT NULL,
    "closedToDeparture" boolean DEFAULT false NOT NULL,
    closed boolean DEFAULT false NOT NULL,
    "minStay" integer,
    "maxStay" integer,
    "minStayArrival" integer,
    "maxStayArrival" integer,
    "rateMin" double precision,
    "rateMax" double precision,
    source text DEFAULT 'manual'::text NOT NULL,
    "syncStatus" text DEFAULT 'pending'::text NOT NULL,
    "lastSyncedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ChannelRetryQueue" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid,
    "syncLogId" uuid,
    "channelCode" text NOT NULL,
    operation text NOT NULL,
    payload text DEFAULT '{}'::text NOT NULL,
    "attemptCount" integer DEFAULT 0 NOT NULL,
    "nextRetryAt" timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "lastError" text,
    "lastAttemptAt" timestamp with time zone,
    priority integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ChannelSyncLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "connectionId" uuid NOT NULL,
    "syncType" text NOT NULL,
    direction text NOT NULL,
    "requestPayload" text,
    "responsePayload" text,
    "statusCode" integer,
    status text NOT NULL,
    "errorMessage" text,
    "attemptCount" integer DEFAULT 1 NOT NULL,
    "correlationId" uuid,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."ChatConversation" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "guestId" uuid,
    "bookingId" uuid,
    channel text NOT NULL,
    "externalId" uuid,
    "channelRef" text,
    subject text,
    "assignedTo" uuid,
    status text DEFAULT 'open'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    "lastMessageAt" timestamp with time zone,
    "lastMessage" text,
    "unreadCount" integer DEFAULT 0 NOT NULL,
    tags text DEFAULT '[]'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ChatMessage" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "conversationId" uuid NOT NULL,
    "senderId" uuid,
    content text NOT NULL,
    "messageType" text DEFAULT 'text'::text NOT NULL,
    attachments text DEFAULT '[]'::text NOT NULL,
    "senderType" text NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    "sentAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "readAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."CoaSessionDetail" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "sessionId" uuid NOT NULL,
    username text NOT NULL,
    "userId" uuid,
    "coaType" text NOT NULL,
    "policyName" text,
    "bandwidthPercent" double precision,
    "triggeredBy" text DEFAULT 'system'::text NOT NULL,
    "nasIpAddress" text,
    "actualSessionTime" integer DEFAULT 0 NOT NULL,
    "effectiveSessionTime" integer DEFAULT 0 NOT NULL,
    "actualDownloadBytes" integer DEFAULT 0 NOT NULL,
    "actualUploadBytes" integer DEFAULT 0 NOT NULL,
    "effectiveDownloadBytes" integer DEFAULT 0 NOT NULL,
    "effectiveUploadBytes" integer DEFAULT 0 NOT NULL,
    result text DEFAULT 'pending'::text NOT NULL,
    "errorMessage" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."CommunicationChannel" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    provider text,
    config text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    capabilities text DEFAULT '[]'::text NOT NULL,
    "webhookUrl" text,
    "webhookSecret" text,
    "messagesSent" integer DEFAULT 0 NOT NULL,
    "messagesReceived" integer DEFAULT 0 NOT NULL,
    "lastMessageAt" timestamp with time zone,
    "lastError" text,
    "lastErrorAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."CompetitorPrice" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "roomTypeId" uuid,
    "competitorName" text NOT NULL,
    "competitorType" text DEFAULT 'direct'::text NOT NULL,
    "competitorUrl" text,
    rating double precision,
    date timestamp with time zone NOT NULL,
    price double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "roomTypeName" text,
    "ratePlanName" text,
    source text DEFAULT 'manual'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ConsentRecord" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "guestId" uuid,
    "userId" uuid,
    "consentType" text NOT NULL,
    "consentCategory" text DEFAULT 'preferences'::text NOT NULL,
    granted boolean DEFAULT false NOT NULL,
    "grantedAt" timestamp with time zone,
    "grantedVia" text,
    "ipAddress" text,
    "userAgent" text,
    "consentText" text,
    "consentVersion" text,
    revoked boolean DEFAULT false NOT NULL,
    "revokedAt" timestamp with time zone,
    "revokedVia" text,
    "revocationReason" text,
    "expiresAt" timestamp with time zone,
    metadata text DEFAULT '{}'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ContentFilter" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    domains text DEFAULT '[]'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "scheduleId" uuid,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."CreditNote" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "folioId" uuid NOT NULL,
    "creditNoteNumber" text NOT NULL,
    "guestId" uuid NOT NULL,
    "bookingId" uuid,
    reason text NOT NULL,
    description text,
    items text DEFAULT '[]'::text NOT NULL,
    subtotal double precision DEFAULT 0 NOT NULL,
    "taxAmount" double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'issued'::text NOT NULL,
    "appliedAmount" double precision DEFAULT 0 NOT NULL,
    "remainingAmount" double precision NOT NULL,
    "issuedBy" text,
    "approvedBy" text,
    "approvedAt" timestamp with time zone,
    "validUntil" timestamp with time zone,
    "refundedTo" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."DemandForecast" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "roomTypeId" uuid,
    date timestamp with time zone NOT NULL,
    "demandScore" integer DEFAULT 0 NOT NULL,
    "occupancyForecast" double precision,
    "adrForecast" double precision,
    "revparForecast" double precision,
    "localEvents" text DEFAULT '[]'::text NOT NULL,
    "eventsImpact" double precision DEFAULT 0 NOT NULL,
    "seasonalFactor" double precision DEFAULT 1.0 NOT NULL,
    "dayOfWeekFactor" double precision DEFAULT 1.0 NOT NULL,
    confidence double precision DEFAULT 0.5 NOT NULL,
    "generatedBy" text DEFAULT 'algorithm'::text NOT NULL,
    "modelVersion" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."DhcpBlacklist" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "subnetId" uuid,
    "macAddress" text NOT NULL,
    reason text,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."DhcpHostnameFilter" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "subnetId" uuid,
    pattern text NOT NULL,
    action text DEFAULT 'ignore'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."DhcpLease" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "subnetId" uuid NOT NULL,
    "macAddress" text NOT NULL,
    "ipAddress" text NOT NULL,
    hostname text,
    "clientId" text,
    "leaseStart" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "leaseEnd" timestamp with time zone NOT NULL,
    state text DEFAULT 'active'::text NOT NULL,
    "lastSeenAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."DhcpLeaseScript" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    "scriptPath" text NOT NULL,
    events text DEFAULT '["add","del","old"]'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."DhcpOption" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "subnetId" uuid,
    code integer NOT NULL,
    name text NOT NULL,
    value text NOT NULL,
    type text DEFAULT 'string'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."DhcpReservation" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "subnetId" uuid NOT NULL,
    "macAddress" text NOT NULL,
    "ipAddress" text NOT NULL,
    hostname text,
    "leaseTime" integer,
    "linkedType" text,
    "linkedId" uuid,
    description text,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."DhcpSubnet" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    subnet text NOT NULL,
    gateway text,
    "poolStart" text NOT NULL,
    "poolEnd" text NOT NULL,
    "leaseTime" integer DEFAULT 3600 NOT NULL,
    "vlanId" integer,
    "vlanConfigId" uuid,
    "domainName" text,
    "dnsServers" text DEFAULT '[]'::text NOT NULL,
    "ntpServers" text DEFAULT '[]'::text NOT NULL,
    "bootFileName" text,
    "nextServer" text,
    "ipv6Enabled" boolean DEFAULT false NOT NULL,
    "ipv6Prefix" text,
    "ipv6PoolStart" text,
    "ipv6PoolEnd" text,
    "ipv6LeaseTime" integer DEFAULT 3600 NOT NULL,
    "ipv6RAType" text DEFAULT 'slaac'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."DhcpTagRule" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "subnetId" uuid,
    name text NOT NULL,
    "matchType" text NOT NULL,
    "matchPattern" text NOT NULL,
    "setTag" text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."DigitalKeyAccessLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "roomId" uuid NOT NULL,
    "guestId" uuid,
    "accessType" text NOT NULL,
    method text NOT NULL,
    success boolean NOT NULL,
    "failureReason" text,
    "deviceId" uuid,
    "deviceType" text,
    "ipAddress" text,
    "accessedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."Discount" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    type text NOT NULL,
    value double precision NOT NULL,
    "minAmount" double precision DEFAULT 0,
    "maxDiscount" double precision,
    "applicableTo" text DEFAULT 'room'::text,
    "validFrom" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "validUntil" timestamp with time zone,
    "maxUses" integer,
    "usedCount" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


CREATE TABLE public."DnsRecord" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "zoneId" uuid NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'A'::text NOT NULL,
    value text NOT NULL,
    ttl integer DEFAULT 300 NOT NULL,
    priority integer,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."DnsRedirectRule" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    "matchPattern" text NOT NULL,
    "targetIp" text NOT NULL,
    "applyTo" text DEFAULT 'unauthenticated'::text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."DnsZone" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    domain text NOT NULL,
    description text,
    "vlanId" integer,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."EnergyMetric" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    date timestamp with time zone NOT NULL,
    "electricityKwh" double precision DEFAULT 0 NOT NULL,
    "gasM3" double precision DEFAULT 0 NOT NULL,
    "waterM3" double precision DEFAULT 0 NOT NULL,
    "electricityCost" double precision DEFAULT 0 NOT NULL,
    "gasCost" double precision DEFAULT 0 NOT NULL,
    "waterCost" double precision DEFAULT 0 NOT NULL,
    "carbonFootprint" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."Event" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "spaceId" uuid,
    name text NOT NULL,
    type text NOT NULL,
    description text,
    "organizerName" text NOT NULL,
    "organizerEmail" text NOT NULL,
    "organizerPhone" text NOT NULL,
    "startDate" timestamp with time zone NOT NULL,
    "endDate" timestamp with time zone NOT NULL,
    "setupStart" timestamp with time zone,
    "teardownEnd" timestamp with time zone,
    "expectedAttendance" integer NOT NULL,
    "actualAttendance" integer,
    "spaceCharge" double precision DEFAULT 0 NOT NULL,
    "cateringCharge" double precision DEFAULT 0 NOT NULL,
    "avCharge" double precision DEFAULT 0 NOT NULL,
    "otherCharges" double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "depositAmount" double precision DEFAULT 0 NOT NULL,
    "depositPaid" boolean DEFAULT false NOT NULL,
    status text DEFAULT 'inquiry'::text NOT NULL,
    "contractUrl" text,
    "contractSignedAt" timestamp with time zone,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."EventResource" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "eventId" uuid NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    description text,
    quantity integer DEFAULT 1 NOT NULL,
    "unitPrice" double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "vendorId" uuid,
    "vendorName" text,
    "staffId" uuid,
    "staffName" text,
    status text DEFAULT 'pending'::text NOT NULL,
    "setupTime" timestamp with time zone,
    "teardownTime" timestamp with time zone,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."EventSpace" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    "minCapacity" integer NOT NULL,
    "maxCapacity" integer NOT NULL,
    "sizeSqMeters" double precision,
    "sizeSqFeet" double precision,
    "hourlyRate" double precision,
    "dailyRate" double precision,
    amenities text DEFAULT '[]'::text NOT NULL,
    images text DEFAULT '[]'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ExchangeRate" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "fromCurrency" text NOT NULL,
    "toCurrency" text NOT NULL,
    rate double precision NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    "validFrom" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "validUntil" timestamp with time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ExternalReview" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid,
    source text DEFAULT 'unknown'::text NOT NULL,
    "externalId" uuid,
    content text NOT NULL,
    rating integer NOT NULL,
    "reviewerName" text,
    "reviewDate" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "sentimentScore" double precision,
    "sentimentLabel" text,
    "sentimentAspects" text,
    "sentimentKeywords" text,
    "responseText" text,
    "respondedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."FairAccessPolicy" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    "cycleType" text DEFAULT 'daily'::text NOT NULL,
    "limitType" text DEFAULT 'total'::text NOT NULL,
    "dataLimitMb" double precision NOT NULL,
    "dataLimitUnit" text DEFAULT 'mb'::text NOT NULL,
    "switchOverBwPolicyId" uuid,
    "cycleResetHour" integer DEFAULT 23 NOT NULL,
    "cycleResetMinute" integer DEFAULT 59 NOT NULL,
    "applicableOn" text DEFAULT 'total'::text NOT NULL,
    "isEnabled" boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."FeatureAnnouncement" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    "targetRoles" text DEFAULT '[]'::text NOT NULL,
    "startsAt" timestamp with time zone,
    "endsAt" timestamp with time zone,
    dismissible boolean DEFAULT true NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."FirewallRule" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "zoneId" uuid NOT NULL,
    chain text DEFAULT 'input'::text NOT NULL,
    protocol text,
    "sourceIp" text,
    "sourcePort" integer,
    "destIp" text,
    "destPort" integer,
    action text DEFAULT 'accept'::text NOT NULL,
    "jumpTarget" text,
    "logPrefix" text,
    enabled boolean DEFAULT true NOT NULL,
    comment text,
    priority integer DEFAULT 0 NOT NULL,
    "scheduleId" uuid,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."FirewallSchedule" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    "daysOfWeek" text DEFAULT '1,2,3,4,5,6,7'::text NOT NULL,
    "startTime" text DEFAULT '00:00'::text NOT NULL,
    "endTime" text DEFAULT '23:59'::text NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."FirewallZone" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    interfaces text DEFAULT '[]'::text NOT NULL,
    "inputPolicy" text DEFAULT 'accept'::text NOT NULL,
    "forwardPolicy" text DEFAULT 'accept'::text NOT NULL,
    "outputPolicy" text DEFAULT 'accept'::text NOT NULL,
    masquerade boolean DEFAULT false NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."FloorPlan" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "propertyId" uuid NOT NULL,
    floor integer NOT NULL,
    name text NOT NULL,
    "imageUrl" text,
    "svgData" text,
    "roomPositions" text DEFAULT '[]'::text NOT NULL,
    width integer DEFAULT 800 NOT NULL,
    height integer DEFAULT 600 NOT NULL,
    "gridSize" integer DEFAULT 20 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."FloorPlanRoom" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "floorPlanId" uuid NOT NULL,
    "roomId" uuid NOT NULL,
    x integer NOT NULL,
    y integer NOT NULL,
    width integer DEFAULT 80 NOT NULL,
    height integer DEFAULT 60 NOT NULL,
    rotation integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Folio" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "bookingId" uuid NOT NULL,
    "folioNumber" text NOT NULL,
    "guestId" uuid NOT NULL,
    subtotal double precision DEFAULT 0 NOT NULL,
    taxes double precision DEFAULT 0 NOT NULL,
    discount double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "paidAmount" double precision DEFAULT 0 NOT NULL,
    balance double precision DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    "openedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "closedAt" timestamp with time zone,
    "invoiceNumber" text,
    "invoiceUrl" text,
    "invoiceIssuedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."FolioLineItem" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "folioId" uuid NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    "unitPrice" double precision NOT NULL,
    "totalAmount" double precision NOT NULL,
    "serviceDate" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "referenceType" text,
    "referenceId" uuid,
    "taxRate" double precision DEFAULT 0 NOT NULL,
    "taxAmount" double precision DEFAULT 0 NOT NULL,
    "itemCurrency" text DEFAULT 'USD'::text NOT NULL,
    "exchangeRate" double precision DEFAULT 1 NOT NULL,
    "baseAmount" double precision DEFAULT 0 NOT NULL,
    "postedBy" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "discountId" uuid
);


CREATE TABLE public."FolioTransfer" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "fromFolioId" uuid NOT NULL,
    "toFolioId" uuid NOT NULL,
    "folioLineItemId" uuid,
    "bookingId" uuid,
    amount double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    reason text NOT NULL,
    description text,
    status text DEFAULT 'completed'::text NOT NULL,
    "transferredBy" text,
    "approvedBy" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."GDPRRequest" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "guestId" uuid,
    "requestType" text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "requestSource" text DEFAULT 'guest'::text NOT NULL,
    "requesterEmail" text,
    "requesterName" text,
    "verificationToken" text,
    "verifiedAt" timestamp with time zone,
    "expiresAt" timestamp with time zone,
    priority text DEFAULT 'normal'::text NOT NULL,
    notes text,
    "rejectionReason" text,
    "completedAt" timestamp with time zone,
    "completedBy" text,
    "downloadUrl" text,
    "downloadExpiresAt" timestamp with time zone,
    "dataSnapshot" text,
    metadata text DEFAULT '{}'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."GoogleHotelAdsConnection" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "accountId" uuid,
    "subAccountId" uuid,
    "hotelId" uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    "connectionMode" text DEFAULT 'live'::text NOT NULL,
    "partnerId" uuid,
    "hotelCenterId" uuid,
    "priceFeedUrl" text,
    "priceFeedFormat" text DEFAULT 'xml'::text NOT NULL,
    "lastPriceFeedAt" timestamp with time zone,
    "lastBookingFeedAt" timestamp with time zone,
    "lastError" text,
    "lastErrorAt" timestamp with time zone,
    "totalBookings" integer DEFAULT 0 NOT NULL,
    "totalRevenue" double precision DEFAULT 0 NOT NULL,
    "totalSpend" double precision DEFAULT 0 NOT NULL,
    "avgRoas" double precision DEFAULT 0 NOT NULL,
    "bidStrategy" text DEFAULT 'auto'::text NOT NULL,
    "baseBidModifier" double precision DEFAULT 1.0 NOT NULL,
    "occupancyBidModifier" text DEFAULT '{}'::text NOT NULL,
    "dayOfWeekBidModifier" text DEFAULT '{}'::text NOT NULL,
    "advanceBookingModifier" text DEFAULT '{}'::text NOT NULL,
    "lengthOfStayModifier" text DEFAULT '{}'::text NOT NULL,
    "autoBidEnabled" boolean DEFAULT true NOT NULL,
    "autoBidRules" text DEFAULT '[]'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."GroupBooking" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    "contactName" text,
    "contactEmail" text,
    "contactPhone" text,
    "checkIn" timestamp with time zone NOT NULL,
    "checkOut" timestamp with time zone NOT NULL,
    "totalRooms" integer DEFAULT 1 NOT NULL,
    "bookedRooms" integer DEFAULT 0 NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "depositAmount" double precision DEFAULT 0 NOT NULL,
    "depositPaid" boolean DEFAULT false NOT NULL,
    status text DEFAULT 'inquiry'::text NOT NULL,
    "contractUrl" text,
    "contractSignedAt" timestamp with time zone,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Guest" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    email public.citext,
    phone text,
    "alternatePhone" text,
    nationality text,
    "dateOfBirth" timestamp with time zone,
    gender text,
    "idType" text,
    "idNumber" text,
    "idExpiry" timestamp with time zone,
    "idCountry" text,
    address text,
    city text,
    state text,
    country text,
    "postalCode" text,
    preferences text DEFAULT '{}'::text NOT NULL,
    "dietaryRequirements" text,
    "specialRequests" text,
    avatar text,
    notes text,
    tags text DEFAULT '[]'::text NOT NULL,
    "loyaltyTier" text DEFAULT 'bronze'::text NOT NULL,
    "loyaltyPoints" integer DEFAULT 0 NOT NULL,
    "totalStays" integer DEFAULT 0 NOT NULL,
    "totalSpent" double precision DEFAULT 0 NOT NULL,
    "isVip" boolean DEFAULT false NOT NULL,
    "vipLevel" text,
    source text DEFAULT 'direct'::text NOT NULL,
    "sourceId" uuid,
    "emailOptIn" boolean DEFAULT false NOT NULL,
    "smsOptIn" boolean DEFAULT false NOT NULL,
    "kycStatus" text DEFAULT 'pending'::text NOT NULL,
    "kycVerifiedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


CREATE TABLE public."GuestBehavior" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "guestId" uuid NOT NULL,
    "visitCount" integer DEFAULT 0 NOT NULL,
    "firstVisitAt" timestamp with time zone,
    "lastVisitAt" timestamp with time zone,
    "totalBookings" integer DEFAULT 0 NOT NULL,
    "cancelledBookings" integer DEFAULT 0 NOT NULL,
    "noShowCount" integer DEFAULT 0 NOT NULL,
    "totalSpent" double precision DEFAULT 0 NOT NULL,
    "avgBookingValue" double precision DEFAULT 0 NOT NULL,
    "lifetimeValue" double precision DEFAULT 0 NOT NULL,
    "totalNights" integer DEFAULT 0 NOT NULL,
    "avgStayLength" double precision DEFAULT 0 NOT NULL,
    "preferredRoomTypes" text DEFAULT '[]'::text NOT NULL,
    "bookingSources" text DEFAULT '{}'::text NOT NULL,
    "serviceRequests" integer DEFAULT 0 NOT NULL,
    "foodOrders" integer DEFAULT 0 NOT NULL,
    "spaBookings" integer DEFAULT 0 NOT NULL,
    "learnedPreferences" text DEFAULT '{}'::text NOT NULL,
    "emailOpens" integer DEFAULT 0 NOT NULL,
    "emailClicks" integer DEFAULT 0 NOT NULL,
    "smsResponses" integer DEFAULT 0 NOT NULL,
    "engagementScore" double precision DEFAULT 0 NOT NULL,
    "vipScore" double precision DEFAULT 0 NOT NULL,
    "vipDetectedAt" timestamp with time zone,
    "isRepeatGuest" boolean DEFAULT false NOT NULL,
    "repeatGuestSince" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."GuestDocument" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "guestId" uuid NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    "fileUrl" text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "verifiedAt" timestamp with time zone,
    "verifiedBy" text,
    "rejectionReason" text,
    "expiryDate" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."GuestFeedback" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "guestId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    type text NOT NULL,
    category text NOT NULL,
    subject text NOT NULL,
    description text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    "resolvedAt" timestamp with time zone,
    "resolvedBy" text,
    resolution text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."GuestJourney" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "guestId" uuid NOT NULL,
    "bookingId" uuid,
    stage text NOT NULL,
    "eventType" text NOT NULL,
    title text NOT NULL,
    description text,
    metadata text DEFAULT '{}'::text NOT NULL,
    source text DEFAULT 'system'::text NOT NULL,
    "occurredAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."GuestRecommendation" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "guestId" uuid NOT NULL,
    type text NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    description text,
    reason text,
    "estimatedValue" double precision,
    "relevanceScore" double precision DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "shownAt" timestamp with time zone,
    "acceptedAt" timestamp with time zone,
    "rejectedAt" timestamp with time zone,
    "expiresAt" timestamp with time zone,
    "actionType" text,
    "actionData" text,
    "isAiGenerated" boolean DEFAULT false NOT NULL,
    "aiConfidence" double precision,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."GuestReview" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "guestId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "overallRating" integer NOT NULL,
    "cleanlinessRating" integer,
    "serviceRating" integer,
    "locationRating" integer,
    "valueRating" integer,
    title text,
    comment text,
    source text DEFAULT 'internal'::text NOT NULL,
    "responseText" text,
    "respondedAt" timestamp with time zone,
    "respondedBy" text,
    "sentimentScore" double precision,
    "sentimentLabel" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."GuestSegment" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    rules text NOT NULL,
    "memberCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."GuestStay" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "guestId" uuid NOT NULL,
    "bookingId" uuid NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "roomNights" integer DEFAULT 1 NOT NULL,
    "feedbackGiven" boolean DEFAULT false NOT NULL,
    "reviewGiven" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."HelpArticle" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid,
    title text NOT NULL,
    slug text NOT NULL,
    content text NOT NULL,
    excerpt text,
    category text NOT NULL,
    tags text DEFAULT '[]'::text NOT NULL,
    "featuredImage" text,
    "videoUrl" text,
    "viewCount" integer DEFAULT 0 NOT NULL,
    "helpfulCount" integer DEFAULT 0 NOT NULL,
    "notHelpfulCount" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    "authorId" uuid,
    "metaTitle" text,
    "metaDescription" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "publishedAt" timestamp with time zone
);


CREATE TABLE public."HelpCategory" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    icon text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "parentId" uuid,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."IdempotencyKey" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    key text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" uuid,
    "requestHash" text,
    "responseSnapshot" text,
    status text DEFAULT 'processing'::text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."InspectionResult" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "roomId" uuid NOT NULL,
    "taskId" uuid,
    "templateId" uuid NOT NULL,
    "inspectorId" uuid NOT NULL,
    score integer,
    passed boolean DEFAULT false NOT NULL,
    items text DEFAULT '[]'::text NOT NULL,
    notes text,
    "completedAt" timestamp with time zone,
    "reAssigned" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."InspectionTemplate" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid,
    name text NOT NULL,
    description text,
    "roomType" text,
    category text DEFAULT 'room'::text NOT NULL,
    items text DEFAULT '[]'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Integration" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    name text,
    config text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "lastSyncAt" timestamp with time zone,
    "lastError" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."InterfaceAlias" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "interfaceId" uuid NOT NULL,
    "interfaceName" text NOT NULL,
    "ipAddress" text NOT NULL,
    netmask text NOT NULL,
    description text,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."InterfaceConfig" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "interfaceId" uuid NOT NULL,
    mode text DEFAULT 'static'::text NOT NULL,
    "ipAddress" text,
    netmask text,
    gateway text,
    "dnsPrimary" text,
    "dnsSecondary" text,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."InterfaceRole" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "interfaceId" uuid NOT NULL,
    role text DEFAULT 'lan'::text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."InventoryLock" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "roomId" uuid,
    "roomTypeId" uuid,
    "startDate" timestamp with time zone NOT NULL,
    "endDate" timestamp with time zone NOT NULL,
    reason text NOT NULL,
    "lockType" text DEFAULT 'maintenance'::text NOT NULL,
    "sessionId" uuid,
    "expiresAt" timestamp with time zone,
    "createdBy" uuid,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Invoice" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "invoiceNumber" text NOT NULL,
    "folioId" uuid,
    "customerName" text NOT NULL,
    "customerEmail" text,
    "customerAddress" text,
    "customerPhone" text,
    subtotal double precision NOT NULL,
    taxes double precision DEFAULT 0 NOT NULL,
    discount double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "issuedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dueAt" timestamp with time zone,
    "paidAt" timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    "pdfUrl" text,
    notes text,
    "lineItems" text DEFAULT '[]'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."IoTCommand" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "deviceId" uuid NOT NULL,
    command text NOT NULL,
    parameters text DEFAULT '{}'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "executedAt" timestamp with time zone,
    error text,
    source text DEFAULT 'manual'::text NOT NULL,
    "triggeredBy" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."IoTDevice" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "roomId" uuid,
    name text NOT NULL,
    type text NOT NULL,
    manufacturer text,
    model text,
    "serialNumber" text,
    protocol text DEFAULT 'wifi'::text NOT NULL,
    "ipAddress" text,
    "macAddress" text,
    status text DEFAULT 'offline'::text NOT NULL,
    "lastHeartbeat" timestamp with time zone,
    "firmwareVersion" text,
    config text DEFAULT '{}'::text NOT NULL,
    "currentState" text DEFAULT '{}'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."IoTReading" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "deviceId" uuid NOT NULL,
    type text NOT NULL,
    value double precision NOT NULL,
    unit text,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."IpPool" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid,
    name text NOT NULL,
    description text,
    gateway inet,
    subnet inet,
    "isDefault" boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE public."IpPoolRange" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "poolId" uuid NOT NULL,
    "startIp" inet NOT NULL,
    "endIp" inet NOT NULL,
    comment text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."LiveSession" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "acctSessionId" uuid NOT NULL,
    username text NOT NULL,
    "userId" uuid,
    "planId" uuid,
    "nasIpAddress" text NOT NULL,
    "nasIdentifier" text,
    "nasPortType" text,
    "framedIpAddress" text DEFAULT ''::text NOT NULL,
    "macAddress" text DEFAULT ''::text NOT NULL,
    "clientIpAddress" text DEFAULT ''::text NOT NULL,
    "deviceType" text,
    "operatingSystem" text,
    manufacturer text,
    "bandwidthPolicyId" uuid,
    "bandwidthDown" integer DEFAULT 0 NOT NULL,
    "bandwidthUp" integer DEFAULT 0 NOT NULL,
    "maxInputOctets" integer DEFAULT 0 NOT NULL,
    "maxOutputOctets" integer DEFAULT 0 NOT NULL,
    "maxTotalOctets" integer DEFAULT 0 NOT NULL,
    "sessionTimeout" integer DEFAULT 0 NOT NULL,
    "idleTimeout" integer DEFAULT 0 NOT NULL,
    "lastInterimUpdate" timestamp with time zone,
    "currentInputBytes" integer DEFAULT 0 NOT NULL,
    "currentOutputBytes" integer DEFAULT 0 NOT NULL,
    "currentSessionTime" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "roomNo" text,
    "hotelId" uuid,
    "urlFilterPolicy" text,
    "authMethod" text,
    "startedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."LoyaltyPointTransaction" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "guestId" uuid NOT NULL,
    points integer NOT NULL,
    balance integer NOT NULL,
    type text NOT NULL,
    source text,
    "referenceId" uuid,
    "referenceType" text,
    description text,
    "expiresAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."LoyaltyRedemption" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "guestId" uuid NOT NULL,
    "rewardId" uuid NOT NULL,
    "pointsSpent" integer NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    "redemptionCode" text,
    "redeemedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp with time zone,
    "cancelledAt" timestamp with time zone,
    "cancelledReason" text,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."LoyaltyReward" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    category text DEFAULT 'general'::text NOT NULL,
    "pointsCost" integer NOT NULL,
    "monetaryValue" double precision DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "imageUrl" text,
    "isAvailable" boolean DEFAULT true NOT NULL,
    "availableFrom" timestamp with time zone,
    "availableUntil" timestamp with time zone,
    "maxRedemptions" integer,
    "currentRedemptions" integer DEFAULT 0 NOT NULL,
    "minTierRequired" text,
    "termsConditions" text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."LoyaltyTier" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    "displayName" text NOT NULL,
    "minPoints" integer DEFAULT 0 NOT NULL,
    "maxPoints" integer,
    "pointsMultiplier" double precision DEFAULT 1.0 NOT NULL,
    benefits text DEFAULT '[]'::text NOT NULL,
    color text DEFAULT '#cd7f32'::text NOT NULL,
    icon text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."LoyaltyTransaction" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "guestId" uuid NOT NULL,
    points integer NOT NULL,
    type text NOT NULL,
    reason text NOT NULL,
    "referenceType" text,
    "referenceId" uuid,
    "balanceAfter" integer NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."MacFilter" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "macAddress" text NOT NULL,
    action text DEFAULT 'allow'::text NOT NULL,
    "listType" text DEFAULT 'blacklist'::text NOT NULL,
    description text,
    "linkedType" text,
    "linkedId" uuid,
    "expiresAt" timestamp with time zone,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."MaintenanceBlock" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "roomId" uuid NOT NULL,
    "roomNumber" text NOT NULL,
    reason text NOT NULL,
    description text,
    "startDate" timestamp with time zone NOT NULL,
    "endDate" timestamp with time zone,
    "blockedBy" text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    "vendorId" uuid,
    "estimatedCost" double precision,
    "actualCost" double precision,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ManualTransaction" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "paymentId" uuid NOT NULL,
    amount double precision NOT NULL,
    currency text NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    "refundAmount" double precision DEFAULT 0 NOT NULL,
    "refundId" uuid,
    metadata text DEFAULT '{}'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."MenuItem" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "propertyId" uuid NOT NULL,
    "categoryId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    "imageUrl" text,
    price double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    options text DEFAULT '[]'::text NOT NULL,
    "isVegetarian" boolean DEFAULT false NOT NULL,
    "isVegan" boolean DEFAULT false NOT NULL,
    "isGlutenFree" boolean DEFAULT false NOT NULL,
    allergens text DEFAULT '[]'::text NOT NULL,
    "isAvailable" boolean DEFAULT true NOT NULL,
    "availableTimes" text,
    "preparationTime" integer,
    "kitchenStation" text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


CREATE TABLE public."MessageTemplate" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    channel text NOT NULL,
    subject text,
    body text NOT NULL,
    variables text DEFAULT '[]'::text NOT NULL,
    "isQuickReply" boolean DEFAULT false NOT NULL,
    shortcut text,
    "whatsappTemplateId" uuid,
    "whatsappCategory" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "usageCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."MetasearchConnection" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    platform text NOT NULL,
    "externalId" uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    "connectionUrl" text,
    "feedFormat" text DEFAULT 'xml'::text NOT NULL,
    "lastSyncAt" timestamp with time zone,
    "lastError" text,
    "lastErrorAt" timestamp with time zone,
    impressions integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    bookings integer DEFAULT 0 NOT NULL,
    revenue double precision DEFAULT 0 NOT NULL,
    cost double precision DEFAULT 0 NOT NULL,
    ctr double precision DEFAULT 0 NOT NULL,
    config text DEFAULT '{}'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."MultiWanConfig" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    mode text DEFAULT 'weighted'::text NOT NULL,
    "healthCheckUrl" text DEFAULT 'https://1.1.1.1'::text NOT NULL,
    "healthCheckInterval" integer DEFAULT 10 NOT NULL,
    "healthCheckTimeout" integer DEFAULT 3 NOT NULL,
    "failoverThreshold" integer DEFAULT 3 NOT NULL,
    "autoSwitchback" boolean DEFAULT true NOT NULL,
    "switchbackDelay" integer DEFAULT 300 NOT NULL,
    "flushConnectionsOnFailover" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."MultiWanMember" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "multiWanConfigId" uuid NOT NULL,
    "interfaceName" text NOT NULL,
    "interfaceId" uuid,
    weight integer DEFAULT 1 NOT NULL,
    gateway text,
    "healthStatus" text DEFAULT 'unknown'::text NOT NULL,
    "lastHealthCheck" timestamp with time zone,
    enabled boolean DEFAULT true NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."NasHealthLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "nasIpAddress" text NOT NULL,
    "nasName" text,
    "isOnline" boolean DEFAULT false NOT NULL,
    "liveUsers" integer DEFAULT 0 NOT NULL,
    "totalAuths" integer DEFAULT 0 NOT NULL,
    "totalAccts" integer DEFAULT 0 NOT NULL,
    "avgLatencyMs" double precision,
    "lastSeenAt" timestamp with time zone,
    "checkIntervalSec" integer DEFAULT 60 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."NatLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "sourceIp" text NOT NULL,
    "sourcePort" integer NOT NULL,
    "destIp" text NOT NULL,
    "destPort" integer NOT NULL,
    protocol text NOT NULL,
    "destDomain" text,
    action text DEFAULT 'allow'::text NOT NULL,
    bytes integer DEFAULT 0 NOT NULL,
    "sessionId" uuid
);


CREATE TABLE public."NetworkConfigBackup" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    "configData" text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "autoBackup" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."NetworkInterface" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'ethernet'::text NOT NULL,
    "hwAddress" text,
    mtu integer DEFAULT 1500 NOT NULL,
    speed text,
    status text DEFAULT 'down'::text NOT NULL,
    carrier boolean DEFAULT false NOT NULL,
    "isManagement" boolean DEFAULT false NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Notification" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    type text NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    data text DEFAULT '{}'::text NOT NULL,
    link text,
    icon text,
    image text,
    priority text DEFAULT 'normal'::text NOT NULL,
    "readAt" timestamp with time zone,
    "dismissedAt" timestamp with time zone,
    "actionType" text,
    "actionData" text,
    "expiresAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."NotificationLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "templateId" uuid,
    "recipientType" text NOT NULL,
    "recipientId" uuid NOT NULL,
    "recipientEmail" text,
    "recipientPhone" text,
    channel text NOT NULL,
    subject text,
    body text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "errorMessage" text,
    "externalId" uuid,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "sentAt" timestamp with time zone,
    "deliveredAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."NotificationPreference" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    category text NOT NULL,
    "emailEnabled" boolean DEFAULT true NOT NULL,
    "smsEnabled" boolean DEFAULT true NOT NULL,
    "pushEnabled" boolean DEFAULT true NOT NULL,
    "inAppEnabled" boolean DEFAULT true NOT NULL,
    "quietHoursStart" text DEFAULT '22:00'::text,
    "quietHoursEnd" text DEFAULT '08:00'::text,
    "quietHoursEnabled" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."NotificationTemplate" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    "triggerEvent" text NOT NULL,
    subject text,
    body text NOT NULL,
    variables text DEFAULT '[]'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Order" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "tableId" uuid,
    "orderNumber" text NOT NULL,
    "guestId" uuid,
    "bookingId" uuid,
    "guestName" text,
    "orderType" text DEFAULT 'dine_in'::text NOT NULL,
    subtotal double precision DEFAULT 0 NOT NULL,
    taxes double precision DEFAULT 0 NOT NULL,
    discount double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "kitchenStatus" text DEFAULT 'pending'::text NOT NULL,
    "kitchenStartedAt" timestamp with time zone,
    "kitchenCompletedAt" timestamp with time zone,
    "folioId" uuid,
    "addToFolio" boolean DEFAULT false NOT NULL,
    notes text,
    "specialInstructions" text,
    "confirmedAt" timestamp with time zone,
    "completedAt" timestamp with time zone,
    "cancelledAt" timestamp with time zone,
    "cancelledReason" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."OrderCategory" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    "imageUrl" text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."OrderItem" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "orderId" uuid NOT NULL,
    "menuItemId" uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    "unitPrice" double precision NOT NULL,
    "totalAmount" double precision NOT NULL,
    notes text,
    options text,
    status text DEFAULT 'pending'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ParkingSlot" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid,
    number text NOT NULL,
    floor integer DEFAULT 1 NOT NULL,
    type text DEFAULT 'standard'::text NOT NULL,
    "vehicleType" text DEFAULT 'car'::text NOT NULL,
    width double precision,
    length double precision,
    "hasCharging" boolean DEFAULT false NOT NULL,
    "chargerType" text,
    status text DEFAULT 'available'::text NOT NULL,
    "posX" integer,
    "posY" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Payment" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "folioId" uuid NOT NULL,
    amount double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    method text NOT NULL,
    gateway text,
    "gatewayRef" text,
    "gatewayFee" double precision,
    "gatewayStatus" text,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "failoverTo" text,
    "routingDecision" text,
    "cardType" text,
    "cardLast4" text,
    "cardExpiry" text,
    "transactionId" uuid,
    reference text,
    status text DEFAULT 'pending'::text NOT NULL,
    "refundAmount" double precision DEFAULT 0 NOT NULL,
    "refundedAt" timestamp with time zone,
    "refundReason" text,
    "guestId" uuid,
    "idempotencyKey" text,
    "processedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."PaymentGateway" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    provider text NOT NULL,
    priority integer DEFAULT 1 NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    status text DEFAULT 'inactive'::text NOT NULL,
    mode text DEFAULT 'test'::text NOT NULL,
    "apiKey" text,
    "secretKey" text,
    "merchantId" uuid,
    "webhookSecret" text,
    "feePercentage" double precision DEFAULT 0 NOT NULL,
    "feeFixed" double precision DEFAULT 0 NOT NULL,
    "supportedCurrencies" text DEFAULT 'USD'::text NOT NULL,
    "totalTransactions" integer DEFAULT 0 NOT NULL,
    "totalVolume" double precision DEFAULT 0 NOT NULL,
    "lastSyncAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."PaymentSchedule" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "folioId" uuid NOT NULL,
    "bookingId" uuid NOT NULL,
    "guestId" uuid NOT NULL,
    "scheduleName" text NOT NULL,
    "totalAmount" double precision NOT NULL,
    "depositAmount" double precision DEFAULT 0 NOT NULL,
    "depositDueDate" timestamp with time zone,
    installments text DEFAULT '[]'::text NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "paidAmount" double precision DEFAULT 0 NOT NULL,
    "remainingAmount" double precision NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."PortalAuthentication" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "portalId" uuid NOT NULL,
    method text DEFAULT 'voucher'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    config text DEFAULT '{}'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."PortalMapping" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "portalId" uuid NOT NULL,
    "vlanId" integer,
    "vlanConfigId" uuid,
    ssid text,
    subnet text,
    priority integer DEFAULT 0 NOT NULL,
    "fallbackPortalId" uuid,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."PortalPage" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "portalId" uuid NOT NULL,
    language text DEFAULT 'en'::text NOT NULL,
    title text,
    subtitle text,
    "logoUrl" text,
    "backgroundImage" text,
    "backgroundColor" text DEFAULT '#ffffff'::text NOT NULL,
    "textColor" text DEFAULT '#1f2937'::text NOT NULL,
    "accentColor" text DEFAULT '#0d9488'::text NOT NULL,
    "termsText" text,
    "termsUrl" text,
    "customCss" text DEFAULT ''::text NOT NULL,
    "customHtml" text DEFAULT ''::text NOT NULL,
    "showSocial" boolean DEFAULT false NOT NULL,
    "showBranding" boolean DEFAULT true NOT NULL,
    "formFields" text DEFAULT '{"username":true,"password":true,"roomNumber":false,"phone":false,"voucherCode":false,"termsCheckbox":true}'::text NOT NULL,
    "authFlow" text DEFAULT 'pms_credentials'::text NOT NULL,
    "socialProviders" text DEFAULT '{"google":false,"facebook":false,"apple":false}'::text NOT NULL,
    "voucherTemplate" text DEFAULT 'default'::text NOT NULL,
    "designSettings" text DEFAULT '{}'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."PortalTemplate" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    category text DEFAULT 'hotel'::text NOT NULL,
    thumbnail text,
    "htmlContent" text NOT NULL,
    "cssContent" text NOT NULL,
    "isBuiltIn" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."PortalWhitelist" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "propertyId" uuid NOT NULL,
    domain text NOT NULL,
    path text,
    description text,
    protocol text DEFAULT 'https'::text NOT NULL,
    "bypassAuth" boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."PortForwardRule" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    protocol text DEFAULT 'tcp'::text NOT NULL,
    "externalPort" integer NOT NULL,
    "internalIp" text NOT NULL,
    "internalPort" integer NOT NULL,
    "interfaceId" uuid,
    enabled boolean DEFAULT true NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."PreventiveMaintenance" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    title text NOT NULL,
    description text,
    "assetId" uuid,
    frequency text NOT NULL,
    "frequencyValue" integer,
    "assignedRoleId" uuid,
    checklist text DEFAULT '[]'::text NOT NULL,
    "lastCompletedAt" timestamp with time zone,
    "nextDueAt" timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    "estimatedDuration" integer,
    "estimatedCost" double precision,
    priority text DEFAULT 'medium'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


CREATE TABLE public."PriceOverride" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "ratePlanId" uuid NOT NULL,
    date timestamp with time zone NOT NULL,
    price double precision NOT NULL,
    reason text,
    "minStay" integer,
    "closedToArrival" boolean DEFAULT false NOT NULL,
    "closedToDeparture" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."PricingRule" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid,
    name text NOT NULL,
    type text NOT NULL,
    description text,
    value double precision NOT NULL,
    "valueType" text DEFAULT 'percentage'::text NOT NULL,
    conditions text DEFAULT '{}'::text NOT NULL,
    priority integer DEFAULT 1 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "effectiveFrom" timestamp with time zone NOT NULL,
    "effectiveTo" timestamp with time zone,
    "roomTypes" text DEFAULT '[]'::text NOT NULL,
    "appliedCount" integer DEFAULT 0 NOT NULL,
    "lastAppliedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Promotion" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    "discountType" text NOT NULL,
    "discountValue" double precision NOT NULL,
    "maxDiscount" double precision,
    "minBookingValue" double precision,
    "minNights" integer,
    "applicableRoomTypes" text DEFAULT '[]'::text NOT NULL,
    "startsAt" timestamp with time zone NOT NULL,
    "endsAt" timestamp with time zone NOT NULL,
    "maxUses" integer,
    "usedCount" integer DEFAULT 0 NOT NULL,
    "maxUsesPerUser" integer,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Property" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    type text DEFAULT 'hotel'::text NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    state text,
    country text NOT NULL,
    "postalCode" text,
    latitude double precision,
    longitude double precision,
    email text,
    phone text,
    website text,
    logo text,
    "primaryColor" text,
    "secondaryColor" text,
    "checkInTime" text DEFAULT '14:00'::text NOT NULL,
    "checkOutTime" text DEFAULT '11:00'::text NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "taxId" uuid,
    "taxType" text DEFAULT 'gst'::text NOT NULL,
    "defaultTaxRate" double precision DEFAULT 0 NOT NULL,
    "taxComponents" text DEFAULT '[]'::text NOT NULL,
    "serviceChargePercent" double precision DEFAULT 0 NOT NULL,
    "includeTaxInPrice" boolean DEFAULT false NOT NULL,
    "totalRooms" integer DEFAULT 0 NOT NULL,
    "totalFloors" integer DEFAULT 0 NOT NULL,
    "noShowSettings" text DEFAULT '{"noShowBufferHours":1,"autoProcessNoShows":false,"noShowNotificationEnabled":true}'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone,
    "brandId" uuid
);


CREATE TABLE public."PurchaseOrder" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "vendorId" uuid NOT NULL,
    "orderNumber" text NOT NULL,
    "orderDate" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expectedDate" timestamp with time zone,
    "receivedDate" timestamp with time zone,
    subtotal double precision DEFAULT 0 NOT NULL,
    taxes double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    "approvedBy" text,
    "approvedAt" timestamp with time zone,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."PurchaseOrderItem" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "purchaseOrderId" uuid NOT NULL,
    "stockItemId" uuid NOT NULL,
    quantity double precision NOT NULL,
    "unitPrice" double precision NOT NULL,
    "totalAmount" double precision NOT NULL,
    "receivedQuantity" double precision,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."RadiusAuthLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "propertyId" uuid NOT NULL,
    username text NOT NULL,
    "authResult" text NOT NULL,
    "authType" text,
    "nasIpAddress" text,
    "nasIdentifier" text,
    "callingStationId" uuid,
    "calledStationId" uuid,
    "clientIpAddress" text,
    "replyMessage" text,
    "terminateReason" text,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."RadiusCoaLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "propertyId" uuid NOT NULL,
    action text NOT NULL,
    username text NOT NULL,
    "sessionId" uuid,
    "nasIpAddress" text,
    "sharedSecret" text,
    attributes text,
    result text NOT NULL,
    "responseCode" text,
    "errorMessage" text,
    "triggeredBy" text NOT NULL,
    "triggeredById" uuid,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."RadiusEventUser" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "propertyId" uuid NOT NULL,
    "eventId" uuid NOT NULL,
    "eventName" text NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    "planId" uuid,
    "bandwidthDown" integer DEFAULT 5 NOT NULL,
    "bandwidthUp" integer DEFAULT 2 NOT NULL,
    "dataLimitMb" integer,
    "validFrom" timestamp with time zone NOT NULL,
    "validUntil" timestamp with time zone NOT NULL,
    "maxSessions" integer DEFAULT 1 NOT NULL,
    "guestName" text,
    "guestEmail" text,
    "guestCompany" text,
    status text DEFAULT 'active'::text NOT NULL,
    "usedAt" timestamp with time zone,
    "firstUsedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."RadiusMacAuth" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "propertyId" uuid NOT NULL,
    "macAddress" text NOT NULL,
    username text,
    "guestId" uuid,
    "guestName" text,
    description text,
    "autoLogin" boolean DEFAULT true NOT NULL,
    "validFrom" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "validUntil" timestamp with time zone,
    "lastSeenAt" timestamp with time zone,
    "loginCount" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "bandwidthDown" integer,
    "bandwidthUp" integer,
    "sessionTimeout" integer,
    "dataLimitMB" integer,
    "groupName" text,
    "planId" uuid,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."RadiusNAS" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    shortname text NOT NULL,
    "ipAddress" text NOT NULL,
    type text DEFAULT 'other'::text NOT NULL,
    ports text,
    secret text NOT NULL,
    server text,
    community text,
    description text,
    "coaEnabled" boolean DEFAULT true NOT NULL,
    "coaPort" integer DEFAULT 3799 NOT NULL,
    "authPort" integer DEFAULT 1812 NOT NULL,
    "acctPort" integer DEFAULT 1813 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "lastSeenAt" timestamp with time zone,
    "totalAuths" integer DEFAULT 0 NOT NULL,
    "totalAccts" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."RadiusProvisioningLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "propertyId" uuid NOT NULL,
    action text NOT NULL,
    username text NOT NULL,
    "guestId" uuid,
    "bookingId" uuid,
    "userId" uuid,
    result text NOT NULL,
    details text,
    error text,
    "durationMs" integer,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."RadiusServerConfig" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "serverIp" text DEFAULT '127.0.0.1'::text NOT NULL,
    "serverHostname" text,
    "authPort" integer DEFAULT 1812 NOT NULL,
    "acctPort" integer DEFAULT 1813 NOT NULL,
    "coaPort" integer DEFAULT 3799 NOT NULL,
    "listenAllInterfaces" boolean DEFAULT true NOT NULL,
    "bindAddress" text DEFAULT '0.0.0.0'::text NOT NULL,
    "maxAuthWait" integer DEFAULT 30 NOT NULL,
    "maxAcctWait" integer DEFAULT 30 NOT NULL,
    "cleanupSessions" boolean DEFAULT true NOT NULL,
    "sessionCleanupInterval" integer DEFAULT 3600 NOT NULL,
    "logAuth" boolean DEFAULT true NOT NULL,
    "logAuthBadpass" boolean DEFAULT false NOT NULL,
    "logAuthGoodpass" boolean DEFAULT false NOT NULL,
    "logDestination" text DEFAULT 'files'::text NOT NULL,
    "logLevel" text DEFAULT 'info'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "interimUpdateInterval" integer DEFAULT 60 NOT NULL,
    "dataCapAction" text DEFAULT 'disconnect'::text NOT NULL,
    "dataCapThrottleRate" text DEFAULT '1M/1M'::text NOT NULL,
    "macAuthEnabled" boolean DEFAULT false NOT NULL,
    "macAuthBypassPortal" boolean DEFAULT true NOT NULL,
    "portalWhitelistEnabled" boolean DEFAULT false NOT NULL,
    "concurrentSessionAction" text DEFAULT 'reject'::text NOT NULL
);


CREATE TABLE public."RatePlan" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "roomTypeId" uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    "basePrice" double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "mealPlan" text DEFAULT 'room_only'::text NOT NULL,
    "minStay" integer DEFAULT 1 NOT NULL,
    "maxStay" integer,
    "advanceBookingDays" integer,
    "cancellationPolicy" text,
    "cancellationHours" integer,
    "bookingStartDays" integer,
    "bookingEndDays" integer,
    "promoCode" text,
    "discountPercent" double precision,
    "discountAmount" double precision,
    "promoStart" timestamp with time zone,
    "promoEnd" timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


CREATE TABLE public."Reconciliation" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "bankAccountId" uuid NOT NULL,
    "bankTransactionId" uuid NOT NULL,
    "paymentId" uuid,
    "folioId" uuid,
    "matchType" text DEFAULT 'manual'::text NOT NULL,
    "matchConfidence" double precision,
    "matchCriteria" text DEFAULT '{}'::text NOT NULL,
    status text DEFAULT 'matched'::text NOT NULL,
    "reconciledAmount" double precision NOT NULL,
    "adjustmentAmount" double precision DEFAULT 0 NOT NULL,
    "adjustmentReason" text,
    "reconciledBy" text,
    "reconciledAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."RegistrationCard" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "bookingId" uuid NOT NULL,
    "guestId" uuid NOT NULL,
    "cardNumber" text NOT NULL,
    "checkInDate" timestamp with time zone NOT NULL,
    "checkOutDate" timestamp with time zone NOT NULL,
    "roomNumber" text NOT NULL,
    "roomType" text NOT NULL,
    "guestName" text NOT NULL,
    "guestNationality" text,
    "guestIdType" text,
    "guestIdNumber" text,
    "guestAddress" text,
    "guestPhone" text,
    "guestEmail" text,
    purpose text,
    "vehiclePlate" text,
    companions text DEFAULT '[]'::text NOT NULL,
    "specialRequests" text,
    "termsAccepted" boolean DEFAULT true NOT NULL,
    "acceptedAt" timestamp with time zone,
    "printedAt" timestamp with time zone,
    "printedBy" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ReportCache" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "reportType" text NOT NULL,
    "periodStart" timestamp with time zone NOT NULL,
    "periodEnd" timestamp with time zone NOT NULL,
    data text NOT NULL,
    "generatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ReportHistory" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "scheduledReportId" uuid,
    name text NOT NULL,
    type text NOT NULL,
    format text DEFAULT 'pdf'::text NOT NULL,
    "generatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "generatedBy" text,
    "periodStart" timestamp with time zone,
    "periodEnd" timestamp with time zone,
    "fileUrl" text,
    "fileSize" integer,
    status text DEFAULT 'completed'::text NOT NULL,
    "errorMessage" text,
    "recipientCount" integer DEFAULT 0 NOT NULL,
    "sentAt" timestamp with time zone,
    metadata text DEFAULT '{}'::text NOT NULL
);


CREATE TABLE public."Reservation" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "propertyId" uuid NOT NULL,
    "tableId" uuid,
    "guestId" uuid,
    "guestName" text NOT NULL,
    "guestPhone" text NOT NULL,
    "guestEmail" text,
    "partySize" integer NOT NULL,
    date timestamp with time zone NOT NULL,
    "time" text NOT NULL,
    duration integer DEFAULT 90 NOT NULL,
    "specialRequests" text,
    occasion text,
    status text DEFAULT 'confirmed'::text NOT NULL,
    source text DEFAULT 'phone'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."RestaurantTable" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "propertyId" uuid NOT NULL,
    number text NOT NULL,
    name text,
    capacity integer DEFAULT 4 NOT NULL,
    area text,
    floor integer DEFAULT 1 NOT NULL,
    "posX" integer,
    "posY" integer,
    width integer,
    height integer,
    status text DEFAULT 'available'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Role" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    "displayName" text NOT NULL,
    description text,
    permissions text DEFAULT '[]'::text NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Room" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "propertyId" uuid NOT NULL,
    "roomTypeId" uuid NOT NULL,
    number text NOT NULL,
    name text,
    floor integer DEFAULT 1 NOT NULL,
    "isAccessible" boolean DEFAULT false NOT NULL,
    "isSmoking" boolean DEFAULT false NOT NULL,
    "hasBalcony" boolean DEFAULT false NOT NULL,
    "hasSeaView" boolean DEFAULT false NOT NULL,
    "hasMountainView" boolean DEFAULT false NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    "smartRoomConfig" text,
    "digitalKeyEnabled" boolean DEFAULT true NOT NULL,
    "digitalKeySecret" text,
    "housekeepingStatus" text DEFAULT 'clean'::text NOT NULL,
    "lastCleanedAt" timestamp with time zone,
    "lastInspectedAt" timestamp with time zone,
    "inspectedBy" text,
    "hkPriority" text DEFAULT 'normal'::text NOT NULL,
    "hkNotes" text,
    dnd boolean DEFAULT false NOT NULL,
    "currentTaskId" uuid,
    images text DEFAULT '[]'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


CREATE TABLE public."RoomMoveLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "bookingId" uuid NOT NULL,
    "guestId" uuid NOT NULL,
    "fromRoomId" uuid NOT NULL,
    "fromRoomNumber" text NOT NULL,
    "toRoomId" uuid NOT NULL,
    "toRoomNumber" text NOT NULL,
    reason text NOT NULL,
    "movedBy" text,
    "previousRate" double precision NOT NULL,
    "newRate" double precision NOT NULL,
    "rateDifference" double precision NOT NULL,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."RoomType" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    "maxAdults" integer DEFAULT 2 NOT NULL,
    "maxChildren" integer DEFAULT 0 NOT NULL,
    "maxOccupancy" integer DEFAULT 2 NOT NULL,
    "sizeSqMeters" double precision,
    "sizeSqFeet" double precision,
    amenities text DEFAULT '[]'::text NOT NULL,
    "basePrice" double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    images text DEFAULT '[]'::text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "totalRooms" integer DEFAULT 0 NOT NULL,
    "overbookingEnabled" boolean DEFAULT false NOT NULL,
    "overbookingPercentage" double precision DEFAULT 0 NOT NULL,
    "overbookingLimit" integer DEFAULT 0 NOT NULL,
    "wifiPlanId" uuid,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


CREATE TABLE public."ScheduleAccess" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    "daysOfWeek" text DEFAULT '1,2,3,4,5,6,7'::text NOT NULL,
    "startTime" text DEFAULT '00:00'::text NOT NULL,
    "endTime" text DEFAULT '23:59'::text NOT NULL,
    "downloadMbps" integer DEFAULT 0 NOT NULL,
    "uploadMbps" integer DEFAULT 0 NOT NULL,
    "applyTo" text DEFAULT 'all'::text NOT NULL,
    "applyToPlanId" uuid,
    "bandwidthPolicyId" uuid,
    action text DEFAULT 'limit'::text NOT NULL,
    description text,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ScheduledNotification" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "templateId" uuid,
    "recipientType" text NOT NULL,
    "recipientId" uuid NOT NULL,
    "recipientEmail" text,
    "recipientPhone" text,
    channels text DEFAULT '[]'::text NOT NULL,
    subject text,
    body text NOT NULL,
    data text DEFAULT '{}'::text NOT NULL,
    "scheduledFor" timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "processedAt" timestamp with time zone,
    "sentAt" timestamp with time zone,
    "errorMessage" text,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "maxRetries" integer DEFAULT 3 NOT NULL,
    "nextRetryAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."ScheduledReport" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    frequency text NOT NULL,
    "dayOfWeek" integer,
    "dayOfMonth" integer,
    "time" text NOT NULL,
    recipients text NOT NULL,
    format text DEFAULT 'pdf'::text NOT NULL,
    "deliveryMethod" text DEFAULT 'email'::text NOT NULL,
    filters text DEFAULT '{}'::text NOT NULL,
    "lastRunAt" timestamp with time zone,
    "nextRunAt" timestamp with time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."SecurityEvent" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "cameraId" uuid NOT NULL,
    type text NOT NULL,
    severity text DEFAULT 'medium'::text NOT NULL,
    description text,
    thumbnail text,
    "recordingId" uuid,
    metadata text DEFAULT '{}'::text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    acknowledged boolean DEFAULT false NOT NULL,
    "acknowledgedAt" timestamp with time zone,
    "acknowledgedBy" text,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."SecurityIncident" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid,
    type text NOT NULL,
    severity text DEFAULT 'medium'::text NOT NULL,
    title text NOT NULL,
    description text,
    location text NOT NULL,
    "reportedBy" text,
    "assignedTo" uuid,
    "cameraId" uuid,
    status text DEFAULT 'open'::text NOT NULL,
    resolution text,
    "resolvedAt" timestamp with time zone,
    "resolvedBy" text,
    "incidentDate" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."SecuritySettings" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "maxConcurrentSessions" integer DEFAULT 3 NOT NULL,
    "sessionTimeoutMinutes" integer DEFAULT 30 NOT NULL,
    "passwordExpiryDays" integer DEFAULT 90 NOT NULL,
    "minPasswordLength" integer DEFAULT 8 NOT NULL,
    "requireUppercase" boolean DEFAULT false NOT NULL,
    "requireLowercase" boolean DEFAULT false NOT NULL,
    "requireNumbers" boolean DEFAULT false NOT NULL,
    "requireSpecialChars" boolean DEFAULT false NOT NULL,
    "enable2FA" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."SegmentMembership" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "segmentId" uuid NOT NULL,
    "guestId" uuid NOT NULL,
    "addedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."ServiceRequest" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "guestId" uuid,
    "bookingId" uuid,
    "roomId" uuid,
    type text NOT NULL,
    category text,
    subject text NOT NULL,
    description text,
    priority text DEFAULT 'medium'::text NOT NULL,
    "assignedTo" uuid,
    "assignedAt" timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    "requestedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "startedAt" timestamp with time zone,
    "completedAt" timestamp with time zone,
    rating integer,
    feedback text,
    source text DEFAULT 'app'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Session" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    token text NOT NULL,
    "refreshToken" text NOT NULL,
    "userAgent" text,
    "ipAddress" text,
    "expiresAt" timestamp with time zone NOT NULL,
    "lastActive" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."ShiftTemplate" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    code text,
    "startTime" text NOT NULL,
    "endTime" text NOT NULL,
    "breakMinutes" integer DEFAULT 0 NOT NULL,
    "shiftType" text DEFAULT 'regular'::text NOT NULL,
    "activeDays" text DEFAULT '[1,2,3,4,5]'::text NOT NULL,
    department text,
    "minStaff" integer DEFAULT 1 NOT NULL,
    "maxStaff" integer,
    color text DEFAULT '#0d9488'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."SSOConnection" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "samlEntityId" uuid,
    "samlSsoUrl" text,
    "samlSloUrl" text,
    "samlCertificate" text,
    "samlPrivateKey" text,
    "samlNameIdFormat" text DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'::text,
    "samlSignRequest" boolean DEFAULT true NOT NULL,
    "samlWantAssertionSigned" boolean DEFAULT true NOT NULL,
    "ldapUrl" text,
    "ldapBaseDn" text,
    "ldapBindDn" text,
    "ldapBindPassword" text,
    "ldapSearchFilter" text DEFAULT '(mail={email})'::text,
    "ldapUseStartTls" boolean DEFAULT false NOT NULL,
    "ldapUseSsl" boolean DEFAULT true NOT NULL,
    "ldapTimeout" integer DEFAULT 30 NOT NULL,
    "oidcClientId" uuid,
    "oidcClientSecret" text,
    "oidcDiscoveryUrl" text,
    "oidcAuthorizationUrl" text,
    "oidcTokenUrl" text,
    "oidcUserInfoUrl" text,
    "oidcJwksUrl" text,
    "oidcScopes" text DEFAULT 'openid profile email'::text NOT NULL,
    "oidcUsePkce" boolean DEFAULT true NOT NULL,
    "emailAttribute" text DEFAULT 'email'::text NOT NULL,
    "firstNameAttribute" text DEFAULT 'givenName'::text NOT NULL,
    "lastNameAttribute" text DEFAULT 'sn'::text NOT NULL,
    "nameAttribute" text DEFAULT 'name'::text NOT NULL,
    "roleAttribute" text,
    "departmentAttribute" text,
    "phoneAttribute" text DEFAULT 'telephoneNumber'::text,
    "autoProvision" boolean DEFAULT true NOT NULL,
    "autoProvisionRole" text,
    "syncRoles" boolean DEFAULT false NOT NULL,
    "syncOnLogin" boolean DEFAULT true NOT NULL,
    "allowedDomains" text,
    "lastSyncAt" timestamp with time zone,
    "lastSyncStatus" text,
    "lastSyncError" text,
    "testConnectionAt" timestamp with time zone,
    "testConnectionStatus" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."SSOSession" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "connectionId" uuid NOT NULL,
    "userId" uuid,
    "ssoProviderId" uuid,
    attributes text DEFAULT '{}'::text NOT NULL,
    "sessionId" uuid,
    "ipAddress" text,
    "userAgent" text,
    "initiatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "authenticatedAt" timestamp with time zone,
    "expiresAt" timestamp with time zone NOT NULL,
    "terminatedAt" timestamp with time zone,
    "terminatedReason" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."StaffAttendance" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    date timestamp with time zone NOT NULL,
    status text DEFAULT 'present'::text NOT NULL,
    "checkIn" timestamp with time zone,
    "checkOut" timestamp with time zone,
    "lateMinutes" integer DEFAULT 0 NOT NULL,
    "earlyLeaveMinutes" integer DEFAULT 0 NOT NULL,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."StaffChannel" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    type text DEFAULT 'team'::text NOT NULL,
    department text,
    "createdBy" uuid,
    "isArchived" boolean DEFAULT false NOT NULL,
    "lastMessageAt" timestamp with time zone,
    "lastMessage" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."StaffChannelMember" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "channelId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    "lastReadAt" timestamp with time zone,
    muted boolean DEFAULT false NOT NULL,
    "joinedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."StaffChatMessage" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "channelId" uuid NOT NULL,
    "senderId" uuid NOT NULL,
    content text NOT NULL,
    "messageType" text DEFAULT 'text'::text NOT NULL,
    attachments text DEFAULT '[]'::text NOT NULL,
    "replyToId" uuid,
    "isEdited" boolean DEFAULT false NOT NULL,
    "editedAt" timestamp with time zone,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "deletedAt" timestamp with time zone,
    "sentAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "readBy" text DEFAULT '[]'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."StaffLeave" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "leaveType" text NOT NULL,
    "startDate" timestamp with time zone NOT NULL,
    "endDate" timestamp with time zone NOT NULL,
    "totalDays" double precision NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    "approvedBy" text,
    "approvedAt" timestamp with time zone,
    "rejectionReason" text,
    "attachmentUrl" text,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."StaffPerformance" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "reviewPeriod" text NOT NULL,
    "reviewYear" integer NOT NULL,
    "reviewDate" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "overallRating" double precision,
    "punctualityRating" double precision,
    "qualityRating" double precision,
    "teamworkRating" double precision,
    "communicationRating" double precision,
    "initiativeRating" double precision,
    "tasksCompleted" integer DEFAULT 0 NOT NULL,
    "avgResponseTime" double precision,
    "attendanceRate" double precision,
    "customerRating" double precision,
    "goalsSet" integer DEFAULT 0 NOT NULL,
    "goalsAchieved" integer DEFAULT 0 NOT NULL,
    "goalsComments" text,
    strengths text,
    "areasOfImprovement" text,
    achievements text,
    "reviewedBy" text,
    status text DEFAULT 'draft'::text NOT NULL,
    "acknowledgedAt" timestamp with time zone,
    "employeeComments" text,
    "nextReviewDate" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."StaffSchedule" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid,
    "userId" uuid NOT NULL,
    "shiftTemplateId" uuid,
    date timestamp with time zone NOT NULL,
    "startTime" text NOT NULL,
    "endTime" text NOT NULL,
    department text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    "assignedBy" text,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."StaffShift" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    date timestamp with time zone NOT NULL,
    "startTime" text NOT NULL,
    "endTime" text NOT NULL,
    "shiftType" text DEFAULT 'regular'::text NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    "clockIn" timestamp with time zone,
    "clockOut" timestamp with time zone,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."StaffSkill" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "skillName" text NOT NULL,
    "skillLevel" integer DEFAULT 1 NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    certified boolean DEFAULT false NOT NULL,
    "certifiedAt" timestamp with time zone,
    "certifiedBy" text,
    notes text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."StaffWorkload" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "propertyId" uuid,
    date timestamp with time zone NOT NULL,
    "totalTasks" integer DEFAULT 0 NOT NULL,
    "completedTasks" integer DEFAULT 0 NOT NULL,
    "totalMinutes" integer DEFAULT 0 NOT NULL,
    "workedMinutes" integer DEFAULT 0 NOT NULL,
    "capacityMinutes" integer DEFAULT 480 NOT NULL,
    efficiency double precision DEFAULT 1.0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."StaticRoute" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    destination text NOT NULL,
    gateway text NOT NULL,
    metric integer DEFAULT 100 NOT NULL,
    "interfaceName" text,
    protocol text DEFAULT 'static'::text NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    description text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."StockConsumption" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "stockItemId" uuid NOT NULL,
    quantity double precision NOT NULL,
    type text NOT NULL,
    reference text,
    cost double precision,
    notes text,
    "recordedBy" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."StockItem" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid,
    name text NOT NULL,
    sku text,
    category text,
    description text,
    unit text DEFAULT 'piece'::text NOT NULL,
    "unitCost" double precision DEFAULT 0 NOT NULL,
    quantity double precision DEFAULT 0 NOT NULL,
    "minQuantity" double precision DEFAULT 0 NOT NULL,
    "maxQuantity" double precision,
    "reorderPoint" double precision,
    location text,
    status text DEFAULT 'active'::text NOT NULL,
    "lowStockAlert" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


CREATE TABLE public."Subscription" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "planId" uuid NOT NULL,
    "planName" text NOT NULL,
    "billingCycle" text NOT NULL,
    amount double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "currentPeriodStart" timestamp with time zone NOT NULL,
    "currentPeriodEnd" timestamp with time zone NOT NULL,
    "cancelledAt" timestamp with time zone,
    "paymentMethodId" uuid,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."SubscriptionInvoice" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "subscriptionId" uuid NOT NULL,
    "invoiceNumber" text NOT NULL,
    amount double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    "issuedAt" timestamp with time zone,
    "dueAt" timestamp with time zone,
    "paidAt" timestamp with time zone,
    "pdfUrl" text,
    "paymentId" uuid,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."SubscriptionPlan" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    "displayName" text NOT NULL,
    description text,
    "monthlyPrice" double precision NOT NULL,
    "yearlyPrice" double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "maxProperties" integer,
    "maxUsers" integer,
    "maxRooms" integer,
    "storageLimitMb" integer,
    features text DEFAULT '{}'::text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isPopular" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."SyslogServer" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    protocol text DEFAULT 'udp'::text NOT NULL,
    host text NOT NULL,
    port integer DEFAULT 514 NOT NULL,
    format text DEFAULT 'ietf'::text NOT NULL,
    facility text DEFAULT 'local1'::text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    categories text DEFAULT '[]'::text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    "tlsCertPath" text,
    "tlsVerify" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."SystemNetworkHealth" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    hostname text,
    "kernelVersion" text,
    uptime integer DEFAULT 0 NOT NULL,
    "cpuUsage" double precision DEFAULT 0 NOT NULL,
    "ramTotal" integer DEFAULT 0 NOT NULL,
    "ramUsed" integer DEFAULT 0 NOT NULL,
    "diskTotal" integer DEFAULT 0 NOT NULL,
    "diskUsed" integer DEFAULT 0 NOT NULL,
    "cpuTemperature" double precision,
    services text DEFAULT '{}'::text NOT NULL,
    "lastUpdated" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Task" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "roomId" uuid,
    "assignedTo" uuid,
    type text NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    description text,
    priority text DEFAULT 'medium'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "scheduledAt" timestamp with time zone,
    "startedAt" timestamp with time zone,
    "completedAt" timestamp with time zone,
    "estimatedDuration" integer,
    "actualDuration" integer,
    "roomStatusBefore" text,
    "roomStatusAfter" text,
    notes text,
    "completionNotes" text,
    attachments text DEFAULT '[]'::text NOT NULL,
    "isRecurring" boolean DEFAULT false NOT NULL,
    "recurrenceRule" text,
    deadline timestamp with time zone,
    "createdBy" uuid,
    "qualityScore" integer,
    subtasks text DEFAULT '[]'::text NOT NULL,
    "serviceRequestId" uuid,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."TaskAssignmentSuggestion" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "taskId" uuid NOT NULL,
    "suggestedUserId" uuid NOT NULL,
    score double precision DEFAULT 0 NOT NULL,
    reason text NOT NULL,
    factors text DEFAULT '{}'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "rejectedBy" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp with time zone,
    "acceptedAt" timestamp with time zone,
    "rejectedAt" timestamp with time zone
);


CREATE TABLE public."TaxReport" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid,
    "reportNumber" text NOT NULL,
    "reportType" text NOT NULL,
    jurisdiction text DEFAULT 'india'::text NOT NULL,
    "periodStart" timestamp with time zone NOT NULL,
    "periodEnd" timestamp with time zone NOT NULL,
    "filingDueDate" timestamp with time zone,
    "grossRevenue" double precision DEFAULT 0 NOT NULL,
    "taxableRevenue" double precision DEFAULT 0 NOT NULL,
    "taxCollected" double precision DEFAULT 0 NOT NULL,
    "taxPaid" double precision DEFAULT 0 NOT NULL,
    "taxDue" double precision DEFAULT 0 NOT NULL,
    "taxRefundable" double precision DEFAULT 0 NOT NULL,
    adjustments double precision DEFAULT 0 NOT NULL,
    "adjustmentReason" text,
    "cgstAmount" double precision DEFAULT 0 NOT NULL,
    "sgstAmount" double precision DEFAULT 0 NOT NULL,
    "igstAmount" double precision DEFAULT 0 NOT NULL,
    "cessAmount" double precision DEFAULT 0 NOT NULL,
    "stateTaxAmount" double precision DEFAULT 0 NOT NULL,
    "localTaxAmount" double precision DEFAULT 0 NOT NULL,
    "vatOutput" double precision DEFAULT 0 NOT NULL,
    "vatInput" double precision DEFAULT 0 NOT NULL,
    "transactionCount" integer DEFAULT 0 NOT NULL,
    "exemptTransactions" integer DEFAULT 0 NOT NULL,
    "exportTransactions" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    "filedAt" timestamp with time zone,
    "filedBy" text,
    "filingReference" text,
    "paymentReference" text,
    "paidAt" timestamp with time zone,
    "attachmentUrl" text,
    notes text,
    "internalNotes" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Tenant" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo text,
    email public.citext NOT NULL,
    phone text,
    address text,
    city text,
    country text,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    language text DEFAULT 'en'::text NOT NULL,
    plan text DEFAULT 'trial'::text NOT NULL,
    status text DEFAULT 'trial'::text NOT NULL,
    "trialEndsAt" timestamp with time zone,
    "subscriptionStartsAt" timestamp with time zone,
    "subscriptionEndsAt" timestamp with time zone,
    "maxProperties" integer DEFAULT 1 NOT NULL,
    "maxUsers" integer DEFAULT 5 NOT NULL,
    "maxRooms" integer DEFAULT 50 NOT NULL,
    "storageLimitMb" integer DEFAULT 500 NOT NULL,
    features text DEFAULT '{}'::text NOT NULL,
    settings text DEFAULT '{}'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


CREATE TABLE public."UsageLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    type text NOT NULL,
    endpoint text,
    method text,
    "statusCode" integer,
    "dataSize" integer DEFAULT 0 NOT NULL,
    duration integer,
    "ipAddress" text,
    "userAgent" text,
    "userId" uuid,
    metadata text DEFAULT '{}'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."UsageSummary" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "apiCalls" integer DEFAULT 0 NOT NULL,
    "apiCallsMonth" integer DEFAULT 0 NOT NULL,
    "messagesSent" integer DEFAULT 0 NOT NULL,
    "messagesMonth" integer DEFAULT 0 NOT NULL,
    "emailsSent" integer DEFAULT 0 NOT NULL,
    "emailsMonth" integer DEFAULT 0 NOT NULL,
    "smsSent" integer DEFAULT 0 NOT NULL,
    "smsMonth" integer DEFAULT 0 NOT NULL,
    "storageUsedMb" double precision DEFAULT 0 NOT NULL,
    "storageFiles" integer DEFAULT 0 NOT NULL,
    "webhooksSent" integer DEFAULT 0 NOT NULL,
    "webhooksMonth" integer DEFAULT 0 NOT NULL,
    "lastApiCallAt" timestamp with time zone,
    "lastMessageAt" timestamp with time zone,
    "lastStorageUploadAt" timestamp with time zone,
    "lastResetAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."User" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    email public.citext NOT NULL,
    "passwordHash" text NOT NULL,
    "isVerified" boolean DEFAULT false NOT NULL,
    "verifiedAt" timestamp with time zone,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    avatar text,
    phone text,
    "jobTitle" text,
    department text,
    "roleId" uuid,
    "lastLoginAt" timestamp with time zone,
    "lastLoginIp" text,
    "passwordChangedAt" timestamp with time zone,
    "failedAttempts" integer DEFAULT 0 NOT NULL,
    "lockedUntil" timestamp with time zone,
    "twoFactorEnabled" boolean DEFAULT false NOT NULL,
    "twoFactorSecret" text,
    "backupCodes" text,
    preferences text DEFAULT '{}'::text NOT NULL,
    "isPlatformAdmin" boolean DEFAULT false NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "invitedAt" timestamp with time zone,
    "invitedBy" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


CREATE TABLE public."UserFcmToken" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    token text NOT NULL,
    "deviceId" uuid,
    "deviceType" text DEFAULT 'web'::text NOT NULL,
    "deviceName" text,
    "userAgent" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastUsedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."UserTutorial" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "tutorialKey" text NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    "completedAt" timestamp with time zone,
    "currentStep" integer DEFAULT 0 NOT NULL,
    "totalSteps" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Vehicle" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "guestId" uuid,
    "bookingId" uuid,
    "licensePlate" text NOT NULL,
    make text,
    model text,
    color text,
    year integer,
    "slotId" uuid,
    "entryTime" timestamp with time zone,
    "exitTime" timestamp with time zone,
    "parkingFee" double precision DEFAULT 0 NOT NULL,
    "isPaid" boolean DEFAULT false NOT NULL,
    status text DEFAULT 'parked'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."Vendor" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    "contactPerson" text,
    email text,
    phone text,
    address text,
    type text NOT NULL,
    "paymentTerms" text,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    "portalEmail" text,
    "portalPassword" text,
    "portalToken" text,
    "portalTokenExpires" timestamp with time zone,
    "lastPortalLogin" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


CREATE TABLE public."VendorPayment" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "vendorId" uuid NOT NULL,
    "workOrderId" uuid,
    "paymentNumber" text NOT NULL,
    amount double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "paymentMethod" text DEFAULT 'bank_transfer'::text NOT NULL,
    "paymentDate" timestamp with time zone,
    "dueDate" timestamp with time zone,
    "bankName" text,
    "bankAccount" text,
    "checkNumber" text,
    "transactionRef" text,
    notes text,
    "paidAt" timestamp with time zone,
    "cancelledAt" timestamp with time zone,
    "cancelReason" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."VlanConfig" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "parentInterfaceId" uuid NOT NULL,
    "vlanId" integer NOT NULL,
    "subInterface" text NOT NULL,
    description text,
    mtu integer DEFAULT 1500 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."WaitlistEntry" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "guestId" uuid NOT NULL,
    "roomTypeId" uuid NOT NULL,
    "checkIn" timestamp with time zone NOT NULL,
    "checkOut" timestamp with time zone NOT NULL,
    adults integer DEFAULT 1 NOT NULL,
    children integer DEFAULT 0 NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'waiting'::text NOT NULL,
    notes text,
    "bookingId" uuid,
    "convertedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."WanFailover" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "primaryWanId" uuid NOT NULL,
    "backupWanId" uuid NOT NULL,
    "healthCheckUrl" text DEFAULT 'https://1.1.1.1'::text NOT NULL,
    "healthCheckInterval" integer DEFAULT 30 NOT NULL,
    "failoverThreshold" integer DEFAULT 3 NOT NULL,
    "autoSwitchback" boolean DEFAULT true NOT NULL,
    "switchbackDelay" integer DEFAULT 300 NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."WebCategory" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    "categoryType" text DEFAULT 'custom'::text NOT NULL,
    "isUploadRestricted" boolean DEFAULT false NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "implementationOn" text DEFAULT 'block'::text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."WebCategorySchedule" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "webCategoryId" uuid NOT NULL,
    "scheduleAccessId" uuid,
    "isAllow" boolean DEFAULT false NOT NULL,
    "orderIndex" integer DEFAULT 0 NOT NULL,
    "startTime" text DEFAULT '00:00'::text NOT NULL,
    "endTime" text DEFAULT '23:59'::text NOT NULL,
    "daysOfWeek" text DEFAULT '1,2,3,4,5,6,7'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."WebhookDeliveryLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "endpointId" uuid NOT NULL,
    "eventType" text NOT NULL,
    payload text NOT NULL,
    "statusCode" integer,
    response text,
    status text DEFAULT 'pending'::text NOT NULL,
    "attemptCount" integer DEFAULT 1 NOT NULL,
    "nextRetryAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."WebhookEndpoint" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    events text DEFAULT '[]'::text NOT NULL,
    secret text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "totalCalls" integer DEFAULT 0 NOT NULL,
    "failedCalls" integer DEFAULT 0 NOT NULL,
    "lastCalledAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."WiFiAAAConfig" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "defaultPlanId" uuid,
    "defaultDownloadSpeed" integer DEFAULT 10 NOT NULL,
    "defaultUploadSpeed" integer DEFAULT 10 NOT NULL,
    "defaultSessionLimit" integer,
    "defaultDataLimit" integer,
    "autoProvisionOnCheckin" boolean DEFAULT true NOT NULL,
    "autoDeprovisionOnCheckout" boolean DEFAULT true NOT NULL,
    "autoDeprovisionDelay" integer DEFAULT 0 NOT NULL,
    "authMethod" text DEFAULT 'pap'::text NOT NULL,
    "allowMacAuth" boolean DEFAULT false NOT NULL,
    "accountingSyncInterval" integer DEFAULT 5 NOT NULL,
    "lastSyncAt" timestamp with time zone,
    "lastSyncId" uuid,
    "maxConcurrentSessions" integer DEFAULT 3 NOT NULL,
    "sessionTimeoutPolicy" text DEFAULT 'hard'::text NOT NULL,
    "portalEnabled" boolean DEFAULT true NOT NULL,
    "portalTitle" text,
    "portalLogo" text,
    "portalTerms" text,
    "portalRedirectUrl" text,
    "portalBrandColor" text DEFAULT '#0d9488'::text NOT NULL,
    "voucherPortalUrl" text,
    "usernameFormat" text DEFAULT 'room_random'::text NOT NULL,
    "usernamePrefix" text,
    "usernameCase" text DEFAULT 'lowercase'::text NOT NULL,
    "usernameMinLength" integer DEFAULT 4 NOT NULL,
    "usernameMaxLength" integer DEFAULT 32 NOT NULL,
    "passwordFormat" text DEFAULT 'random_alphanumeric'::text NOT NULL,
    "passwordFixedValue" text,
    "passwordLength" integer DEFAULT 8 NOT NULL,
    "passwordIncludeUppercase" boolean DEFAULT true NOT NULL,
    "passwordIncludeNumbers" boolean DEFAULT true NOT NULL,
    "passwordIncludeSymbols" boolean DEFAULT false NOT NULL,
    "credentialSeparator" text DEFAULT '_'::text NOT NULL,
    "credentialPrintOnVoucher" boolean DEFAULT true NOT NULL,
    "credentialShowInPortal" boolean DEFAULT true NOT NULL,
    "duplicateUsernameAction" text DEFAULT 'append_random'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."WiFiAccountingSync" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "lastRadAcctId" uuid NOT NULL,
    "lastSyncedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "recordsProcessed" integer DEFAULT 0 NOT NULL,
    errors integer DEFAULT 0 NOT NULL,
    "lastError" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."WiFiGateway" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    "ipAddress" text NOT NULL,
    "macAddress" text,
    vendor text NOT NULL,
    model text,
    version text,
    "radiusSecret" text NOT NULL,
    "radiusAuthPort" integer DEFAULT 1812 NOT NULL,
    "radiusAcctPort" integer DEFAULT 1813 NOT NULL,
    "coaEnabled" boolean DEFAULT false NOT NULL,
    "coaPort" integer DEFAULT 3799 NOT NULL,
    "coaSecret" text,
    "captivePortalEnabled" boolean DEFAULT false NOT NULL,
    "captivePortalUrl" text,
    "splashPageId" uuid,
    "defaultVlan" integer,
    "guestVlan" integer,
    "staffVlan" integer,
    "managementUrl" text,
    "apiUsername" text,
    "apiPassword" text,
    "apiPort" integer,
    status text DEFAULT 'active'::text NOT NULL,
    "lastSeenAt" timestamp with time zone,
    "firmwareVersion" text,
    "totalClients" integer DEFAULT 0 NOT NULL,
    "totalSessions" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."WiFiPlan" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    name text NOT NULL,
    description text,
    "downloadSpeed" integer NOT NULL,
    "uploadSpeed" integer NOT NULL,
    "dataLimit" integer,
    "sessionLimit" integer,
    "maxDevices" integer DEFAULT 1 NOT NULL,
    "fupPolicyId" uuid,
    "ipPoolId" uuid,
    price double precision DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    "validityDays" integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."WiFiSession" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "planId" uuid,
    "guestId" uuid,
    "bookingId" uuid,
    "macAddress" text NOT NULL,
    "ipAddress" text,
    "deviceName" text,
    "deviceType" text,
    "startTime" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endTime" timestamp with time zone,
    "dataUsed" integer DEFAULT 0 NOT NULL,
    duration integer DEFAULT 0 NOT NULL,
    "authMethod" text DEFAULT 'voucher'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."WiFiUser" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    "guestId" uuid,
    "bookingId" uuid,
    "userType" text DEFAULT 'guest'::text NOT NULL,
    "planId" uuid,
    "ipPoolId" uuid,
    "validFrom" timestamp with time zone NOT NULL,
    "validUntil" timestamp with time zone NOT NULL,
    "maxSessions" integer DEFAULT 1 NOT NULL,
    "sessionCount" integer DEFAULT 0 NOT NULL,
    "totalBytesIn" integer DEFAULT 0 NOT NULL,
    "totalBytesOut" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "radiusSynced" boolean DEFAULT false NOT NULL,
    "radiusSyncedAt" timestamp with time zone,
    "lastAccountingAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."WiFiUserStatusHistory" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    username text NOT NULL,
    "userId" uuid,
    "oldStatus" text,
    "newStatus" text NOT NULL,
    "changedBy" text,
    "changeReason" text,
    "ipAddress" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


CREATE TABLE public."WiFiVoucher" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "planId" uuid NOT NULL,
    code text NOT NULL,
    "guestId" uuid,
    "bookingId" uuid,
    "isUsed" boolean DEFAULT false NOT NULL,
    "usedAt" timestamp with time zone,
    "validFrom" timestamp with time zone NOT NULL,
    "validUntil" timestamp with time zone NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    "issuedTo" text,
    "issuedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


CREATE TABLE public."WorkOrder" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "vendorId" uuid,
    "roomId" uuid,
    "assetId" uuid,
    "workOrderNumber" text NOT NULL,
    title text NOT NULL,
    description text,
    type text DEFAULT 'general'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "requestedBy" text,
    "assignedAt" timestamp with time zone,
    "scheduledDate" timestamp with time zone,
    "startedAt" timestamp with time zone,
    "completedAt" timestamp with time zone,
    "estimatedCost" double precision,
    "actualCost" double precision,
    "estimatedHours" double precision,
    "actualHours" double precision,
    notes text,
    "completionNotes" text,
    attachments text DEFAULT '[]'::text NOT NULL,
    "vendorNotes" text,
    rating integer,
    feedback text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


-- ============================================================
-- Indexes (770)
-- ============================================================

CREATE INDEX "AISuggestion_status_idx" ON public."AISuggestion" USING btree (status);

CREATE INDEX "AISuggestion_tenantId_idx" ON public."AISuggestion" USING btree ("tenantId");

CREATE INDEX "AISuggestion_type_idx" ON public."AISuggestion" USING btree (type);

CREATE INDEX "AdCampaign_platform_idx" ON public."AdCampaign" USING btree (platform);

CREATE INDEX "AdCampaign_status_idx" ON public."AdCampaign" USING btree (status);

CREATE INDEX "AdCampaign_tenantId_idx" ON public."AdCampaign" USING btree ("tenantId");

CREATE INDEX "AdCampaign_type_idx" ON public."AdCampaign" USING btree (type);

CREATE UNIQUE INDEX "AdPerformance_campaignId_date_key" ON public."AdPerformance" USING btree ("campaignId", date);

CREATE INDEX "AdPerformance_campaignId_idx" ON public."AdPerformance" USING btree ("campaignId");

CREATE INDEX "AdPerformance_date_idx" ON public."AdPerformance" USING btree (date);

CREATE INDEX "Amenity_category_idx" ON public."Amenity" USING btree (category);

CREATE INDEX "Amenity_tenantId_idx" ON public."Amenity" USING btree ("tenantId");

CREATE UNIQUE INDEX "Amenity_tenantId_name_key" ON public."Amenity" USING btree ("tenantId", name);

CREATE INDEX "Asset_category_idx" ON public."Asset" USING btree (category);

CREATE INDEX "Asset_propertyId_idx" ON public."Asset" USING btree ("propertyId");

CREATE INDEX "Asset_roomId_idx" ON public."Asset" USING btree ("roomId");

CREATE INDEX "Asset_status_idx" ON public."Asset" USING btree (status);

CREATE INDEX "Asset_tenantId_idx" ON public."Asset" USING btree ("tenantId");

CREATE INDEX "AuditLog_entityType_entityId_idx" ON public."AuditLog" USING btree ("entityType", "entityId");

CREATE INDEX "AuditLog_tenantId_idx" ON public."AuditLog" USING btree ("tenantId");

CREATE INDEX "AuditLog_userId_idx" ON public."AuditLog" USING btree ("userId");

CREATE INDEX "AutomationExecutionLog_executedAt_idx" ON public."AutomationExecutionLog" USING btree ("executedAt");

CREATE INDEX "AutomationExecutionLog_ruleId_idx" ON public."AutomationExecutionLog" USING btree ("ruleId");

CREATE INDEX "AutomationRule_tenantId_idx" ON public."AutomationRule" USING btree ("tenantId");

CREATE INDEX "AutomationRule_triggerEvent_idx" ON public."AutomationRule" USING btree ("triggerEvent");

CREATE INDEX "BandwidthPolicyDetail_bandwidthPolicyId_idx" ON public."BandwidthPolicyDetail" USING btree ("bandwidthPolicyId");

CREATE INDEX "BandwidthPolicyDetail_isEnabled_idx" ON public."BandwidthPolicyDetail" USING btree ("isEnabled");

CREATE INDEX "BandwidthPolicyDetail_scheduleAccessId_idx" ON public."BandwidthPolicyDetail" USING btree ("scheduleAccessId");

CREATE INDEX "BandwidthPolicyDetail_tenantId_idx" ON public."BandwidthPolicyDetail" USING btree ("tenantId");

CREATE INDEX "BandwidthPolicy_enabled_idx" ON public."BandwidthPolicy" USING btree (enabled);

CREATE INDEX "BandwidthPolicy_planId_idx" ON public."BandwidthPolicy" USING btree ("planId");

CREATE INDEX "BandwidthPolicy_propertyId_idx" ON public."BandwidthPolicy" USING btree ("propertyId");

CREATE INDEX "BandwidthPolicy_tenantId_idx" ON public."BandwidthPolicy" USING btree ("tenantId");

CREATE INDEX "BandwidthPool_enabled_idx" ON public."BandwidthPool" USING btree (enabled);

CREATE INDEX "BandwidthPool_propertyId_idx" ON public."BandwidthPool" USING btree ("propertyId");

CREATE INDEX "BandwidthPool_tenantId_idx" ON public."BandwidthPool" USING btree ("tenantId");

CREATE INDEX "BandwidthPool_vlanId_idx" ON public."BandwidthPool" USING btree ("vlanId");

CREATE INDEX "BandwidthTopup_enabled_idx" ON public."BandwidthTopup" USING btree (enabled);

CREATE INDEX "BandwidthTopup_propertyId_idx" ON public."BandwidthTopup" USING btree ("propertyId");

CREATE INDEX "BandwidthTopup_tenantId_idx" ON public."BandwidthTopup" USING btree ("tenantId");

CREATE INDEX "BandwidthUsageDaily_date_idx" ON public."BandwidthUsageDaily" USING btree (date);

CREATE UNIQUE INDEX "BandwidthUsageDaily_propertyId_date_key" ON public."BandwidthUsageDaily" USING btree ("propertyId", date);

CREATE INDEX "BandwidthUsageDaily_propertyId_idx" ON public."BandwidthUsageDaily" USING btree ("propertyId");

CREATE INDEX "BandwidthUsageDaily_tenantId_idx" ON public."BandwidthUsageDaily" USING btree ("tenantId");

CREATE INDEX "BandwidthUsageSession_endedAt_idx" ON public."BandwidthUsageSession" USING btree ("endedAt");

CREATE INDEX "BandwidthUsageSession_ipAddress_idx" ON public."BandwidthUsageSession" USING btree ("ipAddress");

CREATE INDEX "BandwidthUsageSession_propertyId_idx" ON public."BandwidthUsageSession" USING btree ("propertyId");

CREATE INDEX "BandwidthUsageSession_sessionId_idx" ON public."BandwidthUsageSession" USING btree ("sessionId");

CREATE INDEX "BandwidthUsageSession_startedAt_idx" ON public."BandwidthUsageSession" USING btree ("startedAt");

CREATE INDEX "BandwidthUsageSession_tenantId_idx" ON public."BandwidthUsageSession" USING btree ("tenantId");

CREATE INDEX "BankAccount_bankName_idx" ON public."BankAccount" USING btree ("bankName");

CREATE INDEX "BankAccount_status_idx" ON public."BankAccount" USING btree (status);

CREATE INDEX "BankAccount_tenantId_idx" ON public."BankAccount" USING btree ("tenantId");

CREATE INDEX "BankTransaction_bankAccountId_idx" ON public."BankTransaction" USING btree ("bankAccountId");

CREATE INDEX "BankTransaction_importBatchId_idx" ON public."BankTransaction" USING btree ("importBatchId");

CREATE INDEX "BankTransaction_isReconciled_idx" ON public."BankTransaction" USING btree ("isReconciled");

CREATE INDEX "BankTransaction_tenantId_idx" ON public."BankTransaction" USING btree ("tenantId");

CREATE INDEX "BankTransaction_transactionDate_idx" ON public."BankTransaction" USING btree ("transactionDate");

CREATE INDEX "BankTransaction_transactionType_idx" ON public."BankTransaction" USING btree ("transactionType");

CREATE INDEX "BondConfig_propertyId_idx" ON public."BondConfig" USING btree ("propertyId");

CREATE UNIQUE INDEX "BondConfig_propertyId_name_key" ON public."BondConfig" USING btree ("propertyId", name);

CREATE INDEX "BondConfig_tenantId_idx" ON public."BondConfig" USING btree ("tenantId");

CREATE INDEX "BondMember_bondConfigId_idx" ON public."BondMember" USING btree ("bondConfigId");

CREATE UNIQUE INDEX "BondMember_bondConfigId_interfaceId_key" ON public."BondMember" USING btree ("bondConfigId", "interfaceId");

CREATE INDEX "BookingAuditLog_bookingId_idx" ON public."BookingAuditLog" USING btree ("bookingId");

CREATE INDEX "Booking_checkIn_idx" ON public."Booking" USING btree ("checkIn");

CREATE INDEX "Booking_checkOut_idx" ON public."Booking" USING btree ("checkOut");

CREATE UNIQUE INDEX "Booking_confirmationCode_key" ON public."Booking" USING btree ("confirmationCode");

CREATE INDEX "Booking_groupId_idx" ON public."Booking" USING btree ("groupId");

CREATE UNIQUE INDEX "Booking_idempotencyKey_key" ON public."Booking" USING btree ("idempotencyKey");

CREATE UNIQUE INDEX "Booking_portalToken_key" ON public."Booking" USING btree ("portalToken");

CREATE INDEX "Booking_primaryGuestId_idx" ON public."Booking" USING btree ("primaryGuestId");

CREATE INDEX "Booking_propertyId_idx" ON public."Booking" USING btree ("propertyId");

CREATE INDEX "Booking_status_idx" ON public."Booking" USING btree (status);

CREATE INDEX "Booking_tenantId_checkIn_idx" ON public."Booking" USING btree ("tenantId", "checkIn");

CREATE INDEX "Booking_tenantId_checkOut_idx" ON public."Booking" USING btree ("tenantId", "checkOut");

CREATE INDEX "Booking_tenantId_idx" ON public."Booking" USING btree ("tenantId");

CREATE INDEX "Booking_tenantId_propertyId_status_idx" ON public."Booking" USING btree ("tenantId", "propertyId", status);

CREATE UNIQUE INDEX "Brand_code_key" ON public."Brand" USING btree (code);

CREATE INDEX "Brand_tenantId_idx" ON public."Brand" USING btree ("tenantId");

CREATE INDEX "BridgeConfig_propertyId_idx" ON public."BridgeConfig" USING btree ("propertyId");

CREATE UNIQUE INDEX "BridgeConfig_propertyId_name_key" ON public."BridgeConfig" USING btree ("propertyId", name);

CREATE INDEX "BridgeConfig_tenantId_idx" ON public."BridgeConfig" USING btree ("tenantId");

CREATE INDEX "CameraEvent_cameraId_idx" ON public."CameraEvent" USING btree ("cameraId");

CREATE INDEX "CameraEvent_tenantId_idx" ON public."CameraEvent" USING btree ("tenantId");

CREATE INDEX "CameraEvent_timestamp_idx" ON public."CameraEvent" USING btree ("timestamp");

CREATE INDEX "CameraGroup_propertyId_idx" ON public."CameraGroup" USING btree ("propertyId");

CREATE INDEX "Camera_propertyId_idx" ON public."Camera" USING btree ("propertyId");

CREATE UNIQUE INDEX "CampaignSegment_campaignId_segmentId_key" ON public."CampaignSegment" USING btree ("campaignId", "segmentId");

CREATE INDEX "Campaign_status_idx" ON public."Campaign" USING btree (status);

CREATE INDEX "Campaign_tenantId_idx" ON public."Campaign" USING btree ("tenantId");

CREATE INDEX "CancellationPolicy_isActive_idx" ON public."CancellationPolicy" USING btree ("isActive");

CREATE INDEX "CancellationPolicy_propertyId_idx" ON public."CancellationPolicy" USING btree ("propertyId");

CREATE INDEX "CancellationPolicy_ratePlanId_idx" ON public."CancellationPolicy" USING btree ("ratePlanId");

CREATE INDEX "CancellationPolicy_tenantId_idx" ON public."CancellationPolicy" USING btree ("tenantId");

CREATE INDEX "CaptivePortal_enabled_idx" ON public."CaptivePortal" USING btree (enabled);

CREATE INDEX "CaptivePortal_propertyId_idx" ON public."CaptivePortal" USING btree ("propertyId");

CREATE UNIQUE INDEX "CaptivePortal_slug_key" ON public."CaptivePortal" USING btree (slug);

CREATE INDEX "CaptivePortal_tenantId_idx" ON public."CaptivePortal" USING btree ("tenantId");

CREATE INDEX "ChannelConnection_channel_idx" ON public."ChannelConnection" USING btree (channel);

CREATE INDEX "ChannelConnection_status_idx" ON public."ChannelConnection" USING btree (status);

CREATE INDEX "ChannelConnection_tenantId_idx" ON public."ChannelConnection" USING btree ("tenantId");

CREATE INDEX "ChannelDeadLetterQueue_channelCode_idx" ON public."ChannelDeadLetterQueue" USING btree ("channelCode");

CREATE INDEX "ChannelDeadLetterQueue_createdAt_idx" ON public."ChannelDeadLetterQueue" USING btree ("createdAt");

CREATE INDEX "ChannelDeadLetterQueue_tenantId_idx" ON public."ChannelDeadLetterQueue" USING btree ("tenantId");

CREATE UNIQUE INDEX "ChannelMapping_connectionId_roomTypeId_ratePlanId_key" ON public."ChannelMapping" USING btree ("connectionId", "roomTypeId", "ratePlanId");

CREATE INDEX "ChannelRestriction_connectionId_idx" ON public."ChannelRestriction" USING btree ("connectionId");

CREATE UNIQUE INDEX "ChannelRestriction_connectionId_roomTypeId_startDate_key" ON public."ChannelRestriction" USING btree ("connectionId", "roomTypeId", "startDate");

CREATE INDEX "ChannelRestriction_roomTypeId_idx" ON public."ChannelRestriction" USING btree ("roomTypeId");

CREATE INDEX "ChannelRestriction_startDate_endDate_idx" ON public."ChannelRestriction" USING btree ("startDate", "endDate");

CREATE INDEX "ChannelRetryQueue_channelCode_idx" ON public."ChannelRetryQueue" USING btree ("channelCode");

CREATE INDEX "ChannelRetryQueue_nextRetryAt_idx" ON public."ChannelRetryQueue" USING btree ("nextRetryAt");

CREATE INDEX "ChannelRetryQueue_status_idx" ON public."ChannelRetryQueue" USING btree (status);

CREATE INDEX "ChannelRetryQueue_tenantId_idx" ON public."ChannelRetryQueue" USING btree ("tenantId");

CREATE INDEX "ChannelSyncLog_connectionId_idx" ON public."ChannelSyncLog" USING btree ("connectionId");

CREATE INDEX "ChannelSyncLog_createdAt_idx" ON public."ChannelSyncLog" USING btree ("createdAt");

CREATE INDEX "ChatConversation_channel_idx" ON public."ChatConversation" USING btree (channel);

CREATE INDEX "ChatConversation_guestId_idx" ON public."ChatConversation" USING btree ("guestId");

CREATE INDEX "ChatConversation_propertyId_idx" ON public."ChatConversation" USING btree ("propertyId");

CREATE INDEX "ChatConversation_status_idx" ON public."ChatConversation" USING btree (status);

CREATE INDEX "ChatConversation_tenantId_idx" ON public."ChatConversation" USING btree ("tenantId");

CREATE INDEX "ChatMessage_conversationId_idx" ON public."ChatMessage" USING btree ("conversationId");

CREATE INDEX "CoaSessionDetail_coaType_idx" ON public."CoaSessionDetail" USING btree ("coaType");

CREATE INDEX "CoaSessionDetail_createdAt_idx" ON public."CoaSessionDetail" USING btree ("createdAt");

CREATE INDEX "CoaSessionDetail_propertyId_idx" ON public."CoaSessionDetail" USING btree ("propertyId");

CREATE INDEX "CoaSessionDetail_sessionId_idx" ON public."CoaSessionDetail" USING btree ("sessionId");

CREATE INDEX "CoaSessionDetail_tenantId_idx" ON public."CoaSessionDetail" USING btree ("tenantId");

CREATE INDEX "CoaSessionDetail_userId_idx" ON public."CoaSessionDetail" USING btree ("userId");

CREATE INDEX "CoaSessionDetail_username_idx" ON public."CoaSessionDetail" USING btree (username);

CREATE INDEX "CommunicationChannel_status_idx" ON public."CommunicationChannel" USING btree (status);

CREATE INDEX "CommunicationChannel_tenantId_idx" ON public."CommunicationChannel" USING btree ("tenantId");

CREATE UNIQUE INDEX "CommunicationChannel_tenantId_type_key" ON public."CommunicationChannel" USING btree ("tenantId", type);

CREATE INDEX "CompetitorPrice_date_idx" ON public."CompetitorPrice" USING btree (date);

CREATE UNIQUE INDEX "CompetitorPrice_propertyId_competitorName_date_key" ON public."CompetitorPrice" USING btree ("propertyId", "competitorName", date);

CREATE INDEX "CompetitorPrice_propertyId_idx" ON public."CompetitorPrice" USING btree ("propertyId");

CREATE INDEX "CompetitorPrice_tenantId_idx" ON public."CompetitorPrice" USING btree ("tenantId");

CREATE INDEX "ConsentRecord_consentType_idx" ON public."ConsentRecord" USING btree ("consentType");

CREATE INDEX "ConsentRecord_createdAt_idx" ON public."ConsentRecord" USING btree ("createdAt");

CREATE INDEX "ConsentRecord_granted_idx" ON public."ConsentRecord" USING btree (granted);

CREATE INDEX "ConsentRecord_guestId_idx" ON public."ConsentRecord" USING btree ("guestId");

CREATE INDEX "ConsentRecord_tenantId_idx" ON public."ConsentRecord" USING btree ("tenantId");

CREATE INDEX "ConsentRecord_userId_idx" ON public."ConsentRecord" USING btree ("userId");

CREATE INDEX "ContentFilter_category_idx" ON public."ContentFilter" USING btree (category);

CREATE INDEX "ContentFilter_enabled_idx" ON public."ContentFilter" USING btree (enabled);

CREATE INDEX "ContentFilter_propertyId_idx" ON public."ContentFilter" USING btree ("propertyId");

CREATE INDEX "ContentFilter_tenantId_idx" ON public."ContentFilter" USING btree ("tenantId");

CREATE INDEX "CreditNote_bookingId_idx" ON public."CreditNote" USING btree ("bookingId");

CREATE UNIQUE INDEX "CreditNote_creditNoteNumber_key" ON public."CreditNote" USING btree ("creditNoteNumber");

CREATE INDEX "CreditNote_folioId_idx" ON public."CreditNote" USING btree ("folioId");

CREATE INDEX "CreditNote_guestId_idx" ON public."CreditNote" USING btree ("guestId");

CREATE INDEX "CreditNote_propertyId_idx" ON public."CreditNote" USING btree ("propertyId");

CREATE INDEX "CreditNote_status_idx" ON public."CreditNote" USING btree (status);

CREATE INDEX "CreditNote_tenantId_idx" ON public."CreditNote" USING btree ("tenantId");

CREATE INDEX "DemandForecast_date_idx" ON public."DemandForecast" USING btree (date);

CREATE UNIQUE INDEX "DemandForecast_date_key" ON public."DemandForecast" USING btree (date);

CREATE INDEX "DemandForecast_propertyId_idx" ON public."DemandForecast" USING btree ("propertyId");

CREATE INDEX "DemandForecast_tenantId_idx" ON public."DemandForecast" USING btree ("tenantId");

CREATE INDEX "DhcpBlacklist_macAddress_idx" ON public."DhcpBlacklist" USING btree ("macAddress");

CREATE INDEX "DhcpBlacklist_propertyId_idx" ON public."DhcpBlacklist" USING btree ("propertyId");

CREATE INDEX "DhcpBlacklist_subnetId_idx" ON public."DhcpBlacklist" USING btree ("subnetId");

CREATE INDEX "DhcpBlacklist_tenantId_idx" ON public."DhcpBlacklist" USING btree ("tenantId");

CREATE INDEX "DhcpHostnameFilter_propertyId_idx" ON public."DhcpHostnameFilter" USING btree ("propertyId");

CREATE INDEX "DhcpHostnameFilter_subnetId_idx" ON public."DhcpHostnameFilter" USING btree ("subnetId");

CREATE INDEX "DhcpHostnameFilter_tenantId_idx" ON public."DhcpHostnameFilter" USING btree ("tenantId");

CREATE INDEX "DhcpLeaseScript_enabled_idx" ON public."DhcpLeaseScript" USING btree (enabled);

CREATE INDEX "DhcpLeaseScript_propertyId_idx" ON public."DhcpLeaseScript" USING btree ("propertyId");

CREATE INDEX "DhcpLeaseScript_tenantId_idx" ON public."DhcpLeaseScript" USING btree ("tenantId");

CREATE UNIQUE INDEX "DhcpLeaseScript_tenantId_scriptPath_key" ON public."DhcpLeaseScript" USING btree ("tenantId", "scriptPath");

CREATE INDEX "DhcpLease_leaseEnd_idx" ON public."DhcpLease" USING btree ("leaseEnd");

CREATE INDEX "DhcpLease_macAddress_idx" ON public."DhcpLease" USING btree ("macAddress");

CREATE INDEX "DhcpLease_propertyId_idx" ON public."DhcpLease" USING btree ("propertyId");

CREATE INDEX "DhcpLease_state_idx" ON public."DhcpLease" USING btree (state);

CREATE UNIQUE INDEX "DhcpLease_subnetId_ipAddress_key" ON public."DhcpLease" USING btree ("subnetId", "ipAddress");

CREATE INDEX "DhcpLease_tenantId_idx" ON public."DhcpLease" USING btree ("tenantId");

CREATE INDEX "DhcpOption_code_idx" ON public."DhcpOption" USING btree (code);

CREATE INDEX "DhcpOption_propertyId_idx" ON public."DhcpOption" USING btree ("propertyId");

CREATE INDEX "DhcpOption_subnetId_idx" ON public."DhcpOption" USING btree ("subnetId");

CREATE INDEX "DhcpOption_tenantId_idx" ON public."DhcpOption" USING btree ("tenantId");

CREATE INDEX "DhcpReservation_macAddress_idx" ON public."DhcpReservation" USING btree ("macAddress");

CREATE INDEX "DhcpReservation_propertyId_idx" ON public."DhcpReservation" USING btree ("propertyId");

CREATE UNIQUE INDEX "DhcpReservation_subnetId_ipAddress_key" ON public."DhcpReservation" USING btree ("subnetId", "ipAddress");

CREATE UNIQUE INDEX "DhcpReservation_subnetId_macAddress_key" ON public."DhcpReservation" USING btree ("subnetId", "macAddress");

CREATE INDEX "DhcpReservation_tenantId_idx" ON public."DhcpReservation" USING btree ("tenantId");

CREATE INDEX "DhcpSubnet_enabled_idx" ON public."DhcpSubnet" USING btree (enabled);

CREATE INDEX "DhcpSubnet_propertyId_idx" ON public."DhcpSubnet" USING btree ("propertyId");

CREATE INDEX "DhcpSubnet_subnet_idx" ON public."DhcpSubnet" USING btree (subnet);

CREATE INDEX "DhcpSubnet_tenantId_idx" ON public."DhcpSubnet" USING btree ("tenantId");

CREATE INDEX "DhcpTagRule_matchType_idx" ON public."DhcpTagRule" USING btree ("matchType");

CREATE INDEX "DhcpTagRule_propertyId_idx" ON public."DhcpTagRule" USING btree ("propertyId");

CREATE INDEX "DhcpTagRule_setTag_idx" ON public."DhcpTagRule" USING btree ("setTag");

CREATE INDEX "DhcpTagRule_subnetId_idx" ON public."DhcpTagRule" USING btree ("subnetId");

CREATE INDEX "DhcpTagRule_tenantId_idx" ON public."DhcpTagRule" USING btree ("tenantId");

CREATE INDEX "DigitalKeyAccessLog_accessedAt_idx" ON public."DigitalKeyAccessLog" USING btree ("accessedAt");

CREATE INDEX "DigitalKeyAccessLog_guestId_idx" ON public."DigitalKeyAccessLog" USING btree ("guestId");

CREATE INDEX "DigitalKeyAccessLog_roomId_idx" ON public."DigitalKeyAccessLog" USING btree ("roomId");

CREATE INDEX "DigitalKeyAccessLog_tenantId_idx" ON public."DigitalKeyAccessLog" USING btree ("tenantId");

CREATE INDEX "Discount_code_idx" ON public."Discount" USING btree (code);

CREATE INDEX "Discount_isActive_idx" ON public."Discount" USING btree ("isActive");

CREATE UNIQUE INDEX "Discount_tenantId_code_key" ON public."Discount" USING btree ("tenantId", code);

CREATE INDEX "Discount_tenantId_idx" ON public."Discount" USING btree ("tenantId");

CREATE INDEX "DnsRecord_tenantId_idx" ON public."DnsRecord" USING btree ("tenantId");

CREATE INDEX "DnsRecord_zoneId_idx" ON public."DnsRecord" USING btree ("zoneId");

CREATE UNIQUE INDEX "DnsRecord_zoneId_name_type_key" ON public."DnsRecord" USING btree ("zoneId", name, type);

CREATE INDEX "DnsRedirectRule_enabled_idx" ON public."DnsRedirectRule" USING btree (enabled);

CREATE INDEX "DnsRedirectRule_priority_idx" ON public."DnsRedirectRule" USING btree (priority);

CREATE INDEX "DnsRedirectRule_propertyId_idx" ON public."DnsRedirectRule" USING btree ("propertyId");

CREATE INDEX "DnsRedirectRule_tenantId_idx" ON public."DnsRedirectRule" USING btree ("tenantId");

CREATE UNIQUE INDEX "DnsZone_propertyId_domain_key" ON public."DnsZone" USING btree ("propertyId", domain);

CREATE INDEX "DnsZone_propertyId_idx" ON public."DnsZone" USING btree ("propertyId");

CREATE INDEX "DnsZone_tenantId_idx" ON public."DnsZone" USING btree ("tenantId");

CREATE INDEX "EnergyMetric_date_idx" ON public."EnergyMetric" USING btree (date);

CREATE UNIQUE INDEX "EnergyMetric_propertyId_date_key" ON public."EnergyMetric" USING btree ("propertyId", date);

CREATE INDEX "EnergyMetric_tenantId_idx" ON public."EnergyMetric" USING btree ("tenantId");

CREATE INDEX "EventResource_category_idx" ON public."EventResource" USING btree (category);

CREATE INDEX "EventResource_eventId_idx" ON public."EventResource" USING btree ("eventId");

CREATE INDEX "EventResource_status_idx" ON public."EventResource" USING btree (status);

CREATE INDEX "EventSpace_propertyId_idx" ON public."EventSpace" USING btree ("propertyId");

CREATE INDEX "Event_propertyId_idx" ON public."Event" USING btree ("propertyId");

CREATE INDEX "Event_startDate_idx" ON public."Event" USING btree ("startDate");

CREATE INDEX "Event_tenantId_idx" ON public."Event" USING btree ("tenantId");

CREATE INDEX "ExchangeRate_fromCurrency_idx" ON public."ExchangeRate" USING btree ("fromCurrency");

CREATE INDEX "ExchangeRate_isActive_idx" ON public."ExchangeRate" USING btree ("isActive");

CREATE UNIQUE INDEX "ExchangeRate_tenantId_fromCurrency_toCurrency_validFrom_key" ON public."ExchangeRate" USING btree ("tenantId", "fromCurrency", "toCurrency", "validFrom");

CREATE INDEX "ExchangeRate_tenantId_idx" ON public."ExchangeRate" USING btree ("tenantId");

CREATE INDEX "ExchangeRate_toCurrency_idx" ON public."ExchangeRate" USING btree ("toCurrency");

CREATE INDEX "ExternalReview_propertyId_idx" ON public."ExternalReview" USING btree ("propertyId");

CREATE INDEX "ExternalReview_reviewDate_idx" ON public."ExternalReview" USING btree ("reviewDate");

CREATE INDEX "ExternalReview_source_idx" ON public."ExternalReview" USING btree (source);

CREATE INDEX "ExternalReview_tenantId_idx" ON public."ExternalReview" USING btree ("tenantId");

CREATE INDEX "FairAccessPolicy_cycleType_idx" ON public."FairAccessPolicy" USING btree ("cycleType");

CREATE INDEX "FairAccessPolicy_isEnabled_idx" ON public."FairAccessPolicy" USING btree ("isEnabled");

CREATE INDEX "FairAccessPolicy_propertyId_idx" ON public."FairAccessPolicy" USING btree ("propertyId");

CREATE INDEX "FairAccessPolicy_tenantId_idx" ON public."FairAccessPolicy" USING btree ("tenantId");

CREATE INDEX "FeatureAnnouncement_status_idx" ON public."FeatureAnnouncement" USING btree (status);

CREATE INDEX "FirewallRule_enabled_idx" ON public."FirewallRule" USING btree (enabled);

CREATE INDEX "FirewallRule_priority_idx" ON public."FirewallRule" USING btree (priority);

CREATE INDEX "FirewallRule_propertyId_idx" ON public."FirewallRule" USING btree ("propertyId");

CREATE INDEX "FirewallRule_tenantId_idx" ON public."FirewallRule" USING btree ("tenantId");

CREATE INDEX "FirewallRule_zoneId_idx" ON public."FirewallRule" USING btree ("zoneId");

CREATE INDEX "FirewallSchedule_propertyId_idx" ON public."FirewallSchedule" USING btree ("propertyId");

CREATE INDEX "FirewallSchedule_tenantId_idx" ON public."FirewallSchedule" USING btree ("tenantId");

CREATE INDEX "FirewallZone_propertyId_idx" ON public."FirewallZone" USING btree ("propertyId");

CREATE UNIQUE INDEX "FirewallZone_propertyId_name_key" ON public."FirewallZone" USING btree ("propertyId", name);

CREATE INDEX "FirewallZone_tenantId_idx" ON public."FirewallZone" USING btree ("tenantId");

CREATE INDEX "FloorPlanRoom_floorPlanId_idx" ON public."FloorPlanRoom" USING btree ("floorPlanId");

CREATE UNIQUE INDEX "FloorPlanRoom_floorPlanId_roomId_key" ON public."FloorPlanRoom" USING btree ("floorPlanId", "roomId");

CREATE INDEX "FloorPlanRoom_roomId_idx" ON public."FloorPlanRoom" USING btree ("roomId");

CREATE UNIQUE INDEX "FloorPlan_propertyId_floor_key" ON public."FloorPlan" USING btree ("propertyId", floor);

CREATE INDEX "FolioLineItem_discountId_idx" ON public."FolioLineItem" USING btree ("discountId");

CREATE INDEX "FolioLineItem_folioId_idx" ON public."FolioLineItem" USING btree ("folioId");

CREATE INDEX "FolioTransfer_bookingId_idx" ON public."FolioTransfer" USING btree ("bookingId");

CREATE INDEX "FolioTransfer_fromFolioId_idx" ON public."FolioTransfer" USING btree ("fromFolioId");

CREATE INDEX "FolioTransfer_propertyId_idx" ON public."FolioTransfer" USING btree ("propertyId");

CREATE INDEX "FolioTransfer_tenantId_idx" ON public."FolioTransfer" USING btree ("tenantId");

CREATE INDEX "FolioTransfer_toFolioId_idx" ON public."FolioTransfer" USING btree ("toFolioId");

CREATE INDEX "Folio_bookingId_idx" ON public."Folio" USING btree ("bookingId");

CREATE UNIQUE INDEX "Folio_folioNumber_key" ON public."Folio" USING btree ("folioNumber");

CREATE INDEX "Folio_guestId_idx" ON public."Folio" USING btree ("guestId");

CREATE INDEX "Folio_tenantId_idx" ON public."Folio" USING btree ("tenantId");

CREATE INDEX "GDPRRequest_createdAt_idx" ON public."GDPRRequest" USING btree ("createdAt");

CREATE INDEX "GDPRRequest_expiresAt_idx" ON public."GDPRRequest" USING btree ("expiresAt");

CREATE INDEX "GDPRRequest_guestId_idx" ON public."GDPRRequest" USING btree ("guestId");

CREATE INDEX "GDPRRequest_requestType_idx" ON public."GDPRRequest" USING btree ("requestType");

CREATE INDEX "GDPRRequest_status_idx" ON public."GDPRRequest" USING btree (status);

CREATE INDEX "GDPRRequest_tenantId_idx" ON public."GDPRRequest" USING btree ("tenantId");

CREATE INDEX "GoogleHotelAdsConnection_status_idx" ON public."GoogleHotelAdsConnection" USING btree (status);

CREATE INDEX "GoogleHotelAdsConnection_tenantId_idx" ON public."GoogleHotelAdsConnection" USING btree ("tenantId");

CREATE UNIQUE INDEX "GoogleHotelAdsConnection_tenantId_propertyId_key" ON public."GoogleHotelAdsConnection" USING btree ("tenantId", "propertyId");

CREATE INDEX "GroupBooking_propertyId_idx" ON public."GroupBooking" USING btree ("propertyId");

CREATE INDEX "GroupBooking_tenantId_idx" ON public."GroupBooking" USING btree ("tenantId");

CREATE INDEX "GuestBehavior_guestId_idx" ON public."GuestBehavior" USING btree ("guestId");

CREATE UNIQUE INDEX "GuestBehavior_guestId_key" ON public."GuestBehavior" USING btree ("guestId");

CREATE INDEX "GuestBehavior_isRepeatGuest_idx" ON public."GuestBehavior" USING btree ("isRepeatGuest");

CREATE INDEX "GuestBehavior_tenantId_idx" ON public."GuestBehavior" USING btree ("tenantId");

CREATE INDEX "GuestDocument_guestId_idx" ON public."GuestDocument" USING btree ("guestId");

CREATE INDEX "GuestFeedback_guestId_idx" ON public."GuestFeedback" USING btree ("guestId");

CREATE INDEX "GuestFeedback_propertyId_idx" ON public."GuestFeedback" USING btree ("propertyId");

CREATE INDEX "GuestJourney_guestId_idx" ON public."GuestJourney" USING btree ("guestId");

CREATE INDEX "GuestJourney_occurredAt_idx" ON public."GuestJourney" USING btree ("occurredAt");

CREATE INDEX "GuestJourney_stage_idx" ON public."GuestJourney" USING btree (stage);

CREATE INDEX "GuestJourney_tenantId_idx" ON public."GuestJourney" USING btree ("tenantId");

CREATE INDEX "GuestRecommendation_expiresAt_idx" ON public."GuestRecommendation" USING btree ("expiresAt");

CREATE INDEX "GuestRecommendation_guestId_idx" ON public."GuestRecommendation" USING btree ("guestId");

CREATE INDEX "GuestRecommendation_status_idx" ON public."GuestRecommendation" USING btree (status);

CREATE INDEX "GuestRecommendation_tenantId_idx" ON public."GuestRecommendation" USING btree ("tenantId");

CREATE INDEX "GuestReview_guestId_idx" ON public."GuestReview" USING btree ("guestId");

CREATE INDEX "GuestReview_propertyId_idx" ON public."GuestReview" USING btree ("propertyId");

CREATE INDEX "GuestSegment_tenantId_idx" ON public."GuestSegment" USING btree ("tenantId");

CREATE UNIQUE INDEX "GuestStay_guestId_bookingId_key" ON public."GuestStay" USING btree ("guestId", "bookingId");

CREATE INDEX "Guest_email_idx" ON public."Guest" USING btree (email);

CREATE INDEX "Guest_phone_idx" ON public."Guest" USING btree (phone);

CREATE INDEX "Guest_tenantId_email_idx" ON public."Guest" USING btree ("tenantId", email);

CREATE INDEX "Guest_tenantId_idx" ON public."Guest" USING btree ("tenantId");

CREATE INDEX "HelpArticle_category_idx" ON public."HelpArticle" USING btree (category);

CREATE UNIQUE INDEX "HelpArticle_slug_key" ON public."HelpArticle" USING btree (slug);

CREATE INDEX "HelpArticle_status_idx" ON public."HelpArticle" USING btree (status);

CREATE INDEX "HelpCategory_parentId_idx" ON public."HelpCategory" USING btree ("parentId");

CREATE UNIQUE INDEX "HelpCategory_slug_key" ON public."HelpCategory" USING btree (slug);

CREATE INDEX "IdempotencyKey_key_idx" ON public."IdempotencyKey" USING btree (key);

CREATE UNIQUE INDEX "IdempotencyKey_key_key" ON public."IdempotencyKey" USING btree (key);

CREATE INDEX "IdempotencyKey_tenantId_idx" ON public."IdempotencyKey" USING btree ("tenantId");

CREATE INDEX "InspectionResult_completedAt_idx" ON public."InspectionResult" USING btree ("completedAt");

CREATE INDEX "InspectionResult_inspectorId_idx" ON public."InspectionResult" USING btree ("inspectorId");

CREATE INDEX "InspectionResult_propertyId_idx" ON public."InspectionResult" USING btree ("propertyId");

CREATE INDEX "InspectionResult_roomId_idx" ON public."InspectionResult" USING btree ("roomId");

CREATE INDEX "InspectionResult_taskId_idx" ON public."InspectionResult" USING btree ("taskId");

CREATE INDEX "InspectionResult_templateId_idx" ON public."InspectionResult" USING btree ("templateId");

CREATE INDEX "InspectionResult_tenantId_idx" ON public."InspectionResult" USING btree ("tenantId");

CREATE INDEX "InspectionTemplate_isActive_idx" ON public."InspectionTemplate" USING btree ("isActive");

CREATE INDEX "InspectionTemplate_propertyId_idx" ON public."InspectionTemplate" USING btree ("propertyId");

CREATE INDEX "InspectionTemplate_roomType_idx" ON public."InspectionTemplate" USING btree ("roomType");

CREATE INDEX "InspectionTemplate_tenantId_idx" ON public."InspectionTemplate" USING btree ("tenantId");

CREATE INDEX "Integration_tenantId_idx" ON public."Integration" USING btree ("tenantId");

CREATE UNIQUE INDEX "Integration_tenantId_type_provider_key" ON public."Integration" USING btree ("tenantId", type, provider);

CREATE INDEX "InterfaceAlias_interfaceId_idx" ON public."InterfaceAlias" USING btree ("interfaceId");

CREATE INDEX "InterfaceAlias_propertyId_idx" ON public."InterfaceAlias" USING btree ("propertyId");

CREATE UNIQUE INDEX "InterfaceAlias_propertyId_interfaceId_ipAddress_key" ON public."InterfaceAlias" USING btree ("propertyId", "interfaceId", "ipAddress");

CREATE INDEX "InterfaceAlias_tenantId_idx" ON public."InterfaceAlias" USING btree ("tenantId");

CREATE INDEX "InterfaceConfig_propertyId_idx" ON public."InterfaceConfig" USING btree ("propertyId");

CREATE UNIQUE INDEX "InterfaceConfig_propertyId_interfaceId_key" ON public."InterfaceConfig" USING btree ("propertyId", "interfaceId");

CREATE INDEX "InterfaceConfig_tenantId_idx" ON public."InterfaceConfig" USING btree ("tenantId");

CREATE INDEX "InterfaceRole_propertyId_idx" ON public."InterfaceRole" USING btree ("propertyId");

CREATE UNIQUE INDEX "InterfaceRole_propertyId_interfaceId_key" ON public."InterfaceRole" USING btree ("propertyId", "interfaceId");

CREATE INDEX "InterfaceRole_role_idx" ON public."InterfaceRole" USING btree (role);

CREATE INDEX "InterfaceRole_tenantId_idx" ON public."InterfaceRole" USING btree ("tenantId");

CREATE INDEX "InventoryLock_expiresAt_idx" ON public."InventoryLock" USING btree ("expiresAt");

CREATE INDEX "InventoryLock_propertyId_idx" ON public."InventoryLock" USING btree ("propertyId");

CREATE INDEX "InventoryLock_roomId_idx" ON public."InventoryLock" USING btree ("roomId");

CREATE INDEX "InventoryLock_roomTypeId_idx" ON public."InventoryLock" USING btree ("roomTypeId");

CREATE INDEX "InventoryLock_sessionId_idx" ON public."InventoryLock" USING btree ("sessionId");

CREATE INDEX "InventoryLock_tenantId_idx" ON public."InventoryLock" USING btree ("tenantId");

CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON public."Invoice" USING btree ("invoiceNumber");

CREATE INDEX "Invoice_tenantId_idx" ON public."Invoice" USING btree ("tenantId");

CREATE INDEX "IoTCommand_deviceId_idx" ON public."IoTCommand" USING btree ("deviceId");

CREATE INDEX "IoTCommand_status_idx" ON public."IoTCommand" USING btree (status);

CREATE INDEX "IoTDevice_propertyId_idx" ON public."IoTDevice" USING btree ("propertyId");

CREATE INDEX "IoTDevice_roomId_idx" ON public."IoTDevice" USING btree ("roomId");

CREATE INDEX "IoTDevice_tenantId_idx" ON public."IoTDevice" USING btree ("tenantId");

CREATE INDEX "IoTReading_deviceId_idx" ON public."IoTReading" USING btree ("deviceId");

CREATE INDEX "IoTReading_timestamp_idx" ON public."IoTReading" USING btree ("timestamp");

CREATE INDEX "IpPoolRange_poolId_idx" ON public."IpPoolRange" USING btree ("poolId");

CREATE INDEX "IpPool_isDefault_idx" ON public."IpPool" USING btree ("isDefault");

CREATE INDEX "IpPool_propertyId_idx" ON public."IpPool" USING btree ("propertyId");

CREATE INDEX "IpPool_tenantId_idx" ON public."IpPool" USING btree ("tenantId");

CREATE UNIQUE INDEX "IpPool_tenantId_name_key" ON public."IpPool" USING btree ("tenantId", name);

CREATE UNIQUE INDEX "LiveSession_acctSessionId_key" ON public."LiveSession" USING btree ("acctSessionId");

CREATE INDEX "LiveSession_framedIpAddress_idx" ON public."LiveSession" USING btree ("framedIpAddress");

CREATE INDEX "LiveSession_macAddress_idx" ON public."LiveSession" USING btree ("macAddress");

CREATE INDEX "LiveSession_nasIpAddress_idx" ON public."LiveSession" USING btree ("nasIpAddress");

CREATE INDEX "LiveSession_propertyId_idx" ON public."LiveSession" USING btree ("propertyId");

CREATE INDEX "LiveSession_status_idx" ON public."LiveSession" USING btree (status);

CREATE INDEX "LiveSession_tenantId_idx" ON public."LiveSession" USING btree ("tenantId");

CREATE INDEX "LiveSession_userId_idx" ON public."LiveSession" USING btree ("userId");

CREATE INDEX "LiveSession_username_idx" ON public."LiveSession" USING btree (username);

CREATE UNIQUE INDEX "LiveSession_username_key" ON public."LiveSession" USING btree (username);

CREATE INDEX "LoyaltyPointTransaction_expiresAt_idx" ON public."LoyaltyPointTransaction" USING btree ("expiresAt");

CREATE INDEX "LoyaltyPointTransaction_guestId_idx" ON public."LoyaltyPointTransaction" USING btree ("guestId");

CREATE INDEX "LoyaltyPointTransaction_tenantId_idx" ON public."LoyaltyPointTransaction" USING btree ("tenantId");

CREATE INDEX "LoyaltyPointTransaction_type_idx" ON public."LoyaltyPointTransaction" USING btree (type);

CREATE INDEX "LoyaltyRedemption_guestId_idx" ON public."LoyaltyRedemption" USING btree ("guestId");

CREATE INDEX "LoyaltyRedemption_redemptionCode_idx" ON public."LoyaltyRedemption" USING btree ("redemptionCode");

CREATE UNIQUE INDEX "LoyaltyRedemption_redemptionCode_key" ON public."LoyaltyRedemption" USING btree ("redemptionCode");

CREATE INDEX "LoyaltyRedemption_rewardId_idx" ON public."LoyaltyRedemption" USING btree ("rewardId");

CREATE INDEX "LoyaltyRedemption_status_idx" ON public."LoyaltyRedemption" USING btree (status);

CREATE INDEX "LoyaltyRedemption_tenantId_idx" ON public."LoyaltyRedemption" USING btree ("tenantId");

CREATE INDEX "LoyaltyReward_category_idx" ON public."LoyaltyReward" USING btree (category);

CREATE INDEX "LoyaltyReward_isAvailable_idx" ON public."LoyaltyReward" USING btree ("isAvailable");

CREATE INDEX "LoyaltyReward_tenantId_idx" ON public."LoyaltyReward" USING btree ("tenantId");

CREATE INDEX "LoyaltyTier_minPoints_idx" ON public."LoyaltyTier" USING btree ("minPoints");

CREATE INDEX "LoyaltyTier_tenantId_idx" ON public."LoyaltyTier" USING btree ("tenantId");

CREATE UNIQUE INDEX "LoyaltyTier_tenantId_name_key" ON public."LoyaltyTier" USING btree ("tenantId", name);

CREATE INDEX "LoyaltyTransaction_guestId_idx" ON public."LoyaltyTransaction" USING btree ("guestId");

CREATE INDEX "LoyaltyTransaction_tenantId_idx" ON public."LoyaltyTransaction" USING btree ("tenantId");

CREATE INDEX "MacFilter_enabled_idx" ON public."MacFilter" USING btree (enabled);

CREATE INDEX "MacFilter_listType_idx" ON public."MacFilter" USING btree ("listType");

CREATE INDEX "MacFilter_propertyId_idx" ON public."MacFilter" USING btree ("propertyId");

CREATE UNIQUE INDEX "MacFilter_propertyId_macAddress_key" ON public."MacFilter" USING btree ("propertyId", "macAddress");

CREATE INDEX "MacFilter_tenantId_idx" ON public."MacFilter" USING btree ("tenantId");

CREATE INDEX "MaintenanceBlock_endDate_idx" ON public."MaintenanceBlock" USING btree ("endDate");

CREATE INDEX "MaintenanceBlock_propertyId_idx" ON public."MaintenanceBlock" USING btree ("propertyId");

CREATE INDEX "MaintenanceBlock_roomId_idx" ON public."MaintenanceBlock" USING btree ("roomId");

CREATE INDEX "MaintenanceBlock_startDate_idx" ON public."MaintenanceBlock" USING btree ("startDate");

CREATE INDEX "MaintenanceBlock_status_idx" ON public."MaintenanceBlock" USING btree (status);

CREATE INDEX "MaintenanceBlock_tenantId_idx" ON public."MaintenanceBlock" USING btree ("tenantId");

CREATE INDEX "ManualTransaction_paymentId_idx" ON public."ManualTransaction" USING btree ("paymentId");

CREATE INDEX "ManualTransaction_status_idx" ON public."ManualTransaction" USING btree (status);

CREATE INDEX "ManualTransaction_tenantId_idx" ON public."ManualTransaction" USING btree ("tenantId");

CREATE INDEX "MenuItem_categoryId_idx" ON public."MenuItem" USING btree ("categoryId");

CREATE INDEX "MenuItem_propertyId_idx" ON public."MenuItem" USING btree ("propertyId");

CREATE INDEX "MessageTemplate_category_idx" ON public."MessageTemplate" USING btree (category);

CREATE INDEX "MessageTemplate_channel_idx" ON public."MessageTemplate" USING btree (channel);

CREATE INDEX "MessageTemplate_tenantId_idx" ON public."MessageTemplate" USING btree ("tenantId");

CREATE UNIQUE INDEX "MessageTemplate_tenantId_name_channel_key" ON public."MessageTemplate" USING btree ("tenantId", name, channel);

CREATE INDEX "MetasearchConnection_platform_idx" ON public."MetasearchConnection" USING btree (platform);

CREATE INDEX "MetasearchConnection_status_idx" ON public."MetasearchConnection" USING btree (status);

CREATE INDEX "MetasearchConnection_tenantId_idx" ON public."MetasearchConnection" USING btree ("tenantId");

CREATE UNIQUE INDEX "MetasearchConnection_tenantId_propertyId_platform_key" ON public."MetasearchConnection" USING btree ("tenantId", "propertyId", platform);

CREATE UNIQUE INDEX "MultiWanConfig_propertyId_key" ON public."MultiWanConfig" USING btree ("propertyId");

CREATE INDEX "MultiWanConfig_tenantId_idx" ON public."MultiWanConfig" USING btree ("tenantId");

CREATE INDEX "MultiWanMember_multiWanConfigId_idx" ON public."MultiWanMember" USING btree ("multiWanConfigId");

CREATE UNIQUE INDEX "MultiWanMember_multiWanConfigId_interfaceName_key" ON public."MultiWanMember" USING btree ("multiWanConfigId", "interfaceName");

CREATE INDEX "NasHealthLog_createdAt_idx" ON public."NasHealthLog" USING btree ("createdAt");

CREATE INDEX "NasHealthLog_isOnline_idx" ON public."NasHealthLog" USING btree ("isOnline");

CREATE INDEX "NasHealthLog_nasIpAddress_idx" ON public."NasHealthLog" USING btree ("nasIpAddress");

CREATE INDEX "NasHealthLog_propertyId_idx" ON public."NasHealthLog" USING btree ("propertyId");

CREATE INDEX "NasHealthLog_tenantId_idx" ON public."NasHealthLog" USING btree ("tenantId");

CREATE INDEX "NatLog_destDomain_idx" ON public."NatLog" USING btree ("destDomain");

CREATE INDEX "NatLog_propertyId_idx" ON public."NatLog" USING btree ("propertyId");

CREATE INDEX "NatLog_sessionId_idx" ON public."NatLog" USING btree ("sessionId");

CREATE INDEX "NatLog_sourceIp_idx" ON public."NatLog" USING btree ("sourceIp");

CREATE INDEX "NatLog_tenantId_idx" ON public."NatLog" USING btree ("tenantId");

CREATE INDEX "NatLog_timestamp_idx" ON public."NatLog" USING btree ("timestamp");

CREATE INDEX "NetworkConfigBackup_createdAt_idx" ON public."NetworkConfigBackup" USING btree ("createdAt");

CREATE INDEX "NetworkConfigBackup_propertyId_idx" ON public."NetworkConfigBackup" USING btree ("propertyId");

CREATE INDEX "NetworkConfigBackup_tenantId_idx" ON public."NetworkConfigBackup" USING btree ("tenantId");

CREATE INDEX "NetworkInterface_propertyId_idx" ON public."NetworkInterface" USING btree ("propertyId");

CREATE UNIQUE INDEX "NetworkInterface_propertyId_name_key" ON public."NetworkInterface" USING btree ("propertyId", name);

CREATE INDEX "NetworkInterface_status_idx" ON public."NetworkInterface" USING btree (status);

CREATE INDEX "NetworkInterface_tenantId_idx" ON public."NetworkInterface" USING btree ("tenantId");

CREATE INDEX "NotificationLog_recipientId_idx" ON public."NotificationLog" USING btree ("recipientId");

CREATE INDEX "NotificationLog_status_idx" ON public."NotificationLog" USING btree (status);

CREATE INDEX "NotificationLog_tenantId_idx" ON public."NotificationLog" USING btree ("tenantId");

CREATE INDEX "NotificationPreference_tenantId_idx" ON public."NotificationPreference" USING btree ("tenantId");

CREATE UNIQUE INDEX "NotificationPreference_userId_category_key" ON public."NotificationPreference" USING btree ("userId", category);

CREATE INDEX "NotificationPreference_userId_idx" ON public."NotificationPreference" USING btree ("userId");

CREATE INDEX "NotificationTemplate_tenantId_idx" ON public."NotificationTemplate" USING btree ("tenantId");

CREATE UNIQUE INDEX "NotificationTemplate_tenantId_triggerEvent_type_key" ON public."NotificationTemplate" USING btree ("tenantId", "triggerEvent", type);

CREATE INDEX "Notification_createdAt_idx" ON public."Notification" USING btree ("createdAt");

CREATE INDEX "Notification_expiresAt_idx" ON public."Notification" USING btree ("expiresAt");

CREATE INDEX "Notification_readAt_idx" ON public."Notification" USING btree ("readAt");

CREATE INDEX "Notification_tenantId_idx" ON public."Notification" USING btree ("tenantId");

CREATE INDEX "Notification_type_idx" ON public."Notification" USING btree (type);

CREATE INDEX "Notification_userId_idx" ON public."Notification" USING btree ("userId");

CREATE INDEX "OrderCategory_propertyId_idx" ON public."OrderCategory" USING btree ("propertyId");

CREATE INDEX "OrderItem_orderId_idx" ON public."OrderItem" USING btree ("orderId");

CREATE UNIQUE INDEX "Order_orderNumber_key" ON public."Order" USING btree ("orderNumber");

CREATE INDEX "Order_propertyId_idx" ON public."Order" USING btree ("propertyId");

CREATE INDEX "Order_status_idx" ON public."Order" USING btree (status);

CREATE INDEX "Order_tenantId_idx" ON public."Order" USING btree ("tenantId");

CREATE INDEX "ParkingSlot_tenantId_idx" ON public."ParkingSlot" USING btree ("tenantId");

CREATE UNIQUE INDEX "ParkingSlot_tenantId_number_key" ON public."ParkingSlot" USING btree ("tenantId", number);

CREATE INDEX "PaymentGateway_status_idx" ON public."PaymentGateway" USING btree (status);

CREATE INDEX "PaymentGateway_tenantId_idx" ON public."PaymentGateway" USING btree ("tenantId");

CREATE UNIQUE INDEX "PaymentGateway_tenantId_provider_key" ON public."PaymentGateway" USING btree ("tenantId", provider);

CREATE INDEX "PaymentSchedule_bookingId_idx" ON public."PaymentSchedule" USING btree ("bookingId");

CREATE INDEX "PaymentSchedule_folioId_idx" ON public."PaymentSchedule" USING btree ("folioId");

CREATE INDEX "PaymentSchedule_propertyId_idx" ON public."PaymentSchedule" USING btree ("propertyId");

CREATE INDEX "PaymentSchedule_status_idx" ON public."PaymentSchedule" USING btree (status);

CREATE INDEX "PaymentSchedule_tenantId_idx" ON public."PaymentSchedule" USING btree ("tenantId");

CREATE INDEX "Payment_folioId_idx" ON public."Payment" USING btree ("folioId");

CREATE INDEX "Payment_gatewayRef_idx" ON public."Payment" USING btree ("gatewayRef");

CREATE INDEX "Payment_gateway_idx" ON public."Payment" USING btree (gateway);

CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON public."Payment" USING btree ("idempotencyKey");

CREATE INDEX "Payment_status_idx" ON public."Payment" USING btree (status);

CREATE INDEX "Payment_tenantId_idx" ON public."Payment" USING btree ("tenantId");

CREATE INDEX "Payment_tenantId_status_idx" ON public."Payment" USING btree ("tenantId", status);

CREATE INDEX "PortForwardRule_enabled_idx" ON public."PortForwardRule" USING btree (enabled);

CREATE INDEX "PortForwardRule_propertyId_idx" ON public."PortForwardRule" USING btree ("propertyId");

CREATE INDEX "PortForwardRule_tenantId_idx" ON public."PortForwardRule" USING btree ("tenantId");

CREATE INDEX "PortalAuthentication_portalId_idx" ON public."PortalAuthentication" USING btree ("portalId");

CREATE UNIQUE INDEX "PortalAuthentication_portalId_method_key" ON public."PortalAuthentication" USING btree ("portalId", method);

CREATE INDEX "PortalAuthentication_propertyId_idx" ON public."PortalAuthentication" USING btree ("propertyId");

CREATE INDEX "PortalAuthentication_tenantId_idx" ON public."PortalAuthentication" USING btree ("tenantId");

CREATE INDEX "PortalMapping_enabled_idx" ON public."PortalMapping" USING btree (enabled);

CREATE INDEX "PortalMapping_portalId_idx" ON public."PortalMapping" USING btree ("portalId");

CREATE INDEX "PortalMapping_propertyId_idx" ON public."PortalMapping" USING btree ("propertyId");

CREATE INDEX "PortalMapping_ssid_idx" ON public."PortalMapping" USING btree (ssid);

CREATE INDEX "PortalMapping_tenantId_idx" ON public."PortalMapping" USING btree ("tenantId");

CREATE INDEX "PortalPage_portalId_idx" ON public."PortalPage" USING btree ("portalId");

CREATE UNIQUE INDEX "PortalPage_portalId_language_key" ON public."PortalPage" USING btree ("portalId", language);

CREATE INDEX "PortalPage_tenantId_idx" ON public."PortalPage" USING btree ("tenantId");

CREATE INDEX "PortalTemplate_category_idx" ON public."PortalTemplate" USING btree (category);

CREATE INDEX "PortalTemplate_tenantId_idx" ON public."PortalTemplate" USING btree ("tenantId");

CREATE INDEX "PortalWhitelist_domain_idx" ON public."PortalWhitelist" USING btree (domain);

CREATE UNIQUE INDEX "PortalWhitelist_propertyId_domain_path_key" ON public."PortalWhitelist" USING btree ("propertyId", domain, path);

CREATE INDEX "PortalWhitelist_propertyId_idx" ON public."PortalWhitelist" USING btree ("propertyId");

CREATE INDEX "PortalWhitelist_status_idx" ON public."PortalWhitelist" USING btree (status);

CREATE INDEX "PreventiveMaintenance_assetId_idx" ON public."PreventiveMaintenance" USING btree ("assetId");

CREATE INDEX "PreventiveMaintenance_nextDueAt_idx" ON public."PreventiveMaintenance" USING btree ("nextDueAt");

CREATE INDEX "PreventiveMaintenance_propertyId_idx" ON public."PreventiveMaintenance" USING btree ("propertyId");

CREATE INDEX "PreventiveMaintenance_status_idx" ON public."PreventiveMaintenance" USING btree (status);

CREATE INDEX "PreventiveMaintenance_tenantId_idx" ON public."PreventiveMaintenance" USING btree ("tenantId");

CREATE UNIQUE INDEX "PriceOverride_ratePlanId_date_key" ON public."PriceOverride" USING btree ("ratePlanId", date);

CREATE INDEX "PricingRule_isActive_idx" ON public."PricingRule" USING btree ("isActive");

CREATE INDEX "PricingRule_propertyId_idx" ON public."PricingRule" USING btree ("propertyId");

CREATE INDEX "PricingRule_tenantId_idx" ON public."PricingRule" USING btree ("tenantId");

CREATE INDEX "PricingRule_type_idx" ON public."PricingRule" USING btree (type);

CREATE INDEX "Promotion_code_idx" ON public."Promotion" USING btree (code);

CREATE UNIQUE INDEX "Promotion_code_key" ON public."Promotion" USING btree (code);

CREATE INDEX "Promotion_tenantId_idx" ON public."Promotion" USING btree ("tenantId");

CREATE INDEX "Property_brandId_idx" ON public."Property" USING btree ("brandId");

CREATE INDEX "Property_tenantId_idx" ON public."Property" USING btree ("tenantId");

CREATE UNIQUE INDEX "Property_tenantId_slug_key" ON public."Property" USING btree ("tenantId", slug);

CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON public."PurchaseOrderItem" USING btree ("purchaseOrderId");

CREATE UNIQUE INDEX "PurchaseOrder_orderNumber_key" ON public."PurchaseOrder" USING btree ("orderNumber");

CREATE INDEX "PurchaseOrder_tenantId_idx" ON public."PurchaseOrder" USING btree ("tenantId");

CREATE INDEX "RadiusAuthLog_authResult_idx" ON public."RadiusAuthLog" USING btree ("authResult");

CREATE INDEX "RadiusAuthLog_callingStationId_idx" ON public."RadiusAuthLog" USING btree ("callingStationId");

CREATE INDEX "RadiusAuthLog_propertyId_idx" ON public."RadiusAuthLog" USING btree ("propertyId");

CREATE INDEX "RadiusAuthLog_timestamp_idx" ON public."RadiusAuthLog" USING btree ("timestamp");

CREATE INDEX "RadiusAuthLog_username_idx" ON public."RadiusAuthLog" USING btree (username);

CREATE INDEX "RadiusCoaLog_action_idx" ON public."RadiusCoaLog" USING btree (action);

CREATE INDEX "RadiusCoaLog_propertyId_idx" ON public."RadiusCoaLog" USING btree ("propertyId");

CREATE INDEX "RadiusCoaLog_result_idx" ON public."RadiusCoaLog" USING btree (result);

CREATE INDEX "RadiusCoaLog_timestamp_idx" ON public."RadiusCoaLog" USING btree ("timestamp");

CREATE INDEX "RadiusCoaLog_username_idx" ON public."RadiusCoaLog" USING btree (username);

CREATE INDEX "RadiusEventUser_eventId_idx" ON public."RadiusEventUser" USING btree ("eventId");

CREATE INDEX "RadiusEventUser_propertyId_idx" ON public."RadiusEventUser" USING btree ("propertyId");

CREATE INDEX "RadiusEventUser_status_idx" ON public."RadiusEventUser" USING btree (status);

CREATE UNIQUE INDEX "RadiusEventUser_username_key" ON public."RadiusEventUser" USING btree (username);

CREATE INDEX "RadiusEventUser_validUntil_idx" ON public."RadiusEventUser" USING btree ("validUntil");

CREATE INDEX "RadiusMacAuth_guestId_idx" ON public."RadiusMacAuth" USING btree ("guestId");

CREATE INDEX "RadiusMacAuth_macAddress_idx" ON public."RadiusMacAuth" USING btree ("macAddress");

CREATE INDEX "RadiusMacAuth_planId_idx" ON public."RadiusMacAuth" USING btree ("planId");

CREATE INDEX "RadiusMacAuth_propertyId_idx" ON public."RadiusMacAuth" USING btree ("propertyId");

CREATE UNIQUE INDEX "RadiusMacAuth_propertyId_macAddress_key" ON public."RadiusMacAuth" USING btree ("propertyId", "macAddress");

CREATE INDEX "RadiusMacAuth_status_idx" ON public."RadiusMacAuth" USING btree (status);

CREATE INDEX "RadiusNAS_propertyId_idx" ON public."RadiusNAS" USING btree ("propertyId");

CREATE UNIQUE INDEX "RadiusNAS_propertyId_ipAddress_key" ON public."RadiusNAS" USING btree ("propertyId", "ipAddress");

CREATE UNIQUE INDEX "RadiusNAS_propertyId_shortname_key" ON public."RadiusNAS" USING btree ("propertyId", shortname);

CREATE INDEX "RadiusNAS_status_idx" ON public."RadiusNAS" USING btree (status);

CREATE INDEX "RadiusNAS_tenantId_idx" ON public."RadiusNAS" USING btree ("tenantId");

CREATE INDEX "RadiusProvisioningLog_action_idx" ON public."RadiusProvisioningLog" USING btree (action);

CREATE INDEX "RadiusProvisioningLog_bookingId_idx" ON public."RadiusProvisioningLog" USING btree ("bookingId");

CREATE INDEX "RadiusProvisioningLog_propertyId_idx" ON public."RadiusProvisioningLog" USING btree ("propertyId");

CREATE INDEX "RadiusProvisioningLog_result_idx" ON public."RadiusProvisioningLog" USING btree (result);

CREATE INDEX "RadiusProvisioningLog_timestamp_idx" ON public."RadiusProvisioningLog" USING btree ("timestamp");

CREATE INDEX "RadiusProvisioningLog_username_idx" ON public."RadiusProvisioningLog" USING btree (username);

CREATE UNIQUE INDEX "RadiusServerConfig_propertyId_key" ON public."RadiusServerConfig" USING btree ("propertyId");

CREATE INDEX "RadiusServerConfig_tenantId_idx" ON public."RadiusServerConfig" USING btree ("tenantId");

CREATE INDEX "RatePlan_roomTypeId_idx" ON public."RatePlan" USING btree ("roomTypeId");

CREATE INDEX "RatePlan_tenantId_idx" ON public."RatePlan" USING btree ("tenantId");

CREATE UNIQUE INDEX "RatePlan_tenantId_roomTypeId_code_key" ON public."RatePlan" USING btree ("tenantId", "roomTypeId", code);

CREATE INDEX "Reconciliation_bankAccountId_idx" ON public."Reconciliation" USING btree ("bankAccountId");

CREATE INDEX "Reconciliation_bankTransactionId_idx" ON public."Reconciliation" USING btree ("bankTransactionId");

CREATE INDEX "Reconciliation_paymentId_idx" ON public."Reconciliation" USING btree ("paymentId");

CREATE INDEX "Reconciliation_reconciledAt_idx" ON public."Reconciliation" USING btree ("reconciledAt");

CREATE INDEX "Reconciliation_status_idx" ON public."Reconciliation" USING btree (status);

CREATE INDEX "Reconciliation_tenantId_idx" ON public."Reconciliation" USING btree ("tenantId");

CREATE INDEX "RegistrationCard_bookingId_idx" ON public."RegistrationCard" USING btree ("bookingId");

CREATE INDEX "RegistrationCard_cardNumber_idx" ON public."RegistrationCard" USING btree ("cardNumber");

CREATE UNIQUE INDEX "RegistrationCard_cardNumber_key" ON public."RegistrationCard" USING btree ("cardNumber");

CREATE INDEX "RegistrationCard_guestId_idx" ON public."RegistrationCard" USING btree ("guestId");

CREATE INDEX "RegistrationCard_propertyId_idx" ON public."RegistrationCard" USING btree ("propertyId");

CREATE INDEX "RegistrationCard_tenantId_idx" ON public."RegistrationCard" USING btree ("tenantId");

CREATE INDEX "ReportCache_expiresAt_idx" ON public."ReportCache" USING btree ("expiresAt");

CREATE INDEX "ReportCache_tenantId_idx" ON public."ReportCache" USING btree ("tenantId");

CREATE UNIQUE INDEX "ReportCache_tenantId_reportType_periodStart_periodEnd_key" ON public."ReportCache" USING btree ("tenantId", "reportType", "periodStart", "periodEnd");

CREATE INDEX "ReportHistory_generatedAt_idx" ON public."ReportHistory" USING btree ("generatedAt");

CREATE INDEX "ReportHistory_tenantId_idx" ON public."ReportHistory" USING btree ("tenantId");

CREATE INDEX "ReportHistory_type_idx" ON public."ReportHistory" USING btree (type);

CREATE INDEX "Reservation_date_idx" ON public."Reservation" USING btree (date);

CREATE INDEX "Reservation_propertyId_idx" ON public."Reservation" USING btree ("propertyId");

CREATE INDEX "RestaurantTable_propertyId_idx" ON public."RestaurantTable" USING btree ("propertyId");

CREATE UNIQUE INDEX "RestaurantTable_propertyId_number_key" ON public."RestaurantTable" USING btree ("propertyId", number);

CREATE INDEX "Role_tenantId_idx" ON public."Role" USING btree ("tenantId");

CREATE UNIQUE INDEX "Role_tenantId_name_key" ON public."Role" USING btree ("tenantId", name);

CREATE INDEX "RoomMoveLog_bookingId_idx" ON public."RoomMoveLog" USING btree ("bookingId");

CREATE INDEX "RoomMoveLog_createdAt_idx" ON public."RoomMoveLog" USING btree ("createdAt");

CREATE INDEX "RoomMoveLog_guestId_idx" ON public."RoomMoveLog" USING btree ("guestId");

CREATE INDEX "RoomMoveLog_propertyId_idx" ON public."RoomMoveLog" USING btree ("propertyId");

CREATE INDEX "RoomMoveLog_tenantId_idx" ON public."RoomMoveLog" USING btree ("tenantId");

CREATE UNIQUE INDEX "RoomType_propertyId_code_key" ON public."RoomType" USING btree ("propertyId", code);

CREATE INDEX "RoomType_propertyId_idx" ON public."RoomType" USING btree ("propertyId");

CREATE INDEX "Room_currentTaskId_idx" ON public."Room" USING btree ("currentTaskId");

CREATE UNIQUE INDEX "Room_currentTaskId_key" ON public."Room" USING btree ("currentTaskId");

CREATE INDEX "Room_housekeepingStatus_idx" ON public."Room" USING btree ("housekeepingStatus");

CREATE INDEX "Room_propertyId_idx" ON public."Room" USING btree ("propertyId");

CREATE UNIQUE INDEX "Room_propertyId_number_key" ON public."Room" USING btree ("propertyId", number);

CREATE INDEX "Room_propertyId_status_idx" ON public."Room" USING btree ("propertyId", status);

CREATE INDEX "Room_roomTypeId_idx" ON public."Room" USING btree ("roomTypeId");

CREATE INDEX "Room_status_idx" ON public."Room" USING btree (status);

CREATE INDEX "SSOConnection_status_idx" ON public."SSOConnection" USING btree (status);

CREATE INDEX "SSOConnection_tenantId_idx" ON public."SSOConnection" USING btree ("tenantId");

CREATE INDEX "SSOConnection_type_idx" ON public."SSOConnection" USING btree (type);

CREATE INDEX "SSOSession_connectionId_idx" ON public."SSOSession" USING btree ("connectionId");

CREATE INDEX "SSOSession_expiresAt_idx" ON public."SSOSession" USING btree ("expiresAt");

CREATE INDEX "SSOSession_sessionId_idx" ON public."SSOSession" USING btree ("sessionId");

CREATE INDEX "SSOSession_ssoProviderId_idx" ON public."SSOSession" USING btree ("ssoProviderId");

CREATE INDEX "SSOSession_userId_idx" ON public."SSOSession" USING btree ("userId");

CREATE INDEX "ScheduleAccess_enabled_idx" ON public."ScheduleAccess" USING btree (enabled);

CREATE INDEX "ScheduleAccess_propertyId_idx" ON public."ScheduleAccess" USING btree ("propertyId");

CREATE INDEX "ScheduleAccess_tenantId_idx" ON public."ScheduleAccess" USING btree ("tenantId");

CREATE INDEX "ScheduledNotification_nextRetryAt_idx" ON public."ScheduledNotification" USING btree ("nextRetryAt");

CREATE INDEX "ScheduledNotification_recipientId_idx" ON public."ScheduledNotification" USING btree ("recipientId");

CREATE INDEX "ScheduledNotification_scheduledFor_idx" ON public."ScheduledNotification" USING btree ("scheduledFor");

CREATE INDEX "ScheduledNotification_status_idx" ON public."ScheduledNotification" USING btree (status);

CREATE INDEX "ScheduledNotification_tenantId_idx" ON public."ScheduledNotification" USING btree ("tenantId");

CREATE INDEX "ScheduledReport_tenantId_idx" ON public."ScheduledReport" USING btree ("tenantId");

CREATE INDEX "SecurityEvent_acknowledged_idx" ON public."SecurityEvent" USING btree (acknowledged);

CREATE INDEX "SecurityEvent_cameraId_idx" ON public."SecurityEvent" USING btree ("cameraId");

CREATE INDEX "SecurityEvent_severity_idx" ON public."SecurityEvent" USING btree (severity);

CREATE INDEX "SecurityEvent_tenantId_idx" ON public."SecurityEvent" USING btree ("tenantId");

CREATE INDEX "SecurityEvent_timestamp_idx" ON public."SecurityEvent" USING btree ("timestamp");

CREATE INDEX "SecurityIncident_incidentDate_idx" ON public."SecurityIncident" USING btree ("incidentDate");

CREATE INDEX "SecurityIncident_severity_idx" ON public."SecurityIncident" USING btree (severity);

CREATE INDEX "SecurityIncident_status_idx" ON public."SecurityIncident" USING btree (status);

CREATE INDEX "SecurityIncident_tenantId_idx" ON public."SecurityIncident" USING btree ("tenantId");

CREATE INDEX "SecuritySettings_tenantId_idx" ON public."SecuritySettings" USING btree ("tenantId");

CREATE UNIQUE INDEX "SecuritySettings_tenantId_key" ON public."SecuritySettings" USING btree ("tenantId");

CREATE UNIQUE INDEX "SegmentMembership_segmentId_guestId_key" ON public."SegmentMembership" USING btree ("segmentId", "guestId");

CREATE INDEX "ServiceRequest_propertyId_idx" ON public."ServiceRequest" USING btree ("propertyId");

CREATE INDEX "ServiceRequest_status_idx" ON public."ServiceRequest" USING btree (status);

CREATE INDEX "ServiceRequest_tenantId_idx" ON public."ServiceRequest" USING btree ("tenantId");

CREATE UNIQUE INDEX "Session_refreshToken_key" ON public."Session" USING btree ("refreshToken");

CREATE INDEX "Session_token_idx" ON public."Session" USING btree (token);

CREATE UNIQUE INDEX "Session_token_key" ON public."Session" USING btree (token);

CREATE INDEX "Session_userId_idx" ON public."Session" USING btree ("userId");

CREATE INDEX "ShiftTemplate_tenantId_idx" ON public."ShiftTemplate" USING btree ("tenantId");

CREATE INDEX "StaffAttendance_date_idx" ON public."StaffAttendance" USING btree (date);

CREATE INDEX "StaffAttendance_tenantId_idx" ON public."StaffAttendance" USING btree ("tenantId");

CREATE UNIQUE INDEX "StaffAttendance_userId_date_key" ON public."StaffAttendance" USING btree ("userId", date);

CREATE INDEX "StaffChannelMember_channelId_idx" ON public."StaffChannelMember" USING btree ("channelId");

CREATE UNIQUE INDEX "StaffChannelMember_channelId_userId_key" ON public."StaffChannelMember" USING btree ("channelId", "userId");

CREATE INDEX "StaffChannelMember_userId_idx" ON public."StaffChannelMember" USING btree ("userId");

CREATE INDEX "StaffChannel_department_idx" ON public."StaffChannel" USING btree (department);

CREATE INDEX "StaffChannel_tenantId_idx" ON public."StaffChannel" USING btree ("tenantId");

CREATE INDEX "StaffChannel_type_idx" ON public."StaffChannel" USING btree (type);

CREATE INDEX "StaffChatMessage_channelId_idx" ON public."StaffChatMessage" USING btree ("channelId");

CREATE INDEX "StaffChatMessage_senderId_idx" ON public."StaffChatMessage" USING btree ("senderId");

CREATE INDEX "StaffChatMessage_sentAt_idx" ON public."StaffChatMessage" USING btree ("sentAt");

CREATE INDEX "StaffLeave_startDate_idx" ON public."StaffLeave" USING btree ("startDate");

CREATE INDEX "StaffLeave_status_idx" ON public."StaffLeave" USING btree (status);

CREATE INDEX "StaffLeave_tenantId_idx" ON public."StaffLeave" USING btree ("tenantId");

CREATE INDEX "StaffLeave_userId_idx" ON public."StaffLeave" USING btree ("userId");

CREATE INDEX "StaffPerformance_reviewYear_idx" ON public."StaffPerformance" USING btree ("reviewYear");

CREATE INDEX "StaffPerformance_tenantId_idx" ON public."StaffPerformance" USING btree ("tenantId");

CREATE INDEX "StaffPerformance_userId_idx" ON public."StaffPerformance" USING btree ("userId");

CREATE UNIQUE INDEX "StaffPerformance_userId_reviewPeriod_reviewYear_key" ON public."StaffPerformance" USING btree ("userId", "reviewPeriod", "reviewYear");

CREATE INDEX "StaffSchedule_date_idx" ON public."StaffSchedule" USING btree (date);

CREATE INDEX "StaffSchedule_tenantId_idx" ON public."StaffSchedule" USING btree ("tenantId");

CREATE UNIQUE INDEX "StaffSchedule_userId_date_key" ON public."StaffSchedule" USING btree ("userId", date);

CREATE INDEX "StaffSchedule_userId_idx" ON public."StaffSchedule" USING btree ("userId");

CREATE INDEX "StaffShift_date_idx" ON public."StaffShift" USING btree (date);

CREATE INDEX "StaffShift_tenantId_idx" ON public."StaffShift" USING btree ("tenantId");

CREATE INDEX "StaffShift_userId_idx" ON public."StaffShift" USING btree ("userId");

CREATE INDEX "StaffSkill_category_idx" ON public."StaffSkill" USING btree (category);

CREATE INDEX "StaffSkill_tenantId_idx" ON public."StaffSkill" USING btree ("tenantId");

CREATE INDEX "StaffSkill_userId_idx" ON public."StaffSkill" USING btree ("userId");

CREATE UNIQUE INDEX "StaffSkill_userId_skillName_key" ON public."StaffSkill" USING btree ("userId", "skillName");

CREATE INDEX "StaffWorkload_date_idx" ON public."StaffWorkload" USING btree (date);

CREATE INDEX "StaffWorkload_tenantId_idx" ON public."StaffWorkload" USING btree ("tenantId");

CREATE UNIQUE INDEX "StaffWorkload_userId_date_key" ON public."StaffWorkload" USING btree ("userId", date);

CREATE INDEX "StaffWorkload_userId_idx" ON public."StaffWorkload" USING btree ("userId");

CREATE INDEX "StaticRoute_enabled_idx" ON public."StaticRoute" USING btree (enabled);

CREATE INDEX "StaticRoute_isDefault_idx" ON public."StaticRoute" USING btree ("isDefault");

CREATE INDEX "StaticRoute_propertyId_idx" ON public."StaticRoute" USING btree ("propertyId");

CREATE INDEX "StaticRoute_tenantId_idx" ON public."StaticRoute" USING btree ("tenantId");

CREATE INDEX "StockConsumption_stockItemId_idx" ON public."StockConsumption" USING btree ("stockItemId");

CREATE INDEX "StockItem_tenantId_idx" ON public."StockItem" USING btree ("tenantId");

CREATE UNIQUE INDEX "SubscriptionInvoice_invoiceNumber_key" ON public."SubscriptionInvoice" USING btree ("invoiceNumber");

CREATE INDEX "SubscriptionInvoice_subscriptionId_idx" ON public."SubscriptionInvoice" USING btree ("subscriptionId");

CREATE INDEX "Subscription_tenantId_idx" ON public."Subscription" USING btree ("tenantId");

CREATE INDEX "SyslogServer_enabled_idx" ON public."SyslogServer" USING btree (enabled);

CREATE INDEX "SyslogServer_propertyId_idx" ON public."SyslogServer" USING btree ("propertyId");

CREATE INDEX "SyslogServer_tenantId_idx" ON public."SyslogServer" USING btree ("tenantId");

CREATE UNIQUE INDEX "SystemNetworkHealth_propertyId_key" ON public."SystemNetworkHealth" USING btree ("propertyId");

CREATE INDEX "SystemNetworkHealth_tenantId_idx" ON public."SystemNetworkHealth" USING btree ("tenantId");

CREATE INDEX "TaskAssignmentSuggestion_expiresAt_idx" ON public."TaskAssignmentSuggestion" USING btree ("expiresAt");

CREATE INDEX "TaskAssignmentSuggestion_status_idx" ON public."TaskAssignmentSuggestion" USING btree (status);

CREATE INDEX "TaskAssignmentSuggestion_suggestedUserId_idx" ON public."TaskAssignmentSuggestion" USING btree ("suggestedUserId");

CREATE INDEX "TaskAssignmentSuggestion_taskId_idx" ON public."TaskAssignmentSuggestion" USING btree ("taskId");

CREATE INDEX "TaskAssignmentSuggestion_tenantId_idx" ON public."TaskAssignmentSuggestion" USING btree ("tenantId");

CREATE INDEX "Task_assignedTo_idx" ON public."Task" USING btree ("assignedTo");

CREATE INDEX "Task_priority_idx" ON public."Task" USING btree (priority);

CREATE INDEX "Task_propertyId_idx" ON public."Task" USING btree ("propertyId");

CREATE INDEX "Task_propertyId_status_idx" ON public."Task" USING btree ("propertyId", status);

CREATE INDEX "Task_roomId_idx" ON public."Task" USING btree ("roomId");

CREATE INDEX "Task_status_idx" ON public."Task" USING btree (status);

CREATE INDEX "Task_tenantId_idx" ON public."Task" USING btree ("tenantId");

CREATE INDEX "Task_tenantId_propertyId_status_idx" ON public."Task" USING btree ("tenantId", "propertyId", status);

CREATE INDEX "TaxReport_filingDueDate_idx" ON public."TaxReport" USING btree ("filingDueDate");

CREATE INDEX "TaxReport_jurisdiction_idx" ON public."TaxReport" USING btree (jurisdiction);

CREATE INDEX "TaxReport_periodStart_periodEnd_idx" ON public."TaxReport" USING btree ("periodStart", "periodEnd");

CREATE INDEX "TaxReport_propertyId_idx" ON public."TaxReport" USING btree ("propertyId");

CREATE UNIQUE INDEX "TaxReport_reportNumber_key" ON public."TaxReport" USING btree ("reportNumber");

CREATE INDEX "TaxReport_reportType_idx" ON public."TaxReport" USING btree ("reportType");

CREATE INDEX "TaxReport_status_idx" ON public."TaxReport" USING btree (status);

CREATE INDEX "TaxReport_tenantId_idx" ON public."TaxReport" USING btree ("tenantId");

CREATE UNIQUE INDEX "Tenant_slug_key" ON public."Tenant" USING btree (slug);

CREATE INDEX "UsageLog_createdAt_idx" ON public."UsageLog" USING btree ("createdAt");

CREATE INDEX "UsageLog_tenantId_idx" ON public."UsageLog" USING btree ("tenantId");

CREATE INDEX "UsageLog_tenantId_type_createdAt_idx" ON public."UsageLog" USING btree ("tenantId", type, "createdAt");

CREATE INDEX "UsageLog_type_idx" ON public."UsageLog" USING btree (type);

CREATE INDEX "UsageSummary_lastResetAt_idx" ON public."UsageSummary" USING btree ("lastResetAt");

CREATE INDEX "UsageSummary_tenantId_idx" ON public."UsageSummary" USING btree ("tenantId");

CREATE UNIQUE INDEX "UsageSummary_tenantId_key" ON public."UsageSummary" USING btree ("tenantId");

CREATE INDEX "UserFcmToken_isActive_idx" ON public."UserFcmToken" USING btree ("isActive");

CREATE INDEX "UserFcmToken_tenantId_idx" ON public."UserFcmToken" USING btree ("tenantId");

CREATE INDEX "UserFcmToken_token_idx" ON public."UserFcmToken" USING btree (token);

CREATE UNIQUE INDEX "UserFcmToken_token_key" ON public."UserFcmToken" USING btree (token);

CREATE INDEX "UserFcmToken_userId_idx" ON public."UserFcmToken" USING btree ("userId");

CREATE INDEX "UserTutorial_tenantId_idx" ON public."UserTutorial" USING btree ("tenantId");

CREATE INDEX "UserTutorial_userId_idx" ON public."UserTutorial" USING btree ("userId");

CREATE UNIQUE INDEX "UserTutorial_userId_tutorialKey_key" ON public."UserTutorial" USING btree ("userId", "tutorialKey");

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);

CREATE UNIQUE INDEX "User_tenantId_email_key" ON public."User" USING btree ("tenantId", email);

CREATE INDEX "User_tenantId_idx" ON public."User" USING btree ("tenantId");

CREATE INDEX "Vehicle_licensePlate_idx" ON public."Vehicle" USING btree ("licensePlate");

CREATE INDEX "Vehicle_tenantId_idx" ON public."Vehicle" USING btree ("tenantId");

CREATE INDEX "VendorPayment_dueDate_idx" ON public."VendorPayment" USING btree ("dueDate");

CREATE UNIQUE INDEX "VendorPayment_paymentNumber_key" ON public."VendorPayment" USING btree ("paymentNumber");

CREATE INDEX "VendorPayment_status_idx" ON public."VendorPayment" USING btree (status);

CREATE INDEX "VendorPayment_tenantId_idx" ON public."VendorPayment" USING btree ("tenantId");

CREATE INDEX "VendorPayment_vendorId_idx" ON public."VendorPayment" USING btree ("vendorId");

CREATE INDEX "VendorPayment_workOrderId_idx" ON public."VendorPayment" USING btree ("workOrderId");

CREATE UNIQUE INDEX "Vendor_portalEmail_key" ON public."Vendor" USING btree ("portalEmail");

CREATE UNIQUE INDEX "Vendor_portalToken_key" ON public."Vendor" USING btree ("portalToken");

CREATE INDEX "Vendor_status_idx" ON public."Vendor" USING btree (status);

CREATE INDEX "Vendor_tenantId_idx" ON public."Vendor" USING btree ("tenantId");

CREATE INDEX "Vendor_type_idx" ON public."Vendor" USING btree (type);

CREATE INDEX "VlanConfig_propertyId_idx" ON public."VlanConfig" USING btree ("propertyId");

CREATE UNIQUE INDEX "VlanConfig_propertyId_subInterface_key" ON public."VlanConfig" USING btree ("propertyId", "subInterface");

CREATE UNIQUE INDEX "VlanConfig_propertyId_vlanId_key" ON public."VlanConfig" USING btree ("propertyId", "vlanId");

CREATE INDEX "VlanConfig_tenantId_idx" ON public."VlanConfig" USING btree ("tenantId");

CREATE UNIQUE INDEX "WaitlistEntry_bookingId_key" ON public."WaitlistEntry" USING btree ("bookingId");

CREATE INDEX "WaitlistEntry_propertyId_idx" ON public."WaitlistEntry" USING btree ("propertyId");

CREATE INDEX "WaitlistEntry_status_idx" ON public."WaitlistEntry" USING btree (status);

CREATE INDEX "WaitlistEntry_tenantId_idx" ON public."WaitlistEntry" USING btree ("tenantId");

CREATE UNIQUE INDEX "WanFailover_propertyId_key" ON public."WanFailover" USING btree ("propertyId");

CREATE INDEX "WanFailover_tenantId_idx" ON public."WanFailover" USING btree ("tenantId");

CREATE INDEX "WebCategorySchedule_propertyId_idx" ON public."WebCategorySchedule" USING btree ("propertyId");

CREATE INDEX "WebCategorySchedule_scheduleAccessId_idx" ON public."WebCategorySchedule" USING btree ("scheduleAccessId");

CREATE INDEX "WebCategorySchedule_tenantId_idx" ON public."WebCategorySchedule" USING btree ("tenantId");

CREATE INDEX "WebCategorySchedule_webCategoryId_idx" ON public."WebCategorySchedule" USING btree ("webCategoryId");

CREATE INDEX "WebCategory_categoryType_idx" ON public."WebCategory" USING btree ("categoryType");

CREATE INDEX "WebCategory_enabled_idx" ON public."WebCategory" USING btree (enabled);

CREATE INDEX "WebCategory_propertyId_idx" ON public."WebCategory" USING btree ("propertyId");

CREATE UNIQUE INDEX "WebCategory_propertyId_name_key" ON public."WebCategory" USING btree ("propertyId", name);

CREATE INDEX "WebCategory_tenantId_idx" ON public."WebCategory" USING btree ("tenantId");

CREATE INDEX "WebhookDeliveryLog_endpointId_idx" ON public."WebhookDeliveryLog" USING btree ("endpointId");

CREATE INDEX "WebhookDeliveryLog_status_idx" ON public."WebhookDeliveryLog" USING btree (status);

CREATE INDEX "WebhookEndpoint_tenantId_idx" ON public."WebhookEndpoint" USING btree ("tenantId");

CREATE UNIQUE INDEX "WiFiAAAConfig_propertyId_key" ON public."WiFiAAAConfig" USING btree ("propertyId");

CREATE INDEX "WiFiAAAConfig_tenantId_idx" ON public."WiFiAAAConfig" USING btree ("tenantId");

CREATE INDEX "WiFiGateway_propertyId_idx" ON public."WiFiGateway" USING btree ("propertyId");

CREATE UNIQUE INDEX "WiFiGateway_propertyId_ipAddress_key" ON public."WiFiGateway" USING btree ("propertyId", "ipAddress");

CREATE INDEX "WiFiGateway_status_idx" ON public."WiFiGateway" USING btree (status);

CREATE INDEX "WiFiGateway_tenantId_idx" ON public."WiFiGateway" USING btree ("tenantId");

CREATE INDEX "WiFiGateway_vendor_idx" ON public."WiFiGateway" USING btree (vendor);

CREATE INDEX "WiFiPlan_ipPoolId_idx" ON public."WiFiPlan" USING btree ("ipPoolId");

CREATE INDEX "WiFiPlan_tenantId_idx" ON public."WiFiPlan" USING btree ("tenantId");

CREATE INDEX "WiFiSession_guestId_idx" ON public."WiFiSession" USING btree ("guestId");

CREATE INDEX "WiFiSession_macAddress_idx" ON public."WiFiSession" USING btree ("macAddress");

CREATE INDEX "WiFiSession_tenantId_idx" ON public."WiFiSession" USING btree ("tenantId");

CREATE INDEX "WiFiUserStatusHistory_createdAt_idx" ON public."WiFiUserStatusHistory" USING btree ("createdAt");

CREATE INDEX "WiFiUserStatusHistory_propertyId_idx" ON public."WiFiUserStatusHistory" USING btree ("propertyId");

CREATE INDEX "WiFiUserStatusHistory_tenantId_idx" ON public."WiFiUserStatusHistory" USING btree ("tenantId");

CREATE INDEX "WiFiUserStatusHistory_userId_idx" ON public."WiFiUserStatusHistory" USING btree ("userId");

CREATE INDEX "WiFiUserStatusHistory_username_idx" ON public."WiFiUserStatusHistory" USING btree (username);

CREATE INDEX "WiFiUser_bookingId_idx" ON public."WiFiUser" USING btree ("bookingId");

CREATE INDEX "WiFiUser_guestId_idx" ON public."WiFiUser" USING btree ("guestId");

CREATE INDEX "WiFiUser_ipPoolId_idx" ON public."WiFiUser" USING btree ("ipPoolId");

CREATE INDEX "WiFiUser_propertyId_idx" ON public."WiFiUser" USING btree ("propertyId");

CREATE INDEX "WiFiUser_status_idx" ON public."WiFiUser" USING btree (status);

CREATE INDEX "WiFiUser_tenantId_idx" ON public."WiFiUser" USING btree ("tenantId");

CREATE INDEX "WiFiUser_username_idx" ON public."WiFiUser" USING btree (username);

CREATE UNIQUE INDEX "WiFiUser_username_key" ON public."WiFiUser" USING btree (username);

CREATE INDEX "WiFiVoucher_code_idx" ON public."WiFiVoucher" USING btree (code);

CREATE UNIQUE INDEX "WiFiVoucher_code_key" ON public."WiFiVoucher" USING btree (code);

CREATE INDEX "WiFiVoucher_tenantId_idx" ON public."WiFiVoucher" USING btree ("tenantId");

CREATE INDEX "WorkOrder_priority_idx" ON public."WorkOrder" USING btree (priority);

CREATE INDEX "WorkOrder_propertyId_idx" ON public."WorkOrder" USING btree ("propertyId");

CREATE INDEX "WorkOrder_scheduledDate_idx" ON public."WorkOrder" USING btree ("scheduledDate");

CREATE INDEX "WorkOrder_status_idx" ON public."WorkOrder" USING btree (status);

CREATE INDEX "WorkOrder_tenantId_idx" ON public."WorkOrder" USING btree ("tenantId");

CREATE INDEX "WorkOrder_type_idx" ON public."WorkOrder" USING btree (type);

CREATE INDEX "WorkOrder_vendorId_idx" ON public."WorkOrder" USING btree ("vendorId");

CREATE UNIQUE INDEX "WorkOrder_workOrderNumber_key" ON public."WorkOrder" USING btree ("workOrderNumber");

CREATE INDEX "_CaptivePortalToVlanConfig_B_index" ON public."_CaptivePortalToVlanConfig" USING btree ("B");

