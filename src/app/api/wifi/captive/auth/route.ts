import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/wifi/captive/auth
 * Captive Portal WiFi Authentication
 *
 * Accepts two auth methods:
 *  - voucher: { method: "voucher", code: "XXXX", tenantId?: string }
 *  - room:    { method: "room", roomNumber: "101", lastName: "Smith", tenantId?: string }
 *
 * In production, this would validate against the RADIUS backend,
 * check voucher validity, or verify guest reservation details.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { method, tenantId } = body

    // Minimum tenant validation: if tenantId is provided, verify it exists
    if (tenantId) {
      const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
      if (!tenant) {
        return NextResponse.json(
          { success: false, error: 'Invalid tenant' },
          { status: 400 }
        )
      }
    }

    if (method === 'voucher') {
      const { code } = body
      if (!code || typeof code !== 'string' || code.trim().length < 1) {
        return NextResponse.json(
          { success: false, error: 'Voucher code is required' },
          { status: 400 }
        )
      }

      // In production: validate voucher against database / RADIUS
      // For demo: accept any non-empty code
      return NextResponse.json({
        success: true,
        method: 'voucher',
        sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        network: 'RoyalStay-Guest',
        bandwidthLimit: '100Mbps',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        message: 'Voucher validated successfully',
      })
    }

    if (method === 'room') {
      const { roomNumber, lastName } = body
      if (!roomNumber || typeof roomNumber !== 'string' || roomNumber.trim().length < 1) {
        return NextResponse.json(
          { success: false, error: 'Room number is required' },
          { status: 400 }
        )
      }
      if (!lastName || typeof lastName !== 'string' || lastName.trim().length < 1) {
        return NextResponse.json(
          { success: false, error: 'Last name is required' },
          { status: 400 }
        )
      }

      // In production: verify against guest reservation system
      // For demo: accept any room + name combination
      return NextResponse.json({
        success: true,
        method: 'room',
        roomNumber: roomNumber.trim(),
        sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        network: 'RoyalStay-Guest',
        bandwidthLimit: '100Mbps',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        message: 'Room authentication successful',
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid authentication method' },
      { status: 400 }
    )
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
