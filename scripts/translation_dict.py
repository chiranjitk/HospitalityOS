#!/usr/bin/env python3
"""
Comprehensive translation dictionary for StaySuite Hospitality OS.
Covers common UI terms, hospitality domain terms, and standard phrases.
Used to bulk-translate locale JSON files.
"""

# Common UI terms translations
UI_TERMS = {
    # Actions
    "save": {"hi": "सहेजें", "ar": "حفظ", "bn": "সংরক্ষণ করুন", "de": "Speichern", "es": "Guardar", "fr": "Enregistrer", "gu": "સેવ કરો", "ja": "保存", "ml": "സേവ് ചെയ്യുക", "mr": "जतन करा", "pt": "Salvar", "ta": "சேமிக்கவும்", "te": "సేవ్ చేయండి", "zh": "保存"},
    "cancel": {"hi": "रद्द करें", "ar": "إلغاء", "bn": "বাতিল করুন", "de": "Abbrechen", "es": "Cancelar", "fr": "Annuler", "gu": "રદ કરો", "ja": "キャンセル", "ml": "റദ്ദാക്കുക", "mr": "रद्द करा", "pt": "Cancelar", "ta": "ரத்துசெய்க", "te": "రద్దు చేయండి", "zh": "取消"},
    "delete": {"hi": "हटाएं", "ar": "حذف", "bn": "মুছে ফেলুন", "de": "Löschen", "es": "Eliminar", "fr": "Supprimer", "gu": "ડિલીટ કરો", "ja": "削除", "ml": "ഇല്ലാതാക്കുക", "mr": "हटवा", "pt": "Excluir", "ta": "நீக்குக", "te": "తొలగించండి", "zh": "删除"},
    "edit": {"hi": "संपादित करें", "ar": "تعديل", "bn": "সম্পাদনা করুন", "de": "Bearbeiten", "es": "Editar", "fr": "Modifier", "gu": "ફેરફાર કરો", "ja": "編集", "ml": "എഡിറ്റുചെയ്യുക", "mr": "संपादित करा", "pt": "Editar", "ta": "திருத்துக", "te": "సవరించండి", "zh": "编辑"},
    "add": {"hi": "जोड़ें", "ar": "إضافة", "bn": "যোগ করুন", "de": "Hinzufügen", "es": "Añadir", "fr": "Ajouter", "gu": "ઉમેરો", "ja": "追加", "ml": "ചേർക്കുക", "mr": "जोडा", "pt": "Adicionar", "ta": "சேர்க்கவும்", "te": "జోడించండి", "zh": "添加"},
    "create": {"hi": "बनाएं", "ar": "إنشاء", "bn": "তৈরি করুন", "de": "Erstellen", "es": "Crear", "fr": "Créer", "gu": "બનાવો", "ja": "作成", "ml": "സൃഷ്ടിക്കുക", "mr": "तयार करा", "pt": "Criar", "ta": "உருவாக்குக", "te": "సృష్టించండి", "zh": "创建"},
    "update": {"hi": "अपडेट करें", "ar": "تحديث", "bn": "আপডেট করুন", "de": "Aktualisieren", "es": "Actualizar", "fr": "Mettre à jour", "gu": "અપડેટ કરો", "ja": "更新", "ml": "അപ്‌ഡേറ്റുചെയ്യുക", "mr": "अद्ययावत करा", "pt": "Atualizar", "ta": "புதுப்பிக்கவும்", "te": "అప్‌డేట్ చేయండి", "zh": "更新"},
    "search": {"hi": "खोजें", "ar": "بحث", "bn": "অনুসন্ধান করুন", "de": "Suchen", "es": "Buscar", "fr": "Rechercher", "gu": "શોધો", "ja": "検索", "ml": "തിരയുക", "mr": "शोधा", "pt": "Pesquisar", "ta": "தேடுக", "te": "వెతకండి", "zh": "搜索"},
    "filter": {"hi": "फ़िल्टर", "ar": "تصفية", "bn": "ফিল্টার", "de": "Filter", "es": "Filtrar", "fr": "Filtrer", "gu": "ફિલ્ટર", "ja": "フィルター", "ml": "ഫിൽട്ടർ", "mr": "फिल्टर", "pt": "Filtrar", "ta": "வடிகட்டுக", "te": "ఫిల్టర్", "zh": "筛选"},
    "export": {"hi": "एक्सपोर्ट", "ar": "تصدير", "bn": "এক্সপোর্ট", "de": "Exportieren", "es": "Exportar", "fr": "Exporter", "gu": "એક્સપોર્ટ", "ja": "エクスポート", "ml": "എക്സ്പോർട്ടുചെയ്യുക", "mr": "एक्स्पोर्ट", "pt": "Exportar", "ta": "ஏற்றுமதி செய்க", "te": "ఎగ్జిపోర్ట్", "zh": "导出"},
    "import": {"hi": "इम्पोर्ट", "ar": "استيراد", "bn": "ইম্পোর্ট", "de": "Importieren", "es": "Importar", "fr": "Importer", "gu": "ઇમ્પોર્ટ", "ja": "インポート", "ml": "ഇമ്പോർട്ടുചെയ്യുക", "mr": "इम्पोर्ट", "pt": "Importar", "ta": "இறக்குமதி செய்க", "te": "ఇంపోర్ట్", "zh": "导入"},
    "refresh": {"hi": "रिफ़्रेश", "ar": "تحديث", "bn": "রিফ্রেশ", "de": "Aktualisieren", "es": "Actualizar", "fr": "Actualiser", "gu": "રિફ્રેશ", "ja": "更新", "ml": "റിഫ്രഷ്", "mr": "रिफ्रेश", "pt": "Atualizar", "ta": "புதിയப்பிக்கவும்", "te": "రిఫ్రెష్", "zh": "刷新"},
    "loading": {"hi": "लोड हो रहा है...", "ar": "جاري التحميل...", "bn": "লোড হচ্ছে...", "de": "Wird geladen...", "es": "Cargando...", "fr": "Chargement...", "gu": "લોડ થઈ રહ્યું છે...", "ja": "読み込み中...", "ml": "ലോഡ് ചെയ്യുന്നു...", "mr": "लोड होत आहे...", "pt": "Carregando...", "ta": "ஏற்றுகிறது...", "te": "లోడ్ అవుతోంది...", "zh": "加载中..."},
    "noData": {"hi": "कोई डेटा उपलब्ध नहीं", "ar": "لا توجد بيانات", "bn": "কোনো তথ্য নেই", "de": "Keine Daten verfügbar", "es": "Sin datos", "fr": "Aucune donnée", "gu": "કોઈ ડેટા ઉપલબ્ધ નથી", "ja": "データなし", "ml": "ഡാറ്റ ലഭ്യമല്ല", "mr": "डेटा उपलब्ध नाही", "pt": "Sem dados", "ta": "தரவு இல்லை", "te": "డేటా లేదు", "zh": "暂无数据"},
    "confirm": {"hi": "पुष्टि करें", "ar": "تأكيد", "bn": "নিশ্চিত করুন", "de": "Bestätigen", "es": "Confirmar", "fr": "Confirmer", "gu": "પુષ્ટિ કરો", "ja": "確認", "ml": "സ്ഥിരീകരിക്കുക", "mr": "पुष्टी करा", "pt": "Confirmar", "ta": "உறுதிப்படுத்துக", "te": "నిర్ధారించండి", "zh": "确认"},
    "back": {"hi": "वापस", "ar": "رجوع", "bn": "পিছনে", "de": "Zurück", "es": "Volver", "fr": "Retour", "gu": "પાછા", "ja": "戻る", "ml": "തിരികെ", "mr": "मागे", "pt": "Voltar", "ta": "மீண்டும்", "te": "వెనుకకు", "zh": "返回"},
    "submit": {"hi": "जमा करें", "ar": "إرسال", "bn": "জমা দিন", "de": "Absenden", "es": "Enviar", "fr": "Soumettre", "gu": "સબમિટ કરો", "ja": "送信", "ml": "സമർപ്പിക്കുക", "mr": "सबमिट करा", "pt": "Enviar", "ta": "சமர்ப்பிக்கவும்", "te": "సబ్మిట్ చేయండి", "zh": "提交"},
    "reset": {"hi": "रीसेट", "ar": "إعادة تعيين", "bn": "রিসেট", "de": "Zurücksetzen", "es": "Restablecer", "fr": "Réinitialiser", "gu": "રિસેટ", "ja": "リセット", "ml": "റീസെറ്റ്", "mr": "रीसेट", "pt": "Redefinir", "ta": "மீண்டமைக்கவும்", "te": "రీసెట్", "zh": "重置"},
    "clear": {"hi": "साफ़ करें", "ar": "مسح", "bn": "মুছুন", "de": "Löschen", "es": "Limpiar", "fr": "Effacer", "gu": "ક્લિયર કરો", "ja": "クリア", "ml": "മായ്ക്കുക", "mr": "साफ करा", "pt": "Limpar", "ta": "அழிக்கவும்", "te": "క్లియర్", "zh": "清除"},
    "close": {"hi": "बंद करें", "ar": "إغلاق", "bn": "বন্ধ করুন", "de": "Schließen", "es": "Cerrar", "fr": "Fermer", "gu": "બંધ કરો", "ja": "閉じる", "ml": "അടയ്ക്കുക", "mr": "बंद करा", "pt": "Fechar", "ta": "மூടுக", "te": "మూసివేయండి", "zh": "关闭"},
    "view": {"hi": "देखें", "ar": "عرض", "bn": "দেখুন", "de": "Anzeigen", "es": "Ver", "fr": "Afficher", "gu": "જુઓ", "ja": "表示", "ml": "കാണുക", "mr": "पहा", "pt": "Visualizar", "ta": "காட்டவும்", "te": "చూడండి", "zh": "查看"},
    "download": {"hi": "डाउनलोड", "ar": "تنزيل", "bn": "ডাউনলোড", "de": "Herunterladen", "es": "Descargar", "fr": "Télécharger", "gu": "ડાઉનલોડ", "ja": "ダウンロード", "ml": "ഡൗൺലോഡ്", "mr": "डाउनलोड", "pt": "Baixar", "ta": "பதிவிறக்கவும்", "te": "డౌన్‌లోడ్", "zh": "下载"},
    "upload": {"hi": "अपलोड", "ar": "رفع", "bn": "আপলোড", "de": "Hochladen", "es": "Subir", "fr": "Télécharger", "gu": "અપલોડ", "ja": "アップロード", "ml": "അപ്‌ലോഡ്", "mr": "अपलोड", "pt": "Enviar", "ta": "பதிவேற்றவும்", "te": "అప్‌లోడ్", "zh": "上传"},
    "copy": {"hi": "कॉपी", "ar": "نسخ", "bn": "কপি", "de": "Kopieren", "es": "Copiar", "fr": "Copier", "gu": "કોપી", "ja": "コピー", "ml": "കോപ്പി", "mr": "कॉपी", "pt": "Copiar", "ta": "நகലெடுக்கவும்", "te": "కాపీ", "zh": "复制"},
    "select": {"hi": "चुनें", "ar": "تحديد", "bn": "নির্বাচন করুন", "de": "Auswählen", "es": "Seleccionar", "fr": "Sélectionner", "gu": "પસંદ કરો", "ja": "選択", "ml": "തിരഞ്ഞെടുക്കുക", "mr": "निवडा", "pt": "Selecionar", "ta": "தேர்ந்தெடுக்கவும்", "te": "ఎంచుకోండి", "zh": "选择"},
    "selectAll": {"hi": "सभी चुनें", "ar": "تحديد الكل", "bn": "সব নির্বাচন করুন", "de": "Alle auswählen", "es": "Seleccionar todo", "fr": "Tout sélectionner", "gu": "બધા પસંદ કરો", "ja": "すべて選択", "ml": "എല്ലാം തിരഞ്ഞെടുക്കുക", "mr": "सर्व निवडा", "pt": "Selecionar tudo", "ta": "அனைத்தையும் தேர்ந்தெடுக்கவும்", "te": "అన్నీ ఎంచుకోండి", "zh": "全选"},
    "actions": {"hi": "कार्रवाई", "ar": "إجراءات", "bn": "কার্যক্রম", "de": "Aktionen", "es": "Acciones", "fr": "Actions", "gu": "ક્રિયાઓ", "ja": "アクション", "ml": "പ്രവർത്തനങ്ങൾ", "mr": "क्रिया", "pt": "Ações", "ta": "செயல்கள்", "te": "చర్యలు", "zh": "操作"},
    "status": {"hi": "स्थिति", "ar": "الحالة", "bn": "স্থিতি", "de": "Status", "es": "Estado", "fr": "Statut", "gu": "સ્થિતિ", "ja": "ステータス", "ml": "നില", "mr": "स्थिती", "pt": "Status", "ta": "நிலை", "te": "స్థితి", "zh": "状态"},
    "details": {"hi": "विवरण", "ar": "التفاصيل", "bn": "বিস্তারিত", "de": "Details", "es": "Detalles", "fr": "Détails", "gu": "વિગતો", "ja": "詳細", "ml": "വിശദാംശങ്ങൾ", "mr": "तपशील", "pt": "Detalhes", "ta": "விவரங்கள்", "te": "వివరాలు", "zh": "详情"},
    "settings": {"hi": "सेटिंग्स", "ar": "الإعدادات", "bn": "সেটিংস", "de": "Einstellungen", "es": "Configuración", "fr": "Paramètres", "gu": "સેટિંગ્સ", "ja": "設定", "ml": "ക്രമീകരണം", "mr": "सेटिंग्ज", "pt": "Configurações", "ta": "அமைப்புகள்", "te": "సెట్టింగ్‌లు", "zh": "设置"},
    "help": {"hi": "सहायता", "ar": "مساعدة", "bn": "সাহায্য", "de": "Hilfe", "es": "Ayuda", "fr": "Aide", "gu": "સહાય", "ja": "ヘルプ", "ml": "സഹായം", "mr": "मदत", "pt": "Ajuda", "ta": "உதவி", "te": "సహాయం", "zh": "帮助"},
    "error": {"hi": "त्रुटि", "ar": "خطأ", "bn": "ত্রুটি", "de": "Fehler", "es": "Error", "fr": "Erreur", "gu": "ભૂલ", "ja": "エラー", "ml": "പിശക്", "mr": "त्रुटी", "pt": "Erro", "ta": "பிழை", "te": "లోపం", "zh": "错误"},
    "success": {"hi": "सफलता", "ar": "نجاح", "bn": "সফল", "de": "Erfolg", "es": "Éxito", "fr": "Succès", "gu": "સફળતા", "ja": "成功", "ml": "വിജയം", "mr": "यशस्सी", "pt": "Sucesso", "ta": "வெற்றி", "te": "విజయం", "zh": "成功"},
    "warning": {"hi": "चेतावनी", "ar": "تحذير", "bn": "সতর্কতা", "de": "Warnung", "es": "Advertencia", "fr": "Avertissement", "gu": "ચેતવણી", "ja": "警告", "ml": "മുന്നറിപ്പ്", "mr": "चेतावणी", "pt": "Aviso", "ta": "எচ்சரிக்கை", "te": "హెచ్చరిక", "zh": "警告"},
    "info": {"hi": "जानकारी", "ar": "معلومات", "bn": "তথ্য", "de": "Info", "es": "Información", "fr": "Info", "gu": "માહિતી", "ja": "情報", "ml": "വിവരം", "mr": "माहिती", "pt": "Informação", "ta": "தகவல்", "te": "సమాచారం", "zh": "信息"},
    "yes": {"hi": "हाँ", "ar": "نعم", "bn": "হ্যাঁ", "de": "Ja", "es": "Sí", "fr": "Oui", "gu": "હા", "ja": "はい", "ml": "അതെ", "mr": "होय", "pt": "Sim", "ta": "ஆம்", "te": "అవును", "zh": "是"},
    "no": {"hi": "नहीं", "ar": "لا", "bn": "না", "de": "Nein", "es": "No", "fr": "Non", "gu": "ના", "ja": "いいえ", "ml": "ഇല്ല", "mr": "नाही", "pt": "Não", "ta": "இல்லை", "te": "కాదు", "zh": "否"},
    "all": {"hi": "सभी", "ar": "الكل", "bn": "সব", "de": "Alle", "es": "Todos", "fr": "Tous", "gu": "બધા", "ja": "すべて", "ml": "എല്ലാം", "mr": "सर्व", "pt": "Todos", "ta": "அனைத்தும்", "te": "అన్నీ", "zh": "全部"},
    "none": {"hi": "कोई नहीं", "ar": "لا شيء", "bn": "কিছু না", "de": "Keine", "es": "Ninguno", "fr": "Aucun", "gu": "કોઈ નહીં", "ja": "なし", "ml": "ഒന്നുമില്ല", "mr": "कोणीही नाही", "pt": "Nenhum", "ta": "எதுவுமில்லை", "te": "ఏదీ లేదు", "zh": "无"},
    "enabled": {"hi": "सक्षम", "ar": "مفعّل", "bn": "সক্রিয", "de": "Aktiviert", "es": "Activado", "fr": "Activé", "gu": "સક્ષમ", "ja": "有効", "ml": "പ്രാപ്തമാക്കി", "mr": "सक्षम", "pt": "Ativado", "ta": "இயக்கப்பட்டது", "te": "ప్రాప్యం", "zh": "已启用"},
    "disabled": {"hi": "अक्षम", "ar": "معطّل", "bn": "নিষ্ক্রিয়", "de": "Deaktiviert", "es": "Desactivado", "fr": "Désactivé", "gu": "અક્ષમ", "ja": "無効", "ml": "പ്രാപ്തമാക്കാത്തത്", "mr": "अक्षम", "pt": "Desativado", "ta": "முடక்கப்பட்டது", "te": "అప్రాప్యం", "zh": "已禁用"},
    "active": {"hi": "सक्रिय", "ar": "نشط", "bn": "সক্রিয়", "de": "Aktiv", "es": "Activo", "fr": "Actif", "gu": "સક્રિય", "ja": "アクティブ", "ml": "സജീവം", "mr": "सक्रिय", "pt": "Ativo", "ta": "செயലிலுள்ளது", "te": "యాక్టివ్", "zh": "活跃"},
    "inactive": {"hi": "निष्क्रिय", "ar": "غير نشط", "bn": "নিষ্ক্রিয়", "de": "Inaktiv", "es": "Inactivo", "fr": "Inactif", "gu": "નિષ્ક્રિય", "ja": "非アクティブ", "ml": "നിഷ്ക്രിയം", "mr": "निष्क्रिय", "pt": "Inativo", "ta": "செயலற്റது", "te": "యాక్టివ్ కాదు", "zh": "未激活"},
    "pending": {"hi": "लंबित", "ar": "معلّق", "bn": "মুলতবি", "de": "Ausstehend", "es": "Pendiente", "fr": "En attente", "gu": "પેન્ડિંગ", "ja": "保留中", "ml": "വായിലെ", "mr": "प्रलंबित", "pt": "Pendente", "ta": "நிலுவையில்", "te": "పెండింగ్", "zh": "待处理"},
    "inProgress": {"hi": "प्रगति में", "ar": "قيد التنفيذ", "bn": "চলমান", "de": "In Bearbeitung", "es": "En progreso", "fr": "En cours", "gu": "પ્રગતિમાં", "ja": "進行中", "ml": "പുരോഗതിയിൽ", "mr": "प्रगतीत", "pt": "Em andamento", "ta": "நடைపெறുகிறது", "te": "ప్రోగ్రెస్‌లో ఉంది", "zh": "进行中"},
    "completed": {"hi": "पूर्ण", "ar": "مكتمل", "bn": "সম্পন্ন", "de": "Abgeschlossen", "es": "Completado", "fr": "Terminé", "gu": "પૂર્ણ", "ja": "完了", "ml": "പൂർത്തിയായി", "mr": "पूर्ण", "pt": "Concluído", "ta": "முടிந்தது", "te": "పూర్తయైంది", "zh": "已完成"},
    "profile": {"hi": "प्रोफ़ाइल", "ar": "الملف الشخصي", "bn": "প্রোফাইল", "de": "Profil", "es": "Perfil", "fr": "Profil", "gu": "પ્રોફાઇલ", "ja": "プロフィール", "ml": "പ്രൊഫൈൽ", "mr": "प्रोफाइल", "pt": "Perfil", "ta": "சுயവிவரம்", "te": "ప్రొఫైల్", "zh": "个人资料"},
    "notifications": {"hi": "सूचनाएं", "ar": "الإشعارات", "bn": "বিজ্ঞপ্তি", "de": "Benachrichtigungen", "es": "Notificaciones", "fr": "Notifications", "gu": "નોટિફિકેશનો", "ja": "通知", "ml": "അറിയിപ്പുകൾ", "mr": "सूचना", "pt": "Notificações", "ta": "அறிவிப்புகள்", "te": "నోటిఫికేషన్లు", "zh": "通知"},
    "language": {"hi": "भाषा", "ar": "اللغة", "bn": "ভাষা", "de": "Sprache", "es": "Idioma", "fr": "Langue", "gu": "ભાષા", "ja": "言語", "ml": "ഭാഷ", "mr": "भाषा", "pt": "Idioma", "ta": "மொழி", "te": "భాష", "zh": "语言"},
    "theme": {"hi": "थीम", "ar": "السمة", "bn": "থিম", "de": "Design", "es": "Tema", "fr": "Thème", "gu": "થીમ", "ja": "テーマ", "ml": "തീം", "mr": "थीम", "pt": "Tema", "ta": "தீம்", "te": "థీమ్", "zh": "主题"},
    "logout": {"hi": "लॉगआउट", "ar": "تسجيل الخروج", "bn": "লগআউট", "de": "Abmelden", "es": "Cerrar sesión", "fr": "Déconnexion", "gu": "લૉગઆઉટ", "ja": "ログアウト", "ml": "ലോഗ്‌ഔട്ട്", "mr": "लॉगआउट", "pt": "Sair", "ta": "வெளியேறுக", "te": "లాగ్అవుట్", "zh": "退出"},
    "login": {"hi": "लॉगिन", "ar": "تسجيل الدخول", "bn": "লগইন", "de": "Anmelden", "es": "Iniciar sesión", "fr": "Connexion", "gu": "લૉગિન", "ja": "ログイン", "ml": "ലോഗിൻ", "mr": "लॉगिन", "pt": "Entrar", "ta": "உள்நுழைக", "te": "లాగిన్", "zh": "登录"},
    "email": {"hi": "ईमेल", "ar": "البريد الإلكتروني", "bn": "ইমেল", "de": "E-Mail", "es": "Correo", "fr": "E-mail", "gu": "ઇમેલ", "ja": "メール", "ml": "ഇമെയിൽ", "mr": "ईमेल", "pt": "E-mail", "ta": "மின்னஞ்சல்", "te": "ఇమెయిల్", "zh": "邮箱"},
    "password": {"hi": "पासवर्ड", "ar": "كلمة المرور", "bn": "পাসওয়ার্ড", "de": "Passwort", "es": "Contraseña", "fr": "Mot de passe", "gu": "પાસવર્ડ", "ja": "パスワード", "ml": "പാസ്‌വേഡ്", "mr": "पासवर्ड", "pt": "Senha", "ta": "கடவுச்சொல்", "te": "పాస్‌వర్డ్", "zh": "密码"},
    "name": {"hi": "नाम", "ar": "الاسم", "bn": "নাম", "de": "Name", "es": "Nombre", "fr": "Nom", "gu": "નામ", "ja": "名前", "ml": "പേര്", "mr": "नाव", "pt": "Nome", "ta": "பெயர்", "te": "పేరు", "zh": "姓名"},
    "description": {"hi": "विवरण", "ar": "الوصف", "bn": "বিবরণ", "de": "Beschreibung", "es": "Descripción", "fr": "Description", "gu": "વર્ણન", "ja": "説明", "ml": "വിവരണം", "mr": "वर्णन", "pt": "Descrição", "ta": "விளക്കப்படுத്തல்", "te": "వివరణ", "zh": "描述"},
}

# Status terms
STATUS_TERMS = {
    "confirmed": {"hi": "पुष्टि", "ar": "مؤكد", "bn": "নিশ্চিত", "de": "Bestätigt", "es": "Confirmado", "fr": "Confirmé", "gu": "પુષ્ટિ", "ja": "確認済み", "ml": "സ്ഥിരീകരിച്ചു", "mr": "पुष्टी", "pt": "Confirmado", "ta": "உறுதிப்படுத்தப்பட்டது", "te": "నిర్ధారించబడింది", "zh": "已确认"},
    "cancelled": {"hi": "रद्द", "ar": "ملغى", "bn": "বাতিল", "de": "Storniert", "es": "Cancelado", "fr": "Annulé", "gu": "રદ થયેલ", "ja": "キャンセル済み", "ml": "റദ്ദാക്കപ്പെട്ടു", "mr": "रद्द केले", "pt": "Cancelado", "ta": "ரத்துசெய்யப்பட்டது", "te": "రద్దు చేయబడింది", "zh": "已取消"},
    "checkedIn": {"hi": "चेक-इन", "ar": "تم تسجيل الدخول", "bn": "চেক-ইন", "de": "Eingecheckt", "es": "Registrado", "fr": "Enregistré", "gu": "ચેક-ઇન", "ja": "チェックイン済み", "ml": "ചെക്ക്-ഇൻ", "mr": "चेक-इन", "pt": "Check-in", "ta": "செக்-இன்", "te": "చెక్-ఇన్", "zh": "已入住"},
    "checkedOut": {"hi": "चेक-आउट", "ar": "تم تسجيل الخروج", "bn": "চেক-আউট", "de": "Ausgecheckt", "es": "Registrado salida", "fr": "Départ", "gu": "ચેક-આઉટ", "ja": "チェックアウト済み", "ml": "ചെക്ക്-ഔട്ട്", "mr": "चेक-आउट", "pt": "Check-out", "ta": "செக்-அவுட்", "te": "చెక్-అవుట్", "zh": "已退房"},
    "noShow": {"hi": "नो-शो", "ar": "عدم الحضور", "bn": "নো-শো", "de": "Nicht erschienen", "es": "No show", "fr": "No-show", "gu": "નો-શો", "ja": "ノーショー", "ml": "വന്നില്ല", "mr": "नो-शो", "pt": "No-show", "ta": "வராதவர்", "te": "నో-షో", "zh": "未到"},
    "occupied": {"hi": "अधिकृत", "ar": "مشغول", "bn": "দখল", "de": "Belegt", "es": "Ocupado", "fr": "Occupé", "gu": "રોકાયેલ", "ja": "使用中", "ml": "കയ്യിലുള്ളത്", "mr": "व्याप्त", "pt": "Ocupado", "ta": "ஆக்ரமிக்கப்பட்டது", "te": "ఆక్రమించబడింది", "zh": "已占用"},
    "available": {"hi": "उपलब्ध", "ar": "متاح", "bn": "পাওয়া যায়", "de": "Verfügbar", "es": "Disponible", "fr": "Disponible", "gu": "ઉપલબ્ધ", "ja": "利用可能", "ml": "ലഭ്യം", "mr": "उपलब्ध", "pt": "Disponível", "ta": "கிடைக்கும்", "te": "అందుబాటులో ఉంది", "zh": "可用"},
    "maintenance": {"hi": "रखरखाव", "ar": "صيانة", "bn": "রক্ষণাবেক্ষণ", "de": "Wartung", "es": "Mantenimiento", "fr": "Maintenance", "gu": "જાળવણી", "ja": "メンテナンス", "ml": "പരിപാലനം", "mr": "देखभाल", "pt": "Manutenção", "ta": "பராமரிப்பு", "te": "నిర్వహణ", "zh": "维护中"},
    "cleaning": {"hi": "सफ़ाई", "ar": "تنظيف", "bn": "পরিষ্কার", "de": "Reinigung", "es": "Limpieza", "fr": "Nettoyage", "gu": "સફાઈ", "ja": "清掃中", "ml": "വൃത്തി", "mr": "स्वछता", "pt": "Limpeza", "ta": "சுத்தம்", "te": "శుభ్రపరచడం", "zh": "清洁中"},
    "reserved": {"hi": "आरक्षित", "ar": "محجوز", "bn": "সংরক্ষিত", "de": "Reserviert", "es": "Reservado", "fr": "Réservé", "gu": "આરક્ષિત", "ja": "予約済み", "ml": "റിസർവ് ചെയ്തത്", "mr": "आरक्षित", "pt": "Reservado", "ta": "ஒப்புக்கொள்ளப்பட்டது", "te": "రిజర్వ్ చేయబడింది", "zh": "已预留"},
    "paid": {"hi": "भुगतान किया", "ar": "مدفوع", "bn": "পরিশোধিত", "de": "Bezahlt", "es": "Pagado", "fr": "Payé", "gu": "ચુકવણી થયેલ", "ja": "支払済み", "ml": "പണം നൽകിയ", "mr": "पैसे दिले", "pt": "Pago", "ta": "செலுத்தியது", "te": "చెల్లించబడింది", "zh": "已付款"},
    "unpaid": {"hi": "अवैतनिक", "ar": "غير مدفوع", "bn": "অপরিশোধিত", "de": "Unbezahlt", "es": "Sin pagar", "fr": "Non payé", "gu": "અચુકવાયેલ", "ja": "未払い", "ml": "അടയ്ക്കാത്തത്", "mr": "विनापकरण", "pt": "Não pago", "ta": "செலுத்தாதது", "te": "చెల్లించని", "zh": "未付款"},
    "refunded": {"hi": "धनवापसी", "ar": "مسترد", "bn": "ফেরত", "de": "Erstattet", "es": "Reembolsado", "fr": "Remboursé", "gu": "રિફન્ડ", "ja": "返金済み", "ml": "തിരിച്ചു നൽകിയ", "mr": "परत केले", "pt": "Reembolsado", "ta": "திருப்பி செலுத்தியது", "te": "రీఫండ్ చేయబడింది", "zh": "已退款"},
    "expired": {"hi": "समय सीमा समाप्त", "ar": "منتهي الصلاحية", "bn": "মেয়াদোত্তীর্ণ", "de": "Abgelaufen", "es": "Expirado", "fr": "Expiré", "gu": "સમાપ્ત", "ja": "期限切れ", "ml": "കാലാവധി കഴിഞ്ഞത്", "mr": "कालबाह्य", "pt": "Expirado", "ta": "காலாவதியானது", "te": "గడువు ముగిసింది", "zh": "已过期"},
    "delivered": {"hi": "वितरित", "ar": "تم التسليم", "bn": "বিতরণ করা হয়েছে", "de": "Geliefert", "es": "Entregado", "fr": "Livré", "gu": "પહોંચાડેલ", "ja": "配達済み", "ml": "എത്തിച്ചേർന്നത്", "mr": "वितरित", "pt": "Entregue", "ta": "வழங்கப்பட்டது", "te": "అందించబడింది", "zh": "已送达"},
    "failed": {"hi": "विफल", "ar": "فشل", "bn": "ব্যর্থ", "de": "Fehlgeschlagen", "es": "Fallido", "fr": "Échoué", "gu": "નિષ્ફળ", "ja": "失敗", "ml": "പരാജയപ്പെട്ടു", "mr": "अयशस्वी", "pt": "Falhou", "ta": "தோল്വியடைந்தது", "te": "విఫలమైంది", "zh": "失败"},
}

# Domain-specific terms
DOMAIN_TERMS = {
    "check-in": {"hi": "चेक-इन", "ar": "تسجيل الوصول", "bn": "চেক-ইন", "de": "Check-in", "es": "Registro", "fr": "Enregistrement", "gu": "ચેક-ઇન", "ja": "チェックイン", "ml": "ചെക്ക്-ഇൻ", "mr": "चेक-इन", "pt": "Check-in", "ta": "செக்-இன்", "te": "చెక్-ఇన్", "zh": "入住"},
    "check-out": {"hi": "चेक-आउट", "ar": "تسجيل المغادرة", "bn": "চেক-আউট", "de": "Check-out", "es": "Salida", "fr": "Départ", "gu": "ચેક-આઉટ", "ja": "チェックアウト", "ml": "ചെക്ക്-ഔട്ട്", "mr": "चेक-आउट", "pt": "Check-out", "ta": "செக்-அவுட்", "te": "చెక్-అవుట్", "zh": "退房"},
    "booking": {"hi": "बुकिंग", "ar": "حجز", "bn": "বুকিংগ", "de": "Buchung", "es": "Reserva", "fr": "Réservation", "gu": "બુકિંગ", "ja": "予約", "ml": "ബുക്കിംഗ്", "mr": "बुकिंग", "pt": "Reserva", "ta": "முந்நீர்", "te": "బుకింగ్", "zh": "预订"},
    "reservation": {"hi": "आरक्षण", "ar": "حجز", "bn": "সংরক্ষণ", "de": "Reservierung", "es": "Reservación", "fr": "Réservation", "gu": "આરક્ષણ", "ja": "予約", "ml": "റിസർവേഷൻ", "mr": "आरक्षण", "pt": "Reserva", "ta": "முந்நீர்", "te": "రిజర్వేషన్", "zh": "预订"},
    "guest": {"hi": "अतिथि", "ar": "ضيف", "bn": "অতিথি", "de": "Gast", "es": "Huésped", "fr": "Client", "gu": "મહેમાન", "ja": "ゲスト", "ml": "അതിഥി", "mr": "पाहुणा", "pt": "Hóspede", "ta": "விருந்தினர்", "te": "అతిథి", "zh": "客人"},
    "room": {"hi": "कमरा", "ar": "غرفة", "bn": "কক্ষ", "de": "Zimmer", "es": "Habitación", "fr": "Chambre", "gu": "રૂમ", "ja": "部屋", "ml": "മുറി", "mr": "खोली", "pt": "Quarto", "ta": "அறை", "te": "గది", "zh": "房间"},
    "property": {"hi": "प्रॉपर्टी", "ar": "الممتلكات", "bn": "সম্পত্তি", "de": "Eigenschaft", "es": "Propiedad", "fr": "Établissement", "gu": "પ્રોપર્ટી", "ja": "物件", "ml": "സ്വത്ത്", "mr": "मालमत्ता", "pt": "Propriedade", "ta": "சொத்து", "te": "ఆస్తి", "zh": "物业"},
    "rate": {"hi": "दर", "ar": "السعر", "bn": "হার", "de": "Rate", "es": "Tarifa", "fr": "Tarif", "gu": "દર", "ja": "レート", "ml": "നിരകം", "mr": "दर", "pt": "Tarifa", "ta": "விலை", "te": "రేటు", "zh": "费率"},
    "invoice": {"hi": "इनवॉइस", "ar": "فاتورة", "bn": "চালান", "de": "Rechnung", "es": "Factura", "fr": "Facture", "gu": "ઇન્વોઇસ", "ja": "請求書", "ml": "ഇൻവോയ്‌സ്", "mr": "बिल", "pt": "Fatura", "ta": "விலைப்பட்டியல்", "te": "ఇన్వాయిస్", "zh": "发票"},
    "payment": {"hi": "भुगतान", "ar": "الدفع", "bn": "পেমেন্ট", "de": "Zahlung", "es": "Pago", "fr": "Paiement", "gu": "ચુકવણી", "ja": "支払い", "ml": "പേയ്മെന്റ്", "mr": "पैसे", "pt": "Pagamento", "ta": "செலுத்தல்", "te": "చెల్లింపు", "zh": "支付"},
    "folio": {"hi": "फोलियो", "ar": "الملف", "bn": "ফোলিও", "de": "Konto", "es": "Folio", "fr": "Folio", "gu": "ફોલિયો", "ja": "フォリオ", "ml": "ഫോളിയോ", "mr": "फोलिओ", "pt": "Fólio", "ta": "பக்கம்", "te": "ఫోలియో", "zh": "账单"},
    "housekeeping": {"hi": "हाउसकीपिंग", "ar": "الخدمة الفندقية", "bn": "হাউসকিপিং", "de": "Zimmerreinigung", "es": "Servicio de habitación", "fr": "Ménage", "gu": "હાઉસકીપિંગ", "ja": "ハウスキーピング", "ml": "ഹൗസ്‌കീപ്പിംഗ്", "mr": "हाउसकीपिंग", "pt": "Arrumação", "ta": "வீட்டுப் பராமரிப்பு", "te": "హౌస్‌కీపింగ్", "zh": "客房服务"},
    "occupancy": {"hi": "ऑक्यूपेंसी", "ar": "الإشغال", "bn": "দখল", "de": "Belegung", "es": "Ocupación", "fr": "Taux d'occupation", "gu": "ઓક્યુપન્સી", "ja": "稼働率", "ml": "കയ്യേറ്റം", "mr": "ओक्युपन्सी", "pt": "Ocupação", "ta": "ஆக்ரமிப்பு", "te": "ఆక్రమణ రేటు", "zh": "入住率"},
    "revenue": {"hi": "राजस्व", "ar": "الإيرادات", "bn": "রাজস্ব", "de": "Umsatz", "es": "Ingresos", "fr": "Revenus", "gu": "આવક", "ja": "売上", "ml": "വരുമാനം", "mr": "उत्पन्न", "pt": "Receita", "ta": "வருமானம்", "te": "ఆదాయం", "zh": "收入"},
    "arrival": {"hi": "आगमन", "ar": "الوصول", "bn": "আগমন", "de": "Ankunft", "es": "Llegada", "fr": "Arrivée", "gu": "આગમન", "ja": "到着", "ml": "വരവ്", "mr": "आगमन", "pt": "Chegada", "ta": "வருகை", "te": "రాక", "zh": "到达"},
    "departure": {"hi": "प्रस्थान", "ar": "المغادرة", "bn": "প্রস্থান", "de": "Abreise", "es": "Salida", "fr": "Départ", "gu": "પ્રસ્થાન", "ja": "出発", "ml": "പോക്ക്", "mr": "प्रस्थान", "pt": "Partida", "ta": "புறப்பாடு", "te": "నిష్క్రమణ", "zh": "离店"},
    "night": {"hi": "रात्रि", "ar": "ليلة", "bn": "রাত", "de": "Nacht", "es": "Noche", "fr": "Nuit", "gu": "રાત", "ja": "泊", "ml": "രാത്രി", "mr": "रात्र", "pt": "Noite", "ta": "இரவு", "te": "రాత్రి", "zh": "晚"},
    "channel": {"hi": "चैनल", "ar": "القناة", "bn": "চ্যানেল", "de": "Kanal", "es": "Canal", "fr": "Canal", "gu": "ચેનલ", "ja": "チャネル", "ml": "ചാനൽ", "mr": "चॅनेल", "pt": "Canal", "ta": "சேனல்", "te": "ఛానెల్", "zh": "渠道"},
    "tenant": {"hi": "टेनेंट", "ar": "المستأجر", "bn": "টেন্যান্ট", "de": "Mandant", "es": "Inquilino", "fr": "Locataire", "gu": "ટેનન્ટ", "ja": "テナント", "ml": "ടെനന്റ്", "mr": "टेनंट", "pt": "Inquilino", "ta": "குடியிருப்பவர்", "te": "టెనెంట్", "zh": "租户"},
    "staff": {"hi": "स्टाफ़", "ar": "الموظفون", "bn": "কর্মী", "de": "Personal", "es": "Personal", "fr": "Personnel", "gu": "સ્ટાફ", "ja": "スタッフ", "ml": "സ്റ്റാഫ്", "mr": "कर्मचारी", "pt": "Equipe", "ta": "ஊழியர்கள்", "te": "స్టాఫ్", "zh": "员工"},
    "department": {"hi": "विभाग", "ar": "القسم", "bn": "বিভাগ", "de": "Abteilung", "es": "Departamento", "fr": "Département", "gu": "વિભાગ", "ja": "部門", "ml": "വകുപ്പ്", "mr": "विभाग", "pt": "Departamento", "ta": "துறை", "te": "విభాగం", "zh": "部门"},
    "report": {"hi": "रिपोर्ट", "ar": "تقرير", "bn": "রিপোর্ট", "de": "Bericht", "es": "Informe", "fr": "Rapport", "gu": "રિપોર્ટ", "ja": "レポート", "ml": "റിപ്പോർട്ട്", "mr": "अहवाल", "pt": "Relatório", "ta": "அறிக்கை", "te": "నివేదిక", "zh": "报告"},
    "dashboard": {"hi": "डैशबोर्ड", "ar": "لوحة التحكم", "bn": "ড্যাশবোর্ড", "de": "Dashboard", "es": "Panel", "fr": "Tableau de bord", "gu": "ડેશબોર્ડ", "ja": "ダッシュボード", "ml": "ഡാഷ്‌ബോർഡ്", "mr": "डॅशबोर्ड", "pt": "Painel", "ta": "டாஷ்போர்டு", "te": "డాష్‌బోర్డ్", "zh": "仪表盘"},
    "order": {"hi": "ऑर्डर", "ar": "طلب", "bn": "অর্ডার", "de": "Bestellung", "es": "Pedido", "fr": "Commande", "gu": "ઓર્ડર", "ja": "注文", "ml": "ഓർഡർ", "mr": "ऑर्डर", "pt": "Pedido", "ta": "உத்தரவு", "te": "ఆర్డర్", "zh": "订单"},
    "menu": {"hi": "मेन्यू", "ar": "القائمة", "bn": "মেনু", "de": "Menü", "es": "Menú", "fr": "Menu", "gu": "મેનુ", "ja": "メニュー", "ml": "മെനു", "mr": "मेनू", "pt": "Cardápio", "ta": "மெனு", "te": "మెనూ", "zh": "菜单"},
    "table": {"hi": "टेबल", "ar": "الطاولة", "bn": "টেবিল", "de": "Tisch", "es": "Mesa", "fr": "Table", "gu": "ટેબલ", "ja": "テーブル", "ml": "ടേബിൾ", "mr": "टेबल", "pt": "Mesa", "ta": "மேசை", "te": "టేబుల్", "zh": "餐桌"},
    "task": {"hi": "कार्य", "ar": "مهمة", "bn": "কাজ", "de": "Aufgabe", "es": "Tarea", "fr": "Tâche", "gu": "ટાસ્ક", "ja": "タスク", "ml": "ടാസ്ക്", "mr": "कार्य", "pt": "Tarefa", "ta": "பணி", "te": "టాస్క్", "zh": "任务"},
    "campaign": {"hi": "अभियान", "ar": "حملة", "bn": "অভিযান", "de": "Kampagne", "es": "Campaña", "fr": "Campagne", "gu": "કેમ્પેઇન", "ja": "キャンペーン", "ml": "കാമ്പെയ്ൻ", "mr": "मोहीम", "pt": "Campanha", "ta": "பிரச்சாரம்", "te": "క్యాంపేయిన్", "zh": "活动"},
    "automation": {"hi": "ऑटोमेशन", "ar": "أتمتة", "bn": "অটোমেশন", "de": "Automatisierung", "es": "Automatización", "fr": "Automatisation", "gu": "ઓટોમેશન", "ja": "オートメーション", "ml": "ഓട്ടോമേഷൻ", "mr": "ऑटोमेशन", "pt": "Automação", "ta": "தானியக்கമ்", "te": "ఆటోమేషన్", "zh": "自动化"},
    "integration": {"hi": "इंटीग्रेशन", "ar": "التكامل", "bn": "ইন্টিগ্রেশন", "de": "Integration", "es": "Integración", "fr": "Intégration", "gu": "ઇન્ટિગ્રેશન", "ja": "統合", "ml": "ഇന്റഗ്രേഷൻ", "mr": "इंटिग्रेशन", "pt": "Integração", "ta": "ஒருங்கிணைப்பு", "te": "ఇంటిగ్రేషన్", "zh": "集成"},
    "webhook": {"hi": "वेबहुक", "ar": "ويب هوك", "bn": "ওয়েবহুক", "de": "Webhook", "es": "Webhook", "fr": "Webhook", "gu": "વેબહુક", "ja": "Webhook", "ml": "വെബ്‌ഹുക്ക്", "mr": "वेबहुक", "pt": "Webhook", "ta": "வெப்ஹூக்", "te": "వెబ్‌హుక్", "zh": "Webhook"},
    "loyalty": {"hi": "लॉयल्टी", "ar": "الولاء", "bn": "লয়ালটি", "de": "Treue", "es": "Fidelización", "fr": "Fidélité", "gu": "લોયલ્ટી", "ja": "ロイヤルティ", "ml": "ലോയൽറ്റി", "mr": "लॉयल्टी", "pt": "Fidelidade", "ta": "விசுவலாட்டி", "te": "లాయల్టీ", "zh": "忠诚度"},
    "feedback": {"hi": "फ़ीडबैक", "ar": "التعليقات", "bn": "ফিডব্যাক", "de": "Feedback", "es": "Comentarios", "fr": "Commentaires", "gu": "ફીડબેક", "ja": "フィードバック", "ml": "ഫീഡ്‌ബാക്ക്", "mr": "फीडबॅक", "pt": "Feedback", "ta": "கருத்து", "te": "ఫీడ్‌బ్యాక్", "zh": "反馈"},
    "segment": {"hi": "सेगमेंट", "ar": "الشريحة", "bn": "সেগমেন্ট", "de": "Segment", "es": "Segmento", "fr": "Segment", "gu": "સેગમેન્ટ", "ja": "セグメント", "ml": "സെഗ്മെന്റ്", "mr": "सेगमेंट", "pt": "Segmento", "ta": "பிரிவு", "te": "సెగ్మెంట్", "zh": "细分"},
    "inventory": {"hi": "इन्वेंट्री", "ar": "المخزون", "bn": "ইনভেন্টরি", "de": "Bestand", "es": "Inventario", "fr": "Inventaire", "gu": "ઇન્વેન્ટરી", "ja": "在庫", "ml": "ഇൻവെൻറ്ററി", "mr": "इन्व्हेंटरी", "pt": "Inventário", "ta": "சரக்கு", "te": "ఇన్వెంటరీ", "zh": "库存"},
    "vendor": {"hi": "वेंडर", "ar": "المورد", "bn": "ভেন্ডর", "de": "Lieferant", "es": "Proveedor", "fr": "Fournisseur", "gu": "વેન્ડર", "ja": "仕入先", "ml": "വിതരണക്കാർ", "mr": "व्हेंडर", "pt": "Fornecedor", "ta": "விநியோகஸ்தர்", "te": "వెండర్", "zh": "供应商"},
    "purchase order": {"hi": "खरीद आदेश", "ar": "أمر شراء", "bn": "ক্রয়াদেশ", "de": "Bestellung", "es": "Orden de compra", "fr": "Bon de commande", "gu": "ખરીદી ઓર્ડર", "ja": "発注書", "ml": "വാങ്ങൽ ഓർഡർ", "mr": "खरेदी ऑर्डर", "pt": "Ordem de compra", "ta": "கொள்முதல் உத்தரவு", "te": "కొనుగోలు ఆర్డర్", "zh": "采购订单"},
    "shift": {"hi": "शिफ़्ट", "ar": "الوردية", "bn": "শিফট", "de": "Schicht", "es": "Turno", "fr": "Poste", "gu": "શિફ્ટ", "ja": "シフト", "ml": "ഷിഫ്റ്റ്", "mr": "शिफ्ट", "pt": "Turno", "ta": "சிப்பு", "te": "షిఫ్ట్", "zh": "班次"},
    "schedule": {"hi": "शेड्यूल", "ar": "الجدول", "bn": "সূচি", "de": "Zeitplan", "es": "Horario", "fr": "Planification", "gu": "શેડ્યુલ", "ja": "スケジュール", "ml": "ഷെഡ്യൂൾ", "mr": "वेळापत्रक", "pt": "Cronograma", "ta": "அட்டவணை", "te": "షెడ్యూల్", "zh": "日程"},
    "event": {"hi": "इवेंट", "ar": "الفعالية", "bn": "ইভেন্ট", "de": "Veranstaltung", "es": "Evento", "fr": "Événement", "gu": "ઇવેન્ટ", "ja": "イベント", "ml": "ഇവന്റ്", "mr": "इव्हेंट", "pt": "Evento", "ta": "நிகழ்வு", "te": "ఈవెంట్", "zh": "活动"},
    "parking": {"hi": "पार्किंग", "ar": "موقف السيارات", "bn": "পার্কিং", "de": "Parken", "es": "Estacionamiento", "fr": "Parking", "gu": "પાર્કિંગ", "ja": "駐車場", "ml": "പാർക്കിംഗ്", "mr": "पार्किंग", "pt": "Estacionamento", "ta": "நிறுத்துமிடம்", "te": "పార్కింగ్", "zh": "停车"},
    "security": {"hi": "सुरक्षा", "ar": "الأمن", "bn": "নিরাপত্তা", "de": "Sicherheit", "es": "Seguridad", "fr": "Sécurité", "gu": "સુરક્ષા", "ja": "セキュリティ", "ml": "സുരക്ഷ", "mr": "सुरक्षा", "pt": "Segurança", "ta": "பாதுகாப்பு", "te": "భద్రత", "zh": "安全"},
    "camera": {"hi": "कैमरा", "ar": "الكاميرا", "bn": "ক্যামেরা", "de": "Kamera", "es": "Cámara", "fr": "Caméra", "gu": "કેમેરા", "ja": "カメラ", "ml": "ക്യാമറ", "mr": "कॅमेऱा", "pt": "Câmera", "ta": "கேமரா", "te": "కెమెరా", "zh": "摄像头"},
    "incident": {"hi": "घटना", "ar": "حادثة", "bn": "ঘটনা", "de": "Vorfall", "es": "Incidente", "fr": "Incident", "gu": "ઘટના", "ja": "インシデント", "ml": "സംഭവം", "mr": "घटना", "pt": "Incidente", "ta": "சம்பவம்", "te": "సంఘటన", "zh": "事件"},
    "iot": {"hi": "IoT", "ar": "إنترنت الأشياء", "bn": "IoT", "de": "IoT", "es": "IoT", "fr": "IoT", "gu": "IoT", "ja": "IoT", "ml": "IoT", "mr": "IoT", "pt": "IoT", "ta": "IoT", "te": "IoT", "zh": "物联网"},
    "device": {"hi": "डिवाइस", "ar": "الجهاز", "bn": "ডিভাইস", "de": "Gerät", "es": "Dispositivo", "fr": "Appareil", "gu": "ડિવાઇસ", "ja": "デバイス", "ml": "ഡിവൈസ്", "mr": "डिव्हाइस", "pt": "Dispositivo", "ta": "சாதனம்", "te": "పరికరం", "zh": "设备"},
    "energy": {"hi": "एनर्जी", "ar": "الطاقة", "bn": "এনার্জি", "de": "Energie", "es": "Energía", "fr": "Énergie", "gu": "એનર્જી", "ja": "エネルギー", "ml": "എനർജി", "mr": "ऊर्जा", "pt": "Energia", "ta": "ஆற்றல்", "te": "శక్తి", "zh": "能源"},
    "wifi": {"hi": "वाई-फ़ाई", "ar": "واي فاي", "bn": "ওয়াই-ফাই", "de": "WLAN", "es": "WiFi", "fr": "WiFi", "gu": "વાઈ-ફાઈ", "ja": "WiFi", "ml": "വൈഫൈ", "mr": "वाय-फाय", "pt": "WiFi", "ta": "வைஃபை", "te": "వైఫై", "zh": "WiFi"},
    "network": {"hi": "नेटवर्क", "ar": "الشبكة", "bn": "নেটওয়ার্ক", "de": "Netzwerk", "es": "Red", "fr": "Réseau", "gu": "નેટવર્ક", "ja": "ネットワーク", "ml": "നെറ്റ്‌വർക്ക്", "mr": "नेटवर्क", "pt": "Rede", "ta": "நெட்வ௼க்", "te": "నెట్‌వర్క్", "zh": "网络"},
    "firewall": {"hi": "फ़ायरवॉल", "ar": "جدار الحماية", "bn": "ফায়ারওয়াল", "de": "Firewall", "es": "Cortafuegos", "fr": "Pare-feu", "gu": "ફાયરવોલ", "ja": "ファイアウォール", "ml": "ഫയർവാൾ", "mr": "फायरवॉल", "pt": "Firewall", "ta": "ஃபயர்வால்", "te": "ఫైర్‌వాల్", "zh": "防火墙"},
    "gateway": {"hi": "गेटवे", "ar": "البوابة", "bn": "গেটওয়ে", "de": "Gateway", "es": "Puerta de enlace", "fr": "Passerelle", "gu": "ગેટવે", "ja": "ゲートウェイ", "ml": "ഗേറ്റ്‌വേ", "mr": "गेटवे", "pt": "Gateway", "ta": "நுழைவாயில்", "te": "గేట్‌వే", "zh": "网关"},
    "session": {"hi": "सेशन", "ar": "الجلسة", "bn": "সেশন", "de": "Sitzung", "es": "Sesión", "fr": "Session", "gu": "સેશન", "ja": "セッション", "ml": "സെഷൻ", "mr": "सेशन", "pt": "Sessão", "ta": "அமர்வு", "te": "సెషన్", "zh": "会话"},
    "voucher": {"hi": "वाउचर", "ar": "قسيمة", "bn": "ভাউচার", "de": "Gutschein", "es": "Cupón", "fr": "Bon", "gu": "વાઉચર", "ja": "バウチャー", "ml": "വൗച്ചർ", "mr": "व्हाउचर", "pt": "Voucher", "ta": "சலாவணம்", "te": "వౌచర్", "zh": "代金券"},
    "plan": {"hi": "प्लान", "ar": "الخطة", "bn": "প্ল্যান", "de": "Plan", "es": "Plan", "fr": "Plan", "gu": "પ્લાન", "ja": "プラン", "ml": "പ്ലാൻ", "mr": "प्लॅन", "pt": "Plano", "ta": "திட்டம்", "te": "ప్లాన్", "zh": "方案"},
    "subscription": {"hi": "सब्सक्रिप्शन", "ar": "الاشتراك", "bn": "সাবস্ক্রিপশন", "de": "Abonnement", "es": "Suscripción", "fr": "Abonnement", "gu": "સબ્સ્ક્રિપ્શન", "ja": "サブスクリプション", "ml": "സബ്സ്ക്രിപ്ഷൻ", "mr": "सब्सक्रिप्शन", "pt": "Assinatura", "ta": "சந்தா", "te": "సబ్‌స్క్రిప్షన్", "zh": "订阅"},
    "chain": {"hi": "चेन", "ar": "السلسلة", "bn": "চেইন", "de": "Kette", "es": "Cadena", "fr": "Chaîne", "gu": "ચેઇન", "ja": "チェーン", "ml": "ചെയിൻ", "mr": "चेन", "pt": "Rede", "ta": "செயின்", "te": "చైన్", "zh": "连锁"},
    "brand": {"hi": "ब्रांड", "ar": "العلامة التجارية", "bn": "ব্র্যান্ড", "de": "Marke", "es": "Marca", "fr": "Marque", "gu": "બ્રાન્ડ", "ja": "ブランド", "ml": "ബ്രാൻഡ്", "mr": "ब्रँड", "pt": "Marca", "ta": "பெயர்", "te": "బ్రాండ్", "zh": "品牌"},
    "advertisement": {"hi": "विज्ञापन", "ar": "إعلان", "bn": "বিজ্ঞাপন", "de": "Werbung", "es": "Anuncio", "fr": "Publicité", "gu": "જાહેરાત", "ja": "広告", "ml": "പരസ്യം", "mr": "जाहिरात", "pt": "Anúncio", "ta": "விளம்பரம்", "te": "ప్రకటన", "zh": "广告"},
    "promotion": {"hi": "प्रमोशन", "ar": "عرض ترويجي", "bn": "প্রমোশন", "de": "Aktion", "es": "Promoción", "fr": "Promotion", "gu": "પ્રમોશન", "ja": "プロモーション", "ml": "പ്രമോഷൻ", "mr": "प्रमोशन", "pt": "Promoção", "ta": "சலுகை", "te": "ప్రమోషన్", "zh": "促销"},
    "reputation": {"hi": "प्रतिष्ठा", "ar": "السمعة", "bn": "খ্যাতি", "de": "Reputation", "es": "Reputación", "fr": "Réputation", "gu": "પ્રતિષ્ઠા", "ja": "レピュテーション", "ml": "പ്രശസ്തി", "mr": "प्रतिष्ठा", "pt": "Reputação", "ta": "நற்பேர்", "te": "ప్రతిష్ఠ", "zh": "声誉"},
    "gdpr": {"hi": "GDPR", "ar": "GDPR", "bn": "GDPR", "de": "DSGVO", "es": "RGPD", "fr": "RGPD", "gu": "GDPR", "ja": "GDPR", "ml": "GDPR", "mr": "GDPR", "pt": "LGPD", "ta": "GDPR", "te": "GDPR", "zh": "GDPR"},
    "audit": {"hi": "ऑडिट", "ar": "التدقيق", "bn": "অডিট", "de": "Audit", "es": "Auditoría", "fr": "Audit", "gu": "ઓડિટ", "ja": "監査", "ml": "ഓഡിറ്റ്", "mr": "ऑडिट", "pt": "Auditoria", "ta": "தணிக்கை", "te": "ఆడిట్", "zh": "审计"},
    "template": {"hi": "टेम्पलेट", "ar": "قالب", "bn": "টেমপ্লেট", "de": "Vorlage", "es": "Plantilla", "fr": "Modèle", "gu": "ટેમ્પલેટ", "ja": "テンプレート", "ml": "ടെമ്പ്ലേറ്റ്", "mr": "टेम्प्लेट", "pt": "Modelo", "ta": "வார்ப்புரு", "te": "టెంప్లేట్", "zh": "模板"},
    "workflow": {"hi": "वर्कफ़्लो", "ar": "سير العمل", "bn": "ওয়ার্কফ্লো", "de": "Workflow", "es": "Flujo de trabajo", "fr": "Workflow", "gu": "વર્કફ્લો", "ja": "ワークフロー", "ml": "വർക്ക്ഫ്ലോ", "mr": "वर्कफ्लो", "pt": "Fluxo de trabalho", "ta": "பணிப்பாய்வு", "te": "వర్క్‌ఫ్లో", "zh": "工作流"},
    "permission": {"hi": "अनुमति", "ar": "الصلاحية", "bn": "অনুমতি", "de": "Berechtigung", "es": "Permiso", "fr": "Permission", "gu": "પરવાનગી", "ja": "権限", "ml": "അനുവാദം", "mr": "परवानगी", "pt": "Permissão", "ta": "அனுமதி", "te": "అనుమతి", "zh": "权限"},
    "role": {"hi": "भूमिका", "ar": "الدور", "bn": "ভূমিকা", "de": "Rolle", "es": "Rol", "fr": "Rôle", "gu": "ભૂમિકા", "ja": "ロール", "ml": "റോൾ", "mr": "भूमिका", "pt": "Função", "ta": "பங்கு", "te": "పాత్ర", "zh": "角色"},
    "analytics": {"hi": "एनालिटिक्स", "ar": "التحليلات", "bn": "অ্যানালিটিক্স", "de": "Analytik", "es": "Analíticas", "fr": "Analytique", "gu": "એનાલિટિક્સ", "ja": "分析", "ml": "അനലിറ്റിക്സ്", "mr": " analytics", "pt": "Análise", "ta": "பகுப்பாய்வு", "te": "అనలిటిక్స్", "zh": "分析"},
    "forecast": {"hi": "फ़ॉरकास्ट", "ar": "التوقعات", "bn": "ফোরকাস্ট", "de": "Prognose", "es": "Pronóstico", "fr": "Prévision", "gu": "ફોરકાસ્ટ", "ja": "予測", "ml": "ഫോർകാസ്റ്റ്", "mr": "फोरकास्ट", "pt": "Previsão", "ta": "முன்கூட்டியிடுத்தல்", "te": "ఫోర్‌కాస్ట్", "zh": "预测"},
    "competitor": {"hi": "प्रतिस्पर्धी", "ar": "المنافس", "bn": "প্রতিযোগী", "de": "Wettbewerber", "es": "Competidor", "fr": "Concurrent", "gu": "પ્રતિસ્પર્ધી", "ja": "競合", "ml": "മത്സരി", "mr": "स्पर्धक", "pt": "Concorrente", "ta": "போட்டியாளர்", "te": "పోటీదారులు", "zh": "竞争对手"},
    "diagnostics": {"hi": "डायग्नोस्टिक्स", "ar": "التشخيصات", "bn": "ডায়াগনস্টিক্স", "de": "Diagnose", "es": "Diagnóstico", "fr": "Diagnostics", "gu": "ડાયગ્નોસ્ટિક્સ", "ja": "診断", "ml": "ഡയാഗ്നോസ്റ്റിക്സ്", "mr": "डायग्नोस्टिक्स", "pt": "Diagnóstico", "ta": "பரிசோதனை", "te": "డయాగ్నాస్టిక్స్", "zh": "诊断"},
    "portal": {"hi": "पोर्टल", "ar": "البوابة", "bn": "পোর্টাল", "de": "Portal", "es": "Portal", "fr": "Portail", "gu": "પોર્ટલ", "ja": "ポータル", "ml": "പോർട്ടൽ", "mr": "पोर्टल", "pt": "Portal", "ta": "நுழைவுவாயில்", "te": "పోర్టల్", "zh": "门户"},
    "digital key": {"hi": "डिजिटल कुंजी", "ar": "مفتاح رقمي", "bn": "ডিজিটাল কী", "de": "Digitaler Schlüssel", "es": "Llave digital", "fr": "Clé numérique", "gu": "ડિજિટલ કી", "ja": "デジタルキー", "ml": "ഡിജിറ്റൽ കീ", "mr": "डिजिटल की", "pt": "Chave digital", "ta": "டிஜிட்டல் விசை", "te": "డిజిటల్ కీ", "zh": "数字钥匙"},
}

# Merge all dictionaries
ALL_TERMS = {}
ALL_TERMS.update(UI_TERMS)
ALL_TERMS.update(STATUS_TERMS)
ALL_TERMS.update(DOMAIN_TERMS)

def translate_value(english_val, lang_code):
    """Try to find a translation for an English value."""
    # Direct lookup
    if english_val in ALL_TERMS and lang_code in ALL_TERMS[english_val]:
        return ALL_TERMS[english_val][lang_code]
    
    # Case-insensitive lookup
    lower = english_val.lower()
    for key, translations in ALL_TERMS.items():
        if key.lower() == lower and lang_code in translations:
            return translations[lang_code]
    
    # Partial match (english_val contains a known term)
    for term, translations in ALL_TERMS.items():
        if term.lower() in lower and lang_code in translations:
            # Don't replace entire strings, only if it's a close match
            if len(term) >= len(english_val) * 0.6:
                return translations[lang_code]
    
    return None  # No translation found

def auto_translate_locale(en_data, target_lang_code):
    """Auto-translate a locale file based on English source."""
    translated = {}
    total = 0
    matched = 0
    
    for ns, ns_data in en_data.items():
        if ns.startswith('_'):
            continue
        translated_ns = {}
        for key, val in ns_data.items():
            total += 1
            t = translate_value(val, target_lang_code)
            if t:
                translated_ns[key] = t
                matched += 1
            else:
                translated_ns[key] = val  # Keep English as fallback
        translated[ns] = translated_ns
    
    return translated, total, matched

if __name__ == '__main__':
    import sys, json
    lang = sys.argv[1] if len(sys.argv) > 1 else 'hi'
    en = json.load(open('src/messages/en.json'))
    result, total, matched = auto_translate_locale(en, lang)
    print(f"Language: {lang}, Total keys: {total}, Matched: {matched}, Coverage: {matched/total*100:.1f}%")
    
    # Save result
    with open(f'/tmp/{lang}_auto_translated.json', 'w') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"Saved to /tmp/{lang}_auto_translated.json")
