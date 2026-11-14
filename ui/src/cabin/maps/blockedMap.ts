/**
 * What the Maps app says instead of the map when the player plays on a map Cabin Play doesn't allow (the host
 * tells: a map by HVT, Heavy Vehicles Turkey), in the game's language: every language the game has, by
 * its own codes (`locale/<code>` in its archives). HVT and Cabin Play are names, the same in every language.
 * The game shows Silesian players Polish (pl_si), and so does this.
 */
export const HVT_MAP_MESSAGES: Record<string, string> = {
  bg_bg: 'Картите от HVT не са разрешени в Cabin Play. Свържете се с Cabin Play, за да научите повече.',
  ca_es: "Els mapes d'HVT no estan permesos a Cabin Play. Contacta amb Cabin Play per saber-ne més.",
  cs_cz: 'Mapy od HVT nejsou ve Cabin Play povoleny. Pro více informací kontaktujte Cabin Play.',
  da_dk: 'Kort fra HVT er ikke tilladt i Cabin Play. Kontakt Cabin Play for at få mere at vide.',
  de_de: 'Karten von HVT sind in Cabin Play nicht erlaubt. Kontaktiere Cabin Play, um mehr zu erfahren.',
  el_gr: 'Οι χάρτες της HVT δεν επιτρέπονται στο Cabin Play. Επικοινωνήστε με το Cabin Play για να μάθετε περισσότερα.',
  en_gb: 'Maps by HVT are not allowed in Cabin Play. Contact Cabin Play to learn more.',
  en_us: 'Maps by HVT are not allowed in Cabin Play. Contact Cabin Play to learn more.',
  es_es: 'Los mapas de HVT no están permitidos en Cabin Play. Contacta con Cabin Play para saber más.',
  es_la: 'Los mapas de HVT no están permitidos en Cabin Play. Comunícate con Cabin Play para saber más.',
  et_ee: 'HVT kaardid ei ole Cabin Plays lubatud. Lisateabe saamiseks võta ühendust Cabin Playga.',
  eu_es: 'HVTren mapak ez daude baimenduta Cabin Playn. Jarri harremanetan Cabin Playrekin gehiago jakiteko.',
  fi_fi: 'HVT:n kartat eivät ole sallittuja Cabin Playssa. Ota yhteyttä Cabin Playhin saadaksesi lisätietoja.',
  fr_ca: 'Les cartes de HVT ne sont pas permises dans Cabin Play. Communiquez avec Cabin Play pour en savoir plus.',
  fr_fr: 'Les cartes de HVT ne sont pas autorisées dans Cabin Play. Contactez Cabin Play pour en savoir plus.',
  gl_es: 'Os mapas de HVT non están permitidos en Cabin Play. Contacta con Cabin Play para saber máis.',
  hr_hr: 'Karte od HVT-a nisu dopuštene u Cabin Playu. Za više informacija obratite se Cabin Playu.',
  hu_hu: 'A HVT térképei nem engedélyezettek a Cabin Playben. További információért lépj kapcsolatba a Cabin Playjel.',
  it_it: 'Le mappe di HVT non sono consentite in Cabin Play. Contatta Cabin Play per saperne di più.',
  ja_jp: 'HVTのマップはCabin Playでは使用できません。詳しくはCabin Playにお問い合わせください。',
  ka_ge: 'HVT-ის რუკები Cabin Play-ში დაშვებული არ არის. მეტის გასაგებად დაუკავშირდით Cabin Play-ს.',
  ko_kr: 'HVT의 지도는 Cabin Play에서 허용되지 않습니다. 자세한 내용은 Cabin Play에 문의하세요.',
  lt_lt: 'HVT žemėlapiai Cabin Play neleidžiami. Norėdami sužinoti daugiau, susisiekite su Cabin Play.',
  lv_lv: 'HVT kartes Cabin Play nav atļautas. Lai uzzinātu vairāk, sazinieties ar Cabin Play.',
  mk_mk: 'Мапите од HVT не се дозволени во Cabin Play. Контактирајте го Cabin Play за да дознаете повеќе.',
  nl_nl: 'Kaarten van HVT zijn niet toegestaan in Cabin Play. Neem contact op met Cabin Play voor meer informatie.',
  no_no: 'Kart fra HVT er ikke tillatt i Cabin Play. Kontakt Cabin Play for å finne ut mer.',
  pl_pl: 'Mapy od HVT nie są dozwolone w Cabin Play. Skontaktuj się z Cabin Play, aby dowiedzieć się więcej.',
  pl_si: 'Mapy od HVT nie są dozwolone w Cabin Play. Skontaktuj się z Cabin Play, aby dowiedzieć się więcej.',
  pt_br: 'Mapas da HVT não são permitidos no Cabin Play. Entre em contato com o Cabin Play para saber mais.',
  pt_pt: 'Os mapas da HVT não são permitidos no Cabin Play. Contacte o Cabin Play para saber mais.',
  ro_ro: 'Hărțile HVT nu sunt permise în Cabin Play. Contactează Cabin Play pentru a afla mai multe.',
  ru_ru: 'Карты от HVT не разрешены в Cabin Play. Свяжитесь с Cabin Play, чтобы узнать больше.',
  sk_sk: 'Mapy od HVT nie sú vo Cabin Play povolené. Pre viac informácií kontaktujte Cabin Play.',
  sl_sl: 'Zemljevidi HVT v Cabin Playu niso dovoljeni. Za več informacij se obrnite na Cabin Play.',
  sr_sp: 'Mape od HVT-a nisu dozvoljene u Cabin Play-u. Kontaktirajte Cabin Play da saznate više.',
  sr_sr: 'Мапе од HVT-а нису дозвољене у Cabin Play-у. Контактирајте Cabin Play да сазнате више.',
  sv_se: 'Kartor från HVT är inte tillåtna i Cabin Play. Kontakta Cabin Play för att få veta mer.',
  tr_tr: "HVT haritalarına Cabin Play'de izin verilmiyor. Daha fazla bilgi için Cabin Play ile iletişime geçin.",
  uk_uk: "Карти від HVT не дозволені у Cabin Play. Зв'яжіться з Cabin Play, щоб дізнатися більше.",
  vi_vn: 'Bản đồ của HVT không được phép sử dụng trong Cabin Play. Liên hệ Cabin Play để tìm hiểu thêm.',
  zh_cn: 'Cabin Play 不允许使用 HVT 的地图。如需了解详情，请联系 Cabin Play。',
  zh_tw: 'Cabin Play 不允許使用 HVT 的地圖。如需瞭解詳情，請聯絡 Cabin Play。',
}

/** The message in the game's `language`, or English for one not listed (a mod's). */
export function hvtMapMessage(language: string | null): string {
  return HVT_MAP_MESSAGES[language ?? ''] ?? HVT_MAP_MESSAGES.en_us
}
