/** Map ISO 639-1 codes to NLLB-200 FLORES-200 codes */
const NLLB_MAP: Record<string, string> = {
  en: 'eng_Latn', es: 'spa_Latn', fr: 'fra_Latn', de: 'deu_Latn', it: 'ita_Latn',
  pt: 'por_Latn', ru: 'rus_Cyrl', zh: 'zho_Hans', 'zh-TW': 'zho_Hant', ja: 'jpn_Jpan',
  ko: 'kor_Hang', ar: 'arb_Arab', hi: 'hin_Deva', bn: 'ben_Beng', ta: 'tam_Taml',
  te: 'tel_Telu', mr: 'mar_Deva', gu: 'guj_Gujr', kn: 'kan_Knda', ml: 'mal_Mlym',
  pa: 'pan_Guru', or: 'ory_Orya', ur: 'urd_Arab', as: 'asm_Beng', tr: 'tur_Latn',
  vi: 'vie_Latn', th: 'tha_Thai', id: 'ind_Latn', nl: 'nld_Latn', pl: 'pol_Latn',
  uk: 'ukr_Cyrl', cs: 'ces_Latn', sv: 'swe_Latn', da: 'dan_Latn', fi: 'fin_Latn',
  no: 'nob_Latn', ro: 'ron_Latn', hu: 'hun_Latn', el: 'ell_Grek', he: 'heb_Hebr',
  fa: 'pes_Arab', sw: 'swh_Latn', am: 'amh_Ethi', ne: 'npi_Deva', si: 'sin_Sinh',
  km: 'khm_Khmr', my: 'mya_Mymr', af: 'afr_Latn', sq: 'als_Latn', az: 'azj_Latn',
  bg: 'bul_Cyrl', ca: 'cat_Latn', hr: 'hrv_Latn', et: 'est_Latn', gl: 'glg_Latn',
  ka: 'kat_Geor', kk: 'kaz_Cyrl', lo: 'lao_Laoo', lv: 'lvs_Latn', lt: 'lit_Latn',
  mk: 'mkd_Cyrl', ms: 'zsm_Latn', mt: 'mlt_Latn', mn: 'khk_Cyrl', ps: 'pbt_Arab',
  sk: 'slk_Latn', sl: 'slv_Latn', sr: 'srp_Cyrl', tl: 'tgl_Latn', uz: 'uzn_Latn',
  cy: 'cym_Latn', eu: 'eus_Latn', is: 'isl_Latn', ga: 'gle_Latn', hy: 'hye_Armn',
  be: 'bel_Cyrl', bs: 'bos_Latn', ceb: 'ceb_Latn', ny: 'nya_Latn', co: 'cos_Latn',
  eo: 'epo_Latn', fy: 'fry_Latn', ht: 'hat_Latn', ha: 'hau_Latn', haw: 'haw_Latn',
  hmn: 'hmn_Latn', ig: 'ibo_Latn', jv: 'jav_Latn', ku: 'kmr_Latn', ky: 'kir_Cyrl',
  la: 'lat_Latn', lb: 'ltz_Latn', mg: 'plt_Latn', mi: 'mri_Latn', sd: 'snd_Arab',
  sm: 'smo_Latn', gd: 'gla_Latn', st: 'sot_Latn', sn: 'sna_Latn', so: 'som_Latn',
  su: 'sun_Latn', tg: 'tgk_Cyrl', xh: 'xho_Latn', yi: 'yid_Hebr', yo: 'yor_Latn',
  zu: 'zul_Latn',
};

const REVERSE_NLLB: Record<string, string> = Object.fromEntries(
  Object.entries(NLLB_MAP).map(([k, v]) => [v, k])
);

export function toNllbCode(isoCode: string): string {
  return NLLB_MAP[isoCode] ?? `${isoCode}_Latn`;
}

export function fromNllbCode(nllbCode: string): string {
  return REVERSE_NLLB[nllbCode] ?? nllbCode.split('_')[0];
}

/** IndicTrans2 uses specific script tags */
const INDICTrans_MAP: Record<string, string> = {
  hi: 'hin_Deva', bn: 'ben_Beng', ta: 'tam_Taml', te: 'tel_Telu', mr: 'mar_Deva',
  gu: 'guj_Gujr', kn: 'kan_Knda', ml: 'mal_Mlym', pa: 'pan_Guru', or: 'ory_Orya',
  as: 'asm_Beng', ur: 'urd_Arab', en: 'eng_Latn',
};

export function toIndicTransCode(isoCode: string): string {
  return INDICTrans_MAP[isoCode] ?? toNllbCode(isoCode);
}

export function normalizeLangCode(code: string): string {
  if (code === 'auto') return 'auto';
  return code.split('-')[0].toLowerCase();
}
