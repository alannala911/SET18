import { Link } from "react-router-dom";
import {
  FiArrowRight,
  FiCalendar,
  FiClock,
  FiMapPin,
  FiTag,
} from "react-icons/fi";

const coursePriceFormatter = new Intl.NumberFormat("nb-NO", {
  maximumFractionDigits: 2,
});

function formatCoursePrice(price) {
  const numericPrice = typeof price === "number" ? price : Number(price);
  return Number.isFinite(numericPrice)
    ? `${coursePriceFormatter.format(numericPrice)} kr`
    : price;
}

function formatCourseDate(date) {
  const parsedDate = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsedDate.getTime())
    ? date
    : parsedDate.toLocaleDateString("nb-NO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
}

export function CourseCard({ course, showEditControls = false, onRemove }) {
  return (
    <article className="course-card">
      {showEditControls && (
        <div className="course-admin-controls">
          <Link
            className="course-admin-edit"
            to={`/kurs/${encodeURIComponent(course.id)}/rediger`}
            aria-label={`Rediger ${course.title}`}
            title={`Rediger ${course.title}`}
          >
            Rediger
          </Link>
          <button
            className="course-admin-remove"
            type="button"
            aria-label={`Arkiver ${course.title}`}
            onClick={() => onRemove(course)}
          >
            ×
          </button>
        </div>
      )}
      <header className={`course-image ${course.color}`}>
        <span aria-hidden="true">{course.symbol}</span>
      </header>

      <section className="course-card-content">
        <p className="course-category">{course.category}</p>
        {course.status !== "published" && (
          <p className="course-status">
            {course.status === "draft" ? "Utkast" : "Arkivert"}
          </p>
        )}

        <h3>{course.title}</h3>

        <p className="course-description">{course.description}</p>

        <ul>
          <li>
            <FiCalendar aria-hidden="true" />
            {formatCourseDate(course.date)}
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
            Pris: {formatCoursePrice(course.price)}
          </li>
        </ul>

        <button type="button">
          Les mer og meld deg på
          <FiArrowRight aria-hidden="true" />
        </button>
      </section>
    </article>
  );
}
