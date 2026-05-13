import fs from 'fs';

const src = JSON.parse(fs.readFileSync('/tmp/de_keys.json','utf8'));
const T = JSON.parse(fs.readFileSync('/tmp/de_translations_part2.json','utf8'));

// Comprehensive English->German value translation dictionary
// Maps exact English strings to German translations
const V = {
// Common single words and short phrases
'Status':'Status','Status:':'Status:','Active':'Aktiv','Inactive':'Inaktiv','Draft':'Entwurf',
'Published':'Veröffentlicht','Archived':'Archiviert','Deleted':'Gelöscht','Pending':'Ausstehend',
'Processing':'In Bearbeitung','Completed':'Abgeschlossen','Failed':'Fehlgeschlagen',
'Cancelled':'Storniert','Confirmed':'Bestätigt','Rejected':'Abgelehnt',
'Name':'Name','Code':'Code','Type':'Typ','Category':'Kategorie','Description':'Beschreibung',
'Notes':'Notizen','Email':'E-Mail','Phone':'Telefon','Address':'Adresse','City':'Stadt',
'Country':'Land','Date':'Datum','Time':'Uhrzeit','Start':'Start','End':'Ende',
'From':'Von','To':'An','Amount':'Betrag','Price':'Preis','Total':'Gesamt',
'Subtotal':'Zwischensumme','Tax':'Steuer','Taxes':'Steuern','Discount':'Rabatt',
'Balance':'Saldo','Due':'Fällig','Paid':'Bezahlt','Unpaid':'Unbezahlt',
'Open':'Offen','Closed':'Geschlossen','New':'Neu','Edit':'Bearbeiten',
'Delete':'Löschen','Save':'Speichern','Cancel':'Abbrechen','Create':'Erstellen',
'Update':'Aktualisieren','Search':'Suchen','Filter':'Filtern','Export':'Exportieren',
'Import':'Importieren','Print':'Drucken','Download':'Herunterladen','Upload':'Hochladen',
'Copy':'Kopieren','View':'Anzeigen','Preview':'Vorschau','Refresh':'Aktualisieren',
'Close':'Schließen','Back':'Zurück','Next':'Weiter','Previous':'Zurück',
'Submit':'Absenden','Confirm':'Bestätigen','Approve':'Genehmigen','Reject':'Ablehnen',
'Enable':'Aktivieren','Disable':'Deaktivieren','Configure':'Konfigurieren',
'Manage':'Verwalten','Settings':'Einstellungen','Options':'Optionen',
'Actions':'Aktionen','Details':'Details','Info':'Info','Help':'Hilfe',
'Warning':'Warnung','Error':'Fehler','Success':'Erfolg','Loading':'Laden...',
'Sending':'Wird gesendet...','Saving':'Wird gespeichert...','Deleting':'Wird gelöscht...',
'Updating':'Wird aktualisiert...','Creating':'Wird erstellt...','Processing...':'Verarbeitung...',
'No data':'Keine Daten','None':'Keine','All':'Alle','More':'Mehr','Less':'Weniger',
'Select':'Auswählen','Selected':'Ausgewählt','Required':'Erforderlich','Optional':'Optional',
'Enabled':'Aktiviert','Disabled':'Deaktiviert','Online':'Online','Offline':'Offline',
'Live':'Live','Available':'Verfügbar','Unavailable':'Nicht verfügbar',
'Occupied':'Belegt','Vacant':'Frei','Reserved':'Reserviert',
'Maintenance':'Wartung','Cleaning':'Wird gereinigt','Inspected':'Geprüft',
'Title':'Titel','Message':'Nachricht','Subject':'Betreff','Body':'Text',
'Sender':'Absender','Recipient':'Empfänger','Attachment':'Anhang',
'Template':'Vorlage','Templates':'Vorlagen','Schedule':'Zeitplan',
'Scheduled':'Geplant','Overdue':'Überfällig','On Time':'Pünktlich','Late':'Verspätet',
'Today':'Heute','Yesterday':'Gestern','Tomorrow':'Morgen',
'This Week':'Diese Woche','This Month':'Dieser Monat','This Year':'Dieses Jahr',
'Last Week':'Letzte Woche','Last Month':'Letzter Monat','Last Year':'Letztes Jahr',
'Daily':'Täglich','Weekly':'Wöchentlich','Monthly':'Monatlich','Quarterly':'Quartalsweise',
'Annually':'Jährlich','Hourly':'Stündlich',
'January':'Januar','February':'Februar','March':'März','April':'April',
'May':'Mai','June':'Juni','July':'Juli','August':'August',
'September':'September','October':'Oktober','November':'November','December':'Dezember',
'Monday':'Montag','Tuesday':'Dienstag','Wednesday':'Mittwoch','Thursday':'Donnerstag',
'Friday':'Freitag','Saturday':'Samstag','Sunday':'Sonntag',
'Morning':'Morgen','Afternoon':'Nachmittag','Evening':'Abend','Night':'Nacht',
'Minutes':'Minuten','Hours':'Stunden','Days':'Tage','Weeks':'Wochen',
'Months':'Monate','Years':'Jahre',
'Guest':'Gast','Guests':'Gäste','Customer':'Kunde','Customers':'Kunden',
'User':'Benutzer','Users':'Benutzer','Staff':'Personal','Member':'Mitglied','Members':'Mitglieder',
'Tenant':'Mandant','Tenants':'Mandanten','Property':'Immobilie','Properties':'Immobilien',
'Room':'Zimmer','Rooms':'Zimmer','Floor':'Etage','Building':'Gebäude',
'Booking':'Buchung','Bookings':'Buchungen','Reservation':'Reservierung','Reservations':'Reservierungen',
'Invoice':'Rechnung','Invoices':'Rechnungen','Payment':'Zahlung','Payments':'Zahlungen',
'Folio':'Konto','Folios':'Konten','Order':'Bestellung','Orders':'Bestellungen',
'Item':'Artikel','Items':'Artikel','Product':'Produkt','Products':'Produkte',
'Service':'Dienstleistung','Services':'Dienstleistungen','Task':'Aufgabe','Tasks':'Aufgaben',
'Channel':'Kanal','Channels':'Kanäle','Rate':'Tarif','Rates':'Tarife',
'Plan':'Plan','Plans':'Pläne','Report':'Bericht','Reports':'Berichte',
'Dashboard':'Dashboard','Calendar':'Kalender','Chart':'Diagramm','Table':'Tabelle',
'List':'Liste','Grid':'Raster','Map':'Karte','Timeline':'Zeitachse',
'Revenue':'Umsatz','Cost':'Kosten','Profit':'Gewinn','Margin':'Marge',
'Budget':'Budget','Forecast':'Prognose','Target':'Ziel','Goal':'Ziel',
'Percentage':'Prozentsatz','Ratio':'Verhältnis','Index':'Index','Score':'Punktzahl',
'Rating':'Bewertung','Review':'Bewertung','Reviews':'Bewertungen',
'Feedback':'Feedback','Comment':'Kommentar','Comments':'Kommentare',
'Satisfaction':'Zufriedenheit','Loyalty':'Treue','Retention':'Bindung',
'Segment':'Segment','Segments':'Segmente','Group':'Gruppe','Groups':'Gruppen',
'Campaign':'Kampagne','Campaigns':'Kampagnen','Promotion':'Aktion','Promotions':'Aktionen',
'Offer':'Angebot','Offers':'Angebote','Deal':'Angebot','Deals':'Angebote',
'Discount':'Rabatt','Discounts':'Rabatte','Coupon':'Gutschein','Coupons':'Gutscheine',
'Voucher':'Gutschein','Vouchers':'Gutscheine','Gift Card':'Geschenkkarte',
'Credit':'Guthaben','Credits':'Guthaben','Credit Note':'Gutschrift',
'Credit Notes':'Gutschriften','Refund':'Erstattung','Refunds':'Erstattungen',
'Deposit':'Anzahlung','Charge':'Gebühr','Charges':'Gebühren','Fee':'Gebühr',
'Fines':'Bußgelder','Penalty':'Strafgebühr','Penalties':'Strafgebühren',
'Currency':'Währung','Currencies':'Währungen','Exchange Rate':'Wechselkurs',
'USD':'USD','EUR':'EUR','GBP':'GBP','INR':'INR','AED':'AED',
'Check-in':'Check-in','Check-out':'Check-out','Check In':'Einchecken',
'Check Out':'Auschecken','Walk-in':'Walk-in','No-Show':'No-Show',
'Arrival':'Ankunft','Arrivals':'Ankünfte','Departure':'Abreise','Departures':'Abreisen',
'Extension':'Verlängerung','Cancellation':'Stornierung',
'Housekeeping':'Housekeeping','Concierge':'Concierge','Valet':'Valetservice',
'Reception':'Rezeption','Front Desk':'Rezeption','Bell Desk':'Gepäckservice',
'Security':'Sicherheit','Surveillance':'Überwachung','Parking':'Parken',
'WiFi':'WiFi','Internet':'Internet','Network':'Netzwerk',
'Restaurant':'Restaurant','Bar':'Bar','Kitchen':'Küche','Dining':'Speisen',
'Breakfast':'Frühstück','Lunch':'Mittagessen','Dinner':'Abendessen',
'Spa':'Spa','Gym':'Fitnessstudio','Pool':'Pool','Garden':'Garten',
'Laundry':'Wäscherei','Room Service':'Zimmerservice','Concierge Service':'Concierge-Service',
'Meeting Room':'Konferenzraum','Meeting Rooms':'Konferenzräume','Ballroom':'Großsaal',
'Business Center':'Business-Center','Lounge':'Lounge','Terrace':'Terrasse',
'Elevator':'Aufzug','Stairs':'Treppe','Ramp':'Rampe',
'Air Conditioning':'Klimaanlage','Heating':'Heizung','TV':'TV','Minibar':'Minibar',
'Safe':'Safe','Hairdryer':'Föhn','Iron':'Bügeleisen','Coffee Maker':'Kaffeemaschine',
'Balcony':'Balkon','Terrace':'Terrasse','View':'Blick','Sea View':'Meerblick',
'Mountain View':'Bergblick','City View':'Stadtblick','Garden View':'Gartenblick',
'King Bed':'Kingsize-Bett','Queen Bed':'Queensize-Bett','Twin Beds':'Zweibett',
'Single Bed':'Einzelbett','Double Bed':'Doppelbett','Sofa Bed':'Sofa-Bett',
'Suite':'Suite','Standard':'Standard','Deluxe':'Deluxe','Superior':'Superior',
'Premium':'Premium','Economy':'Economy','Family':'Familie','Accessible':'Barrierefrei',
'Smoking':'Raucher','Non-Smoking':'Nichtraucher','Connecting':'Verbindend',
'Adult':'Erwachsene','Adults':'Erwachsene','Children':'Kinder','Child':'Kind',
'Infant':'Säugling','Infants':'Säuglinge',
'First Name':'Vorname','Last Name':'Nachname','Full Name':'Vollständiger Name',
'Company':'Unternehmen','Job Title':'Position','Department':'Abteilung',
'Nationality':'Nationalität','Country of Residence':'Wohnsitzland',
'Passport':'Reisepass','National ID':'Personalausweis','Driver License':'Führerschein',
'Date of Birth':'Geburtsdatum','Gender':'Geschlecht','Male':'Männlich',
'Female':'Weiblich','Other':'Divers','Prefer not to say':'Keine Angabe',
'VIP':'VIP','Loyalty Member':'Treue-Mitglied','Corporate':'Geschäftlich',
'Group':'Gruppe','Individual':'Einzelperson','Couple':'Paar','Family':'Familie',
'Contact':'Kontakt','Phone Number':'Telefonnummer','Mobile':'Mobil',
'Work Phone':'Geschäftstelefon','Home Phone':'Privattelefon',
'Address Line 1':'Adresszeile 1','Address Line 2':'Adresszeile 2',
'Postal Code':'Postleitzahl','State/Province':'Bundesland/Region','Zip Code':'PLZ',
'Reference':'Referenz','Source':'Quelle','Tags':'Tags','Priority':'Priorität',
'Low':'Niedrig','Medium':'Mittel','High':'Hoch','Critical':'Kritisch',
'Urgent':'Dringend','Normal':'Normal','Important':'Wichtig',
'Progress':'Fortschritt','Status':'Status','Stage':'Phase','Phase':'Phase',
'Created':'Erstellt','Updated':'Aktualisiert','Modified':'Geändert',
'Issued':'Ausgestellt','Sent':'Gesendet','Received':'Empfangen',
'Accepted':'Akzeptiert','Declined':'Abgelehnt','Revoked':'Widerrufen',
'Expired':'Abgelaufen','Valid':'Gültig','Invalid':'Ungültig',
'Active':'Aktiv','Suspended':'Ausgesetzt','Trial':'Testphase',
'On Hold':'Pausiert','Pending Review':'Ausstehende Prüfung',
'In Progress':'In Bearbeitung','Under Review':'In Prüfung',
'Approved':'Genehmigt','Completed':'Abgeschlossen','Reopened':'Wiedereröffnet',
'Assigned':'Zugewiesen','Unassigned':'Nicht zugewiesen',
'Internal':'Intern','External':'Extern','Public':'Öffentlich','Private':'Privat',
'Primary':'Primär','Secondary':'Sekundär','Default':'Standard','Custom':'Benutzerdefiniert',
'Automatic':'Automatisch','Manual':'Manuell','Scheduled':'Geplant',
'Recurring':'Wiederkehrend','One-time':'Einmalig',
'Estimated':'Geschätzt','Actual':'Tatsächlich','Budgeted':'Budgetiert',
'Planned':'Geplant','Unplanned':'Ungeplant','Expected':'Erwartet',
'Average':'Durchschnitt','Median':'Median','Minimum':'Minimum','Maximum':'Maximum',
'Total':'Gesamt','Count':'Anzahl','Sum':'Summe',
'Increase':'Zunahme','Decrease':'Abnahme','Change':'Änderung',
'Difference':'Unterschied','Variance':'Abweichung','Deviation':'Abweichung',
'Percentage':'Prozentsatz','Number':'Nummer','Quantity':'Menge',
'Unit':'Einheit','Rate':'Tarif','Ratio':'Verhältnis',
'Weight':'Gewicht','Volume':'Volumen','Length':'Länge','Width':'Breite',
'Height':'Höhe','Area':'Fläche','Size':'Größe',
'Color':'Farbe','Brand':'Marke','Model':'Modell','Version':'Version',
'Serial Number':'Seriennummer','SKU':'SKU','Barcode':'Barcode',
'QR Code':'QR-Code','URL':'URL','Link':'Link','Image':'Bild',
'Photo':'Foto','Video':'Video','Document':'Dokument','File':'Datei',
'Attachment':'Anhang','Signature':'Unterschrift',
'Username':'Benutzername','Password':'Passwort','PIN':'PIN',
'API Key':'API-Schlüssel','Secret':'Geheimnis','Token':'Token',
'Webhook':'Webhook','Endpoint':'Endpunkt','Callback':'Callback',
'Request':'Anfrage','Response':'Antwort','Header':'Kopfzeile',
'GET':'GET','POST':'POST','PUT':'PUT','DELETE':'DELETE','PATCH':'PATCH',
'JSON':'JSON','XML':'XML','CSV':'CSV','PDF':'PDF','HTML':'HTML',
'On':'An','Off':'Aus','Yes':'Ja','No':'Nein','OK':'OK',
'Other':'Sonstiges','General':'Allgemein','Miscellaneous':'Sonstiges',
'System':'System','Application':'Anwendung','Platform':'Plattform',
'Server':'Server','Database':'Datenbank','Cache':'Cache',
'Browser':'Browser','Device':'Gerät','Operating System':'Betriebssystem',
'Desktop':'Desktop','Mobile':'Mobil','Tablet':'Tablet',
'Analytics':'Analysen','Statistics':'Statistiken','Metrics':'Kennzahlen',
'Performance':'Leistung','Productivity':'Produktivität','Efficiency':'Effizienz',
'Quality':'Qualität','Compliance':'Compliance','Security':'Sicherheit',
'Privacy':'Datenschutz','Encryption':'Verschlüsselung','Authentication':'Authentifizierung',
'Authorization':'Autorisierung','Permission':'Berechtigung','Permissions':'Berechtigungen',
'Role':'Rolle','Roles':'Rollen','Access':'Zugriff','Access Control':'Zugangskontrolle',
'Login':'Anmeldung','Logout':'Abmeldung','Sign In':'Anmelden','Sign Out':'Abmelden',
'Register':'Registrieren','Reset':'Zurücksetzen','Recover':'Wiederherstellen',
'Verify':'Verifizieren','Validate':'Validieren','Authenticate':'Authentifizieren',
'Language':'Sprache','Region':'Region','Locale':'Gebietsschema',
'Timezone':'Zeitzone','Format':'Format','Currency':'Währung',
'Theme':'Design','Layout':'Layout','Display':'Anzeige',
'Color Scheme':'Farbschema','Font':'Schriftart','Icon':'Symbol',
'Notification':'Benachrichtigung','Notifications':'Benachrichtigungen',
'Alert':'Warnung','Alerts':'Warnungen','Reminder':'Erinnerung',
'Popup':'Popup','Toast':'Toast','Badge':'Abzeichen',
'SMS':'SMS','Email':'E-Mail','Push':'Push','In-App':'In-App',
'Marketing':'Marketing','Advertising':'Werbung','Promotion':'Aktion',
'Social Media':'Soziale Medien','SEO':'SEO','SEM':'SEM',
'CRM':'CRM','ERP':'ERP','POS':'POS','PMS':'PMS',
'Channel Manager':'Kanalmanager','Revenue Manager':'Revenue Manager',
'Booking Engine':'Buchungsmaschine','Payment Gateway':'Zahlungsdienstleister',
'Rate Shopper':'Tarifshopper','Competitor Set':'Wettbewerbsset',
'Occupancy':'Auslastung','ADR':'ADR','RevPAR':'RevPAR','GOPPAR':'GOPPAR',
'Market Segment':'Marktsegment','Distribution Channel':'Vertriebskanal',
'Corporate':'Geschäftlich','Leisure':'Freizeit','Group':'Gruppe',
'Transient':'Geschäftsreisender','Tour Operator':'Reiseveranstalter',
'OTA':'OTA','GDS':'GDS','Direct':'Direkt','Wholesaler':'Großhändler',
'Agent':'Agent','Affiliate':'Partner','Referral':'Empfehlung',
'Artificial Intelligence':'Künstliche Intelligenz','Machine Learning':'Maschinelles Lernen',
'Automation':'Automatisierung','Workflow':'Workflow','Trigger':'Auslöser',
'Action':'Aktion','Condition':'Bedingung','Rule':'Regel','Rules':'Regeln',
'Logic':'Logik','Builder':'Builder','Editor':'Editor','Designer':'Designer',
'Connector':'Verbinder','Integration':'Integration','Adapter':'Adapter',
'Plug-in':'Plug-in','Extension':'Erweiterung','Module':'Modul',
'Component':'Komponente','Widget':'Widget','Feature':'Funktion',
'Flag':'Flag','Setting':'Einstellung','Configuration':'Konfiguration',
'Parameter':'Parameter','Property':'Eigenschaft','Attribute':'Attribut',
'Value':'Wert','Label':'Beschriftung','Placeholder':'Platzhalter',
'Tooltip':'Tooltip','Help Text':'Hilfetext','Description':'Beschreibung',
'Instructions':'Anleitung','Guidelines':'Richtlinien','Terms':'Bedingungen',
'Privacy Policy':'Datenschutzerklärung','Terms of Service':'Nutzungsbedingungen',
'Cookie Policy':'Cookie-Richtlinie','Accept All':'Alle akzeptieren',
'Reject All':'Alle ablehnen','Customize':'Anpassen','Preferences':'Präferenzen',
};

// Pattern-based translation for common sentence patterns
function translateValue(val) {
  if (!val || typeof val !== 'string') return val;
  // Exact match
  if (V[val] !== undefined) return V[val];
  // Trim and try again
  const trimmed = val.trim();
  if (V[trimmed] !== undefined) return V[trimmed];
  // Placeholders - keep them
  if (/^\{.+\}$/.test(trimmed)) return val;
  // URLs, emails
  if (/^https?:\/\//.test(trimmed) || /^www\./.test(trimmed)) return val;
  // Phone numbers
  if (/^\+?\d[\d\s\-().]+$/.test(trimmed)) return val;
  // Single word - try to return as-is for proper nouns/tech terms
  if (/^[A-Z][a-z]+$/.test(trimmed) && trimmed.length <= 20) return val;
  return val; // Fallback: keep original
}

// Process ALL keys that don't have translations yet
const keys = Object.keys(src);
let translated = 0;
let kept = 0;

for (const k of keys) {
  if (T[k]) continue; // Already translated
  const val = src[k];
  const translatedVal = translateValue(val);
  if (translatedVal !== val) {
    T[k] = translatedVal;
    translated++;
  } else {
    kept++;
  }
}

console.log('Value-matched translations: ' + translated);
console.log('Kept original (no match): ' + kept);
console.log('Total translations now: ' + Object.keys(T).length);

// Save
fs.writeFileSync('/tmp/de_translations_all.json', JSON.stringify(T, null, 2));
