

import { useState } from "react";
import {
  FiArrowRight,
  FiCalendar,
  FiClock,
  FiMapPin,
  FiSearch,
  FiTag,
} from "react-icons/fi";

import "./Courses.css";

const courses = [
  {
    id: 1,
    title: "Fletting av kurv i pil",
    category: "Fletting",
    description:
      "Lær å flette en enkel kurv i pil. Kurset passer for både nybegynnere og litt øvede.",
    date: "12. november 2026",
    time: "17:00–21:00",
    place: "Borge ungdomsskole, Sarpsborg",
    price: "650 kr",
    symbol: "🧺",
    color: "basket",
  },
  {
    id: 2,
    title: "Toving – sitteunderlag",
    category: "Toving",
    description:
      "Vi lager sitteunderlag i ull og lærer grunnleggende toveteknikker.",
    date: "8. januar 2027",
    time: "17:00–21:00",
    place: "Moss kulturskole",
    price: "550 kr",
    symbol: "🧶",
    color: "wool",
  },
  {
    id: 3,
    title: "Sy et enkelt skjørt",
    category: "Søm",
    description:
      "Lær grunnleggende søm og tilpasning. Kurset passer for nybegynnere.",
    date: "15. januar 2027",
    time: "10:00–15:00",
    place: "Råde husflidssenter",
    price: "750 kr",
    symbol: "🪡",
    color: "sewing",
  },
  {
    id: 4,
    title: "Brodering – fra grunnteknikk til motiv",
    category: "Broderi",
    description:
      "Lær grunnteknikker og lag ditt eget motiv. Passer for nybegynnere og litt øvede.",
    date: "5. februar 2027",
    time: "17:00–20:00",
    place: "Moss kulturskole",
    price: "600 kr",
    symbol: "🌸",
    color: "embroidery",
  },
  {
    id: 5,
    title: "Strikk votter med tradisjonelle mønstre",
    category: "Strikking",
    description:
      "Lær å strikke votter med klassiske mønstre. Alle nivåer er velkomne.",
    date: "12. februar 2027",
    time: "17:00–21:00",
    place: "Sarpsborg læringssenter",
    price: "650 kr",
    symbol: "🧤",
    color: "knitting",
  },
  {
    id: 6,
    title: "Lag din egen nisse",
    category: "Toving",
    description:
      "Vi tover nisser og julepynt. En hyggelig førjulsaktivitet for alle.",
    date: "28. november 2026",
    time: "17:00–20:00",
    place: "Moss kulturskole",
    price: "500 kr",
    symbol: "🎄",
    color: "christmas",
  },
];

const categories = [
  { name: "Alle kurs", symbol: "✦" },
  { name: "Strikking", symbol: "🧶" },
  { name: "Fletting", symbol: "🧺" },
  { name: "Toving", symbol: "☁" },
  { name: "Søm", symbol: "🪡" },
  { name: "Broderi", symbol: "🌸" },
];

export default function Courses() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("Alle kurs");

  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      course.title.toLowerCase().includes(search.toLowerCase()) ||
      course.description
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      course.place.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === "Alle kurs" ||
      course.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <main className="courses-page">
      {/* Introduksjon */}
      <section className="courses-hero">
        <section>
          <p className="courses-label">
            Tradisjon · kreativitet · fellesskap
          </p>

          <h1>Kurs og håndverk</h1>

          <p>
            Lær noe nytt, prøv deg på en ny teknikk og skap
            noe med hendene.
          </p>

          <a href="#course-list">
            Se alle kurs
            <FiArrowRight aria-hidden="true" />
          </a>
        </section>

        <aside className="courses-hero-art" aria-hidden="true">
          <span>🧶</span>
          <span>🪡</span>
          <span>✂️</span>
        </aside>
      </section>

      {/* Kategorier */}
      <section
        className="course-categories"
        aria-label="Kurskategorier"
      >
        {categories.map((category) => (
          <button
            key={category.name}
            type="button"
            className={
              selectedCategory === category.name
                ? "category-button selected"
                : "category-button"
            }
            onClick={() =>
              setSelectedCategory(category.name)
            }
          >
            <span aria-hidden="true">{category.symbol}</span>
            {category.name}
          </button>
        ))}
      </section>

      {/* Søk og filtrering */}
      <section className="course-filter">
        <label className="course-search">
          <FiSearch aria-hidden="true" />

          <input
            type="search"
            placeholder="Søk etter kurs ..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </label>

        <label className="course-select">
          <span>Velg type kurs</span>

          <select
            value={selectedCategory}
            onChange={(event) =>
              setSelectedCategory(event.target.value)
            }
          >
            {categories.map((category) => (
              <option
                key={category.name}
                value={category.name}
              >
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Kursoversikt */}
      <section className="course-results" id="course-list">
        <header>
          <section>
            <p className="courses-label">
              Finn et kurs som passer for deg
            </p>

            <h2>Kommende kurs</h2>
          </section>

          <span>
            {filteredCourses.length}{" "}
            {filteredCourses.length === 1 ? "kurs" : "kurs"}
          </span>
        </header>

        {filteredCourses.length > 0 ? (
          <section
            className="course-grid"
            aria-label="Kommende kurs"
          >
            {filteredCourses.map((course) => (
              <article className="course-card" key={course.id}>
                <header
                  className={`course-image ${course.color}`}
                >
                  <span aria-hidden="true">
                    {course.symbol}
                  </span>
                </header>

                <section className="course-card-content">
                  <p className="course-category">
                    {course.category}
                  </p>

                  <h3>{course.title}</h3>

                  <p className="course-description">
                    {course.description}
                  </p>

                  <ul>
                    <li>
                      <FiCalendar aria-hidden="true" />
                      {course.date}
                    </li>

                    <li>
                      <FiClock aria-hidden="true" />
                      {course.time}
                    </li>

                    <li>
                      <FiMapPin aria-hidden="true" />
                      {course.place}
                    </li>

                    <li>
                      <FiTag aria-hidden="true" />
                      Pris: {course.price}
                    </li>
                  </ul>

                  <button type="button">
                    Les mer og meld deg på
                    <FiArrowRight aria-hidden="true" />
                  </button>
                </section>
              </article>
            ))}
          </section>
        ) : (
          <p className="no-courses">
            Vi fant ingen kurs som passer med søket ditt.
          </p>
        )}
      </section>
    </main>
  );
}