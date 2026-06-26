export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  family: string;
}

export const LANGUAGES: Language[] = [
  {
    "code": "en",
    "name": "English",
    "nativeName": "English",
    "flag": "🇺🇸",
    "family": "Indo-European / Germanic"
  },
  {
    "code": "de",
    "name": "German",
    "nativeName": "Deutsch",
    "flag": "🇩🇪",
    "family": "Indo-European / Germanic"
  },
  {
    "code": "nl",
    "name": "Dutch",
    "nativeName": "Nederlands",
    "flag": "🇳🇱",
    "family": "Indo-European / Germanic"
  },
  {
    "code": "sv",
    "name": "Swedish",
    "nativeName": "Svenska",
    "flag": "🇸🇪",
    "family": "Indo-European / Germanic"
  },
  {
    "code": "da",
    "name": "Danish",
    "nativeName": "Dansk",
    "flag": "🇩🇰",
    "family": "Indo-European / Germanic"
  },
  {
    "code": "no",
    "name": "Norwegian",
    "nativeName": "Norsk",
    "flag": "🇳🇴",
    "family": "Indo-European / Germanic"
  },
  {
    "code": "is",
    "name": "Icelandic",
    "nativeName": "Íslenska",
    "flag": "🇮🇸",
    "family": "Indo-European / Germanic"
  },
  {
    "code": "fy",
    "name": "Frisian",
    "nativeName": "Frysk",
    "flag": "🇳🇱",
    "family": "Indo-European / Germanic"
  },
  {
    "code": "lb",
    "name": "Luxembourgish",
    "nativeName": "Lëtzebuergesch",
    "flag": "🇱🇺",
    "family": "Indo-European / Germanic"
  },
  {
    "code": "yi",
    "name": "Yiddish",
    "nativeName": "ייִדיש",
    "flag": "🌐",
    "family": "Indo-European / Germanic"
  },
  {
    "code": "af",
    "name": "Afrikaans",
    "nativeName": "Afrikaans",
    "flag": "🇿🇦",
    "family": "Indo-European / Germanic"
  },
  {
    "code": "es",
    "name": "Spanish",
    "nativeName": "Español",
    "flag": "🇪🇸",
    "family": "Indo-European / Romance"
  },
  {
    "code": "fr",
    "name": "French",
    "nativeName": "Français",
    "flag": "🇫🇷",
    "family": "Indo-European / Romance"
  },
  {
    "code": "it",
    "name": "Italian",
    "nativeName": "Italiano",
    "flag": "🇮🇹",
    "family": "Indo-European / Romance"
  },
  {
    "code": "pt",
    "name": "Portuguese",
    "nativeName": "Português",
    "flag": "🇵🇹",
    "family": "Indo-European / Romance"
  },
  {
    "code": "ca",
    "name": "Catalan",
    "nativeName": "Català",
    "flag": "🇪🇸",
    "family": "Indo-European / Romance"
  },
  {
    "code": "gl",
    "name": "Galician",
    "nativeName": "Galego",
    "flag": "🇪🇸",
    "family": "Indo-European / Romance"
  },
  {
    "code": "ro",
    "name": "Romanian",
    "nativeName": "Română",
    "flag": "🇷🇴",
    "family": "Indo-European / Romance"
  },
  {
    "code": "co",
    "name": "Corsican",
    "nativeName": "Corsu",
    "flag": "🇫🇷",
    "family": "Indo-European / Romance"
  },
  {
    "code": "ast",
    "name": "Asturian",
    "nativeName": "Asturianu",
    "flag": "🇪🇸",
    "family": "Indo-European / Romance"
  },
  {
    "code": "wa",
    "name": "Walloon",
    "nativeName": "Walon",
    "flag": "🇧🇪",
    "family": "Indo-European / Romance"
  },
  {
    "code": "lld",
    "name": "Ladin",
    "nativeName": "Ladin",
    "flag": "🇮🇹",
    "family": "Indo-European / Romance"
  },
  {
    "code": "fur",
    "name": "Friulian",
    "nativeName": "Furlan",
    "flag": "🇮🇹",
    "family": "Indo-European / Romance"
  },
  {
    "code": "oc",
    "name": "Occitan",
    "nativeName": "Occitan",
    "flag": "🇫🇷",
    "family": "Indo-European / Romance"
  },
  {
    "code": "sc",
    "name": "Sardinian",
    "nativeName": "Sardu",
    "flag": "🇮🇹",
    "family": "Indo-European / Romance"
  },
  {
    "code": "ru",
    "name": "Russian",
    "nativeName": "Русский",
    "flag": "🇷🇺",
    "family": "Indo-European / Slavic"
  },
  {
    "code": "uk",
    "name": "Ukrainian",
    "nativeName": "Українська",
    "flag": "🇺🇦",
    "family": "Indo-European / Slavic"
  },
  {
    "code": "pl",
    "name": "Polish",
    "nativeName": "Polski",
    "flag": "🇵🇱",
    "family": "Indo-European / Slavic"
  },
  {
    "code": "cs",
    "name": "Czech",
    "nativeName": "Čeština",
    "flag": "🇨🇿",
    "family": "Indo-European / Slavic"
  },
  {
    "code": "sk",
    "name": "Slovak",
    "nativeName": "Slovenčina",
    "flag": "🇸🇰",
    "family": "Indo-European / Slavic"
  },
  {
    "code": "bg",
    "name": "Bulgarian",
    "nativeName": "Български",
    "flag": "🇧🇬",
    "family": "Indo-European / Slavic"
  },
  {
    "code": "hr",
    "name": "Croatian",
    "nativeName": "Hrvatski",
    "flag": "🇭🇷",
    "family": "Indo-European / Slavic"
  },
  {
    "code": "sr",
    "name": "Serbian",
    "nativeName": "Српски",
    "flag": "🇷🇸",
    "family": "Indo-European / Slavic"
  },
  {
    "code": "bs",
    "name": "Bosnian",
    "nativeName": "Bosanski",
    "flag": "🇧🇦",
    "family": "Indo-European / Slavic"
  },
  {
    "code": "sl",
    "name": "Slovenian",
    "nativeName": "Slovenščina",
    "flag": "🇸🇮",
    "family": "Indo-European / Slavic"
  },
  {
    "code": "be",
    "name": "Belarusian",
    "nativeName": "Беларуская",
    "flag": "🇧🇾",
    "family": "Indo-European / Slavic"
  },
  {
    "code": "mk",
    "name": "Macedonian",
    "nativeName": "Македонски",
    "flag": "🇲🇰",
    "family": "Indo-European / Slavic"
  },
  {
    "code": "csb",
    "name": "Kashubian",
    "nativeName": "Kaszëbsczi",
    "flag": "🇵🇱",
    "family": "Indo-European / Slavic"
  },
  {
    "code": "dsb",
    "name": "Lower Sorbian",
    "nativeName": "Dolnoserbski",
    "flag": "🇩🇪",
    "family": "Indo-European / Slavic"
  },
  {
    "code": "hsb",
    "name": "Upper Sorbian",
    "nativeName": "Hornjoserbsce",
    "flag": "🇩🇪",
    "family": "Indo-European / Slavic"
  },
  {
    "code": "hi",
    "name": "Hindi",
    "nativeName": "हिन्दी",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "bn",
    "name": "Bengali",
    "nativeName": "বাংলা",
    "flag": "🇧🇩",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "mr",
    "name": "Marathi",
    "nativeName": "मराठी",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "pa",
    "name": "Punjabi",
    "nativeName": "ਪੰਜਾਬੀ",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "gu",
    "name": "Gujarati",
    "nativeName": "ગુજરાતી",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "ur",
    "name": "Urdu",
    "nativeName": "اردو",
    "flag": "🇵🇰",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "or",
    "name": "Odia (Oriya)",
    "nativeName": "ଓଡ଼ିଆ",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "as",
    "name": "Assamese",
    "nativeName": "অসমীয়া",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "ne",
    "name": "Nepali",
    "nativeName": "नेपाली",
    "flag": "🇳🇵",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "sd",
    "name": "Sindhi",
    "nativeName": "سنڌي",
    "flag": "🇵🇰",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "si",
    "name": "Sinhala",
    "nativeName": "සිංහල",
    "flag": "🇱🇰",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "sa",
    "name": "Sanskrit",
    "nativeName": "संस्कृतम्",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "bho",
    "name": "Bhojpuri",
    "nativeName": "भोजपुरी",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "awa",
    "name": "Awadhi",
    "nativeName": "अवधी",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "mag",
    "name": "Magahi",
    "nativeName": "मगही",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "mai",
    "name": "Maithili",
    "nativeName": "मैथिली",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "ks",
    "name": "Kashmiri",
    "nativeName": "कॉशुर / كٲشُر",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "lus",
    "name": "Mizo",
    "nativeName": "Mizo ṭawng",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "mni",
    "name": "Manipuri",
    "nativeName": "মণিপুরী / ꯃꯤꯇꯩꯂꯣꯟ",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "fa",
    "name": "Persian",
    "nativeName": "فارسی",
    "flag": "🇮🇷",
    "family": "Indo-European / Iranian"
  },
  {
    "code": "ps",
    "name": "Pashto",
    "nativeName": "پښتو",
    "flag": "🇦🇫",
    "family": "Indo-European / Iranian"
  },
  {
    "code": "ku",
    "name": "Kurdish (Kurmanji)",
    "nativeName": "Kurdî",
    "flag": "🌐",
    "family": "Indo-European / Iranian"
  },
  {
    "code": "ckb",
    "name": "Kurdish (Sorani)",
    "nativeName": "کوردیی ناوەندی",
    "flag": "🇮🇶",
    "family": "Indo-European / Iranian"
  },
  {
    "code": "tg",
    "name": "Tajik",
    "nativeName": "Тоҷикӣ",
    "flag": "🇹🇯",
    "family": "Indo-European / Iranian"
  },
  {
    "code": "os",
    "name": "Ossetian",
    "nativeName": "Ирон",
    "flag": "🇷🇺",
    "family": "Indo-European / Iranian"
  },
  {
    "code": "bal",
    "name": "Balochi",
    "nativeName": "بلوچی",
    "flag": "🇵🇰",
    "family": "Indo-European / Iranian"
  },
  {
    "code": "ga",
    "name": "Irish",
    "nativeName": "Gaeilge",
    "flag": "🇮🇪",
    "family": "Indo-European / Celtic"
  },
  {
    "code": "cy",
    "name": "Welsh",
    "nativeName": "Cymraeg",
    "flag": "🇬🇧",
    "family": "Indo-European / Celtic"
  },
  {
    "code": "gd",
    "name": "Scots Gaelic",
    "nativeName": "Gàidhlig",
    "flag": "🇬🇧",
    "family": "Indo-European / Celtic"
  },
  {
    "code": "br",
    "name": "Breton",
    "nativeName": "Brezhoneg",
    "flag": "🇫🇷",
    "family": "Indo-European / Celtic"
  },
  {
    "code": "gv",
    "name": "Manx",
    "nativeName": "Gaelg",
    "flag": "🇮🇲",
    "family": "Indo-European / Celtic"
  },
  {
    "code": "lv",
    "name": "Latvian",
    "nativeName": "Latviešu",
    "flag": "🇱🇻",
    "family": "Indo-European / Baltic"
  },
  {
    "code": "lt",
    "name": "Lithuanian",
    "nativeName": "Lietuvių",
    "flag": "🇱🇹",
    "family": "Indo-European / Baltic"
  },
  {
    "code": "el",
    "name": "Greek",
    "nativeName": "Ελληνικά",
    "flag": "🇬🇷",
    "family": "Indo-European / Hellenic"
  },
  {
    "code": "hy",
    "name": "Armenian",
    "nativeName": "Հայերեն",
    "flag": "🇦🇲",
    "family": "Indo-European / Armenian"
  },
  {
    "code": "sq",
    "name": "Albanian",
    "nativeName": "Shqip",
    "flag": "🇦🇱",
    "family": "Indo-European / Albanian"
  },
  {
    "code": "ar",
    "name": "Arabic",
    "nativeName": "العربية",
    "flag": "🇸🇦",
    "family": "Afroasiatic / Semitic"
  },
  {
    "code": "he",
    "name": "Hebrew",
    "nativeName": "עברית",
    "flag": "🇮🇱",
    "family": "Afroasiatic / Semitic"
  },
  {
    "code": "am",
    "name": "Amharic",
    "nativeName": "አማርኛ",
    "flag": "🇪🇹",
    "family": "Afroasiatic / Semitic"
  },
  {
    "code": "mt",
    "name": "Maltese",
    "nativeName": "Malti",
    "flag": "🇲🇹",
    "family": "Afroasiatic / Semitic"
  },
  {
    "code": "ti",
    "name": "Tigrinya",
    "nativeName": "ትግርኛ",
    "flag": "🇪🇷",
    "family": "Afroasiatic / Semitic"
  },
  {
    "code": "so",
    "name": "Somali",
    "nativeName": "Soomaaliga",
    "flag": "🇸🇴",
    "family": "Afroasiatic / Cushitic"
  },
  {
    "code": "om",
    "name": "Oromo",
    "nativeName": "Afaan Oromoo",
    "flag": "🇪🇹",
    "family": "Afroasiatic / Cushitic"
  },
  {
    "code": "sid",
    "name": "Sidamo",
    "nativeName": "Sidaamu Afoo",
    "flag": "🇪🇹",
    "family": "Afroasiatic / Cushitic"
  },
  {
    "code": "ha",
    "name": "Hausa",
    "nativeName": "Hausa",
    "flag": "🇳🇬",
    "family": "Afroasiatic / Chadic"
  },
  {
    "code": "kab",
    "name": "Kabyle",
    "nativeName": "Taqbaylit",
    "flag": "🇩🇿",
    "family": "Afroasiatic / Berber"
  },
  {
    "code": "tzm",
    "name": "Central Atlas Tamazight",
    "nativeName": "ⵜⴰⵎⴰⵣⵉⵖⵜ",
    "flag": "🇲🇦",
    "family": "Afroasiatic / Berber"
  },
  {
    "code": "zh",
    "name": "Chinese (Simplified)",
    "nativeName": "中文 (简体)",
    "flag": "🇨🇳",
    "family": "Sino-Tibetan / Sinitic"
  },
  {
    "code": "zh-TW",
    "name": "Chinese (Traditional)",
    "nativeName": "中文 (繁體)",
    "flag": "🇹🇼",
    "family": "Sino-Tibetan / Sinitic"
  },
  {
    "code": "yue",
    "name": "Cantonese",
    "nativeName": "粵語",
    "flag": "🇭🇰",
    "family": "Sino-Tibetan / Sinitic"
  },
  {
    "code": "nan",
    "name": "Min Nan (Hokkien)",
    "nativeName": "閩南語",
    "flag": "🇹🇼",
    "family": "Sino-Tibetan / Sinitic"
  },
  {
    "code": "wuu",
    "name": "Wu Chinese (Shanghainese)",
    "nativeName": "吴语",
    "flag": "🇨🇳",
    "family": "Sino-Tibetan / Sinitic"
  },
  {
    "code": "my",
    "name": "Myanmar (Burmese)",
    "nativeName": "မြန်မာဘာသာ",
    "flag": "🇲🇲",
    "family": "Sino-Tibetan / Tibeto-Burman"
  },
  {
    "code": "bo",
    "name": "Tibetan",
    "nativeName": "བོད་སྐད་",
    "flag": "🇨🇳",
    "family": "Sino-Tibetan / Tibeto-Burman"
  },
  {
    "code": "dz",
    "name": "Dzongkha",
    "nativeName": "རྫོང་ཁ་",
    "flag": "🇧🇹",
    "family": "Sino-Tibetan / Tibeto-Burman"
  },
  {
    "code": "sw",
    "name": "Swahili",
    "nativeName": "Kiswahili",
    "flag": "🇰🇪",
    "family": "Niger-Congo / Bantu"
  },
  {
    "code": "zu",
    "name": "Zulu",
    "nativeName": "isiZulu",
    "flag": "🇿🇦",
    "family": "Niger-Congo / Bantu"
  },
  {
    "code": "xh",
    "name": "Xhosa",
    "nativeName": "isiXhosa",
    "flag": "🇿🇦",
    "family": "Niger-Congo / Bantu"
  },
  {
    "code": "sn",
    "name": "Shona",
    "nativeName": "chiShona",
    "flag": "🇿🇼",
    "family": "Niger-Congo / Bantu"
  },
  {
    "code": "st",
    "name": "Sesotho",
    "nativeName": "Sesotho",
    "flag": "🇱🇸",
    "family": "Niger-Congo / Bantu"
  },
  {
    "code": "ln",
    "name": "Lingala",
    "nativeName": "Lingála",
    "flag": "🇨🇩",
    "family": "Niger-Congo / Bantu"
  },
  {
    "code": "lg",
    "name": "Luganda",
    "nativeName": "Oluganda",
    "flag": "🇺🇬",
    "family": "Niger-Congo / Bantu"
  },
  {
    "code": "rw",
    "name": "Kinyarwanda",
    "nativeName": "Ikinyarwanda",
    "flag": "🇷🇼",
    "family": "Niger-Congo / Bantu"
  },
  {
    "code": "rn",
    "name": "Kirundi",
    "nativeName": "Ikirundi",
    "flag": "🇧🇮",
    "family": "Niger-Congo / Bantu"
  },
  {
    "code": "tn",
    "name": "Tswana",
    "nativeName": "Setswana",
    "flag": "🇧🇼",
    "family": "Niger-Congo / Bantu"
  },
  {
    "code": "ny",
    "name": "Chichewa",
    "nativeName": "Chichewa",
    "flag": "🇲🇼",
    "family": "Niger-Congo / Bantu"
  },
  {
    "code": "ts",
    "name": "Tsonga",
    "nativeName": "Xitsonga",
    "flag": "🇿🇦",
    "family": "Niger-Congo / Bantu"
  },
  {
    "code": "nso",
    "name": "Northern Sotho",
    "nativeName": "Sesotho sa Leboa",
    "flag": "🇿🇦",
    "family": "Niger-Congo / Bantu"
  },
  {
    "code": "ss",
    "name": "Swati",
    "nativeName": "SiSwati",
    "flag": "🇸🇿",
    "family": "Niger-Congo / Bantu"
  },
  {
    "code": "ve",
    "name": "Venda",
    "nativeName": "Tshivenda",
    "flag": "🇿🇦",
    "family": "Niger-Congo / Bantu"
  },
  {
    "code": "bm",
    "name": "Bambara",
    "nativeName": "Bamanankan",
    "flag": "🇲🇱",
    "family": "Niger-Congo / Bantu"
  },
  {
    "code": "yo",
    "name": "Yoruba",
    "nativeName": "Yorùbá",
    "flag": "🇳🇬",
    "family": "Niger-Congo / Volta-Niger"
  },
  {
    "code": "ig",
    "name": "Igbo",
    "nativeName": "Asụsụ Igbo",
    "flag": "🇳🇬",
    "family": "Niger-Congo / Volta-Niger"
  },
  {
    "code": "ee",
    "name": "Ewe",
    "nativeName": "Eʋegbe",
    "flag": "🇬🇭",
    "family": "Niger-Congo / Volta-Niger"
  },
  {
    "code": "fon",
    "name": "Fon",
    "nativeName": "Fɔngbe",
    "flag": "🇧🇯",
    "family": "Niger-Congo / Volta-Niger"
  },
  {
    "code": "wo",
    "name": "Wolof",
    "nativeName": "Wolof",
    "flag": "🇸🇳",
    "family": "Niger-Congo / Atlantic"
  },
  {
    "code": "ff",
    "name": "Fulah",
    "nativeName": "Fulfulde",
    "flag": "🇸🇳",
    "family": "Niger-Congo / Atlantic"
  },
  {
    "code": "dyu",
    "name": "Dyula",
    "nativeName": "Julakan",
    "flag": "🇨🇮",
    "family": "Niger-Congo / Mande"
  },
  {
    "code": "id",
    "name": "Indonesian",
    "nativeName": "Bahasa Indonesia",
    "flag": "🇮🇩",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "ms",
    "name": "Malay",
    "nativeName": "Bahasa Melayu",
    "flag": "🇲🇾",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "jv",
    "name": "Javanese",
    "nativeName": "Basa Jawa",
    "flag": "🇮🇩",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "su",
    "name": "Sundanese",
    "nativeName": "Basa Sunda",
    "flag": "🇮🇩",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "tl",
    "name": "Filipino (Tagalog)",
    "nativeName": "Wikang Filipino",
    "flag": "🇵🇭",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "mg",
    "name": "Malagasy",
    "nativeName": "Malagasy",
    "flag": "🇲🇬",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "sm",
    "name": "Samoan",
    "nativeName": "Gagana Sāmoa",
    "flag": "🇼🇸",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "haw",
    "name": "Hawaiian",
    "nativeName": "ʻŌlelo Hawaiʻi",
    "flag": "🇺🇸",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "mi",
    "name": "Maori",
    "nativeName": "Te Reo Māori",
    "flag": "🇳🇿",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "fj",
    "name": "Fijian",
    "nativeName": "Na Vosa Vakaviti",
    "flag": "🇫🇯",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "hil",
    "name": "Hiligaynon",
    "nativeName": "Ilonggo",
    "flag": "🇵🇭",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "ceb",
    "name": "Cebuano",
    "nativeName": "Cebuano",
    "flag": "🇵🇭",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "ilo",
    "name": "Ilokano",
    "nativeName": "Ilokano",
    "flag": "🇵🇭",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "pag",
    "name": "Pangasinan",
    "nativeName": "Pangasinan",
    "flag": "🇵🇭",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "war",
    "name": "Waray",
    "nativeName": "Winaray",
    "flag": "🇵🇭",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "ch",
    "name": "Chamorro",
    "nativeName": "Finaden Chamorro",
    "flag": "🇬🇺",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "ta",
    "name": "Tamil",
    "nativeName": "தமிழ்",
    "flag": "🇮🇳",
    "family": "Dravidian"
  },
  {
    "code": "te",
    "name": "Telugu",
    "nativeName": "తెలుగు",
    "flag": "🇮🇳",
    "family": "Dravidian"
  },
  {
    "code": "kn",
    "name": "Kannada",
    "nativeName": "ಕನ್ನಡ",
    "flag": "🇮🇳",
    "family": "Dravidian"
  },
  {
    "code": "ml",
    "name": "Malayalam",
    "nativeName": "മലയാളം",
    "flag": "🇮🇳",
    "family": "Dravidian"
  },
  {
    "code": "tcy",
    "name": "Tulu",
    "nativeName": "ತುಳು ಬಾಸೆ",
    "flag": "🇮🇳",
    "family": "Dravidian"
  },
  {
    "code": "fi",
    "name": "Finnish",
    "nativeName": "Suomi",
    "flag": "🇫🇮",
    "family": "Uralic / Finno-Ugric"
  },
  {
    "code": "et",
    "name": "Estonian",
    "nativeName": "Eesti",
    "flag": "🇪🇪",
    "family": "Uralic / Finno-Ugric"
  },
  {
    "code": "hu",
    "name": "Hungarian",
    "nativeName": "Magyar",
    "flag": "🇭🇺",
    "family": "Uralic / Finno-Ugric"
  },
  {
    "code": "se",
    "name": "Northern Sami",
    "nativeName": "Davvisámegiella",
    "flag": "🇳🇴",
    "family": "Uralic / Finno-Ugric"
  },
  {
    "code": "tr",
    "name": "Turkish",
    "nativeName": "Türkçe",
    "flag": "🇹🇷",
    "family": "Turkic"
  },
  {
    "code": "az",
    "name": "Azerbaijani",
    "nativeName": "Azərbaycanca",
    "flag": "🇦🇿",
    "family": "Turkic"
  },
  {
    "code": "uz",
    "name": "Uzbek",
    "nativeName": "Oʻzbekcha",
    "flag": "🇺🇿",
    "family": "Turkic"
  },
  {
    "code": "kk",
    "name": "Kazakh",
    "nativeName": "Қазақ тілі",
    "flag": "🇰🇿",
    "family": "Turkic"
  },
  {
    "code": "ky",
    "name": "Kyrgyz",
    "nativeName": "Кыргызча",
    "flag": "🇰🇬",
    "family": "Turkic"
  },
  {
    "code": "tk",
    "name": "Turkmen",
    "nativeName": "Türkmençe",
    "flag": "🇹🇲",
    "family": "Turkic"
  },
  {
    "code": "ug",
    "name": "Uyghur",
    "nativeName": "ئۇيغۇرଚە",
    "flag": "🇨🇳",
    "family": "Turkic"
  },
  {
    "code": "tt",
    "name": "Tatar",
    "nativeName": "Татарча",
    "flag": "🇷🇺",
    "family": "Turkic"
  },
  {
    "code": "ba",
    "name": "Bashkir",
    "nativeName": "Башҡортса",
    "flag": "🇷🇺",
    "family": "Turkic"
  },
  {
    "code": "cv",
    "name": "Chuvash",
    "nativeName": "Чӑвашла",
    "flag": "🇷🇺",
    "family": "Turkic"
  },
  {
    "code": "vi",
    "name": "Vietnamese",
    "nativeName": "Tiếng Việt",
    "flag": "🇻🇳",
    "family": "Austroasiatic / Mon-Khmer"
  },
  {
    "code": "km",
    "name": "Khmer",
    "nativeName": "ភាសាខ្មែរ",
    "flag": "🇰🇭",
    "family": "Austroasiatic / Mon-Khmer"
  },
  {
    "code": "ja",
    "name": "Japanese",
    "nativeName": "日本語",
    "flag": "🇯🇵",
    "family": "Japonic"
  },
  {
    "code": "ko",
    "name": "Korean",
    "nativeName": "한국어",
    "flag": "🇰🇷",
    "family": "Koreanic"
  },
  {
    "code": "th",
    "name": "Thai",
    "nativeName": "ไทย",
    "flag": "🇹🇭",
    "family": "Tai-Kadai"
  },
  {
    "code": "lo",
    "name": "Lao",
    "nativeName": "ພາສາລາວ",
    "flag": "🇱🇦",
    "family": "Tai-Kadai"
  },
  {
    "code": "shn",
    "name": "Shan",
    "nativeName": "လိၵ်ႈတႆး",
    "flag": "🇲🇲",
    "family": "Tai-Kadai"
  },
  {
    "code": "ka",
    "name": "Georgian",
    "nativeName": "ქართული",
    "flag": "🇬🇪",
    "family": "Kartvelian"
  },
  {
    "code": "che",
    "name": "Chechen",
    "nativeName": "Нохчийн",
    "flag": "🇷🇺",
    "family": "Northeast Caucasian"
  },
  {
    "code": "ava",
    "name": "Avar",
    "nativeName": "МагӀарул мацӀ",
    "flag": "🇷🇺",
    "family": "Northeast Caucasian"
  },
  {
    "code": "kbd",
    "name": "Kabardian",
    "nativeName": "Адыгэбзэ",
    "flag": "🇷🇺",
    "family": "Northwest Caucasian"
  },
  {
    "code": "ab",
    "name": "Abkhaz",
    "nativeName": "Аԥсшәа",
    "flag": "🇬🇪",
    "family": "Northwest Caucasian"
  },
  {
    "code": "nah",
    "name": "Nahuatl",
    "nativeName": "Nāhuatl",
    "flag": "🇲🇽",
    "family": "Uto-Aztecan"
  },
  {
    "code": "yua",
    "name": "Yucatec Maya",
    "nativeName": "Maaya T'aan",
    "flag": "🇲🇽",
    "family": "Mayan"
  },
  {
    "code": "quc",
    "name": "K'iche'",
    "nativeName": "Qatzijob'al",
    "flag": "🇬🇹",
    "family": "Mayan"
  },
  {
    "code": "qu",
    "name": "Quechua",
    "nativeName": "Runa Simi",
    "flag": "🇵🇪",
    "family": "Quechuan"
  },
  {
    "code": "ay",
    "name": "Aymara",
    "nativeName": "Aymar Aru",
    "flag": "🇧🇴",
    "family": "Aymaran"
  },
  {
    "code": "gn",
    "name": "Guarani",
    "nativeName": "Avañe'ẽ",
    "flag": "🇵🇾",
    "family": "Tupian"
  },
  {
    "code": "iu",
    "name": "Inuktitut",
    "nativeName": "ᐃᓄᒃᑎᑐᑦ",
    "flag": "🇨🇦",
    "family": "Eskimo-Aleut"
  },
  {
    "code": "kl",
    "name": "Greenlandic",
    "nativeName": "Kalaallisut",
    "flag": "🇬🇱",
    "family": "Eskimo-Aleut"
  },
  {
    "code": "mn",
    "name": "Mongolian",
    "nativeName": "Монгол хэл",
    "flag": "🇲🇳",
    "family": "Mongolic"
  },
  {
    "code": "bua",
    "name": "Buryat",
    "nativeName": "Буряад хэлэн",
    "flag": "🇷🇺",
    "family": "Mongolic"
  },
  {
    "code": "mnc",
    "name": "Manchu",
    "nativeName": "ᠮᠠᠨ⠵ᡠ ᡤᡳᠰᡠᠨ",
    "flag": "🇨🇳",
    "family": "Tungusic"
  },
  {
    "code": "eve",
    "name": "Evenki",
    "nativeName": "Эвэды̄ турэ̄н",
    "flag": "🇷🇺",
    "family": "Tungusic"
  },
  {
    "code": "eu",
    "name": "Basque",
    "nativeName": "Euskara",
    "flag": "🇪🇸",
    "family": "Basque (Isolate)"
  },
  {
    "code": "hmn",
    "name": "Hmong",
    "nativeName": "Hmoob",
    "flag": "🌐",
    "family": "Hmong-Mien"
  },
  {
    "code": "luo",
    "name": "Luo",
    "nativeName": "Dholuo",
    "flag": "🇰🇪",
    "family": "Nilo-Saharan"
  },
  {
    "code": "din",
    "name": "Dinka",
    "nativeName": "Thuɔŋjäŋ",
    "flag": "🇸🇩",
    "family": "Nilo-Saharan"
  },
  {
    "code": "tpi",
    "name": "Tok Pisin",
    "nativeName": "Tok Pisin",
    "flag": "🇵🇬",
    "family": "Creole / Pidgin"
  },
  {
    "code": "ht",
    "name": "Haitian Creole",
    "nativeName": "Kreyòl Ayisyen",
    "flag": "🇭🇹",
    "family": "Creole / Pidgin"
  },
  {
    "code": "pap",
    "name": "Papiamento",
    "nativeName": "Papiamentu",
    "flag": "🇦🇼",
    "family": "Creole / Pidgin"
  },
  {
    "code": "gcr",
    "name": "Guianese Creole",
    "nativeName": "Kriyòl Gwiyannen",
    "flag": "🇬🇫",
    "family": "Creole / Pidgin"
  },
  {
    "code": "sg",
    "name": "Sango",
    "nativeName": "Sängö",
    "flag": "🇨🇫",
    "family": "Niger-Congo / Ubangian"
  },
  {
    "code": "adx",
    "name": "Adangbe",
    "nativeName": "Adangbe",
    "flag": "🇬🇭",
    "family": "Niger-Congo / Kwa"
  },
  {
    "code": "kg",
    "name": "Kikongo",
    "nativeName": "Kikongo",
    "flag": "🇨🇬",
    "family": "Niger-Congo / Kongo"
  },
  {
    "code": "lua",
    "name": "Tshiluba",
    "nativeName": "Tshiluba",
    "flag": "🇨🇩",
    "family": "Niger-Congo / Luba"
  },
  {
    "code": "umb",
    "name": "Umbundu",
    "nativeName": "Umbundu",
    "flag": "🇦🇴",
    "family": "Niger-Congo / Umbundu"
  },
  {
    "code": "nyn",
    "name": "Nyankole",
    "nativeName": "Runyankore",
    "flag": "🇺🇬",
    "family": "Niger-Congo / Nyankole"
  },
  {
    "code": "kac",
    "name": "Jingpho",
    "nativeName": "Jingphaw",
    "flag": "🇲🇲",
    "family": "Sino-Tibetan / Jingpho"
  },
  {
    "code": "ban",
    "name": "Balinese",
    "nativeName": "Basa Bali",
    "flag": "🇮🇩",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "mad",
    "name": "Madurese",
    "nativeName": "Basa Madura",
    "flag": "🇮🇩",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "min",
    "name": "Minangkabau",
    "nativeName": "Baso Minangkabau",
    "flag": "🇮🇩",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "bug",
    "name": "Buginese",
    "nativeName": "Basa Ugi",
    "flag": "🇮🇩",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "ace",
    "name": "Acehnese",
    "nativeName": "Basa Acèh",
    "flag": "🇮🇩",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "bjn",
    "name": "Banjar",
    "nativeName": "Bahasa Banjar",
    "flag": "🇮🇩",
    "family": "Austronesian / Malayo-Polynesian"
  },
  {
    "code": "sat",
    "name": "Santali",
    "nativeName": "Santali",
    "flag": "🇮🇳",
    "family": "Austroasiatic / Munda"
  },
  {
    "code": "unr",
    "name": "Mundari",
    "nativeName": "Mundari",
    "flag": "🇮🇳",
    "family": "Austroasiatic / Munda"
  },
  {
    "code": "aar",
    "name": "Afar",
    "nativeName": "Qafaraf",
    "flag": "🇪🇹",
    "family": "Afroasiatic / Cushitic"
  },
  {
    "code": "nod",
    "name": "Northern Thai",
    "nativeName": "กำเมือง",
    "flag": "🇹🇭",
    "family": "Tai-Kadai"
  },
  {
    "code": "sou",
    "name": "Southern Thai",
    "nativeName": "ภาษาไทยถิ่นใต้",
    "flag": "🇹🇭",
    "family": "Tai-Kadai"
  },
  {
    "code": "kok",
    "name": "Konkani",
    "nativeName": "कोंकणी",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "doi",
    "name": "Dogri",
    "nativeName": "डोगरी",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "gbm",
    "name": "Garhwali",
    "nativeName": "गढ़वाली",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  },
  {
    "code": "kfy",
    "name": "Kumaoni",
    "nativeName": "कुमाऊँनी",
    "flag": "🇮🇳",
    "family": "Indo-European / Indo-Aryan"
  }
];

export const getLanguageName = (code: string): string => {
  if (code === 'auto') return 'Detect Language';
  const lang = LANGUAGES.find(l => l.code === code);
  return lang ? lang.name : code.toUpperCase();
};

export const getLanguageByCode = (code: string): Language | undefined => {
  return LANGUAGES.find(l => l.code === code);
};
