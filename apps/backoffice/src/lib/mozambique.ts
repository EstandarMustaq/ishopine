export type ShopTypeValue =
  | "ELECTRONICS"
  | "FASHION"
  | "SERVICES"
  | "REAL_ESTATE_FURNITURE"
  | "AUTOMOTIVE"
  | "FOOD_GROCERY"
  | "HEALTH_BEAUTY"
  | "OTHER";

export const SHOP_TYPES: Array<{
  value: ShopTypeValue;
  label: string;
  slug: string;
}> = [
  { value: "ELECTRONICS", label: "Eletrônicos", slug: "eletronicos" },
  { value: "FASHION", label: "Moda", slug: "moda" },
  { value: "SERVICES", label: "Serviços", slug: "servicos" },
  {
    value: "REAL_ESTATE_FURNITURE",
    label: "Imóveis & móveis",
    slug: "imoveis-moveis",
  },
  { value: "AUTOMOTIVE", label: "Automóveis", slug: "automoveis" },
  { value: "FOOD_GROCERY", label: "Alimentação", slug: "alimentacao" },
  { value: "HEALTH_BEAUTY", label: "Saúde & beleza", slug: "saude-beleza" },
  { value: "OTHER", label: "Outros", slug: "outros" },
];

export const MZ_PROVINCES: Array<{
  name: string;
  districts: string[];
}> = [
  {
    name: "Maputo Cidade",
    districts: [
      "KaMpfumo",
      "Nlhamankulu",
      "KaMaxaquene",
      "KaMavota",
      "KaTembe",
      "KaNyaka",
    ],
  },
  {
    name: "Maputo Província",
    districts: [
      "Boane",
      "Magude",
      "Manhiça",
      "Marracuene",
      "Matola",
      "Matutuíne",
      "Moamba",
      "Namaacha",
    ],
  },
  {
    name: "Gaza",
    districts: [
      "Bilene",
      "Chibuto",
      "Chicualacuala",
      "Chigubo",
      "Chókwè",
      "Guijá",
      "Mabalane",
      "Manjacaze",
      "Massangena",
      "Massingir",
      "Xai-Xai",
    ],
  },
  {
    name: "Inhambane",
    districts: [
      "Funhalouro",
      "Govuro",
      "Homoíne",
      "Inhambane",
      "Inharrime",
      "Inhassoro",
      "Jangamo",
      "Mabote",
      "Massinga",
      "Maxixe",
      "Morrumbene",
      "Panda",
      "Vilankulo",
      "Zavala",
    ],
  },
  {
    name: "Sofala",
    districts: [
      "Beira",
      "Búzi",
      "Caia",
      "Chemba",
      "Cheringoma",
      "Chibabava",
      "Dondo",
      "Gorongosa",
      "Machanga",
      "Maringué",
      "Marromeu",
      "Muanza",
      "Nhamatanda",
    ],
  },
  {
    name: "Manica",
    districts: [
      "Báruè",
      "Gondola",
      "Guro",
      "Macate",
      "Machaze",
      "Macossa",
      "Manica",
      "Mossurize",
      "Sussundenga",
      "Tambara",
      "Vanduzi",
      "Chimoio",
    ],
  },
  {
    name: "Tete",
    districts: [
      "Angónia",
      "Cahora-Bassa",
      "Changara",
      "Chifunde",
      "Chiuta",
      "Doa",
      "Macanga",
      "Magoé",
      "Marara",
      "Marávia",
      "Moatize",
      "Mutarara",
      "Tsangano",
      "Zumbo",
      "Tete",
    ],
  },
  {
    name: "Zambézia",
    districts: [
      "Alto Molócuè",
      "Chinde",
      "Derre",
      "Gilé",
      "Gurué",
      "Ile",
      "Inhassunge",
      "Lugela",
      "Maganja da Costa",
      "Milange",
      "Mocuba",
      "Mocubela",
      "Molumbo",
      "Mopeia",
      "Morrumbala",
      "Mulevala",
      "Namacurra",
      "Namarroi",
      "Nicoadala",
      "Pebane",
      "Quelimane",
    ],
  },
  {
    name: "Nampula",
    districts: [
      "Angoche",
      "Eráti",
      "Ilha de Moçambique",
      "Lalaua",
      "Larde",
      "Liúpo",
      "Malema",
      "Meconta",
      "Mecubúri",
      "Memba",
      "Mogincual",
      "Mogovolas",
      "Moma",
      "Monapo",
      "Mossuril",
      "Muecate",
      "Murrupula",
      "Nacala-a-Velha",
      "Nacala Porto",
      "Nacarôa",
      "Nampula",
      "Rapale",
      "Ribáuè",
    ],
  },
  {
    name: "Cabo Delgado",
    districts: [
      "Ancuabe",
      "Balama",
      "Chiúre",
      "Ibo",
      "Macomia",
      "Mecúfi",
      "Meluco",
      "Metuge",
      "Mocímboa da Praia",
      "Montepuez",
      "Mueda",
      "Muidumbe",
      "Namuno",
      "Nangade",
      "Palma",
      "Pemba",
      "Quissanga",
    ],
  },
  {
    name: "Niassa",
    districts: [
      "Cuamba",
      "Lago",
      "Lichinga",
      "Majune",
      "Mandimba",
      "Marrupa",
      "Maúa",
      "Mavago",
      "Mecanhelas",
      "Mecula",
      "Metarica",
      "Muembe",
      "N'gauma",
      "Nipepe",
      "Sanga",
    ],
  },
];

export function districtsForProvince(province: string): string[] {
  return MZ_PROVINCES.find((p) => p.name === province)?.districts ?? [];
}

export function shopTypeLabel(value?: string | null): string {
  return SHOP_TYPES.find((t) => t.value === value)?.label ?? "Outros";
}
