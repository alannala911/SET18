// Inneholder standardinnhold for aktiviteter, kurs, nyheter, kontakt og kommuner
export const activities = [
  {
    id: 1,
    title: "Husflidskafé",
    description:
      "Ta med håndarbeidet ditt og bli kjent med andre som liker å skape noe.",
    date: "2026-11-07",
    time: "12:00-14:00",
    location: "Fredrikstad",
    category: "Sosialt treff",
    imageUrl: "/images/activity-1.jpg",
  },
  {
    id: 2,
    title: "Reparasjon og redesign",
    description:
      "Få inspirasjon til å reparere klær og bruke tekstiler på nye måter.",
    date: "2026-11-18",
    time: "17:30-19:30",
    location: "Moss",
    category: "Åpent verksted",
    imageUrl: "/images/activity-2.jpg",
  },
  {
    id: 3,
    title: "Juleverksted",
    description:
      "En kreativ samling med enkle håndverksaktiviteter for store og små.",
    date: "2026-12-05",
    time: "11:00-14:00",
    location: "Halden",
    category: "Familieaktivitet",
    imageUrl: "/images/activity-3.jpg",
  },
];

export const courses = [
  {
    id: 1,
    title: "Fletting av kurv i pil",
    category: "Fletting",
    description:
      "Lær å flette en enkel kurv i pil. Kurset passer for både nybegynnere og litt øvede.",
    date: "2026-11-12",
    time: "17:00–21:00",
    place: "Borge ungdomsskole, Sarpsborg",
    price: 650,
    symbol: "🧺",
    color: "basket",
    status: "published",
  },
  {
    id: 2,
    title: "Toving – sitteunderlag",
    category: "Toving",
    description:
      "Vi lager sitteunderlag i ull og lærer grunnleggende toveteknikker.",
    date: "2027-01-08",
    time: "17:00–21:00",
    place: "Moss kulturskole",
    price: 550,
    symbol: "🧶",
    color: "wool",
    status: "published",
  },
  {
    id: 3,
    title: "Sy et enkelt skjørt",
    category: "Søm",
    description:
      "Lær grunnleggende søm og tilpasning. Kurset passer for nybegynnere.",
    date: "2027-01-15",
    time: "10:00–15:00",
    place: "Råde husflidssenter",
    price: 750,
    symbol: "🪡",
    color: "sewing",
    status: "published",
  },
  {
    id: 4,
    title: "Brodering – fra grunnteknikk til motiv",
    category: "Broderi",
    description:
      "Lær grunnteknikker og lag ditt eget motiv. Passer for nybegynnere og litt øvede.",
    date: "2027-02-05",
    time: "17:00–20:00",
    place: "Moss kulturskole",
    price: 600,
    symbol: "🌸",
    color: "embroidery",
    status: "published",
  },
  {
    id: 5,
    title: "Strikk votter med tradisjonelle mønstre",
    category: "Strikking",
    description:
      "Lær å strikke votter med klassiske mønstre. Alle nivåer er velkomne.",
    date: "2027-02-12",
    time: "17:00–21:00",
    place: "Sarpsborg læringssenter",
    price: 650,
    symbol: "🧤",
    color: "knitting",
    status: "published",
  },
  {
    id: 6,
    title: "Lag din egen nisse",
    category: "Toving",
    description:
      "Vi tover nisser og julepynt. En hyggelig førjulsaktivitet for alle.",
    date: "2026-11-28",
    time: "17:00–20:00",
    place: "Moss kulturskole",
    price: 500,
    symbol: "🎄",
    color: "christmas",
    status: "published",
  },
];

export const news = [
  {
    id: 1,
    title: "Ny sesong for kurs og aktiviteter",
    excerpt: "Vi har fått en ny og spennende programplan for høsten.",
    body: "Østfold Husflidslag lanserer en ny sesong med flere aktiviteter, faglige kurs og lokallagsmøter. Vi ser frem til et kreativt høstsemester med fokus på fellesskap og læring.",
    publishedAt: "2026-10-15",
    imageUrl: "/images/news-1.jpg",
  },
  {
    id: 2,
    title: "Samarbeid med lokallag i Østfold",
    excerpt: "Flere lokallag vil tilby åpne verksteder og sosiale treff.",
    body: "Husflidslaget samarbeider med lokale lag om flere arrangementer som skaper rom for møtes, lære og dele erfaringer.",
    publishedAt: "2026-10-12",
    imageUrl: "/images/news-2.jpg",
  },
  {
    id: 3,
    title: "Kunst og hverdagsreparasjon i fokus",
    excerpt: "Et nytt tema som kombinerer kreativitet og praktisk kunnskap.",
    body: "Det nye temaet for høsten setter fokus på reparasjon som både praktisk og kreativ, med økt interesse for bærekraft og gjenbruk.",
    publishedAt: "2026-10-10",
    imageUrl: "/images/news-3.jpg",
  },
];

export const defaultContact = {
  introduction:
    "Har du spørsmål om kurs, aktiviteter eller lokallag? Ta kontakt med oss.",
  email: "ostfoldhusflid@gmail.com",
  phone: "917 77 582",
  address: "Emil Mørchs vei 25\n2. etg., rom 1\n1653 Sellebakk",
  people: [
    {
      id: "mona-andersen",
      name: "Mona Andersen",
      role: "Styreleder",
      email: "mona@sjokkpris.no",
      phone: "917 77 582",
    },
    {
      id: "aud-kari-holme",
      name: "Aud Kari Holme",
      role: "Nestleder",
      email: "Audkari.holme@gmail.com",
      phone: "958 79 367",
    },
    {
      id: "heidi-borstad",
      name: "Heidi Børstad",
      role: "Sekretær",
      email: "heidi.borstad@gmail.com",
      phone: "952 22 155",
    },
    {
      id: "silja-devine-holhjem",
      name: "Silja Devine Holhjem",
      role: "Nettansvarlig",
      email: "siljadevine@gmail.com",
      phone: "416 64 904",
    },
    {
      id: "linda-p-vallner",
      name: "Linda P. Vallner",
      role: "Styremedlem · Ung Husflidskontakt",
      email: "lindap.vallner@gmail.com",
      phone: "97 63 84 24",
    },
    {
      id: "thore-grotvedt",
      name: "Thore Grøtvedt",
      role: "Styremedlem",
      email: "thoregro@gmail.com",
      phone: "901 35 455",
    },
    {
      id: "julie-mari-brevik",
      name: "Julie Mari Brevik",
      role: "Varamedlem",
      email: "bunad.julie@gmail.com",
      phone: "993 13 244",
    },
  ],
};

export const municipalities = [
  {
    id: 1,
    name: "Fredrikstad",
    region: "Østfold",
    description: "Lokallag med fokus på sosiale treff og kreative workshops.",
    contactEmail: "fredrikstad@husflidslag.no",
  },
  {
    id: 2,
    name: "Moss",
    region: "Østfold",
    description:
      "Ekstremt aktive arrangementer og praktiske kurs for alle aldre.",
    contactEmail: "moss@husflidslag.no",
  },
  {
    id: 3,
    name: "Sarpsborg",
    region: "Østfold",
    description: "Fokus på fellesskap, håndverk og regional kultur.",
    contactEmail: "sarpsborg@husflidslag.no",
  },
];
