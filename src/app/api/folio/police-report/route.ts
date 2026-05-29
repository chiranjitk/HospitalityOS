import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/folio/police-report?bookingId=xxx - Get existing police report
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId is required' } },
        { status: 400 }
      );
    }

    // Verify booking belongs to tenant
    const booking = await db.booking.findFirst({ where: { id: bookingId, tenantId: user.tenantId } });
    if (!booking) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } }, { status: 404 });
    }

    const policeReport = await db.policeReport.findFirst({
      where: { bookingId, tenantId: user.tenantId },
    });

    return NextResponse.json({ success: true, data: policeReport });
  } catch (error) {
    console.error('Error fetching police report:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch police report' } },
      { status: 500 }
    );
  }
}

// POST /api/folio/police-report - Generate C-Form and/or submit to authorities
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } }, { status: 403 });
    }

    const body = await request.json();
    const { bookingId, action } = body; // action: 'export' | 'submit'

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId is required' } },
        { status: 400 }
      );
    }

    // Fetch booking with all related data
    const booking = await db.booking.findFirst({
      where: { id: bookingId, tenantId: user.tenantId },
      include: {
        primaryGuest: {
          select: {
            id: true, firstName: true, lastName: true, email: true, phone: true,
            nationality: true, idType: true, idNumber: true, address: true,
            city: true, state: true, country: true,
          },
        },
        room: { select: { id: true, number: true, floor: true } },
        roomType: { select: { id: true, name: true, code: true } },
        property: {
          select: { id: true, name: true, address: true, city: true, country: true, phone: true, email: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } }, { status: 404 });
    }

    // Get registration card
    const registrationCard = await db.registrationCard.findFirst({
      where: { bookingId, tenantId: user.tenantId },
    });

    if (!registrationCard) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Registration card must be generated first' } },
        { status: 400 }
      );
    }

    const guest = booking.primaryGuest;
    const prop = booking.property;

    // Build C-Form data
    const cFormData = {
      guestName: `${guest.firstName} ${guest.lastName}`,
      nationality: guest.nationality || 'Unknown',
      idType: guest.idType || 'Unknown',
      idNumber: guest.idNumber || 'Unknown',
      address: guest.address
        ? `${guest.address}${guest.city ? ', ' + guest.city : ''}${guest.state ? ', ' + guest.state : ''}${guest.country ? ', ' + guest.country : ''}`
        : 'Unknown',
      roomNumber: booking.room?.number || 'TBD',
      checkInDate: booking.checkIn.toISOString(),
      checkOutDate: booking.checkOut.toISOString(),
      purpose: registrationCard.purpose || 'Not specified',
      companions: registrationCard.companions,
      vehiclePlate: registrationCard.vehiclePlate || null,
      registrationCardNumber: registrationCard.cardNumber,
      propertyName: prop.name,
      propertyAddress: prop.address
        ? `${prop.address}${prop.city ? ', ' + prop.city : ''}${prop.country ? ', ' + prop.country : ''}`
        : prop.name,
      signature: registrationCard.signature || null,
    };

    // Check for existing police report
    const existingReport = await db.policeReport.findFirst({
      where: { bookingId, tenantId: user.tenantId },
    });

    if (existingReport) {
      // Update existing report
      if (action === 'submit') {
        const updatedReport = await db.policeReport.update({
          where: { id: existingReport.id },
          data: {
            status: 'submitted',
            submittedAt: new Date(),
            submittedBy: user.id,
            formData: JSON.stringify(cFormData),
            updatedAt: new Date(),
          },
        });
        return NextResponse.json({ success: true, data: updatedReport });
      }

      // For export, just update form data and return
      const updatedReport = await db.policeReport.update({
        where: { id: existingReport.id },
        data: {
          formData: JSON.stringify(cFormData),
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, data: updatedReport });
    }

    // Create new police report
    const now = new Date();
    const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
    const todayReports = await db.policeReport.count({
      where: {
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        },
      },
    });
    const formNumber = `CF-${datePrefix}-${String(todayReports + 1).padStart(3, '0')}`;

    const reportData = {
      tenantId: booking.tenantId,
      propertyId: booking.propertyId,
      bookingId: booking.id,
      registrationCardId: registrationCard.id,
      formNumber,
      status: action === 'submit' ? 'submitted' as const : 'not_submitted' as const,
      submittedAt: action === 'submit' ? new Date() : null,
      submittedBy: action === 'submit' ? user.id : null,
      formData: JSON.stringify(cFormData),
    };

    const report = await db.policeReport.create({ data: reportData });

    // If action is 'export', generate C-Form PDF
    if (action === 'export') {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const margin = 20;
      let y = 15;

      // Header - Title block
      doc.setFillColor(220, 220, 220);
      doc.rect(margin, y, 170, 18, 'F');
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('C-FORM', 105, y + 7, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('POLICE REGISTRATION FORM (FOREIGNER / GUEST)', 105, y + 13, { align: 'center' });
      y += 22;

      // Form number and date
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Form No: ${report.formNumber}`, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${now.toLocaleDateString()}`, 190 - margin, y, { align: 'right' });
      y += 8;

      // Section 1: Property Information
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, 170, 6, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('1. PROPERTY / HOTEL INFORMATION', margin + 2, y + 4);
      y += 10;

      const addField = (label: string, value: string | null | undefined, x?: number) => {
        const fieldX = x || margin + 4;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(label + ':', fieldX, y);
        doc.setFont('helvetica', 'normal');
        doc.text(value || '-', fieldX + 35, y);
        y += 5;
      };

      addField('Hotel Name', prop.name);
      addField('Address', prop.address ? `${prop.address}${prop.city ? ', ' + prop.city : ''}${prop.country ? ', ' + prop.country : ''}` : prop.name);
      addField('Contact', prop.phone ? `${prop.phone} | ${prop.email || ''}` : '');
      y += 4;

      // Section 2: Guest Information
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, 170, 6, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('2. GUEST INFORMATION', margin + 2, y + 4);
      y += 10;

      addField('Full Name', cFormData.guestName);
      addField('Nationality', cFormData.nationality);
      addField('ID Type', cFormData.idType);
      addField('ID Number', cFormData.idNumber);
      addField('Permanent Address', cFormData.address);
      addField('Phone', guest.phone);
      addField('Email', guest.email);
      y += 4;

      // Section 3: Stay Information
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, 170, 6, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('3. STAY INFORMATION', margin + 2, y + 4);
      y += 10;

      addField('Room Number', cFormData.roomNumber);
      addField('Room Type', booking.roomType.name);
      addField('Check-in Date', new Date(cFormData.checkInDate).toLocaleDateString());
      addField('Check-out Date', new Date(cFormData.checkOutDate).toLocaleDateString());

      const nights = Math.ceil(
        (new Date(cFormData.checkOutDate).getTime() - new Date(cFormData.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      addField('Duration', `${nights} night${nights !== 1 ? 's' : ''}`);
      addField('Purpose of Visit', cFormData.purpose);
      addField('Vehicle Plate', cFormData.vehiclePlate);
      addField('Registration Card No.', cFormData.registrationCardNumber);
      y += 4;

      // Section 4: Companions
      const companionsParsed = JSON.parse(cFormData.companions as string) as Array<{ name: string; idType?: string; idNumber?: string; nationality?: string }>;
      if (companionsParsed && companionsParsed.length > 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y, 170, 6, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('4. ACCOMPANYING GUESTS', margin + 2, y + 4);
        y += 10;

        companionsParsed.forEach((comp, i) => {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          const compText = `${i + 1}. ${comp.name}${comp.nationality ? ' (' + comp.nationality + ')' : ''}${comp.idNumber ? ' - ID: ' + comp.idNumber : ''}`;
          doc.text(compText, margin + 4, y);
          y += 5;
        });
        y += 2;
      } else {
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y, 170, 6, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('4. ACCOMPANYING GUESTS', margin + 2, y + 4);
        y += 10;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('No accompanying guests.', margin + 4, y);
        y += 5;
        y += 2;
      }

      // Section 5: Declaration
      y = Math.max(y + 4, 230);
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, 170, 6, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('5. DECLARATION', margin + 2, y + 4);
      y += 10;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const declaration = 'I hereby declare that the information provided above is true and correct to the best of my knowledge. I understand that any false statement may lead to legal action under the applicable laws.';
      const declLines = doc.splitTextToSize(declaration, 160);
      doc.text(declLines, margin + 2, y);
      y += declLines.length * 4 + 8;

      // Signature section
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Guest Signature: ___________________________', margin, y);
      doc.text('Hotel Authorized: ___________________________', 110, y);
      y += 12;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Name: ___________________', margin, y);
      doc.text('Name: ___________________', 110, y);
      y += 5;
      doc.text('Date: ___________________', margin, y);
      doc.text('Date: ___________________', 110, y);

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(`C-Form Ref: ${report.formNumber} | Generated by StaySuite-HospitalityOS | ${now.toLocaleString()}`, 105, 285, { align: 'center' });

      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="c-form-${report.formNumber}.pdf"`,
        },
      });
    }

    // For submit action (without export), just return the JSON
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('Error processing police report:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process police report' } },
      { status: 500 }
    );
  }
}
