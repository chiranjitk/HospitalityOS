#!/usr/bin/env python3
"""
Smart pattern-based translator for StaySuite i18n.
Handles common UI patterns instantly without API calls.
"""
import json, sys, re, os

MSG_DIR = 'src/messages'

# ========================
# PHRASE PATTERN RULES
# ========================
# Each rule maps a regex pattern to a translation template per language.
# {text} = the variable part of the phrase

PATTERNS = {
    # "No X found" patterns
    r'^No (\w+(?: \w+)*) found$': {
        'hi': 'कोई {text} नहीं मिला',
        'ar': 'لم يتم العثور على {text}',
        'bn': 'কোনো {text} পাওয়া যায়নি',
        'de': 'Kein {text} gefunden',
        'es': 'Ningún {text} encontrado',
        'fr': 'Aucun {text} trouvé',
        'gu': 'કોઈ {text} મળ્યું નહીં',
        'ja': '{text}が見つかりません',
        'ml': '{text} കണ്ടെത്തിയില്ല',
        'mr': 'कोणतेही {text} सापडले नाहीत',
        'pt': 'Nenhum {text} encontrado',
        'ta': '{text} ஏதுவும் கிடைக்கவில்லை',
        'te': '{text} కనుగొనబడలేదు',
        'zh': '未找到{text}',
    },
    # "Search X" patterns
    r'^Search (.+)$': {
        'hi': '{text} खोजें',
        'ar': 'بحث عن {text}',
        'bn': '{text} অনুসন্ধান করুন',
        'de': '{text} suchen',
        'es': 'Buscar {text}',
        'fr': 'Rechercher {text}',
        'gu': '{text} શોધો',
        'ja': '{text}を検索',
        'ml': '{text} തിരയുക',
        'mr': '{text} शोधा',
        'pt': 'Pesquisar {text}',
        'ta': '{text} தேடுக',
        'te': '{text} వెతకండి',
        'zh': '搜索{text}',
    },
    # "X Management"
    r'^(.+?) Management$': {
        'hi': '{text} प्रबंधन',
        'ar': 'إدارة {text}',
        'bn': '{text} ব্যবস্থাপনা',
        'de': '{text}-Verwaltung',
        'es': 'Gestión de {text}',
        'fr': 'Gestion de {text}',
        'gu': '{text} મેનેજમેન્ટ',
        'ja': '{text}管理',
        'ml': '{text} മാനേജ്മെന്റ്',
        'mr': '{text} व्यवस्थापन',
        'pt': 'Gestão de {text}',
        'ta': '{text} நிர்வாகம்',
        'te': '{text} నిర్వహణ',
        'zh': '{text}管理',
    },
    # "X Settings"
    r'^(.+?) Settings$': {
        'hi': '{text} सेटिंग्स',
        'ar': 'إعدادات {text}',
        'bn': '{text} সেটিংস',
        'de': '{text}-Einstellungen',
        'es': 'Configuración de {text}',
        'fr': 'Paramètres de {text}',
        'gu': '{text} સેટિંગ્સ',
        'ja': '{text}設定',
        'ml': '{text} ക്രമീകരണം',
        'mr': '{text} सेटिंग्ज',
        'pt': 'Configurações de {text}',
        'ta': '{text} அமைப்புகள்',
        'te': '{text} సెట్టింగులు',
        'zh': '{text}设置',
    },
    # "Create X" / "Add X"
    r'^(Create|Add) (.+)$': {
        'hi': '{text} बनाएं',
        'ar': 'إنشاء {text}',
        'bn': '{text} তৈরি/যোগ করুন',
        'de': '{text} erstellen',
        'es': 'Crear {text}',
        'fr': 'Créer {text}',
        'gu': '{text} બનાવો',
        'ja': '{text}を作成',
        'ml': '{text} സൃഷ്ടിക്കുക',
        'mr': '{text} तयार करा',
        'pt': 'Criar {text}',
        'ta': '{text} உருவாக்குக',
        'te': '{text} సృష్టించండి',
        'zh': '创建{text}',
    },
    # "Edit X" / "Update X"
    r'^(Edit|Update) (.+)$': {
        'hi': '{text} संपादित करें',
        'ar': 'تعديل {text}',
        'bn': '{text} সম্পাদনা/আপডেট করুন',
        'de': '{text} bearbeiten',
        'es': 'Editar {text}',
        'fr': 'Modifier {text}',
        'gu': '{text} ફેરફાર કરો',
        'ja': '{text}を編集',
        'ml': '{text} എഡിറ്റുചെയ്യുക',
        'mr': '{text} संपादित करा',
        'pt': 'Editar {text}',
        'ta': '{text} திருத்துக',
        'te': '{text} సవరించండి',
        'zh': '编辑{text}',
    },
    # "Delete X" / "Remove X"
    r'^(Delete|Remove) (.+)$': {
        'hi': '{text} हटाएं',
        'ar': 'حذف {text}',
        'bn': '{text} মুছে/সরান ফেলুন',
        'de': '{text} löschen',
        'es': 'Eliminar {text}',
        'fr': 'Supprimer {text}',
        'gu': '{text} ડિલીટ/દૂર કરો',
        'ja': '{text}を削除',
        'ml': '{text} ഇല്ലാതാക്കുക',
        'mr': '{text} हटवा',
        'pt': 'Excluir {text}',
        'ta': '{text} நீக்குக',
        'te': '{text} తొలగించండి',
        'zh': '删除{text}',
    },
    # "X Details"
    r'^(.+?) Details$': {
        'hi': '{text} विवरण',
        'ar': 'تفاصيل {text}',
        'bn': '{text} বিবরণ',
        'de': '{text}-Details',
        'es': 'Detalles de {text}',
        'fr': 'Détails de {text}',
        'gu': '{text} વિગતો',
        'ja': '{text}詳細',
        'ml': '{text} വിശദാംശങ്ങൾ',
        'mr': '{text} तपशील',
        'pt': 'Detalhes de {text}',
        'ta': '{text} விவரங்கள்',
        'te': '{text} వివరాలు',
        'zh': '{text}详情',
    },
    # "Total X"
    r'^Total (.+)$': {
        'hi': 'कुल {text}',
        'ar': 'إجمالي {text}',
        'bn': 'মোট {text}',
        'de': 'Gesamt-{text}',
        'es': 'Total {text}',
        'fr': 'Total {text}',
        'gu': 'કુલ {text}',
        'ja': '総{text}',
        'ml': 'മൊത്തം {text}',
        'mr': 'एकूण {text}',
        'pt': 'Total de {text}',
        'ta': 'மொத்த {text}',
        'te': 'మొత్తం {text}',
        'zh': '总计{text}',
    },
    # "Active X" / "X Active"
    r'^(Active|Current) (.+)$': {
        'hi': 'सक्रिय {text}',
        'ar': '{text} نشط',
        'bn': 'সক্রিয় {text}',
        'de': 'Aktive {text}',
        'es': '{text} activo',
        'fr': '{text} actif',
        'gu': 'સક્રિય {text}',
        'ja': 'アクティブな{text}',
        'ml': 'സജീവ {text}',
        'mr': 'सक्रिय {text}',
        'pt': '{text} ativo',
        'ta': 'செயலிலுள்ள {text}',
        'te': 'యాక్టివ్ {text}',
        'zh': '活跃{text}',
    },
    # "Are you sure?" / confirmation patterns
    r'^(Are you sure|Confirm deletion|This action cannot be undone).*$': {
        'hi': 'क्या आप सुनिश्चित हैं?',
        'ar': 'هل أنت متأكد؟',
        'bn': 'আপনি কি নিশ্চিত?',
        'de': 'Sind Sie sicher?',
        'es': '¿Está seguro?',
        'fr': 'Êtes-vous sûr?',
        'gu': 'શું તમે નિશ્ચિત છો?',
        'ja': 'よろしいですか？',
        'ml': 'തീർച്ചയാണോ?',
        'mr': 'तुम्ही खात्री आहात?',
        'pt': 'Tem certeza?',
        'ta': 'நிச்சயமாக உள்ளீரா?',
        'te': 'మీరు ఖచ్చితంగా ఉన్నారా?',
        'zh': '您确定吗？',
    },
    # "Failed to X"
    r'^Failed to (.+)$': {
        'hi': '{text} करने में विफल',
        'ar': 'فشل في {text}',
        'bn': '{text} করতে ব্যর্থ',
        'de': '{text} fehlgeschlagen',
        'es': 'Error al {text}',
        'fr': 'Échec de {text}',
        'gu': '{text} કરવામાં નિષ્ફળ',
        'ja': '{text}に失敗しました',
        'ml': '{text} ചെയ്യുന്നതിൽ പരാജയപ്പെട്ടു',
        'mr': '{text} करण्यात अयशस्वी',
        'pt': 'Falha ao {text}',
        'ta': '{text} செய்ய முடியவில்லை',
        'te': '{text} చేయడం విఫలమైంది',
        'zh': '{text}失败',
    },
    # "X successfully" / "Successfully X"
    r'^(.+) successfully$': {
        'hi': '{text} सफलतापूर्वक',
        'ar': 'تم {text} بنجاح',
        'bn': '{text} সফলভাবে',
        'de': '{text} erfolgreich',
        'es': '{text} exitosamente',
        'fr': '{text} avec succès',
        'gu': '{text} સફળતાપૂર્વક',
        'ja': '{text}しました',
        'ml': '{text} വിജയകരമായി',
        'mr': '{text} यशस्वीरित्या',
        'pt': '{text} com sucesso',
        'ta': '{text} வெற்றிகரமாக',
        'te': '{text} విజయవంతంగా',
        'zh': '成功{text}',
    },
    # "All X" 
    r'^All (.+)$': {
        'hi': 'सभी {text}',
        'ar': 'جميع {text}',
        'bn': 'সব {text}',
        'de': 'Alle {text}',
        'es': 'Todos los {text}',
        'fr': 'Tous les {text}',
        'gu': 'બધા {text}',
        'ja': 'すべての{text}',
        'ml': 'എല്ലാ {text}',
        'mr': 'सर्व {text}',
        'pt': 'Todos os {text}',
        'ta': 'அனைத்து {text}',
        'te': 'అన్నీ {text}',
        'zh': '所有{text}',
    },
    # "Select X"
    r'^Select (.+)$': {
        'hi': '{text} चुनें',
        'ar': 'اختر {text}',
        'bn': '{text} নির্বাচন করুন',
        'de': '{text} auswählen',
        'es': 'Seleccionar {text}',
        'fr': 'Sélectionner {text}',
        'gu': '{text} પસંદ કરો',
        'ja': '{text}を選択',
        'ml': '{text} തിരഞ്ഞെടുക്കുക',
        'mr': '{text} निवडा',
        'pt': 'Selecionar {text}',
        'ta': '{text} தேர்ந்தெடுக்கவும்',
        'te': '{text} ఎంచుకోండి',
        'zh': '选择{text}',
    },
    # "View X" / "Show X"
    r'^(View|Show) (.+)$': {
        'hi': '{text} देखें',
        'ar': 'عرض {text}',
        'bn': '{text} দেখুন',
        'de': '{text} anzeigen',
        'es': 'Ver {text}',
        'fr': 'Afficher {text}',
        'gu': '{text} જુઓ',
        'ja': '{text}を表示',
        'ml': '{text} കാണുക',
        'mr': '{text} पहा',
        'pt': 'Visualizar {text}',
        'ta': '{text} காட்டவும்',
        'te': '{text} చూడండి',
        'zh': '查看{text}',
    },
    # "X Overview"
    r'^(.+?) Overview$': {
        'hi': '{text} अवलोकन',
        'ar': 'نظرة عامة على {text}',
        'bn': '{text} ওভারভিউ',
        'de': '{text}-Übersicht',
        'es': 'Resumen de {text}',
        'fr': 'Aperçu de {text}',
        'gu': '{text} ઓવરવ્યૂ',
        'ja': '{text}概要',
        'ml': '{text} അവലോകനം',
        'mr': '{text} आढावा',
        'pt': 'Visão geral de {text}',
        'ta': '{text} நிலைப்பாடு',
        'te': '{text} అవలోకనం',
        'zh': '{text}概览',
    },
    # "X Analytics"
    r'^(.+?) Analytics$': {
        'hi': '{text} एनालिटिक्स',
        'ar': 'تحليلات {text}',
        'bn': '{text} অ্যানালিটিক্স',
        'de': '{text}-Analytik',
        'es': 'Analíticas de {text}',
        'fr': 'Analytique de {text}',
        'gu': '{text} એનાલિટિક્સ',
        'ja': '{text}分析',
        'ml': '{text} അനലിറ്റിക്സ്',
        'mr': '{text} विश्लेषण',
        'pt': 'Análise de {text}',
        'ta': '{text} பகுப்பாய்வு',
        'te': '{text} అనలిటిక్స్',
        'zh': '{text}分析',
    },
    # "Last X days/weeks/months"
    r'^Last (\d+) (days?|weeks?|months?|years?)$': {
        'hi': 'पिछले {1} {2}',
        'ar': 'آخر {1} {2}',
        'bn': 'গত {1} {2}',
        'de': 'Letzte {1} {2}',
        'es': 'Últimos {1} {2}',
        'fr': 'Derniers {1} {2}',
        'gu': 'ગયા {1} {2}',
        'ja': '過去{1}{2}',
        'ml': 'കഴിഞ്ഞ {1} {2}',
        'mr': 'मागील {1} {2}',
        'pt': 'Últimos {1} {2}',
        'ta': 'கடந்த {1} {2}',
        'te': 'గత {1} {2}',
        'zh': '过去{1}{2}',
    },
    # "X Configuration"
    r'^(.+?) Configuration$': {
        'hi': '{text} कॉन्फ़िगरेशन',
        'ar': 'تكوين {text}',
        'bn': '{text} কনফিগারেশন',
        'de': '{text}-Konfiguration',
        'es': 'Configuración de {text}',
        'fr': 'Configuration de {text}',
        'gu': '{text} રૂપરેખા',
        'ja': '{text}設定',
        'ml': '{text} കോൺഫിഗറേഷൻ',
        'mr': '{text} संरचना',
        'pt': 'Configuração de {text}',
        'ta': '{text} கட்டமைப்பு',
        'te': '{text} కాన్ఫిగరేషన్',
        'zh': '{text}配置',
    },
    # "X History" / "X Logs"
    r'^(.+?) (History|Logs|Records)$': {
        'hi': '{text} {suffix}',
        'ar': '{suffix} {text}',
        'bn': '{text} {suffix}',
        'de': '{text}-{suffix}',
        'es': '{suffix} de {text}',
        'fr': '{suffix} de {text}',
        'gu': '{text} {suffix}',
        'ja': '{text}{suffix}',
        'ml': '{text} {suffix}',
        'mr': '{text} {suffix}',
        'pt': '{suffix} de {text}',
        'ta': '{text} {suffix}',
        'te': '{text} {suffix}',
        'zh': '{text}{suffix}',
    },
}

# Suffix translations for "History/Logs/Records"
SUFFIX_MAP = {
    'History': {
        'hi': 'इतिहास', 'ar': 'السجل', 'bn': 'ইতিহাস', 'de': 'Verlauf',
        'es': 'Historial', 'fr': 'Historique', 'gu': 'ઇતિહાસ', 'ja': '履歴',
        'ml': 'ചരിത്രം', 'mr': 'इतिहास', 'pt': 'Histórico', 'ta': 'வரலாறு',
        'te': 'చరిత్రం', 'zh': '历史',
    },
    'Logs': {
        'hi': 'लॉग', 'ar': 'السجلات', 'bn': 'লগ', 'de': 'Protokolle',
        'es': 'Registros', 'fr': 'Journaux', 'gu': 'લૉગ્સ', 'ja': 'ログ',
        'ml': 'ലോഗുകൾ', 'mr': 'लॉग', 'pt': 'Registros', 'ta': 'பதிவுகள்',
        'te': 'లాగ్‌లు', 'zh': '日志',
    },
    'Records': {
        'hi': 'रिकॉर्ड', 'ar': 'السجلات', 'bn': 'রেকর্ড', 'de': 'Datensätze',
        'es': 'Registros', 'fr': 'Enregistrements', 'gu': 'રેકોર્ડ્સ', 'ja': 'レコード',
        'ml': 'റെക്കോർഡുകൾ', 'mr': 'रेकॉर्ड', 'pt': 'Registros', 'ta': 'பதிவுகள்',
        'te': 'రికార్డులు', 'zh': '记录',
    },
}

# ========================
# DIRECT WORD MAP
# ========================
WORD_MAP = {
    # Common adjectives/nouns used in compound phrases
    "today": {"hi": "आज", "ar": "اليوم", "bn": "আজ", "de": "Heute", "es": "Hoy", "fr": "Aujourd'hui", "gu": "આજે", "ja": "本日", "ml": "ഇന്ന്", "mr": "आज", "pt": "Hoje", "ta": "இன்று", "te": "నేడు", "zh": "今天"},
    "yesterday": {"hi": "कल", "ar": "أمس", "bn": "গতকাল", "de": "Gestern", "es": "Ayer", "fr": "Hier", "gu": "ગઇકાલે", "ja": "昨日", "ml": "ഇന്നലെ", "mr": "काल", "pt": "Ontem", "ta": "நேற்று", "te": "నిన్న", "zh": "昨天"},
    "tomorrow": {"hi": "कल", "ar": "غداً", "bn": "আগামীকাল", "de": "Morgen", "es": "Mañana", "fr": "Demain", "gu": "કાલે", "ja": "明日", "ml": "നാളെ", "mr": "उद्या", "pt": "Amanhã", "ta": "நாளை", "te": "రేపు", "zh": "明天"},
    "new": {"hi": "नया", "ar": "جديد", "bn": "নতুন", "de": "Neu", "es": "Nuevo", "fr": "Nouveau", "gu": "નવું", "ja": "新規", "ml": "പുതിയ", "mr": "नवीन", "pt": "Novo", "ta": "புதிய", "te": "కొత్తింది", "zh": "新"},
    "overview": {"hi": "अवलोकन", "ar": "نظرة عامة", "bn": "ওভারভিউ", "de": "Übersicht", "es": "Resumen", "fr": "Aperçu", "gu": "ઓવરવ્યૂ", "ja": "概要", "ml": "അവലോകനം", "mr": "आढावा", "pt": "Visão geral", "ta": "நிலைப்பாடு", "te": "అవలోకనం", "zh": "概览"},
    "total": {"hi": "कुल", "ar": "الإجمالي", "bn": "মোট", "de": "Gesamt", "es": "Total", "fr": "Total", "gu": "કુલ", "ja": "合計", "ml": "മൊത്തം", "mr": "एकूण", "pt": "Total", "ta": "மொத்தஂ", "te": "మొత్తం", "zh": "总计"},
    "average": {"hi": "औसत", "ar": "المتوسط", "bn": "গড়", "de": "Durchschnitt", "es": "Promedio", "fr": "Moyenne", "gu": "સરેરાશ", "ja": "平均", "ml": "ശരാശരി", "mr": "सरासरी", "pt": "Média", "ta": "சராசரி", "te": "సగటి", "zh": "平均"},
    "type": {"hi": "प्रकार", "ar": "النوع", "bn": "ধরন", "de": "Typ", "es": "Tipo", "fr": "Type", "gu": "પ્રકાર", "ja": "タイプ", "ml": "തരം", "mr": "प्रकार", "pt": "Tipo", "ta": "வகை", "te": "రకం", "zh": "类型"},
    "date": {"hi": "तिथि", "ar": "التاريخ", "bn": "তারিখ", "de": "Datum", "es": "Fecha", "fr": "Date", "gu": "તારીખ", "ja": "日付", "ml": "തീയതി", "mr": "दिनांक", "pt": "Data", "ta": "தேதி", "te": "తేదీ", "zh": "日期"},
    "time": {"hi": "समय", "ar": "الوقت", "bn": "সময়", "de": "Zeit", "es": "Hora", "fr": "Heure", "gu": "સમય", "ja": "時間", "ml": "സമയം", "mr": "वेळ", "pt": "Hora", "ta": "நேரம்", "te": "సమయం", "zh": "时间"},
    "amount": {"hi": "राशि", "ar": "المبلغ", "bn": "পরিমাণ", "de": "Betrag", "es": "Monto", "fr": "Montant", "gu": "રકમ", "ja": "金額", "ml": "തുക", "mr": "रक्कम", "pt": "Valor", "ta": "தொகை", "te": "మొత్తం", "zh": "金额"},
    "count": {"hi": "गिनती", "ar": "العدد", "bn": "গণনা", "de": "Anzahl", "es": "Cantidad", "fr": "Nombre", "gu": "ગણતરી", "ja": "数", "ml": "എണ്ണം", "mr": "संख्या", "pt": "Contagem", "ta": "எண்ணிக்கை", "te": "గణన", "zh": "数量"},
    "percentage": {"hi": "प्रतिशत", "ar": "النسبة", "bn": "শতাংশ", "de": "Prozentsatz", "es": "Porcentaje", "fr": "Pourcentage", "gu": "ટકાવારી", "ja": "パーセント", "ml": "ശതമാനം", "mr": "टक्केवारी", "pt": "Percentual", "ta": "சதவீதம்", "te": "శాతం", "zh": "百分比"},
    "description": {"hi": "विवरण", "ar": "الوصف", "bn": "বিবরণ", "de": "Beschreibung", "es": "Descripción", "fr": "Description", "gu": "વર્ણન", "ja": "説明", "ml": "വിവരണം", "mr": "वर्णन", "pt": "Descrição", "ta": "விளக்கப்படுத்தல்", "te": "వివరణ", "zh": "描述"},
    "title": {"hi": "शीर्षक", "ar": "العنوان", "bn": "শিরোনাম", "de": "Titel", "es": "Título", "fr": "Titre", "gu": "શીર્ષક", "ja": "タイトル", "ml": "ശീർഷകം", "mr": "शीर्षक", "pt": "Título", "ta": "தலைப்பு", "te": "శీర్షిక", "zh": "标题"},
    "name": {"hi": "नाम", "ar": "الاسم", "bn": "নাম", "de": "Name", "es": "Nombre", "fr": "Nom", "gu": "નામ", "ja": "名前", "ml": "പേര്", "mr": "नाव", "pt": "Nome", "ta": "பெயர்", "te": "పేరు", "zh": "名称"},
    "phone": {"hi": "फ़ोन", "ar": "الهاتف", "bn": "ফোন", "de": "Telefon", "es": "Teléfono", "fr": "Téléphone", "gu": "ફોન", "ja": "電話", "ml": "ഫോൺ", "mr": "फोन", "pt": "Telefone", "ta": "தொலைப்பி", "te": "ఫోన్", "zh": "电话"},
    "address": {"hi": "पता", "ar": "العنوان", "bn": "ঠিকানা", "de": "Adresse", "es": "Dirección", "fr": "Adresse", "gu": "સરનામું", "ja": "住所", "ml": "വിലാസം", "mr": "पत्ता", "pt": "Endereço", "ta": "முகவரி", "te": "చిరునామా", "zh": "地址"},
    "city": {"hi": "शहर", "ar": "المدينة", "bn": "শহর", "de": "Stadt", "es": "Ciudad", "fr": "Ville", "gu": "શહેર", "ja": "都市", "ml": "നഗരം", "mr": "शहर", "pt": "Cidade", "ta": "நகரம்", "te": "నగరం", "zh": "城市"},
    "country": {"hi": "देश", "ar": "البلد", "bn": "দেশ", "de": "Land", "es": "País", "fr": "Pays", "gu": "દેશ", "ja": "国", "ml": "രാജ്യം", "mr": "देश", "pt": "País", "ta": "நாடு", "te": "దేశం", "zh": "国家"},
    "notes": {"hi": "टिप्पणियां", "ar": "ملاحظات", "bn": "নোট", "de": "Notizen", "es": "Notas", "fr": "Notes", "gu": "નોટ્સ", "ja": "メモ", "ml": "കുറിപ്പുകൾ", "mr": "टीप", "pt": "Notas", "ta": "குறிப்புகள்", "te": "గమనికలు", "zh": "备注"},
    "priority": {"hi": "प्राथमिकता", "ar": "الأولوية", "bn": "অগ্রাধিকার", "de": "Priorität", "es": "Prioridad", "fr": "Priorité", "gu": "પ્રાથમિકતા", "ja": "優先度", "ml": "മുൻഗണന", "mr": "प्राधान्य", "pt": "Prioridade", "ta": "முன்னுரிமை", "te": "ప్రాధాన్యత", "zh": "优先级"},
    "category": {"hi": "श्रेणी", "ar": "الفئة", "bn": "বিভাগ", "de": "Kategorie", "es": "Categoría", "fr": "Catégorie", "gu": "શ્રેણી", "ja": "カテゴリ", "ml": "വർഗ്ഗം", "mr": "श्रेणी", "pt": "Categoria", "ta": "வகை", "te": "వర్గం", "zh": "类别"},
    "source": {"hi": "स्रोत", "ar": "المصدر", "bn": "উৎস", "de": "Quelle", "es": "Fuente", "fr": "Source", "gu": "સ્ત્રોત", "ja": "ソース", "ml": "ഉറവിടം", "mr": "स्रोत", "pt": "Fonte", "ta": "மூലம்", "te": "మూలం", "zh": "来源"},
    "destination": {"hi": "गंतव्य", "ar": "الوجهة", "bn": "গন্তব্য", "de": "Ziel", "es": "Destino", "fr": "Destination", "gu": "ગંતવ્ય", "ja": "目的地", "ml": "ലക്ഷ്യസ്ഥാനം", "mr": "गंतव्य", "pt": "Destino", "ta": "இலக்கு", "te": "గమ్యం", "zh": "目的地"},
}


def try_pattern_translate(english, lang_code):
    """Try to translate using pattern rules."""
    for pattern, translations in PATTERNS.items():
        m = re.match(pattern, english, re.IGNORECASE)
        if m and lang_code in translations:
            template = translations[lang_code]
            # Handle suffix patterns specially
            if '{suffix}' in template:
                suffix_word = m.group(2) if m.lastindex >= 2 else ''
                suffix_trans = SUFFIX_MAP.get(suffix_word, {}).get(lang_code, suffix_word)
                return template.replace('{text}', m.group(1)).replace('{suffix}', suffix_trans)
            # Handle numbered patterns (like "Last 7 days")
            if '{1}' in template:
                return template.replace('{1}', m.group(1)).replace('{2}', m.group(2))
            return template.replace('{text}', m.group(1) if m.lastindex >= 1 else m.group(0))
    return None


def try_word_translate(english, lang_code):
    """Try direct word lookup."""
    lower = english.lower().strip()
    # Remove trailing punctuation for lookup
    clean = lower.rstrip('.,!?;:')
    if clean in WORD_MAP and lang_code in WORD_MAP[clean]:
        return WORD_MAP[clean][lang_code]
    # Also try capitalized version
    if english in WORD_MAP and lang_code in WORD_MAP[english]:
        return WORD_MAP[english][lang_code]
    return None


def smart_translate(en_data, lang_code):
    """Apply smart translation to all keys in a locale."""
    translated_data = {}
    total = 0
    auto_translated = 0
    
    for ns, ns_data in en_data.items():
        if ns.startswith('_'):
            translated_data[ns] = ns_data
            continue
        
        translated_ns = {}
        for key, val in ns_data.items():
            total += 1
            if not isinstance(val, str):
                translated_ns[key] = val
                continue
            
            # Skip values that look like placeholders, URLs, emails, code
            if val.startswith('http') or val.startswith('{') and val.endswith('}'):
                translated_ns[key] = val
                continue
            if re.match(r'^[\w.+-]+@[\w.-]+\.\w+$', val):
                translated_ns[key] = val
                continue
            
            # Try pattern-based translation
            t = try_pattern_translate(val, lang_code)
            if t:
                translated_ns[key] = t
                auto_translated += 1
                continue
            
            # Try direct word translation
            t = try_word_translate(val, lang_code)
            if t:
                translated_ns[key] = t
                auto_translated += 1
                continue
            
            # Keep English as fallback
            translated_ns[key] = val
        
        translated_data[ns] = translated_ns
    
    return translated_data, total, auto_translated


if __name__ == '__main__':
    lang = sys.argv[1] if len(sys.argv) > 1 else None
    all_langs = ['hi', 'ar', 'bn', 'de', 'es', 'fr', 'gu', 'ja', 'ml', 'mr', 'pt', 'ta', 'te', 'zh']
    langs = [lang] if lang else all_langs
    
    en = json.load(open(os.path.join(MSG_DIR, 'en.json')))
    
    total_all = 0
    translated_all = 0
    
    for lc in langs:
        lang_file = os.path.join(MSG_DIR, f'{lc}.json')
        lang_data = json.load(open(lang_file))
        
        # First pass: merge English-copied values with smart translations
        result, total, translated = smart_translate(en, lc)
        
        # Second pass: apply to actual locale data (only replace English copies)
        for ns in result:
            if ns.startswith('_'): continue
            if ns not in lang_data: continue
            for key, translated_val in result[ns].items():
                if lang_data[ns].get(key) == en[ns].get(key):
                    lang_data[ns][key] = translated_val
        
        with open(lang_file, 'w', encoding='utf-8') as f:
            json.dump(lang_data, f, ensure_ascii=False, indent=2)
        
        total_all += total
        translated_all += translated
        print(f'{lc}: {translated}/{total} pattern-matched ({translated/total*100:.1f}%)')
    
    print(f'\nTotal: {translated_all}/{total_all} auto-translated')
