// Håndterer kursliste, filtrering, arkivering og administratorhandlinger
import "./CoursePage.css";

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiArrowRight,
  FiSearch,
} from "react-icons/fi";
import { apiRequest } from "./api.js";
import { CourseCard } from "./CourseCard.jsx";
import { FilterControls } from "./FilterControls.jsx";
import { getTodayDate } from "./dateSortFilters.js";
import { filterCourses } from "./courseFilters.js";

const categories = [
  { name: "Alle kurs", symbol: "✦" },
  { name: "Strikking", symbol: "🧶" },
  { name: "Fletting", symbol: "🧺" },
  { name: "Toving", symbol: "☁" },
  { name: "Søm", symbol: "🪡" },
  { name: "Broderi", symbol: "🌸" },
];

export default function Courses() {
  const [courseList, setCourseList] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Alle kurs");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [sortBy, setSortBy] = useState("original");
  const [sortDirection, setSortDirection] = useState("ascending");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isEditingCourses, setIsEditingCourses] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [courseLoadError, setCourseLoadError] = useState("");
  const [courseActionError, setCourseActionError] = useState("");
  const [coursePendingRemoval, setCoursePendingRemoval] = useState(null);
  const [removalConfirmationStage, setRemovalConfirmationStage] = useState(1);
  const [isRemovingCourse, setIsRemovingCourse] = useState(false);

  const loadCourses = useCallback(async () => {
    let isAdmin = false;
    let sessionErrorMessage = "";
    try {
      await apiRequest("/auth/me");
      isAdmin = true;
    } catch (sessionError) {
      if (sessionError.status !== 401) sessionErrorMessage = sessionError.message;
    }

    const loadedCourses = await apiRequest(isAdmin ? "/courses?scope=all" : "/courses");
    if (!Array.isArray(loadedCourses)) throw new Error("Kurslisten har et ugyldig format.");
    return { loadedCourses, isAdmin, sessionErrorMessage };
  }, []);

  useEffect(() => {
    let isComponentMounted = true;
    let requestSequence = 0;
    const refreshCourses = () => {
      const sequence = ++requestSequence;
      loadCourses()
        .then(({ loadedCourses, isAdmin, sessionErrorMessage }) => {
          if (!isComponentMounted || sequence !== requestSequence) return;
          setCourseLoadError("");
          setCourseActionError(sessionErrorMessage);
          setIsAdminAuthenticated(isAdmin);
          setCourseList(loadedCourses);
        })
        .catch((loadError) => {
          if (isComponentMounted && sequence === requestSequence) {
            setCourseLoadError(loadError.message);
          }
        })
        .finally(() => {
          if (isComponentMounted && sequence === requestSequence) {
            setIsLoadingCourses(false);
          }
        });
    };

    refreshCourses();
    function sessionChanged() {
      setIsAdminAuthenticated(false);
      setCourseList((current) => current.filter((course) => course.status === "published"));
      refreshCourses();
    }
    window.addEventListener("set18-auth-change", sessionChanged);
    return () => {
      isComponentMounted = false;
      window.removeEventListener("set18-auth-change", sessionChanged);
    };
  }, [loadCourses]);

  const activeCourses = courseList.filter((course) => course.status !== "archived" && (isAdminAuthenticated || course.status === "published"));
  const archivedCourses = isAdminAuthenticated ? courseList.filter((course) => course.status === "archived") : [];
  const categoryOptions = [
    ...categories,
    ...[...new Set(activeCourses.map((course) => course.category))]
      .filter((name) => !categories.some((category) => category.name === name))
      .map((name) => ({ name, symbol: "✦" })),
  ];

  const filteredCourses = filterCourses(activeCourses, {
    search, category: selectedCategory, period: periodFilter,
    startDate: customStartDate, endDate: customEndDate, today: getTodayDate(), sortBy, sortDirection,
  });

  function toggleAdvancedOptions() {
    if (isAdvancedOpen) {
      setCustomStartDate("");
      setCustomEndDate("");
    }
    setIsAdvancedOpen(!isAdvancedOpen);
  }

  function toggleCourseEditing() {
    setCourseActionError("");
    setIsEditingCourses((currentlyEditing) => !currentlyEditing);
  }

  function beginCourseRemoval(course) {
    setCourseActionError("");
    setCoursePendingRemoval(course);
    setRemovalConfirmationStage(1);
  }

  async function confirmCourseRemoval() {
    if (!coursePendingRemoval) return;
    if (removalConfirmationStage === 1) {
      setRemovalConfirmationStage(2);
      return;
    }
    setIsRemovingCourse(true);
    setCourseActionError("");
    try {
      await apiRequest(`/courses/${encodeURIComponent(coursePendingRemoval.id)}`, { method: "DELETE" });
      setCourseList((currentCourses) => currentCourses.map((course) =>
        course.id === coursePendingRemoval.id
          ? { ...course, status: "archived" }
          : course
      ));
      setCoursePendingRemoval(null);
      setRemovalConfirmationStage(1);
    } catch (removalError) {
      setCourseActionError(removalError.message);
      setCoursePendingRemoval(null);
      setRemovalConfirmationStage(1);
    } finally {
      setIsRemovingCourse(false);
    }
  }

  function cancelCourseRemoval() {
    if (isRemovingCourse) return;
    setCoursePendingRemoval(null);
    setRemovalConfirmationStage(1);
  }

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
        {categoryOptions.map((category) => (
          <button
            key={category.name}
            type="button"
            className={
              selectedCategory === category.name
                ? "category-button selected"
                : "category-button"
            }
            onClick={() => setSelectedCategory(category.name)}
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
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label className="course-select">
          <span>Velg type kurs</span>

          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
          >
            {categoryOptions.map((category) => (
              <option key={category.name} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="course-advanced-filters">
        <FilterControls
          label="Filtrer og sorter kurs"
          sortOptions={[
            ["original", "Som oppført"], ["date", "Dato"], ["time", "Tid på dagen"],
            ["duration", "Varighet"], ["location", "Sted"], ["price", "Pris"],
          ]}
          periodFilter={periodFilter}
          sortBy={sortBy}
          sortDirection={sortDirection}
          isAdvancedOpen={isAdvancedOpen}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onPeriodChange={setPeriodFilter}
          onSortByChange={setSortBy}
          onSortDirectionChange={setSortDirection}
          onAdvancedToggle={toggleAdvancedOptions}
          onStartDateChange={setCustomStartDate}
          onEndDateChange={setCustomEndDate}
        />
        {sortBy === "duration" && <p>Varighet beregnes fra tidsrom på samme dag. Kurs uten et tydelig tidsrom vises sist.</p>}
      </div>

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

        {isAdminAuthenticated && (
          <div className="course-admin-actions">
            <button type="button" onClick={toggleCourseEditing}>
              {isEditingCourses ? "Avslutt redigering" : "Rediger kurs"}
            </button>
            <Link to="/kurs/ny">Legg til kurs</Link>
          </div>
        )}

        {courseActionError && <p className="course-error" role="alert">{courseActionError}</p>}
        {courseLoadError && <p className="course-error" role="alert">{courseLoadError}</p>}

        {isLoadingCourses ? (
          <p className="no-courses">Laster kurs …</p>
        ) : filteredCourses.length > 0 ? (
          <section
            className="course-grid"
            aria-label="Kommende kurs"
          >
            {filteredCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                showEditControls={isEditingCourses && isAdminAuthenticated}
                onRemove={beginCourseRemoval}
              />
            ))}
          </section>
        ) : (
          <p className="no-courses">
            {activeCourses.length === 0 && !courseLoadError
              ? "Det er ingen kommende kurs å vise."
              : "Vi fant ingen kurs som passer med søket ditt."}
          </p>
        )}
      </section>

      {isAdminAuthenticated && !isLoadingCourses && (
        <section className="course-results course-archive" aria-labelledby="course-archive-title">
          <h2 id="course-archive-title">Arkiv for kurs</h2>
          <p>Arkiverte kurs er bare synlige for administratorer.</p>
          {archivedCourses.length === 0
            ? <p>Ingen arkiverte kurs.</p>
            : <section className="course-grid" aria-label="Arkiverte kurs">
              {archivedCourses.map((course) => (
                <CourseCard key={course.id} course={course} showEditControls />
              ))}
            </section>}
        </section>
      )}

      {coursePendingRemoval && (
        <div className="course-dialog-backdrop">
          <section
            className="course-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-dialog-title"
            aria-describedby="course-dialog-description"
          >
            <h2 id="course-dialog-title">
              {removalConfirmationStage === 2
                ? "Er du sikker? Kurset arkiveres"
                : "Ønsker du å arkivere dette kurset?"}
            </h2>
            <p id="course-dialog-description">
              {removalConfirmationStage === 2
                ? `Kurset «${coursePendingRemoval.title}» skjules for besøkende. Du kan publisere det igjen ved å redigere status.`
                : `Vil du arkivere «${coursePendingRemoval.title}»?`}
            </p>
            <div className="course-dialog-actions">
              <button type="button" onClick={cancelCourseRemoval} disabled={isRemovingCourse}>
                Nei
              </button>
              <button type="button" onClick={confirmCourseRemoval} disabled={isRemovingCourse}>
                {isRemovingCourse ? "Arkiverer …" : "Ja"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
