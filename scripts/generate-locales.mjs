import fs from 'fs';
import path from 'path';

const LANGS = ['ar', 'bn', 'de', 'es', 'fr', 'gu', 'hi', 'ja', 'ml', 'mr', 'pt', 'ta', 'te', 'zh'];

// Load en.json as source
const en = JSON.parse(fs.readFileSync('/home/z/my-project/StaySuite-HospitalityOS/src/messages/en.json', 'utf-8'));

// Translation mappings for common terms
const COMMON_MAP = {
  // Common UI terms
  save: { ar: 'حفظ', bn: 'সংরক্ষণ', de: 'Speichern', es: 'Guardar', fr: 'Enregistrer', gu: 'સાચવો', hi: 'सहेजें', ja: '保存', ml: 'സേവ് ചെയ്യുക', mr: 'जतन करा', pt: 'Salvar', ta: 'சேமிக்கவும்', te: 'సేవ్ చేయండి', zh: '保存' },
  cancel: { ar: 'إلغاء', bn: 'বাতিল', de: 'Abbrechen', es: 'Cancelar', fr: 'Annuler', gu: 'રદ કરો', hi: 'रद्द करें', ja: 'キャンセル', ml: 'റദ്ദാക്കുക', mr: 'रद्द करा', pt: 'Cancelar', ta: 'ரத்துசெய்க', te: 'రద్దు చేయండి', zh: '取消' },
  delete: { ar: 'حذف', bn: 'মুছে ফেলুন', de: 'Löschen', es: 'Eliminar', fr: 'Supprimer', gu: 'કાઢી નાખો', hi: 'हटाएं', ja: '削除', ml: 'ഇല്ലാതാക്കുക', mr: 'हटवा', pt: 'Excluir', ta: 'நீக்குக', te: 'తొలగించు', zh: '删除' },
  edit: { ar: 'تعديل', bn: 'সম্পাদনা', de: 'Bearbeiten', es: 'Editar', fr: 'Modifier', gu: 'ફેરફાર કરો', hi: 'संपादित करें', ja: '編集', ml: 'എഡിറ്റ് ചെയ്യുക', mr: 'संपादन', pt: 'Editar', ta: 'திருத்துக', te: 'సవరించు', zh: '编辑' },
  add: { ar: 'إضافة', bn: 'যোগ করুন', de: 'Hinzufügen', es: 'Añadir', fr: 'Ajouter', gu: 'ઉમેરો', hi: 'जोड़ें', ja: '追加', ml: 'ചേര്‍ക്കുക', mr: 'जोडा', pt: 'Adicionar', ta: 'சேர்க்கவும்', te: 'జోడించు', zh: '添加' },
  create: { ar: 'إنشاء', bn: 'তৈরি করুন', de: 'Erstellen', es: 'Crear', fr: 'Créer', gu: 'બનાવો', hi: 'बनाएं', ja: '作成', ml: 'സൃഷ്ടിക്കുക', mr: 'तयार करा', pt: 'Criar', ta: 'உருவாக்குக', te: 'సృష్టించు', zh: '创建' },
  update: { ar: 'تحديث', bn: 'আপডেট', de: 'Aktualisieren', es: 'Actualizar', fr: 'Mettre à jour', gu: 'અપડેટ', hi: 'अपडेट करें', ja: '更新', ml: 'അപ്‌ഡേറ്റ് ചെയ്യുക', mr: 'अपडेट करा', pt: 'Atualizar', ta: 'புதுப்பிக்கவும்', te: 'అప్‌డేట్ చేయండి', zh: '更新' },
  search: { ar: 'بحث', bn: 'অনুসন্ধান', de: 'Suchen', es: 'Buscar', fr: 'Rechercher', gu: 'શોધો', hi: 'खोजें', ja: '検索', ml: 'തിരയുക', mr: 'शोधा', pt: 'Pesquisar', ta: 'தேடுக', te: 'వెతకండి', zh: '搜索' },
  filter: { ar: 'تصفية', bn: 'ফিল্টার', de: 'Filtern', es: 'Filtrar', fr: 'Filtrer', gu: 'ફિલ્ટર', hi: 'फ़िल्टर करें', ja: 'フィルター', ml: 'ഫിൽറ്റർ', mr: 'फिल्टर', pt: 'Filtrar', ta: 'வடிகட்டுக', te: 'ఫిల్టర్', zh: '筛选' },
  export: { ar: 'تصدير', bn: 'রপ্তানি', de: 'Exportieren', es: 'Exportar', fr: 'Exporter', gu: 'નિકાસ', hi: 'निर्यात करें', ja: 'エクスポート', ml: 'എക്സ്പോർട്ട്', mr: 'निर्यात', pt: 'Exportar', ta: 'ஏற்றுமதி செய்க', te: 'ఎగ్జిపోర్ట్', zh: '导出' },
  refresh: { ar: 'تحديث', bn: 'রিফ্রেশ', de: 'Aktualisieren', es: 'Actualizar', fr: 'Rafraîchir', gu: 'રિફ્રેશ', hi: 'रीफ़्रेश करें', ja: '更新', ml: 'റീഫ്രെഷ്', mr: 'रिफ्रेश', pt: 'Atualizar', ta: 'புதுப்பிக்கவும்', te: 'రిఫ్రెష్', zh: '刷新' },
  loading: { ar: 'جار التحميل...', bn: 'লোড হচ্ছে...', de: 'Laden...', es: 'Cargando...', fr: 'Chargement...', gu: 'લોડ થઈ રહ્યું છે...', hi: 'लोड हो रहा है...', ja: '読み込み中...', ml: 'ലോഡ് ചെയ്യുന്നു...', mr: 'लोड होत आहे...', pt: 'Carregando...', ta: 'ஏற்றுகிறது...', te: 'లోడ్ అవుతోంది...', zh: '加载中...' },
  noData: { ar: 'لا توجد بيانات', bn: 'কোনো ডেটা নেই', de: 'Keine Daten verfügbar', es: 'Sin datos', fr: 'Aucune donnée', gu: 'કોઈ ડેટા નથી', hi: 'कोई डेटा उपलब्ध नहीं', ja: 'データがありません', ml: 'ഡാറ്റ ലഭ്യമല്ല', mr: 'डेटा उपलब्ध नाही', pt: 'Sem dados', ta: 'தரவு இல்லை', te: 'డేటా లేదు', zh: '暂无数据' },
  confirm: { ar: 'تأكيد', bn: 'নিশ্চিত করুন', de: 'Bestätigen', es: 'Confirmar', fr: 'Confirmer', gu: 'પુષ્ટિ કરો', hi: 'पुष्टि करें', ja: '確認', ml: 'സ്ഥിരീകരിക്കുക', mr: 'पुष्टी करा', pt: 'Confirmar', ta: 'உறுதிப்படுத்தவும்', te: 'నిర్ధారించండి', zh: '确认' },
  close: { ar: 'إغلاق', bn: 'বন্ধ করুন', de: 'Schließen', es: 'Cerrar', fr: 'Fermer', gu: 'બંધ કરો', hi: 'बंद करें', ja: '閉じる', ml: 'അടയ്ക്കുക', mr: 'बंद करा', pt: 'Fechar', ta: 'மூடுக', te: 'మూసివేయండి', zh: '关闭' },
  view: { ar: 'عرض', bn: 'দেখুন', de: 'Anzeigen', es: 'Ver', fr: 'Afficher', gu: 'જુઓ', hi: 'देखें', ja: '表示', ml: 'കാണുക', mr: 'पहा', pt: 'Visualizar', ta: 'காண்க', te: 'చూడండి', zh: '查看' },
  download: { ar: 'تنزيل', bn: 'ডাউনলোড', de: 'Herunterladen', es: 'Descargar', fr: 'Télécharger', gu: 'ડાઉનલોડ', hi: 'डाउनलोड', ja: 'ダウンロード', ml: 'ഡൗൺലോഡ്', mr: 'डाउनलोड', pt: 'Baixar', ta: 'பதிவிறக்கவும்', te: 'డౌన్‌లోడ్', zh: '下载' },
  actions: { ar: 'إجراءات', bn: 'কার্যক্রম', de: 'Aktionen', es: 'Acciones', fr: 'Actions', gu: 'ક્રિયાઓ', hi: 'कार्रवाई', ja: 'アクション', ml: 'നടപടികൾ', mr: 'कार्यवाही', pt: 'Ações', ta: 'செயல்கள்', te: 'చర్యలు', zh: '操作' },
  status: { ar: 'الحالة', bn: 'স্ট্যাটাস', de: 'Status', es: 'Estado', fr: 'Statut', gu: 'સ્થિતિ', hi: 'स्थिति', ja: 'ステータス', ml: 'നില', mr: 'स्थिती', pt: 'Status', ta: 'நிலை', te: 'స్థితి', zh: '状态' },
  details: { ar: 'التفاصيل', bn: 'বিবরণ', de: 'Details', es: 'Detalles', fr: 'Détails', gu: 'વિગતો', hi: 'विवरण', ja: '詳細', ml: 'വിശദാംശങ്ങൾ', mr: 'तपशील', pt: 'Detalhes', ta: 'விவரங்கள்', te: 'వివరాలు', zh: '详情' },
  settings: { ar: 'الإعدادات', bn: 'সেটিংস', de: 'Einstellungen', es: 'Configuración', fr: 'Paramètres', gu: 'સેટિંગ્સ', hi: 'सेटिंग्स', ja: '設定', ml: 'ക്രമീകരണങ്ങൾ', mr: 'सेटिंग्ज', pt: 'Configurações', ta: 'அமைப்புகள்', te: 'సెట్టింగ్‌లు', zh: '设置' },
  help: { ar: 'مساعدة', bn: 'সাহায্য', de: 'Hilfe', es: 'Ayuda', fr: 'Aide', gu: 'મદદ', hi: 'सहायता', ja: 'ヘルプ', ml: 'സഹായം', mr: 'मदत', pt: 'Ajuda', ta: 'உதவி', te: 'సహాయం', zh: '帮助' },
  error: { ar: 'خطأ', bn: 'ত্রুটি', de: 'Fehler', es: 'Error', fr: 'Erreur', gu: 'ભૂલ', hi: 'त्रुटि', ja: 'エラー', ml: 'പിശക്', mr: 'त्रुटी', pt: 'Erro', ta: 'பிழை', te: 'లోపం', zh: '错误' },
  success: { ar: 'نجاح', bn: 'সফল', de: 'Erfolg', es: 'Éxito', fr: 'Succès', gu: 'સફળતા', hi: 'सफलता', ja: '成功', ml: 'വിജയം', mr: 'यशस्स्वी', pt: 'Sucesso', ta: 'வெற்றி', te: 'విజయం', zh: '成功' },
  warning: { ar: 'تحذير', bn: 'সতর্কতা', de: 'Warnung', es: 'Advertencia', fr: 'Avertissement', gu: 'ચેતવણી', hi: 'चेतावनी', ja: '警告', ml: 'മുന്നറിപ്പ്', mr: 'इशारा', pt: 'Aviso', ta: 'எச்சரிக்கை', te: 'హెచ్చరిక', zh: '警告' },
  all: { ar: 'الكل', bn: 'সব', de: 'Alle', es: 'Todos', fr: 'Tous', gu: 'બધા', hi: 'सभी', ja: 'すべて', ml: 'എല്ലാം', mr: 'सर्व', pt: 'Todos', ta: 'அனைத்தும்', te: 'అన్నీ', zh: '全部' },
  none: { ar: 'لا شيء', bn: 'কিছুই না', de: 'Keine', es: 'Ninguno', fr: 'Aucun', gu: 'કંઈ નહીં', hi: 'कोई नहीं', ja: 'なし', ml: 'ഒന്നുമില്ല', mr: 'काही नाही', pt: 'Nenhum', ta: 'எதுவுமில்லை', te: 'ఏదీ లేదు', zh: '无' },
  enabled: { ar: 'مفعّل', bn: 'সক্রিয', de: 'Aktiviert', es: 'Habilitado', fr: 'Activé', gu: 'સક્ષમ', hi: 'सक्षम', ja: '有効', ml: 'പ്രാപ്തമാക്കി', mr: 'सक्षम', pt: 'Ativado', ta: 'இயக்கப்பட்டது', te: 'ప్రాచలనం', zh: '已启用' },
  disabled: { ar: 'معطّل', bn: 'নিস্ক্রিয', de: 'Deaktiviert', es: 'Deshabilitado', fr: 'Désactivé', gu: 'નિષ્ક્રિય', hi: 'अक्षम', ja: '無効', ml: 'അപ്രാപ്തമാക്കി', mr: 'अक्षम', pt: 'Desativado', ta: 'முடక்கப்பட்டது', te: 'నిలిపివేయబడింది', zh: '已禁用' },
  active: { ar: 'نشط', bn: 'সক্রিয', de: 'Aktiv', es: 'Activo', fr: 'Actif', gu: 'સક્રિય', hi: 'सक्रिय', ja: 'アクティブ', ml: 'സജീവം', mr: 'सक्रिय', pt: 'Ativo', ta: 'செயല்பாட்டில் உள்ள', te: 'యాక్టివ్', zh: '活跃' },
  inactive: { ar: 'غير نشط', bn: 'নিস্ক্রিয', de: 'Inaktiv', es: 'Inactivo', fr: 'Inactif', gu: 'નિષ્ક્રિય', hi: 'निष्क्रिय', ja: '非アクティブ', ml: 'നിഷ്ക്രിയം', mr: 'निष्क्रिय', pt: 'Inativo', ta: 'செயலఱ்ற', te: 'అయాక్టివ్', zh: '非活跃' },
  email: { ar: 'البريد الإلكتروني', bn: 'ইমেইল', de: 'E-Mail', es: 'Correo electrónico', fr: 'E-mail', gu: 'ઈમેલ', hi: 'ईमेल', ja: 'メール', ml: 'ഇമെയിൽ', mr: 'ईमेल', pt: 'E-mail', ta: 'மின்னஞ்சல்', te: 'ఇమెయిల్', zh: '邮箱' },
  password: { ar: 'كلمة المرور', bn: 'পাসওয়ার্ড', de: 'Passwort', es: 'Contraseña', fr: 'Mot de passe', gu: 'પાસવર્ડ', hi: 'पासवर्ड', ja: 'パスワード', ml: 'പാസ്‌വേഡ്', mr: 'पासवर्ड', pt: 'Senha', ta: 'கடவுச்சொல்', te: 'పాస్‌వర్డ్', zh: '密码' },
  name: { ar: 'الاسم', bn: 'নাম', de: 'Name', es: 'Nombre', fr: 'Nom', gu: 'નામ', hi: 'नाम', ja: '名前', ml: 'പേര്', mr: 'नाव', pt: 'Nome', ta: 'பெயர்', te: 'పేరు', zh: '姓名' },
  description: { ar: 'الوصف', bn: 'বিবরণ', de: 'Beschreibung', es: 'Descripción', fr: 'Description', gu: 'વર્ણન', hi: 'विवरण', ja: '説明', ml: 'വിവരണം', mr: 'वर्णन', pt: 'Descrição', ta: 'விவரம்', te: 'వివరణ', zh: '描述' },
  submit: { ar: 'إرسال', bn: 'জমা দিন', de: 'Absenden', es: 'Enviar', fr: 'Soumettre', gu: 'સબમિટ', hi: 'जमा करें', ja: '送信', ml: 'സമർ്‌പ്പിക്കുക', mr: 'सबमिट करा', pt: 'Enviar', ta: 'சமர்ப்பிக்கவும்', te: 'సబ్మిట్ చేయండి', zh: '提交' },
  reset: { ar: 'إعادة تعيين', bn: 'রিসেট', de: 'Zurücksetzen', es: 'Restablecer', fr: 'Réinitialiser', gu: 'રિસેટ', hi: 'रीसेट करें', ja: 'リセット', ml: 'പുനഃസജ്ജമാക്കുക', mr: 'रीसेट करा', pt: 'Redefinir', ta: 'மீண்டும் அமைக்கவும்', te: 'రీసెట్ చేయండి', zh: '重置' },
  select: { ar: 'اختيار', bn: 'নির্বাচন', de: 'Auswählen', es: 'Seleccionar', fr: 'Sélectionner', gu: 'પસંદ કરો', hi: 'चुनें', ja: '選択', ml: 'തിരഞ്ഞെടുക്കുക', mr: 'निवडा', pt: 'Selecionar', ta: 'தேர்ந்தெடுக்கவும்', te: 'ఎంచుకోండి', zh: '选择' },
  no: { ar: 'لا', bn: 'না', de: 'Nein', es: 'No', fr: 'Non', gu: 'ના', hi: 'नहीं', ja: 'いいえ', ml: 'അല്ല', mr: 'नाही', pt: 'Não', ta: 'இல்லை', te: 'లేదు', zh: '否' },
  yes: { ar: 'نعم', bn: 'হ্যাঁ', de: 'Ja', es: 'Sí', fr: 'Oui', gu: 'હા', hi: 'हाँ', ja: 'はい', ml: 'അതെ', mr: 'होय', pt: 'Sim', ta: 'ஆம்', te: 'అవును', zh: '是' },
  pending: { ar: 'معلّق', bn: 'পেন্ডিং', de: 'Ausstehend', es: 'Pendiente', fr: 'En attente', gu: 'બાકી', hi: 'लंबित', ja: '保留中', ml: 'ബാക്കി', mr: 'प्रलंबित', pt: 'Pendente', ta: 'நிலுவீழ்ச்சியில்', te: 'పెండింగ్', zh: '待处理' },
  completed: { ar: 'مكتمل', bn: 'সম্পন্ন', de: 'Abgeschlossen', es: 'Completado', fr: 'Terminé', gu: 'પૂર્ણ', hi: 'पूर्ण', ja: '完了', ml: 'പൂർത്തിയായ', mr: 'पूर्ण', pt: 'Concluído', ta: 'முடிந்தது', te: 'పూర్తి అయింది', zh: '已完成' },
  login: { ar: 'تسجيل الدخول', bn: 'লগইন', de: 'Anmelden', es: 'Iniciar sesión', fr: 'Connexion', gu: 'લૉગિન', hi: 'लॉग इन करें', ja: 'ログイン', ml: 'ലോഗിൻ', mr: 'लॉगिन', pt: 'Entrar', ta: 'உள்நுழை', te: 'లాగిన్', zh: '登录' },
  logout: { ar: 'تسجيل الخروج', bn: 'লগআউট', de: 'Abmelden', es: 'Cerrar sesión', fr: 'Déconnexion', gu: 'લૉગઆઉટ', hi: 'लॉग आउट', ja: 'ログアウト', ml: 'ലോഗൗട്ട്', mr: 'लॉगआउट', pt: 'Sair', ta: 'வெளியேறுக', te: 'లాగ్అవుట్', zh: '登出' },
  profile: { ar: 'الملف الشخصي', bn: 'প্রোফাইল', de: 'Profil', es: 'Perfil', fr: 'Profil', gu: 'પ્રોફાઈલ', hi: 'प्रोफ़ाइल', ja: 'プロフィール', ml: 'പ്രൊഫൈൽ', mr: 'प्रोफाइल', pt: 'Perfil', ta: 'சுயவிவரம்', te: 'ప్రొఫైల్', zh: '个人资料' },
  notifications: { ar: 'الإشعارات', bn: 'বিজ্ঞপ্তি', de: 'Benachrichtigungen', es: 'Notificaciones', fr: 'Notifications', gu: 'નોટિફિકેશન', hi: 'सूचनाएं', ja: '通知', ml: 'അറിയിപ്പുകൾ', mr: 'सूचना', pt: 'Notificações', ta: 'அறிவிப்புகள்', te: 'నోటిఫికేషన్లు', zh: '通知' },
};

// Auto-translate by keeping English as fallback and providing known translations
function translate(key, ns, lang) {
  // Check common map first
  if (COMMON_MAP[key] && COMMON_MAP[key][lang]) {
    return COMMON_MAP[key][lang];
  }
  // Check status namespace
  if (COMMON_MAP[key]) return COMMON_MAP[key][lang] || key;
  // Return English as fallback (next-intl handles this)
  return key;
}

// For each language, create the locale file
for (const lang of LANGS) {
  const langFile = path.join('/home/z/my-project/StaySuite-HospitalityOS/src/messages', `${lang}.json`);
  
  // Load existing file if it exists
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(langFile, 'utf-8'));
  } catch {
    existing = {};
  }
  
  // For each namespace in en.json, create keys for this language
  for (const [ns, keys] of Object.entries(en)) {
    if (typeof keys !== 'object') continue;
    
    if (!existing[ns]) existing[ns] = {};
    
    for (const [key, enValue] of Object.entries(keys)) {
      if (typeof enValue !== 'string') {
        existing[ns][key] = enValue;
        continue;
      }
      
      // Keep existing translations
      if (existing[ns][key]) continue;
      
      // Try to find in common map
      let translated = null;
      if (COMMON_MAP[key] && COMMON_MAP[key][lang]) {
        translated = COMMON_MAP[key][lang];
      } else if (COMMON_MAP[enValue] && COMMON_MAP[enValue][lang]) {
        translated = COMMON_MAP[enValue][lang];
      }
      
      // Keep English as fallback for most keys
      existing[ns][key] = translated || enValue;
    }
  }
  
  fs.writeFileSync(langFile, JSON.stringify(existing, null, 2) + '\n');
  const keyCount = Object.values(existing).reduce((sum, ns) => sum + (typeof ns === 'object' ? Object.keys(ns).length : 0), 0);
  console.log(`${lang}.json: ${keyCount} total keys across ${Object.keys(existing).filter(k => typeof existing[k] === 'object').length} namespaces`);
}

console.log('\nAll locale files updated!');
