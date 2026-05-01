import fs from 'fs';

const T = JSON.parse(fs.readFileSync('/tmp/de_translations_all2.json','utf8'));
const src = JSON.parse(fs.readFileSync('/tmp/de_keys.json','utf8'));
const remaining = Object.keys(src).filter(k => !(k in T));

// Comprehensive word-level translation map for compound phrases
const WORDS = {
  'peak':'Spitzen-','low':'Niedrige','trend':'Trend','trendTime':'im Zeitverlauf',
  'utilization':'Auslastung','distribution':'Verteilung','days':'Tage',
  'recorded':'erfasst','period':'Zeitraum','monthly':'Monatlicher',
  'system':'System','custom':'Benutzerdefinierte','test':'Test',
  'granted':'Gewährt','denied':'Verweigert','protected':'Geschützt',
  'permission':'Berechtigung','permissions':'Berechtigungen',
  'comparison':'Vergleich','common':'Gemeinsame','effective':'Effektive',
  'module':'Modul','matrix':'Matrix','both':'Beide',
  'manage':'Verwalten','configure':'Konfigurieren','create':'Erstellen',
  'edit':'Bearbeiten','delete':'Löschen','view':'Anzeigen',
  'add':'Hinzufügen','remove':'Entfernen','update':'Aktualisieren',
  'save':'Speichern','cancel':'Abbrechen','submit':'Absenden',
  'enable':'Aktivieren','disable':'Deaktivieren','connect':'Verbinden',
  'disconnect':'Trennen','test':'Testen','import':'Importieren',
  'export':'Exportieren','download':'Herunterladen','upload':'Hochladen',
  'print':'Drucken','copy':'Kopieren','send':'Senden','receive':'Empfangen',
  'search':'Suchen','filter':'Filtern','sort':'Sortieren',
  'select':'Auswählen','choose':'Wählen','assign':'Zuweisen',
  'track':'Verfolgen','monitor':'Überwachen','manage':'Verwalten',
  'generate':'Generieren','process':'Verarbeiten','handle':'Behandeln',
  'apply':'Anwenden','approve':'Genehmigen','reject':'Ablehnen',
  'confirm':'Bestätigen','verify':'Verifizieren','validate':'Validieren',
  'schedule':'Planen','complete':'Abschließen','start':'Starten',
  'stop':'Beenden','pause':'Pausieren','resume':'Fortsetzen',
  'retry':'Wiederholen','cancel':'Stornieren','revoke':'Widerrufen',
  'archive':'Archivieren','restore':'Wiederherstellen','backup':'Sichern',
  'migrate':'Migrieren','sync':'Synchronisieren','transfer':'Übertragen',
  'convert':'Konvertieren','calculate':'Berechnen','estimate':'Schätzen',
  'analyze':'Analysieren','optimize':'Optimieren','automate':'Automatisieren',
  'integrate':'Integrieren','customize':'Anpassen','personalize':'Personalisieren',
  'notify':'Benachrichtigen','alert':'Warnen','remind':'Erinnern',
  'request':'Anfragen','require':'Erfordern','allow':'Erlauben',
  'block':'Blockieren','restrict':'Einschränken','limit':'Begrenzen',
  'include':'Einschließen','exclude':'Ausschließen','override':'Überschreiben',
  'extend':'Verlängern','reduce':'Reduzieren','increase':'Erhöhen',
  'decrease':'Verringern','adjust':'Anpassen','modify':'Ändern',
  'replace':'Ersetzen','swap':'Tauschen','merge':'Zusammenführen',
  'split':'Aufteilen','combine':'Kombinieren','group':'Gruppieren',
  'categorize':'Kategorisieren','prioritize':'Priorisieren',
  'escalate':'Eskalieren','resolve':'Lösen','investigate':'Untersuchen',
  'diagnose':'Diagnostizieren','repair':'Reparieren','maintain':'Warten',
  'inspect':'Prüfen','clean':'Reinigen','prepare':'Vorbereiten',
  'setup':'Einrichten','install':'Installieren','uninstall':'Deinstallieren',
  'configure':'Konfigurieren','reconfigure':'Rekonfigurieren',
  'activate':'Aktivieren','deactivate':'Deaktivieren',
  'subscribe':'Abonnieren','unsubscribe':'Abmelden',
  'enroll':'Registrieren','register':'Registrieren','deregister':'Abmelden',
  'authenticate':'Authentifizieren','authorize':'Autorisieren',
  'encrypt':'Verschlüsseln','decrypt':'Entschlüsseln',
  'sign':'Signieren','count':'Zählen','measure':'Messen',
  'weigh':'Wiegen','scan':'Scannen','scan_qr':'QR scannen',
  'charge':'Belasten','credit':'Gutschriften','debit':'Belasten',
  'refund':'Erstatten','discount':'Rabattieren','waive':'Verzichten',
  'collect':'Einziehen','pay':'Bezahlen','settle':'Begleichen',
  'bill':'Abrechnen','invoice':'Rechnen ab','receipt':'Belegen',
  'book':'Buchen','reserve':'Reservieren','check':'Prüfen',
  'arrive':'Ankommen','depart':'Abreisen','stay':'Bleiben',
  'guest':'Gast','room':'Zimmer','floor':'Etage','building':'Gebäude',
  'property':'Immobilie','hotel':'Hotel','chain':'Kette','brand':'Marke',
  'tenant':'Mandant','user':'Benutzer','staff':'Personal','member':'Mitglied',
  'customer':'Kunde','client':'Kunde','vendor':'Lieferant','supplier':'Lieferant',
  'partner':'Partner','agent':'Agent','manager':'Manager','administrator':'Administrator',
  'operator':'Operator','moderator':'Moderator','auditor':'Prüfer',
  'booking':'Buchung','reservation':'Reservierung','check-in':'Check-in',
  'check-out':'Check-out','walk-in':'Walk-in','no-show':'No-Show',
  'arrival':'Ankunft','departure':'Abreise','extension':'Verlängerung',
  'cancellation':'Stornierung','modification':'Änderung','amendment':'Änderung',
  'folio':'Konto','invoice':'Rechnung','payment':'Zahlung','receipt':'Beleg',
  'charge':'Gebühr','deposit':'Anzahlung','refund':'Erstattung',
  'credit':'Guthaben','debit':'Belastung','balance':'Saldo',
  'discount':'Rabatt','coupon':'Gutschein','voucher':'Gutschein',
  'promotion':'Aktion','offer':'Angebot','deal':'Angebot',
  'campaign':'Kampagne','advertisement':'Werbung','marketing':'Marketing',
  'channel':'Kanal','source':'Quelle','market':'Markt','segment':'Segment',
  'rate':'Tarif','price':'Preis','cost':'Kosten','fee':'Gebühr',
  'tax':'Steuer','commission':'Provision','revenue':'Umsatz',
  'profit':'Gewinn','margin':'Marge','budget':'Budget',
  'forecast':'Prognose','target':'Ziel','goal':'Ziel','quota':'Quote',
  'occupancy':'Auslastung','availability':'Verfügbarkeit','capacity':'Kapazität',
  'inventory':'Bestand','stock':'Bestand','supply':'Vorrat',
  'housekeeping':'Housekeeping','maintenance':'Wartung','cleaning':'Reinigung',
  'inspection':'Inspektion','repair':'Reparatur','renovation':'Renovierung',
  'amenity':'Ausstattung','facility':'Einrichtung','equipment':'Ausrüstung',
  'service':'Dienstleistung','experience':'Erlebnis','activity':'Aktivität',
  'event':'Veranstaltung','meeting':'Besprechung','conference':'Konferenz',
  'seminar':'Seminar','workshop':'Workshop','training':'Schulung',
  'course':'Kurs','program':'Programm','module':'Modul',
  'feature':'Funktion','setting':'Einstellung','option':'Option',
  'preference':'Präferenz','configuration':'Konfiguration',
  'template':'Vorlage','layout':'Layout','design':'Design',
  'theme':'Design','color':'Farbe','font':'Schriftart',
  'logo':'Logo','image':'Bild','photo':'Foto','video':'Video',
  'document':'Dokument','file':'Datei','attachment':'Anhang',
  'notification':'Benachrichtigung','message':'Nachricht','alert':'Warnung',
  'reminder':'Erinnerung','announcement':'Ankündigung',
  'report':'Bericht','dashboard':'Dashboard','chart':'Diagramm',
  'graph':'Diagramm','table':'Tabelle','calendar':'Kalender',
  'timeline':'Zeitachse','schedule':'Zeitplan','agenda':'Tagesordnung',
  'history':'Verlauf','log':'Protokoll','record':'Datensatz','entry':'Eintrag',
  'audit':'Prüfung','review':'Bewertung','feedback':'Feedback',
  'rating':'Bewertung','score':'Punktzahl','ranking':'Rangliste',
  'metric':'Kennzahl','indicator':'Indikator','statistics':'Statistiken',
  'analytics':'Analysen','insight':'Einblick','trend':'Trend',
  'pattern':'Muster','forecast':'Prognose','prediction':'Vorhersage',
  'recommendation':'Empfehlung','suggestion':'Vorschlag',
  'automation':'Automatisierung','workflow':'Workflow','trigger':'Auslöser',
  'rule':'Regel','condition':'Bedingung','action':'Aktion',
  'integration':'Integration','connection':'Verbindung','endpoint':'Endpunkt',
  'webhook':'Webhook','api':'API','sdk':'SDK','plugin':'Plugin',
  'extension':'Erweiterung','widget':'Widget','component':'Komponente',
  'security':'Sicherheit','privacy':'Datenschutz','compliance':'Compliance',
  'encryption':'Verschlüsselung','authentication':'Authentifizierung',
  'authorization':'Autorisierung','permission':'Berechtigung',
  'role':'Rolle','access':'Zugriff','login':'Anmeldung',
  'password':'Passwort','token':'Token','key':'Schlüssel',
  'certificate':'Zertifikat','signature':'Unterschrift',
  'network':'Netzwerk','server':'Server','database':'Datenbank',
  'storage':'Speicher','cache':'Cache','memory':'Speicher',
  'cpu':'CPU','disk':'Festplatte','bandwidth':'Bandbreite',
  'latency':'Latenz','throughput':'Durchsatz',
  'online':'Online','offline':'Offline','connected':'Verbunden',
  'disconnected':'Getrennt','active':'Aktiv','inactive':'Inaktiv',
  'enabled':'Aktiviert','disabled':'Deaktiviert',
  'available':'Verfügbar','unavailable':'Nicht verfügbar',
  'occupied':'Belegt','vacant':'Frei','reserved':'Reserviert',
  'pending':'Ausstehend','processing':'In Bearbeitung',
  'completed':'Abgeschlossen','failed':'Fehlgeschlagen',
  'cancelled':'Storniert','expired':'Abgelaufen',
  'draft':'Entwurf','published':'Veröffentlicht',
  'confirmed':'Bestätigt','verified':'Verifiziert',
  'approved':'Genehmigt','rejected':'Abgelehnt',
  'internal':'Intern','external':'Extern',
  'primary':'Primär','secondary':'Sekundär',
  'default':'Standard','custom':'Benutzerdefiniert',
  'automatic':'Automatisch','manual':'Manuell',
  'required':'Erforderlich','optional':'Optional',
  'estimated':'Geschätzt','actual':'Tatsächlich',
  'planned':'Geplant','unplanned':'Ungeplant',
  'average':'Durchschn.','minimum':'Minimum','maximum':'Maximum',
  'total':'Gesamt','subtotal':'Zwischensumme',
  'daily':'Täglich','weekly':'Wöchentlich','monthly':'Monatlich',
  'quarterly':'Quartalsweise','annually':'Jährlich',
  'hourly':'Stündlich','per':'pro','each':'jeder',
  'by':'nach','for':'für','from':'von','to':'an',
  'with':'mit','without':'ohne','between':'zwischen',
  'during':'während','before':'vor','after':'nach',
  'until':'bis','since':'seit','within':'innerhalb',
  'above':'über','below':'unter','over':'über',
  'under':'unter','at':'bei','in':'in','on':'am',
  'new':'Neu','existing':'Bestehend','previous':'Vorherige',
  'current':'Aktuelle','next':'Nächste','last':'Letzte',
  'all':'Alle','none':'Keine','other':'Sonstiges',
  'additional':'Zusätzliche','extra':'Zusätzlich','bonus':'Bonus',
  'free':'Kostenlos','paid':'Bezahlt','complimentary':'Kostenlos',
  'included':'Inklusiv','excluded':'Exklusiv',
  'standard':'Standard','premium':'Premium','deluxe':'Deluxe',
  'basic':'Basis','advanced':'Erweitert','pro':'Pro',
  'enterprise':'Enterprise','starter':'Starter',
  'individual':'Einzelperson','group':'Gruppe','team':'Team',
  'department':'Abteilung','division':'Abteilung','unit':'Einheit',
  'organization':'Organisation','company':'Unternehmen',
  'corporate':'Geschäftlich','business':'Geschäft',
  'leisure':'Freizeit','personal':'Persönlich',
  'vip':'VIP','loyalty':'Treue','reward':'Prämie',
  'points':'Punkte','tier':'Stufe','level':'Stufe',
  'bronze':'Bronze','silver':'Silber','gold':'Gold',
  'platinum':'Platin','diamond':'Diamant',
  'wifi':'WiFi','internet':'Internet','bluetooth':'Bluetooth',
  'zigbee':'Zigbee','z-wave':'Z-Wave','thread':'Thread',
  'device':'Gerät','sensor':'Sensor','controller':'Controller',
  'gateway':'Gateway','router':'Router','switch':'Switch',
  'access':'Zugang','point':'Punkt','code':'Code',
  'qr':'QR','nfc':'NFC','gps':'GPS',
  'camera':'Kamera','microphone':'Mikrofon','speaker':'Lautsprecher',
  'display':'Anzeige','screen':'Bildschirm','monitor':'Monitor',
  'keyboard':'Tastatur','mouse':'Maus','printer':'Drucker',
  'scanner':'Scanner','lock':'Schloss','door':'Tür',
  'window':'Fenster','light':'Licht','temperature':'Temperatur',
  'humidity':'Feuchtigkeit','air':'Luft','water':'Wasser',
  'energy':'Energie','power':'Strom','voltage':'Spannung',
  'electric':'Elektrisch','gas':'Gas','solar':'Solar',
  'parking':'Parken','vehicle':'Fahrzeug','car':'Auto',
  'truck':'LKW','motorcycle':'Motorrad','bicycle':'Fahrrad',
  'ev':'Elektro','charging':'Ladung','station':'Station',
  'slot':'Platz','zone':'Zone','area':'Bereich',
  'restaurant':'Restaurant','kitchen':'Küche','bar':'Bar',
  'menu':'Menü','order':'Bestellung','item':'Artikel',
  'ingredient':'Zutat','recipe':'Rezept','portion':'Portion',
  'serving':'Portion','meal':'Mahlzeit','drink':'Getränk',
  'beverage':'Getränk','appetizer':'Vorspeise','main':'Hauptgericht',
  'dessert':'Dessert','snack':'Snack','breakfast':'Frühstück',
  'lunch':'Mittagessen','dinner':'Abendessen',
  'table':'Tisch','seat':'Platz','chair':'Stuhl',
  'reservation':'Reservierung','waitlist':'Warteliste',
  'dietary':'Ernährungs-','allergy':'Allergie','vegetarian':'Vegetarisch',
  'vegan':'Vegan','gluten-free':'Glutenfrei','halal':'Halal',
  'kosher':'Koscher','organic':'Bio','local':'Lokal',
  'seasonal':'Saisonal','fresh':'Frisch','homemade':'Hausgemacht',
  'signature':'Signatur','specialty':'Spezialität','popular':'Beliebt',
  'recommended':'Empfohlen','chef':'Koch','taste':'Geschmack',
  'quality':'Qualität','quantity':'Menge','weight':'Gewicht',
  'volume':'Volumen','size':'Größe','dimension':'Abmessung',
  'currency':'Währung','exchange':'Wechselkurs','rate':'Tarif',
  'dollar':'Dollar','euro':'Euro','pound':'Pfund',
  'cent':'Cent','percent':'Prozent',
};

// Comprehensive phrase-level translation for remaining keys
const REMAINING_TRANS = {
// reports remaining
'reports.peakOccupancy':'Spitzenauslastung','reports.lowOccupancy':'Niedrige Auslastung',
'reports.occupancyTrend':'Auslastungstrend','reports.roomUtilizationTime':'Zimmernutzung im Zeitverlauf',
'reports.occupancyByRoomType':'Auslastung nach Zimmertyp',
'reports.utilizationAccommodation':'Auslastung nach Unterkunftskategorie',
'reports.roomStatusDistribution':'Zimmerstatus-Verteilung',
'reports.peakDays':'Spitzentage','reports.peakDays90Plus':'Tage mit 90%+ Auslastung',
'reports.noPeakDays':'Keine Spitzentage in diesem Zeitraum erfasst',
'reports.lowOccupancyDays':'Tage mit geringer Auslastung',
'reports.lowOccupancyLess50':'Tage mit weniger als 50% Auslastung',
'reports.noLowOccupancyDays':'Keine Tage mit geringer Auslastung in diesem Zeitraum',
// admin remaining
'admin.monthlyRevenueTrend':'Monatlicher Umsatztrend','admin.systemRoles':'Systemrollen',
'admin.customRoles':'Benutzerdefinierte Rollen','admin.testPermissions':'Berechtigungen testen',
'admin.granted':'Gewährt','admin.denied':'Verweigert','admin.adminRoleProtected':'Admin-Rolle geschützt',
'admin.permissionTester':'Berechtigungs-Tester','admin.permissionToTest':'Zu testende Berechtigung',
'admin.permission':'Berechtigung:','admin.noPermissionsAssigned':'Keine Berechtigungen zugewiesen',
'admin.effectivePermissionsByModule':'Effektive Berechtigungen nach Modul',
'admin.roleComparison':'Rollenvergleich','admin.commonPermissions':'Gemeinsame Berechtigungen',
'admin.permissionComparisonMatrix':'Berechtigungsvergleichsmatrix',
'admin.bothGranted':'Beide gewährt','admin.onlyInRole':'Nur in Rolle',
'admin.notGranted':'Nicht gewährt','admin.modulePermissions':'Modulberechtigungen',
'admin.rolePermissions':'Rollenberechtigungen','admin.permissions':'Berechtigungen',
'admin.roleNamePlaceholder':'z.B. frontdesk-manager','admin.roleDescriptionPlaceholder':'Rollenbeschreibung...',
'admin.createRole':'Rolle erstellen','admin.editRole':'Rolle bearbeiten',
'admin.deleteRoleConfirm':'Sind Sie sicher, dass Sie diese Rolle löschen möchten?',
'admin.cannotDeleteSystemRole':'Systemrollen können nicht gelöscht werden',
'admin.roleCreated':'Rolle erstellt','admin.roleUpdated':'Rolle aktualisiert',
'admin.roleDeleted':'Rolle gelöscht','admin.roleNameRequired':'Rollenname ist erforderlich',
'admin.roleNameExists':'Eine Rolle mit diesem Namen existiert bereits',
'admin.permissionsUpdated':'Berechtigungen aktualisiert',
'admin.testWhichPermissionsASpecificRoleHasEnterAPermissionSt':'Testen Sie, welche Berechtigungen eine bestimmte Rolle hat. Geben Sie eine Berechtigungszeichenfolge ein, um zu prüfen, ob sie gewährt wird.',
'admin.roleNameMustStartWithLowercaseLetterAndContainOnlyLowe':'Rollenname muss mit einem Kleinbuchstaben beginnen und nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.',
'admin.theAdminRoleHasGlobalWildcardQuotquotAccessWhichGrants':'Die Admin-Rolle hat globalen Platzhalter ("*")-Zugriff, der alle Berechtigungen gewährt. Die Berechtigung kann nicht entfernt werden.',
'admin.manageRolesAndTheirPermissionAssignmentsAcrossTotalmod':'Rollen und ihre Berechtigungszuweisungen über {totalModules} Module und {totalPermissions} Berechtigungen verwalten.',
'admin.areYouSureYouWantToDeleteThisTenantThisActionCannotBeU':'Sind Sie sicher, dass Sie diesen Mandanten löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.',
'admin.reactivatingThisTenantWillRestoreFullAccessToThePlatfo':'Die Reaktivierung dieses Mandanten stellt den vollen Plattformzugang für alle Benutzer wieder her.',
'admin.isplatformadminAListOfAllUsersAcrossTenantsAListOfAllU':'{isPlatformAdmin ? "Liste aller Benutzer über alle Mandanten" : "Liste der Benutzer in Ihrem Mandanten"}',
'admin.effectivepermssizeEffectivePermissionsIncludingWildcar':'{effectivePerms.size} effektive Berechtigungen (inklusive Platzhalter)',
'admin.platform':'Plattform','admin.platformAdmin':'Plattform-Administrator',
};

// Apply direct translations
let count = 0;
for (const [k, v] of Object.entries(REMAINING_TRANS)) {
  if (!T[k] && src[k]) { T[k] = v; count++; }
}
console.log('Direct translations applied: ' + count);

// For remaining keys, use smart translation of the value
const stillRemaining = Object.keys(src).filter(k => !(k in T));
let autoTranslated = 0;

for (const k of stillRemaining) {
  const val = src[k];
  if (!val || typeof val !== 'string') continue;
  
  // Try translating short common phrases
  let translated = null;
  
  // Pattern: "No X available" -> "Keine X verfügbar"
  if (/^No [a-zA-Z]+ available$/i.test(val)) {
    const match = val.match(/^No ([a-zA-Z]+) available$/i);
    if (match) {
      const nouns = {'data':'Daten','items':'Artikel','records':'Datensätze','results':'Ergebnisse',
        'bookings':'Buchungen','rooms':'Zimmer','guests':'Gäste','staff':'Personal',
        'events':'Veranstaltungen','orders':'Bestellungen','payments':'Zahlungen',
        'invoices':'Rechnungen','tasks':'Aufgaben','reports':'Berichte',
        'channels':'Kanäle','connections':'Verbindungen','resources':'Ressourcen',
        'devices':'Geräte','sensors':'Sensoren','tickets':'Tickets',
        'campaigns':'Kampagnen','promotions':'Aktionen','vouchers':'Gutscheine',
        'slots':'Plätze','spaces':'Räume','vehicles':'Fahrzeuge',
        'issues':'Probleme','incidents':'Vorfälle','alerts':'Warnungen',
        'notifications':'Benachrichtigungen','messages':'Nachrichten',
        'templates':'Vorlagen','rules':'Regeln','workflows':'Workflows',
        'members':'Mitglieder','subscribers':'Abonnenten','tenants':'Mandanten',
        'properties':'Immobilien','amenities':'Ausstattung','categories':'Kategorien',
        'options':'Optionen','features':'Funktionen','integrations':'Integrationen',
        'metrics':'Kennzahlen','statistics':'Statistiken','trends':'Trends',
        'suggestions':'Vorschläge','recommendations':'Empfehlungen',
        'insights':'Einblicke','feedback':'Feedback','reviews':'Bewertungen',
        'coupons':'Gutscheine','discounts':'Rabatte','codes':'Codes',
        'subscriptions':'Abonnements','plans':'Pläne','reports':'Berichte',
        'segments':'Segmente','leads':'Interessenten','prospects':'Perspektiven',
        'leads':'Interessenten','entries':'Einträge','logs':'Protokolle',
        'photos':'Fotos','images':'Bilder','documents':'Dokumente',
        'files':'Dateien','attachments':'Anhänge','downloads':'Downloads',
        'uploads':'Uploads','exports':'Exporte','imports':'Importe'};
      const noun = nouns[match[1].toLowerCase()] || match[1];
      translated = `Keine ${noun} verfügbar`;
    }
  }
  
  // Pattern: "X title" -> "X" (title suffix)
  if (!translated && /^.+(?:Title|Desc)$/i.test(val)) {
    // Already likely handled
  }
  
  // Pattern: "Manage X" -> "X verwalten"
  if (!translated && /^Manage [A-Z]/.test(val)) {
    const rest = val.replace('Manage ', '');
    translated = rest + ' verwalten';
  }
  
  // Pattern: "Configure X" -> "X konfigurieren"
  if (!translated && /^Configure [A-Z]/.test(val)) {
    const rest = val.replace('Configure ', '');
    translated = rest + ' konfigurieren';
  }
  
  // Pattern: "Create X" -> "X erstellen"
  if (!translated && /^Create [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Create ', '');
    translated = rest + ' erstellen';
  }
  
  // Pattern: "Add X" -> "X hinzufügen"
  if (!translated && /^Add [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Add ', '');
    translated = rest + ' hinzufügen';
  }
  
  // Pattern: "Delete X" -> "X löschen"
  if (!translated && /^Delete [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Delete ', '');
    translated = rest + ' löschen';
  }
  
  // Pattern: "Edit X" -> "X bearbeiten"
  if (!translated && /^Edit [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Edit ', '');
    translated = rest + ' bearbeiten';
  }
  
  // Pattern: "Remove X" -> "X entfernen"
  if (!translated && /^Remove [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Remove ', '');
    translated = rest + ' entfernen';
  }
  
  // Pattern: "Save X" -> "X speichern"
  if (!translated && /^Save [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Save ', '');
    translated = rest + ' speichern';
  }
  
  // Pattern: "View X" -> "X anzeigen"
  if (!translated && /^View [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('View ', '');
    translated = rest + ' anzeigen';
  }
  
  // Pattern: "Export X" -> "X exportieren"
  if (!translated && /^Export [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Export ', '');
    translated = rest + ' exportieren';
  }
  
  // Pattern: "Import X" -> "X importieren"
  if (!translated && /^Import [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Import ', '');
    translated = rest + ' importieren';
  }
  
  // Pattern: "Download X" -> "X herunterladen"
  if (!translated && /^Download [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Download ', '');
    translated = rest + ' herunterladen';
  }
  
  // Pattern: "Upload X" -> "X hochladen"
  if (!translated && /^Upload [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Upload ', '');
    translated = rest + ' hochladen';
  }
  
  // Pattern: "Enable X" -> "X aktivieren"
  if (!translated && /^Enable [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Enable ', '');
    translated = rest + ' aktivieren';
  }
  
  // Pattern: "Disable X" -> "X deaktivieren"
  if (!translated && /^Disable [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Disable ', '');
    translated = rest + ' deaktivieren';
  }
  
  // Pattern: "Select X" -> "X auswählen"
  if (!translated && /^Select [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Select ', '');
    translated = rest + ' auswählen';
  }
  
  // Pattern: "Track X" -> "X verfolgen"
  if (!translated && /^Track [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Track ', '');
    translated = rest + ' verfolgen';
  }
  
  // Pattern: "Monitor X" -> "X überwachen"
  if (!translated && /^Monitor [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Monitor ', '');
    translated = rest + ' überwachen';
  }
  
  // Pattern: "Connect X" -> "X verbinden"
  if (!translated && /^Connect [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Connect ', '');
    translated = rest + ' verbinden';
  }
  
  // Pattern: "Disconnect X" -> "X trennen"
  if (!translated && /^Disconnect [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Disconnect ', '');
    translated = rest + ' trennen';
  }
  
  // Pattern: "Test X" -> "X testen"
  if (!translated && /^Test [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Test ', '');
    translated = rest + ' testen';
  }
  
  // Pattern: "Search X" -> "X suchen"
  if (!translated && /^Search [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Search ', '');
    translated = rest + ' suchen';
  }
  
  // Pattern: "Filter X" -> "X filtern"
  if (!translated && /^Filter [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Filter ', '');
    translated = rest + ' filtern';
  }
  
  // Pattern: "Sort X" -> "X sortieren"
  if (!translated && /^Sort [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Sort ', '');
    translated = rest + ' sortieren';
  }
  
  // Pattern: "Send X" -> "X senden"
  if (!translated && /^Send [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Send ', '');
    translated = rest + ' senden';
  }
  
  // Pattern: "Print X" -> "X drucken"
  if (!translated && /^Print [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Print ', '');
    translated = rest + ' drucken';
  }
  
  // Pattern: "Copy X" -> "X kopieren"
  if (!translated && /^Copy [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Copy ', '');
    translated = rest + ' kopieren';
  }
  
  // Pattern: "Generate X" -> "X generieren"
  if (!translated && /^Generate [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Generate ', '');
    translated = rest + ' generieren';
  }
  
  // Pattern: "Process X" -> "X verarbeiten"
  if (!translated && /^Process [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Process ', '');
    translated = rest + ' verarbeiten';
  }
  
  // Pattern: "Close X" -> "X schließen"
  if (!translated && /^Close [a-z]/i.test(val) && val.length < 40) {
    const rest = val.replace('Close ', '');
    translated = rest + ' schließen';
  }
  
  // Pattern: "Mark X as Y" -> "X als Y markieren"
  if (!translated && /^Mark [A-Z].+ as [a-z]/i.test(val) && val.length < 50) {
    const match = val.match(/^Mark (.+) as (.+)$/);
    if (match) translated = match[1] + ' als ' + match[2] + ' markieren';
  }
  
  // Pattern: "Assign X to Y" -> "X Y zuweisen"
  if (!translated && /^Assign [A-Z].+ to [a-z]/i.test(val) && val.length < 50) {
    const match = val.match(/^Assign (.+) to (.+)$/);
    if (match) translated = match[1] + ' ' + match[2] + ' zuweisen';
  }
  
  if (translated) {
    T[k] = translated;
    autoTranslated++;
  }
}

console.log('Auto-translated: ' + autoTranslated);
console.log('Total: ' + Object.keys(T).length);

const finalRemaining = Object.keys(src).filter(k => !(k in T));
console.log('Final remaining: ' + finalRemaining.length);

// Save
fs.writeFileSync('/tmp/de_translations_final.json', JSON.stringify(T, null, 2));
fs.writeFileSync('/tmp/de_final_remaining.json', JSON.stringify(finalRemaining));
