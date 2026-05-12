---
Task ID: 4
Agent: experience-features-2
Task: Build Revenue Analytics, Calendar, Feedback, Chat Attachments, QR, Transfer

Work Log:
- Read worklog.md and studied existing codebase patterns (service-requests.tsx, auth-helpers.ts, API routes, prisma schema)
- Built Feature 1: Experience Revenue Analytics — component with summary cards, bar chart, trend chart, pie chart, top table, CSV export; API with Prisma aggregate queries
- Built Feature 2: Experience Calendar — custom monthly calendar grid, color-coded days, day detail dialog, experience filter; API with bookings grouped by date
- Built Feature 3: Guest Feedback & Ratings — data table, star rating component, rating distribution, avg by experience cards, reply dialog, publish/hide toggle, create feedback dialog; full CRUD API
- Built Feature 4: Chat File Attachments — utility lib (uploadChatAttachment, getChatAttachments, deleteChatAttachment), standalone ChatAttachmentButton component with upload progress and preview, API route for file upload/download/delete
- Built Feature 5: Digital Key QR Code — standalone DigitalKeyQR component with dark-themed key card, CSS-based QR grid, barcode, download; API route to fetch key data
- Built Feature 6: Conversation Transfer/Assignment — ChatTransfer dialog with staff selection, reason picker, notes, transfer history; POST/GET transfer API, PUT assign API
- Updated navigation.ts — added Revenue Analytics, Calendar, Guest Feedback nav items under experience section
- Updated permissions.ts — added experience_revenue.view, experience-calendar, experience-feedback permissions
- Updated section-paths.ts — added experience-revenue, experience-calendar, experience-feedback paths
- Updated prisma/schema.prisma — added ExperienceFeedback, ChatAttachment, ChatTransfer models with indexes and Tenant/User relations

Stage Summary:
Files created:
- src/components/experience/experience-revenue.tsx
- src/components/experience/experience-calendar.tsx
- src/components/experience/experience-feedback.tsx
- src/components/experience/chat-attachment-button.tsx
- src/components/experience/digital-key-qr.tsx
- src/components/experience/chat-transfer.tsx
- src/lib/chat-attachments.ts
- src/app/api/experience-revenue/route.ts
- src/app/api/experience-calendar/route.ts
- src/app/api/experience-feedback/route.ts
- src/app/api/chat-conversations/[id]/attachments/route.ts
- src/app/api/digital-keys/[id]/qr/route.ts
- src/app/api/chat-conversations/[id]/transfer/route.ts
- src/app/api/chat-conversations/[id]/assign/route.ts

Files updated:
- src/config/navigation.ts
- src/config/permissions.ts
- src/components/sections/section-paths.ts
- prisma/schema.prisma (added ExperienceFeedback, ChatAttachment, ChatTransfer models + Tenant/User relations)
