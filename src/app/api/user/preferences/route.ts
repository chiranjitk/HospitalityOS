import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';

interface UserPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  darkMode: boolean;
  compactMode: boolean;
  language: string;
  timezone: string;
  dateFormat: string;
}

const defaultPreferences: UserPreferences = {
  emailNotifications: true,
  pushNotifications: true,
  smsNotifications: false,
  marketingEmails: false,
  darkMode: false,
  compactMode: false,
  language: 'en',
  timezone: 'America/New_York',
  dateFormat: 'MM/DD/YYYY',
};

// GET /api/user/preferences - Get user preferences
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const userRecord = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, preferences: true },
    });

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse preferences from user
    let preferences: UserPreferences = defaultPreferences;
    try {
      if (userRecord.preferences) {
        const parsed = JSON.parse(userRecord.preferences);
        preferences = { ...defaultPreferences, ...parsed };
      }
    } catch {
      preferences = defaultPreferences;
    }

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

// PUT /api/user/preferences - Update user preferences
export async function PUT(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const userId = user.id;

    // Validate preference keys and their types
    const validKeys = [
      { key: 'emailNotifications', type: 'boolean' },
      { key: 'pushNotifications', type: 'boolean' },
      { key: 'smsNotifications', type: 'boolean' },
      { key: 'marketingEmails', type: 'boolean' },
      { key: 'darkMode', type: 'boolean' },
      { key: 'compactMode', type: 'boolean' },
      { key: 'language', type: 'string' },
      { key: 'timezone', type: 'string' },
      { key: 'dateFormat', type: 'string' },
    ];

    // Validate types of provided values
    for (const { key, type } of validKeys) {
      if (body[key] !== undefined) {
        if (type === 'boolean' && typeof body[key] !== 'boolean') {
          return NextResponse.json({ error: `${key} must be a boolean` }, { status: 400 });
        }
        if (type === 'string' && typeof body[key] !== 'string') {
          return NextResponse.json({ error: `${key} must be a string` }, { status: 400 });
        }
      }
    }

    // Validate language if provided (ISO 639-1 code, max 10 chars)
    if (body.language && (!/^[a-zA-Z]{2}(-[a-zA-Z]{2})?$/.test(body.language) || body.language.length > 10)) {
      return NextResponse.json({ error: 'Invalid language format. Use ISO 639-1 (e.g. en, pt-BR)' }, { status: 400 });
    }

    // Validate timezone if provided (max 50 chars)
    if (body.timezone && body.timezone.length > 50) {
      return NextResponse.json({ error: 'Timezone value too long' }, { status: 400 });
    }

    // Validate dateFormat if provided
    const validDateFormats = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD.MM.YYYY'];
    if (body.dateFormat && !validDateFormats.includes(body.dateFormat)) {
      return NextResponse.json({ error: `Invalid dateFormat. Must be one of: ${validDateFormats.join(', ')}` }, { status: 400 });
    }

    // Get current preferences
    let currentPreferences: UserPreferences = defaultPreferences;
    try {
      const userRecord = await db.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });
      if (userRecord?.preferences) {
        currentPreferences = { ...defaultPreferences, ...JSON.parse(userRecord.preferences) };
      }
    } catch {
      currentPreferences = defaultPreferences;
    }

    // Merge with new values (only from validated keys)
    const updatedPreferences: UserPreferences = { ...currentPreferences };
    for (const { key } of validKeys) {
      if (body[key] !== undefined) {
        (updatedPreferences as unknown as Record<string, unknown>)[key] = body[key];
      }
    }

    // Update user preferences
    await db.user.update({
      where: { id: userId },
      data: {
        preferences: JSON.stringify(updatedPreferences),
      },
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId,
          module: 'preferences',
          action: 'update',
          entityType: 'user_preferences',
          entityId: userId,
          newValue: JSON.stringify(updatedPreferences),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({
      success: true,
      preferences: updatedPreferences,
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
