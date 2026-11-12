// i18n.js — Centralized Localization & RTL Support for Alfaaz Collective

export const LANGUAGES = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ur', label: 'اردو', dir: 'rtl', fontClass: 'font-urdu' },
  { code: 'ks', label: 'कॉशुर', dir: 'ltr' },
  { code: 'hi', label: 'हिन्दी', dir: 'ltr' }
];

export const TRANSLATIONS = {
  en: {
    // Nav
    'nav.dashboard': 'Dashboard',
    'nav.return': 'Return',
    'nav.home': 'Home',
    'nav.explore': 'Explore',
    'nav.activity': 'My Activity',
    'nav.profile': 'Profile',
    'nav.logout': 'Log Out',
    'nav.login': 'Log In',
    'nav.register': 'Register',

    // Exhibition General
    'exhib.title_fallback': 'Exhibition Open Call',
    'exhib.subtitle': 'Open Call for Artists & Cultural Practitioners',
    'exhib.closed_heading': 'Exhibition Portal Closed',
    'exhib.closed_body': 'There are no active exhibitions currently accepting applications. Please monitor our official announcements or explore our archives.',
    'exhib.not_found_heading': 'Exhibition Cycle Not Found',
    'exhib.not_found_body': 'The requested exhibition cycle is not active or does not exist. Please choose one of our active shows below.',
    'exhib.active_shows': 'Active Exhibition Shows',
    'exhib.choose_show': 'Select a Show to Apply',
    'exhib.apply_btn': 'Apply to this Show',
    'exhib.guidelines_label': 'Guidelines & Steps',
    'exhib.guidelines_title': 'How to Submit Your Artwork',
    'exhib.guidelines_intro': 'Welcome to the Alfaaz Exhibition Open Call. Follow these 3 simple steps to submit your work for curatorial review:',
    
    // Steps
    'step.1': 'Step 1',
    'step.1_title': 'About You',
    'step.1_desc': 'Share your name, age, and contact information so our team can reach you with updates.',
    'step.2': 'Step 2',
    'step.2_title': 'Your Work',
    'step.2_desc': 'Tell us about your artwork and upload your portfolio PDF (max 15MB).',
    'step.3': 'Step 3',
    'step.3_title': 'Review & Submit',
    'step.3_desc': 'Check your details carefully and confirm your application submission.',
    'step.btn_next': 'Next Step →',
    'step.btn_prev': '← Back',
    'step.btn_submit': 'Submit Application',
    'step.submitting': 'Submitting Application...',

    // Form fields
    'field.full_name': 'Your Name',
    'field.full_name_hint': 'Your full name or artist pseudonym',
    'field.age': 'Age',
    'field.age_hint': 'Enter your current age in years',
    'field.address': 'Where are you from?',
    'field.address_hint': 'Town, district, or city in Kashmir',
    'field.whatsapp': 'WhatsApp / Phone Number',
    'field.whatsapp_hint': 'Primary contact number for curatorial announcements',
    'field.genre': 'Artistic Discipline',
    'field.genre_hint': 'e.g. Painting, Calligraphy, Photography, Sculpture, Poetry, Woodwork',
    'field.medium': 'Medium & Dimensions',
    'field.medium_hint': 'e.g. Oil on Canvas, Walnut Wood, Ink on Paper',
    'field.portfolio': 'Artwork Portfolio (PDF)',
    'field.portfolio_hint': 'Upload photos of your selected artwork in a single PDF (max 15MB)',
    'field.recent_works': 'Recent Works (Optional)',
    'field.recent_works_hint': 'Optional: Share earlier sketches or creations (PDF or Image, max 15MB). You may skip this.',
    'field.artist_note': 'Artist Statement / Note (Optional)',
    'field.artist_note_hint': 'Brief explanation of the theme, inspiration, or process behind your work (max 1000 characters)',
    'field.screening_agree': 'I agree to the curatorial screening terms and certify that all submitted artwork is my own original creation.',
    'field.adult_confirm': 'I confirm that I am 18 years of age or older.',

    // Youth Safeguarding
    'guardian.heading': 'Parent or Guardian Consent (Youth Exhibition)',
    'guardian.notice': 'Alfaaz requires explicit parent or guardian permission for young participants before we can accept your submission. We keep all youth information safe and private.',
    'guardian.name': 'Parent / Legal Guardian Full Name',
    'guardian.name_hint': 'Full legal name of mother, father, or legal guardian',
    'guardian.relationship': 'Relationship to Participant',
    'guardian.relationship_hint': 'e.g. Mother, Father, Legal Guardian, Elder Sibling',
    'guardian.contact': 'Parent / Guardian Phone or Email',
    'guardian.contact_hint': 'We will send official updates to your guardian',
    'guardian.consent_agree': 'As parent or legal guardian, I give my explicit permission for this young artist to participate in this Alfaaz exhibition cycle.',
    'guardian.assent_agree': 'I (the young participant) confirm that I want to take part in this exhibition and that this is my original art.',

    // Badges & Statuses
    'badge.youth': 'Youth Exhibition',
    'badge.adult': 'General Exhibition for Adults',
    'badge.optional': 'Optional',
    'badge.required': 'Required',
    'status.pending': 'Application Received — Under Curatorial Review',
    'status.approved': 'Artwork Selected! Registration Required',
    'status.rejected': 'Application Not Selected for this Cycle',
    'status.submitted': 'Registration Submitted — Awaiting Payment Verification',
    'status.confirmed': 'Registration Confirmed! Gallery Spot Ready',

    // Success Screen
    'success.title': 'Application Successfully Received!',
    'success.msg': 'Thank you for sharing your artwork with Alfaaz Collective. Your submission has been securely recorded and will be reviewed with care and respect by our curatorial team.',
    'success.next_steps_title': 'What Happens Next?',
    'success.next_step_1': '1. Our curators carefully review every submitted piece.',
    'success.next_step_2': '2. When the review is complete, your dashboard will update automatically.',
    'success.next_step_3': '3. If selected, you will be invited to confirm your gallery spot.',
    'success.btn_dashboard': 'Go to Member Dashboard →'
  },

  ur: {
    // Nav
    'nav.dashboard': 'ڈیش بورڈ',
    'nav.return': 'واپسی',
    'nav.home': 'صفحہ اول',
    'nav.explore': 'دریافت',
    'nav.activity': 'میری سرگرمیاں',
    'nav.profile': 'پروفائل',
    'nav.logout': 'لاگ آؤٹ',
    'nav.login': 'لاگ ان',
    'nav.register': 'رجسٹریشن',

    // Exhibition General
    'exhib.title_fallback': 'دعوتی نمائش',
    'exhib.subtitle': 'فنکاروں اور قلمکاروں کے لیے کھلی دعوت',
    'exhib.closed_heading': 'نمائش کا پورٹل فی الوقت بند ہے',
    'exhib.closed_body': 'اس وقت کوئی فعال نمائش درخواستیں وصول نہیں کر رہی ہے۔ برائے مہربانی سرکاری اعلانات ملاحظہ فرمائیں۔',
    'exhib.not_found_heading': 'نمائش دستیاب نہیں ہے',
    'exhib.not_found_body': 'درخواست کردہ نمائش فعال نہیں ہے یا موجود نہیں ہے۔ نیچے دی گئی نمائشوں میں سے انتخاب فرمائیں۔',
    'exhib.active_shows': 'فعال نمائشیں',
    'exhib.choose_show': 'نمائش کا انتخاب کریں',
    'exhib.apply_btn': 'اس نمائش کے لیے درخواست دیں',
    'exhib.guidelines_label': 'رہنمائی اور مراحل',
    'exhib.guidelines_title': 'اپنا فن پارہ کیسے جمع کریں',
    'exhib.guidelines_intro': 'الفاظ دعوتی نمائش میں خوش آمدید۔ اپنی درخواست جمع کرانے کے لیے درج ذیل ۳ آسان مراحل پر عمل کریں:',

    // Steps
    'step.1': 'پہلا مرحلہ',
    'step.1_title': 'آپ کا تعارف',
    'step.1_desc': 'اپنا نام، عمر اور رابطے کی تفصیلات فراہم فرمائیں تاکہ ہماری ٹیم آپ سے رابطہ کر سکے۔',
    'step.2': 'دوسرا مرحلہ',
    'step.2_title': 'آپ کا کام',
    'step.2_desc': 'اپنے فن پارے کے بارے میں بتائیں اور پورٹ فولیو پی ڈی ایف (زیادہ سے زیادہ ۱۵ ایم بی) اپ لوڈ کریں۔',
    'step.3': 'تیسرا مرحلہ',
    'step.3_title': 'جائزہ اور تصدیق',
    'step.3_desc': 'اپنی فراہم کردہ معلومات کی تصدیق کریں اور درخواست حتمی طور پر جمع کرائیں۔',
    'step.btn_next': 'اگلا مرحلہ ←',
    'step.btn_prev': '→ پچھلا مرحلہ',
    'step.btn_submit': 'درخواست جمع کریں',
    'step.submitting': 'درخواست جمع ہو رہی ہے...',

    // Form fields
    'field.full_name': 'آپ کا پورا نام',
    'field.full_name_hint': 'آپ کا اصل یا فنکارانہ نام',
    'field.age': 'عمر',
    'field.age_hint': 'سالوں میں اپنی موجودہ عمر درج کریں',
    'field.address': 'آپ کا تعلق کہاں سے ہے؟',
    'field.address_hint': 'کشمیر کا شہر، قصبہ یا ضلع',
    'field.whatsapp': 'واٹس ایپ / رابطہ نمبر',
    'field.whatsapp_hint': 'نمائش کی اطلاعات کے لیے بنیادی رابطہ نمبر',
    'field.genre': 'فنی شعبہ / صنف',
    'field.genre_hint': 'مثلاً: خطاطی، مصوری، عکاسی، کاٹھ تراشی، مجسمہ سازی',
    'field.medium': 'میڈیم اور پیمائش',
    'field.medium_hint': 'مثلاً: کینوس پر روغن، اخروٹ کی لکڑی، روشنائی',
    'field.portfolio': 'فن پاروں کا پورٹ فولیو (پی ڈی ایف)',
    'field.portfolio_hint': 'اپنے منتخب فن پاروں کی تصاویر ایک پی ڈی ایف فائل میں اپ لوڈ کریں (زیادہ سے زیادہ ۱۵ ایم بی)',
    'field.recent_works': 'حالیہ کام (اختیاری)',
    'field.recent_works_hint': 'اختیاری: اپنے سابقہ خاکے یا تخلیقات شیئر کریں۔ آپ اسے چھوڑ بھی سکتے ہیں۔',
    'field.artist_note': 'فنکارانہ بیان / وضاحتی نوٹ (اختیاری)',
    'field.artist_note_hint': 'اپنے کام کے پس پردہ فکر یا عمل کی مختصر وضاحت (زیادہ سے زیادہ ۱۰۰۰ حروف)',
    'field.screening_agree': 'میں انتخابی شرائط سے اتفاق کرتا ہوں اور تصدیق کرتا ہوں کہ تمام فن پارے میری ذاتی تخلیق ہیں۔',
    'field.adult_confirm': 'میں تصدیق کرتا ہوں کہ میری عمر ۱۸ سال یا اس سے زیادہ ہے۔',

    // Youth Safeguarding
    'guardian.heading': 'والدین یا سرپرست کی اجازت (۱۸ سال سے کم عمر کے لیے)',
    'guardian.notice': 'چونکہ آپ کی عمر ۱۸ سال سے کم ہے، الفاظ کو آپ کے والدین یا سرپرست کی باضابطہ اجازت درکار ہے۔ ہم تمام معلومات کو محفوظ اور نجی رکھتے ہیں۔',
    'guardian.name': 'والدین یا قانونی سرپرست کا پورا نام',
    'guardian.name_hint': 'والد، والدہ یا قانونی سرپرست کا نام',
    'guardian.relationship': 'امیدوار سے رشتہ',
    'guardian.relationship_hint': 'مثلاً: والدہ، والد، سرپرست، بڑا بھائی/بہن',
    'guardian.contact': 'سرپرست کا فون نمبر یا ای میل',
    'guardian.contact_hint': 'تمام باضابطہ پیغامات آپ کے سرپرست کو بھیجے جائیں گے',
    'guardian.consent_agree': 'بطور سرپرست، میں اس نوجوان فنکار کو اس نمائش میں شرکت کی واضح اجازت دیتا ہوں۔',
    'guardian.assent_agree': 'میں (نوجوان فنکار) تصدیق کرتا ہوں کہ میں خوشی سے اس نمائش میں حصہ لینا چاہتا ہوں اور یہ میرا اپنا کام ہے۔',

    // Badges & Statuses
    'badge.youth': '۱۸ سال سے کم (نوجوانوں کے لیے)',
    'badge.adult': '۱۸ سال اور زائد (بڑوں کے لیے)',
    'badge.optional': 'اختیاری',
    'badge.required': 'لازمی',
    'status.pending': 'درخواست موصول ہو گئی — تجزیہ جاری ہے',
    'status.approved': 'مبارک ہو! فن پارہ منتخب ہو گیا ہے',
    'status.rejected': 'اس نمائش کے لیے منتخب نہیں ہو سکا',
    'status.submitted': 'رجسٹریشن جمع — ادائیگی کی توثیق جاری ہے',
    'status.confirmed': 'رجسٹریشن مکمل! گیلری میں جگہ محفوظ ہو گئی',

    // Success Screen
    'success.title': 'درخواست کامیابی کے ساتھ موصول ہوئی!',
    'success.msg': 'الفاظ کلیکٹو کے ساتھ اپنا فن شیئر کرنے کا شکریہ۔ آپ کی درخواست محفوظ ہو چکی ہے اور اسے احترام و احتیاط سے دیکھا جائے گا۔',
    'success.next_steps_title': 'آگے کیا ہوگا؟',
    'success.next_step_1': '۱. ہمارے کیوریٹرز ہر فن پارے کا بغور جائزہ لیں گے۔',
    'success.next_step_2': '۲. جائزہ مکمل ہونے پر آپ کا ڈیش بورڈ خود بخود اپ ڈیٹ ہو جائے گا۔',
    'success.next_step_3': '۳. منتخب ہونے کی صورت میں آپ کو رجسٹریشن کی دعوت دی جائے گی۔',
    'success.btn_dashboard': 'ممبر ڈیش بورڈ پر جائیں ←'
  },

  ks: {
    // Kashmiri (Nastaliq / Devanagari hybrid for broader community reach)
    'nav.dashboard': 'ڈیش بورڈ',
    'nav.return': 'واپسی',
    'nav.home': 'گَرٕ',
    'nav.explore': 'کھوج',
    'nav.activity': 'میون کام',
    'nav.profile': 'پروفائل',
    'nav.logout': 'نیبر نیرُن',
    'nav.login': 'اندر ژانہُن',
    'nav.register': 'ناؤ لیكھناوُن',

    'exhib.title_fallback': 'نمائش ہُنٛد سَدٕ',
    'exhib.subtitle': 'فنکارن خٲطرٕ کُھلہٕ سَدٕ',
    'exhib.closed_heading': 'نمائش پورٹل چھُ فی الحال بند',
    'exhib.closed_body': 'فی الحال چھُنہٕ کانہہ تہِ نمائش درخواست گژھان۔',
    'exhib.active_shows': 'چالو نمائشہٕ',
    'exhib.choose_show': 'پنُن شو ژارِو',
    'exhib.apply_btn': 'درخواست دِیِو',
    'exhib.guidelines_label': 'رہنمائی',
    'exhib.guidelines_title': 'پنُن فن کیتھ پٲٹھ سُوپور کَرِو',
    'exhib.guidelines_intro': 'الفاظ دعوتی نمائش مَنٛز خٲرمقدم۔ ۳ سادٕ مرحلن مَنٛز دِیِو پنٕنؠ درخواست:',

    'step.1': 'گۄڈنیُک مرحلہٕ',
    'step.1_title': 'تُہُند تعارف',
    'step.1_desc': 'پنُن ناو، وٲنٛس تہٕ رابطہٕ درج کٔرِو۔',
    'step.2': 'دویِم مرحلہٕ',
    'step.2_title': 'تُہُند فن پارٕ',
    'step.2_desc': 'پننِس کٲمؠ متعلق ونِو تہٕ پی ڈی ایف اپ لوڈ کٔرِو۔',
    'step.3': 'تریِم مرحلہٕ',
    'step.3_title': 'جائزٕ تہٕ تصدیق',
    'step.3_desc': 'جانچ کٔرِتھ دِیِو حتمی درخواست۔',
    'step.btn_next': 'بروٹھ کُن →',
    'step.btn_prev': '← واپس',
    'step.btn_submit': 'درخواست دِیِو',
    'step.submitting': 'درخواست چھےٚ گژھان...',

    'field.full_name': 'تُہُند پُورٕ ناو',
    'field.full_name_hint': 'اصلی یا فنکارانہ ناو',
    'field.age': 'وٲنٛس (عمر)',
    'field.age_hint': 'پنٕنؠ وٲنٛس درج کٔرِو',
    'field.address': 'تُہُند روزنُک جایہِ',
    'field.address_hint': 'کشمیرُک ضلع یا گام/شہر',
    'field.whatsapp': 'واٹس ایپ نمبر',
    'field.whatsapp_hint': 'رابطہٕ خٲطرٕ فون نمبر',
    'field.genre': 'فنی صنف',
    'field.genre_hint': 'مصوری، خطاطی، لکڑِ کٲم، شاعری',
    'field.medium': 'میڈیم',
    'field.medium_hint': 'تیل، واٹر کلر، کینوس وغیرہ',
    'field.portfolio': 'پورٹ فولیو (پی ڈی ایف)',
    'field.portfolio_hint': 'فن پارن ہِنٛز تصویرِ پی ڈی ایف مَنٛز (زیادہ کھۄتہٕ زیادہ ۱۵ ایم بی)',
    'field.recent_works': 'حالیہ کام (اختیاری)',
    'field.recent_works_hint': 'اختیاری: پننؠ برونٛہمؠ کٲم شیئر کٔرِو۔ یتھ چھوڑِتھ تہِ ہیکِو کٔرِتھ۔',
    'field.artist_note': 'فنکارُک نوٹ',
    'field.artist_note_hint': 'پننِس کٲمؠ ہُنٛد مقصد',
    'field.screening_agree': 'بہٕ چھُس شرائطن مانان تہٕ تصدیق کران زِ یہِ چھُ میون اصل فن۔',
    'field.adult_confirm': 'میٲنؠ وٲنٛس چھےٚ ۱۸ سال یا زیٛادٕ۔',

    'guardian.heading': 'وارثن ہِنٛز اجازت (۱۸ وٲنٛسہِ کھۄتہٕ کم)',
    'guardian.notice': '۱۸ وٲنٛسہِ کھۄتہٕ کم فنکارن خٲطرٕ چھےٚ مول موج یا وارثن ہِنٛز اجازت ضروری۔',
    'guardian.name': 'وارثُک پُورٕ ناو',
    'guardian.name_hint': 'مول، موج یا سرپرست',
    'guardian.relationship': 'امیدوارس سٟتؠ رشتہٕ',
    'guardian.relationship_hint': 'مثلاً: موج، مول، بَڈٕ بٲے',
    'guardian.contact': 'وارثُک فون نمبر',
    'guardian.contact_hint': 'پیغام یِیہِ وارثس سوزنہٕ',
    'guardian.consent_agree': 'بطور وارث، بہٕ چھُس اَتھ نوجوان فنکارس نمائشہِ مَنٛز حصہٕ نِنُک اجازت دِوان۔',
    'guardian.assent_agree': 'بہٕ (نوجوان فنکار) چھُس پننِہ خوشی سان حصہٕ نِوان۔',

    'badge.youth': '۱۸ وٲنٛسہِ کھۄتہٕ کم (نوجوان)',
    'badge.adult': '۱۸ سال یا زیٛادٕ (بَڈٕ)',
    'badge.optional': 'اختیاری',
    'badge.required': 'ضروری',
    'status.pending': 'درخواست موصول — جائزہٕ چھُ جاری',
    'status.approved': 'مبارک! فن پارٕ آو ژارنہٕ',
    'status.rejected': 'اَتھ دورس مَنٛز نَہ آو ژارنہٕ',
    'status.submitted': 'رجسٹریشن گٔیہِ جمع',
    'status.confirmed': 'رجسٹریشن مکمل! گیلری مَنٛز جاے محفوظ',

    'success.title': 'درخواست گٔیہِ کامیابی سان موصول!',
    'success.msg': 'الفاظ کٹمبس سٟتؠ فن ونٛڈنہٕ خٲطرٕ شکریہ۔ تُہنٛز درخواست چھےٚ محفوظ۔',
    'success.next_steps_title': 'بروٹھ کُن کیاہ گژھِ؟',
    'success.next_step_1': '۱. اسہِ ہِنٛد کیوریٹر کَرن ہر کٲمؠ ہُنٛد بغور جائزہٕ۔',
    'success.next_step_2': '۲. جائزہٕ مکمل گژھنہٕ پتہٕ یِیہِ تُہنٛد ڈیش بورڈ اپ ڈیٹ کَرنہٕ۔',
    'success.next_step_3': '۳. ژارنہٕ آمتیٚن یِیہِ رجسٹریشن ہُنٛد سَدٕ دِنہٕ۔',
    'success.btn_dashboard': 'ڈیش بورڈس کُن گژھِو →'
  },

  hi: {
    // Nav
    'nav.dashboard': 'डैशबोर्ड',
    'nav.return': 'वापसी',
    'nav.home': 'होम',
    'nav.explore': 'खोजें',
    'nav.activity': 'मेरी गतिविधियाँ',
    'nav.profile': 'प्रोफ़ाइल',
    'nav.logout': 'लॉग आउट',
    'nav.login': 'लॉग इन',
    'nav.register': 'पंजीकरण',

    // Exhibition General
    'exhib.title_fallback': 'प्रदर्शनी आमंत्रण (ओपन कॉल)',
    'exhib.subtitle': 'कलाकारों और साहित्यकारों के लिए खुला आमंत्रण',
    'exhib.closed_heading': 'प्रदर्शनी पोर्टल वर्तमान में बंद है',
    'exhib.closed_body': 'इस समय कोई सक्रिय प्रदर्शनी आवेदन स्वीकार नहीं कर रही है। कृपया आधिकारिक घोषणाओं की प्रतीक्षा करें।',
    'exhib.not_found_heading': 'प्रदर्शनी चक्र नहीं मिला',
    'exhib.not_found_body': 'अनुरोधित प्रदर्शनी सक्रिय नहीं है या मौजूद नहीं है। कृपया नीचे दी गई सक्रिय प्रदर्शनियों में से चुनें।',
    'exhib.active_shows': 'सक्रिय प्रदर्शनियाँ',
    'exhib.choose_show': 'आवेदन के लिए प्रदर्शनी चुनें',
    'exhib.apply_btn': 'इस प्रदर्शनी के लिए आवेदन करें',
    'exhib.guidelines_label': 'दिशानिर्देश व चरण',
    'exhib.guidelines_title': 'अपनी कलाकृति कैसे जमा करें',
    'exhib.guidelines_intro': 'अल्फाज़ ओपन कॉल में आपका स्वागत है। समीक्षा के लिए अपना कार्य जमा करने के लिए इन ३ सरल चरणों का पालन करें:',

    // Steps
    'step.1': 'चरण १',
    'step.1_title': 'आपका परिचय',
    'step.1_desc': 'अपना नाम, आयु और संपर्क जानकारी साझा करें ताकि हमारी टीम आपसे संपर्क कर सके।',
    'step.2': 'चरण २',
    'step.2_title': 'आपकी कलाकृति',
    'step.2_desc': 'अपनी कलाकृति का विवरण दें और पोर्टफोलियो पीडीएफ (अधिकतम १५ एमबी) अपलोड करें।',
    'step.3': 'चरण ३',
    'step.3_title': 'समीक्षा व पुष्टि',
    'step.3_desc': 'अपने विवरण की जांच करें और अंतिम रूप से आवेदन जमा करें।',
    'step.btn_next': 'अगला चरण →',
    'step.btn_prev': '← पिछला चरण',
    'step.btn_submit': 'आवेदन जमा करें',
    'step.submitting': 'आवेदन जमा हो रहा है...',

    // Form fields
    'field.full_name': 'आपका पूरा नाम',
    'field.full_name_hint': 'आपका वास्तविक या कलात्मक नाम',
    'field.age': 'आयु',
    'field.age_hint': 'वर्षों में अपनी आयु दर्ज करें',
    'field.address': 'आप कहाँ से हैं?',
    'field.address_hint': 'कश्मीर का शहर, कस्बा या जिला',
    'field.whatsapp': 'व्हाट्सएप / फोन नंबर',
    'field.whatsapp_hint': 'प्रदर्शनी अपडेट के लिए प्राथमिक संपर्क नंबर',
    'field.genre': 'कला विधा / विधा',
    'field.genre_hint': 'जैसे: चित्रकला, सुलेख, फोटोग्राफी, काष्ठकला, मूर्तिकला',
    'field.medium': 'माध्यम व माप',
    'field.medium_hint': 'जैसे: कैनवास पर तैलरंग, अखरोट की लकड़ी, कागज पर स्याही',
    'field.portfolio': 'कला पोर्टफोलियो (पीडीएफ)',
    'field.portfolio_hint': 'अपनी कलाकृतियों के चित्र एक पीडीएफ में अपलोड करें (अधिकतम १५ एमबी)',
    'field.recent_works': 'हालिया कार्य (वैकल्पिक)',
    'field.recent_works_hint': 'वैकल्पिक: अपने पहले के रेखाचित्र या कृतियाँ साझा करें। आप इसे छोड़ भी सकते हैं।',
    'field.artist_note': 'कलाकार वक्तव्य / नोट (वैकल्पिक)',
    'field.artist_note_hint': 'अपनी रचना के पीछे की प्रेरणा या प्रक्रिया का संक्षिप्त विवरण (अधिकतम १००० अक्षर)',
    'field.screening_agree': 'मैं चयन शर्तों से सहमत हूँ और पुष्टि करता हूँ कि यह कलाकृति मेरी मौलिक रचना है।',
    'field.adult_confirm': 'मैं पुष्टि करता हूँ कि मेरी आयु १८ वर्ष या उससे अधिक है।',

    // Youth Safeguarding
    'guardian.heading': 'माता-पिता या अभिभावक सहमति (१८ वर्ष से कम आयु हेतु)',
    'guardian.notice': 'क्योंकि आपकी आयु १८ वर्ष से कम है, अल्फाज़ को आपके माता-पिता या अभिभावक की स्पष्ट अनुमति की आवश्यकता है। हम सभी जानकारी सुरक्षित और गोपनीय रखते हैं।',
    'guardian.name': 'माता-पिता या अभिभावक का पूरा नाम',
    'guardian.name_hint': 'माता, पिता या कानूनी अभिभावक का नाम',
    'guardian.relationship': 'प्रतिभागी से संबंध',
    'guardian.relationship_hint': 'जैसे: माता, पिता, अभिभावक, बड़े भाई/बहन',
    'guardian.contact': 'अभिभावक का फोन या ईमेल',
    'guardian.contact_hint': 'सभी आधिकारिक सूचनाएं अभिभावक को भेजी जाएंगी',
    'guardian.consent_agree': 'अभिभावक के रूप में, मैं इस युवा कलाकार को इस प्रदर्शनी में भाग लेने की स्पष्ट सहमति देता हूँ।',
    'guardian.assent_agree': 'मैं (युवा प्रतिभागी) पुष्टि करता हूँ कि मैं अपनी इच्छा से भाग ले रहा हूँ और यह मेरी मौलिक कला है।',

    // Badges & Statuses
    'badge.youth': '१८ वर्ष से कम (युवा वर्ग)',
    'badge.adult': '१८ वर्ष व अधिक (वयस्क वर्ग)',
    'badge.optional': 'वैकल्पिक',
    'badge.required': 'अनिवार्य',
    'status.pending': 'आवेदन प्राप्त — समीक्षा जारी है',
    'status.approved': 'बधाई! कलाकृति चयनित — पंजीकरण आवश्यक',
    'status.rejected': 'इस प्रदर्शनी चक्र के लिए चयनित नहीं',
    'status.submitted': 'पंजीकरण जमा — भुगतान सत्यापन जारी है',
    'status.confirmed': 'पंजीकरण पूर्ण! गैलरी स्थान सुरक्षित',

    // Success Screen
    'success.title': 'आवेदन सफलतापूर्वक प्राप्त हुआ!',
    'success.msg': 'अल्फाज़ कलेक्टिव के साथ अपनी कला साझा करने के लिए धन्यवाद। आपका आवेदन सुरक्षित रूप से दर्ज कर लिया गया है।',
    'success.next_steps_title': 'आगे क्या होगा?',
    'success.next_step_1': '१. हमारे क्यूरेटर हर कलाकृति की निष्पक्ष समीक्षा करेंगे।',
    'success.next_step_2': '२. समीक्षा पूर्ण होते ही आपका डैशबोर्ड स्वचालित रूप से अपडेट हो जाएगा।',
    'success.next_step_3': '३. चयन होने पर आपको गैलरी स्पॉट पुष्टिकरण का आमंत्रण मिलेगा।',
    'success.btn_dashboard': 'सदस्य डैशबोर्ड पर जाएं →'
  }
};

let currentLanguage = 'en';

export function getLanguage() {
  const saved = localStorage.getItem('alfaaz_lang');
  if (saved && TRANSLATIONS[saved]) {
    currentLanguage = saved;
  }
  return currentLanguage;
}

export function setLanguage(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLanguage = lang;
  localStorage.setItem('alfaaz_lang', lang);

  const langMeta = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];
  document.documentElement.lang = lang;
  document.documentElement.dir = langMeta.dir;

  if (langMeta.dir === 'rtl') {
    document.body.classList.add('rtl-mode');
  } else {
    document.body.classList.remove('rtl-mode');
  }

  applyTranslations();
  document.dispatchEvent(new CustomEvent('alfaaz_lang_change', { detail: { lang } }));
}

export function t(key, fallback) {
  const dict = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
  if (dict && dict[key]) {
    return dict[key];
  }
  if (TRANSLATIONS.en && TRANSLATIONS.en[key]) {
    return TRANSLATIONS.en[key];
  }
  return fallback || key;
}

export function applyTranslations(root = document) {
  const elements = root.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      const translated = t(key);
      if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'number')) {
        el.placeholder = translated;
      } else {
        el.textContent = translated;
      }
    }
  });

  const ariaElements = root.querySelectorAll('[data-i18n-aria]');
  ariaElements.forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    if (key) {
      el.setAttribute('aria-label', t(key));
    }
  });

  // Sync any language selector pills
  const selectPills = document.querySelectorAll('.lang-pill-btn');
  selectPills.forEach(btn => {
    if (btn.getAttribute('data-lang') === currentLanguage) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

export function initLanguageSelector(containerId = 'langSelectorContainer') {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="lang-selector-pill-group" role="group" aria-label="Select language">
      ${LANGUAGES.map(l => `
        <button type="button" class="lang-pill-btn ${l.code === getLanguage() ? 'active' : ''}" data-lang="${l.code}" aria-pressed="${l.code === getLanguage()}">
          ${l.label}
        </button>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.lang-pill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const chosen = btn.getAttribute('data-lang');
      setLanguage(chosen);
    });
  });

  // Apply initial direction and language
  const initialLang = getLanguage();
  setLanguage(initialLang);
}
