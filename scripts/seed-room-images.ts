/**
 * Seed script: Assign AI-generated room images to all rooms in the database.
 * 
 * Each room type gets 3 images (bedroom, bathroom/view/general, living_area/amenities).
 * Rooms get 2-3 images assigned with varied categories and captions.
 * 
 * Usage: npx tsx scripts/seed-room-images.ts
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import fs from 'fs';
import sharp from 'sharp';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite',
    },
  },
});

const UPLOAD_DIR = '/home/z/my-project/upload/rooms';

// Image pool per room type name (lowercase match)
const IMAGE_POOL: Record<string, Array<{
  file: string;
  url: string;
  thumbUrl: string;
  category: string;
  caption: string;
}>> = {
  'standard room': [
    {
      file: 'standard-general.png',
      url: '/api/files/rooms/standard-general.png',
      thumbUrl: '/api/files/rooms/thumbs/standard-general.jpg',
      category: 'general',
      caption: 'Standard Room - Full View',
    },
    {
      file: 'standard-bedroom.png',
      url: '/api/files/rooms/standard-bedroom.png',
      thumbUrl: '/api/files/rooms/thumbs/standard-bedroom.jpg',
      category: 'bedroom',
      caption: 'Comfortable Double Bed',
    },
    {
      file: 'standard-bathroom.png',
      url: '/api/files/rooms/standard-bathroom.png',
      thumbUrl: '/api/files/rooms/thumbs/standard-bathroom.jpg',
      category: 'bathroom',
      caption: 'Clean Modern Bathroom',
    },
  ],
  'deluxe room': [
    {
      file: 'deluxe-bedroom.png',
      url: '/api/files/rooms/deluxe-bedroom.png',
      thumbUrl: '/api/files/rooms/thumbs/deluxe-bedroom.jpg',
      category: 'bedroom',
      caption: 'Spacious King Bed',
    },
    {
      file: 'deluxe-living.png',
      url: '/api/files/rooms/deluxe-living.png',
      thumbUrl: '/api/files/rooms/thumbs/deluxe-living.jpg',
      category: 'living_area',
      caption: 'Relaxing Living Area',
    },
    {
      file: 'deluxe-bathroom.png',
      url: '/api/files/rooms/deluxe-bathroom.png',
      thumbUrl: '/api/files/rooms/thumbs/deluxe-bathroom.jpg',
      category: 'bathroom',
      caption: 'Premium Marble Bathroom',
    },
  ],
  'executive suite': [
    {
      file: 'executive-bedroom.png',
      url: '/api/files/rooms/executive-bedroom.png',
      thumbUrl: '/api/files/rooms/thumbs/executive-bedroom.jpg',
      category: 'bedroom',
      caption: 'Luxury King Suite Bedroom',
    },
    {
      file: 'executive-living.png',
      url: '/api/files/rooms/executive-living.png',
      thumbUrl: '/api/files/rooms/thumbs/executive-living.jpg',
      category: 'living_area',
      caption: 'Executive Lounge & Dining',
    },
    {
      file: 'executive-bathroom.png',
      url: '/api/files/rooms/executive-bathroom.png',
      thumbUrl: '/api/files/rooms/thumbs/executive-bathroom.jpg',
      category: 'bathroom',
      caption: 'Jacuzzi & Rain Shower',
    },
  ],
  'presidential suite': [
    {
      file: 'presidential-bedroom.png',
      url: '/api/files/rooms/presidential-bedroom.png',
      thumbUrl: '/api/files/rooms/thumbs/presidential-bedroom.jpg',
      category: 'bedroom',
      caption: 'Grand Presidential Bedroom',
    },
    {
      file: 'presidential-living.png',
      url: '/api/files/rooms/presidential-living.png',
      thumbUrl: '/api/files/rooms/thumbs/presidential-living.jpg',
      category: 'living_area',
      caption: 'Opulent Living Room',
    },
    {
      file: 'presidential-view.png',
      url: '/api/files/rooms/presidential-view.png',
      thumbUrl: '/api/files/rooms/thumbs/presidential-view.jpg',
      category: 'view',
      caption: 'Breathtaking Panoramic View',
    },
  ],
};

async function getImageDimensions(filePath: string): Promise<{ width: number; height: number; fileSize: number }> {
  try {
    const meta = await sharp(filePath).metadata();
    const stat = fs.statSync(filePath);
    return {
      width: meta.width ?? 1344,
      height: meta.height ?? 768,
      fileSize: stat.size,
    };
  } catch {
    return { width: 1344, height: 768, fileSize: 0 };
  }
}

async function main() {
  console.log('🖼️  Seeding room images...\n');

  // Clear existing RoomImage records
  const deleted = await prisma.roomImage.deleteMany({});
  console.log(`Cleared ${deleted.count} existing RoomImage records.`);

  // Get all rooms with their room type names
  const rooms = await prisma.room.findMany({
    where: { deletedAt: null },
    include: {
      roomType: { select: { name: true } },
    },
    orderBy: [{ floor: 'asc' }, { number: 'asc' }],
  });

  console.log(`Found ${rooms.length} rooms.\n`);

  let totalImages = 0;

  for (const room of rooms) {
    const typeName = room.roomType.name.toLowerCase();
    
    // Find matching image pool
    let pool = IMAGE_POOL[typeName];
    if (!pool) {
      // Try partial match
      const key = Object.keys(IMAGE_POOL).find(k => typeName.includes(k) || k.includes(typeName));
      if (key) {
        pool = IMAGE_POOL[key];
      } else {
        console.log(`⚠️  No image pool for "${room.roomType.name}", using standard.`);
        pool = IMAGE_POOL['standard room'];
      }
    }

    // Vary the number of images per room (2-3)
    // Use room number hash for deterministic but varied assignment
    const roomNum = parseInt(room.number) || 0;
    const imageCount = roomNum % 3 === 0 ? 2 : 3; // ~1/3 get 2 images, ~2/3 get 3
    
    // Rotate which images are primary based on room number
    const primaryOffset = roomNum % pool.length;
    
    const roomImages = [];
    
    for (let i = 0; i < imageCount; i++) {
      const imgIndex = (i + primaryOffset) % pool.length;
      const img = pool[imgIndex];
      
      // Get dimensions
      const filePath = `${UPLOAD_DIR}/${img.file}`;
      const dims = await getImageDimensions(filePath);
      
      const isPrimary = i === 0;
      
      // Vary caption slightly per room
      const captionSuffix = room.name ? ` - ${room.name}` : ` - Room ${room.number}`;
      
      roomImages.push({
        id: randomUUID(),
        roomId: room.id,
        url: img.url,
        thumbnailUrl: img.thumbUrl,
        caption: img.caption + captionSuffix,
        category: img.category,
        isPrimary,
        sortOrder: i,
        width: dims.width,
        height: dims.height,
        fileSize: dims.fileSize,
        mimeType: 'image/png',
        otaSyncStatus: '{}',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Batch insert room images
    await prisma.roomImage.createMany({ data: roomImages });
    
    // Update the Room.images JSON field for backward compatibility
    const imageUrls = roomImages
      .sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return a.sortOrder - b.sortOrder;
      })
      .map(img => img.url);
    
    await prisma.room.update({
      where: { id: room.id },
      data: { images: JSON.stringify(imageUrls) },
    });

    totalImages += roomImages.length;
  }

  console.log(`\n✅ Seeded ${totalImages} images across ${rooms.length} rooms.`);
  
  // Summary
  const roomTypes = await prisma.roomType.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { rooms: { where: { deletedAt: null } } } } },
  });
  
  console.log('\n📊 Summary by room type:');
  for (const rt of roomTypes) {
    const imgCount = await prisma.roomImage.count({
      where: { room: { roomTypeId: rt.id, deletedAt: null } },
    });
    console.log(`  ${rt.name}: ${rt._count.rooms} rooms, ${imgCount} images`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
