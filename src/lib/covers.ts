export type CoverPreset = { id: string; url: string; author: string; authorUrl: string; color: string; label: string };

const u = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=2400&q=80`;

/** Capas escolhidas no Unsplash (licença Unsplash, com crédito ao autor). */
export const COVER_PRESETS: CoverPreset[] = [
  { id: "stars", url: u("photo-1773814776134-78acc1b8168f"), author: "You Le", authorUrl: "https://unsplash.com/@le_y0u", color: "#0b0b0d", label: "Céu estrelado" },
  { id: "city", url: u("photo-1664353655151-9d94a9170eb0"), author: "Diane Picchiottino", authorUrl: "https://unsplash.com/@diane_soko", color: "#0c2626", label: "Cidade à noite" },
  { id: "city2", url: u("photo-1617336422396-e1dfc4210ec5"), author: "Justin Hu", authorUrl: "https://unsplash.com/@justhuit", color: "#262626", label: "Skyline" },
  { id: "moon", url: u("photo-1599939571322-792a326991f2"), author: "Thula Na", authorUrl: "https://unsplash.com/@thula25", color: "#0c5973", label: "Lua cheia" },
  { id: "milky", url: u("photo-1488866022504-f2584929ca5f"), author: "Nathan Anderson", authorUrl: "https://unsplash.com/@nathananderson", color: "#0c2640", label: "Via Láctea" },
  { id: "trees", url: u("photo-1595520519880-a86c48ea536c"), author: "Joshua Woroniecki", authorUrl: "https://unsplash.com/@joshuaworoniecki", color: "#0c2659", label: "Noite azul" },
  { id: "leaves", url: u("photo-1493673272479-a20888bcee10"), author: "Gilles Lambert", authorUrl: "https://unsplash.com/@gilleslambert", color: "#262626", label: "Folhas" },
  { id: "monstera", url: u("photo-1636525653613-2a3a05c00759"), author: "Natalie Kovach", authorUrl: "https://unsplash.com/@natkingkov", color: "#0c260c", label: "Costela-de-adão" },
  { id: "alps", url: u("photo-1573126617899-41f1dffb196c"), author: "Konstantin Kleine", authorUrl: "https://unsplash.com/@konstantinkleine", color: "#f3d9a6", label: "Montanhas" },
  { id: "haze", url: u("photo-1444927714506-8492d94b4e3d"), author: "Paul Earle", authorUrl: "https://unsplash.com/@paulearlephotography", color: "#a6c0c0", label: "Névoa" },
  { id: "ocean", url: u("photo-1508624217470-5ef0f947d8be"), author: "Andrzej Kryszpiniuk", authorUrl: "https://unsplash.com/@kryszpin", color: "#8ca6a6", label: "Oceano" },
  { id: "abstract", url: u("photo-1566410824233-a8011929225c"), author: "Pawel Czerwinski", authorUrl: "https://unsplash.com/@pawel_czerwinski", color: "#0c2640", label: "Abstrato" },
  { id: "waves", url: u("photo-1638376776402-9a4b75fe21bb"), author: "Milad Fakurian", authorUrl: "https://unsplash.com/@fakurian", color: "#262626", label: "Ondas P&B" },
  { id: "gradient", url: u("photo-1635776062360-af423602aff3"), author: "MagicPattern", authorUrl: "https://unsplash.com/@magicpattern", color: "#d9d9d9", label: "Gradiente" },
];
