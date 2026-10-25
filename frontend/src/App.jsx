import {
  Routes,
  Route,
  Link,
  NavLink,
} from "react-router-dom";

import Courses from "./Pages/Courses.jsx";
import Activities from "./Pages/Activities.jsx";
import News from "./Pages/News.jsx";
import About from "./Pages/About.jsx";
import Municipalities from "./Pages/Municipalities.jsx";
import Contact from "./Pages/Contact.jsx";
import Search from "./Pages/Search.jsx";
import Shop from "./Pages/Shop.jsx";
import MyPage from "./Pages/MyPage.jsx";

import "./App.css";

/* =========================
   FORSIDEN
========================= */

function HomePage() {
  return (
    <main className="main-content">
      <section className="hero">
        <p>Velkommen til</p>

        <h1>Østfold Husflidslag</h1>

        <p className="hero-description">
          Vi ivaretar og utvikler husflid og håndverk kulturelt,
          sosialt og økonomisk i Østfold.
        </p>

        <Link className="hero-button" to="/kurs">
          Se våre kurs <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="cards" aria-label="Snarveier">
        <article className="card course-card">
          <span className="card-icon" aria-hidden="true">
            K
          </span>

          <h2>Kurs</h2>

          <p>Lær nye teknikker og utvikle ferdighetene dine.</p>

          <Link to="/kurs">
            Se kurs <span aria-hidden="true">→</span>
          </Link>
        </article>

        <article className="card activity-card">
          <span className="card-icon" aria-hidden="true">
            A
          </span>

          <h2>Aktiviteter</h2>

          <p>
            Bli med på arrangementer, møter og sosiale aktiviteter.
          </p>

          <Link to="/aktiviteter">
            Se aktiviteter <span aria-hidden="true">→</span>
          </Link>
        </article>

        <article className="card news-card">
          <span className="card-icon" aria-hidden="true">
            N
          </span>

          <h2>Nyheter</h2>

          <p>Få med deg det siste fra Østfold Husflidslag.</p>

          <Link to="/nyheter">
            Se nyheter <span aria-hidden="true">→</span>
          </Link>
        </article>

        <article className="card local-card">
          <span className="card-icon" aria-hidden="true">
            L
          </span>

          <h2>Lokale lag</h2>

          <p>Finn ditt nærmeste lokallag og se hva som skjer.</p>

          <Link to="/kommuner">
            Se mer <span aria-hidden="true">→</span>
          </Link>
        </article>
      </section>
    </main>
  );
}

/* =========================
   HELE NETTSIDEN
========================= */

function App() {
  return (
    <>
      {/* Toppmeny */}
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-symbol" aria-hidden="true">
            ✣
          </span>

          <strong>
            Østfold
            <br />
            Husflidslag
          </strong>
        </Link>

        <nav className="top-links" aria-label="Ekstra navigasjon">
          <Link to="/sok">⌕ Søk</Link>
          <Link to="/nettbutikk">🛒 Nettbutikk</Link>
          <Link to="/min-side">♙ Min side</Link>
        </nav>
      </header>

      {/* Sidemeny og valgt side */}
      <section className="page-layout">
        <aside className="sidebar">
          <nav className="side-links" aria-label="Hovedmeny">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              <span aria-hidden="true">⌂</span>
              Hjem
            </NavLink>

            <NavLink
              to="/kurs"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              <span aria-hidden="true">▣</span>
              Kurs
            </NavLink>

            <NavLink
              to="/aktiviteter"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              <span aria-hidden="true">☷</span>
              Aktiviteter
            </NavLink>

            <NavLink
              to="/nyheter"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              <span aria-hidden="true">▤</span>
              Nyheter
            </NavLink>

            <NavLink
              to="/om-oss"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              <span aria-hidden="true">●</span>
              Om oss
            </NavLink>

            <NavLink
              to="/kommuner"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              <span aria-hidden="true">♙</span>
              Kommuner
            </NavLink>

            <NavLink
              to="/kontakt"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              <span aria-hidden="true">✉</span>
              Kontakt oss
            </NavLink>
          </nav>

          <section className="social">
            <h2>Følg oss</h2>

            <nav aria-label="Sosiale medier">
              <a href="#" aria-label="Facebook">
                f
              </a>

              <a href="#" aria-label="Instagram">
                ◎
              </a>
            </nav>
          </section>
        </aside>

        {/* Sidene og nettadressene */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/kurs" element={<Courses />} />
          <Route path="/aktiviteter" element={<Activities />} />
          <Route path="/nyheter" element={<News />} />
          <Route path="/om-oss" element={<About />} />
          <Route
            path="/kommuner"
            element={<Municipalities />}
          />
          <Route path="/kontakt" element={<Contact />} />
          <Route path="/sok" element={<Search />} />
          <Route path="/nettbutikk" element={<Shop />} />
          <Route path="/min-side" element={<MyPage />} />
        </Routes>
      </section>

      {/* Bunntekst */}
      <footer className="footer">
        <Link className="brand" to="/">
          <span className="brand-symbol" aria-hidden="true">
            ✣
          </span>

          <strong>
            Østfold
            <br />
            Husflidslag
          </strong>
        </Link>

        <p>Tradisjon     |     Kreativitet     |      Fellesskap</p>

        <nav aria-label="Kontakt og sosiale medier">
          <a href="#">Facebook</a>
          <a href="#">Instagram</a>
          <Link to="/kontakt">Kontakt oss →</Link>
        </nav>
      </footer>
    </>
  );
}

export default App;