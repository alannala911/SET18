import { useCallback, useEffect, useRef, useState } from "react";
import {
  Routes,
  Route,
  Link,
  NavLink,
  Navigate,
} from "react-router-dom";



/* Sider */
import { FiHome, FiHeart, FiUser } from "react-icons/fi";
import Courses from "./Pages/Courses.jsx";
import Activities from "./Pages/Activities.jsx";
import { ActivityEditor } from "./Pages/ActivityEditor.jsx";
import News from "./Pages/News.jsx";
import About from "./Pages/About.jsx";
import Municipalities from "./Pages/Municipalities.jsx";
import Contact from "./Pages/Contact.jsx";
import Search from "./Pages/Search.jsx";
import Shop from "./Pages/Shop.jsx";
import MyPage from "./Pages/MyPage.jsx";
import MemberProfileChange from "./Pages/MemberProfileChange.jsx";
import ResetPassword from "./Pages/ResetPassword.jsx";
import Membership, {
  MembershipAdminPage,
} from "./Pages/Membership.jsx";

/* Bilder og ikoner */
import logoIcon from "./assets/bilder til nettsiden/Ikoner og Bilder/Logo Østfold.png";
import activitiesIcon from "./assets/bilder til nettsiden/Ikoner og Bilder/Aktiviteter.png";
import courseIcon from "./assets/bilder til nettsiden/Ikoner og Bilder/Kurs.png";
import newsIcon from "./assets/bilder til nettsiden/Ikoner og Bilder/Nyheter.png";
import municipalityIcon from "./assets/bilder til nettsiden/Ikoner og Bilder/kommuner.png";
import contactIcon from "./assets/bilder til nettsiden/Ikoner og Bilder/email.png";
import searchIcon from "./assets/bilder til nettsiden/Ikoner og Bilder/søker.png";
import shopIcon from "./assets/bilder til nettsiden/Ikoner og Bilder/nettbutikk.png";
import facebookIcon from "./assets/bilder til nettsiden/Ikoner og Bilder/Facebook1.png";
import instagramIcon from "./assets/bilder til nettsiden/Ikoner og Bilder/instagram1.png";

import "./App.css";

const API = import.meta.env.VITE_API_BASE_URL || "/api";

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const authCheckSequence = useRef(0);

  const refreshAuthentication = useCallback(() => {
    const sequence = ++authCheckSequence.current;

    Promise.all([
      fetch(`${API}/membership/me`, {
        credentials: "include",
      }),
      fetch(`${API}/auth/me`, {
        credentials: "include",
      }),
    ])
      .then((responses) => {
        if (sequence === authCheckSequence.current) {
          setIsAuthenticated(
            responses.some((response) => response.ok),
          );
        }
      })
      .catch((error) => {
        console.error(
          "Kunne ikke kontrollere innloggingsstatus.",
          error,
        );
      });
  }, []);

  useEffect(() => {
    refreshAuthentication();

    window.addEventListener(
      "set18-auth-change",
      refreshAuthentication,
    );

    window.addEventListener("focus", refreshAuthentication);

    return () => {
      window.removeEventListener(
        "set18-auth-change",
        refreshAuthentication,
      );

      window.removeEventListener(
        "focus",
        refreshAuthentication,
      );
    };
  }, [refreshAuthentication]);

  return (
    <>
      {/* Toppmeny */}
      <header className="topbar">
        <Link className="brand" to="/">
          <img
            className="brand-logo"
            src={logoIcon}
            alt="Østfold Husflidslag"
          />
        </Link>

        <nav
          className="top-links"
          aria-label="Ekstra navigasjon"
        >
          <Link to="/sok">
            <img
              className="top-icon"
              src={searchIcon}
              alt=""
            />
            Søk
          </Link>

          <Link to="/nettbutikk">
            <img
              className="top-icon"
              src={shopIcon}
              alt=""
            />
            Nettbutikk
          </Link>

          <Link to="/medlemskap">
  <FiHeart className="navigation-icon" aria-hidden="true" />
  Medlemskap
</Link>

<Link to="/min-side">
  <FiUser className="navigation-icon" aria-hidden="true" />
  {isAuthenticated ? "Min side" : "Logg inn"}
</Link>
        </nav>
      </header>

      {/* Sidemeny og valgt side */}
      <section className="page-layout">
        <aside className="sidebar">
          <nav
            className="side-links"
            aria-label="Hovedmeny"
          >
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              <FiHome className="navigation-icon" aria-hidden="true" />
              Hjem
            </NavLink>

            <NavLink
              to="/kurs"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              <img
                className="menu-icon"
                src={courseIcon}
                alt=""
              />
              Kurs
            </NavLink>

            <NavLink
              to="/aktiviteter"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              <img
                className="menu-icon"
                src={activitiesIcon}
                alt=""
              />
              Aktiviteter
            </NavLink>

            <NavLink
              to="/nyheter"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              <img
                className="menu-icon"
                src={newsIcon}
                alt=""
              />
              Nyheter
            </NavLink>

            <NavLink
              to="/om-oss"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              <span
                className="temporary-icon"
                aria-hidden="true"
              >
                ●
              </span>
              Om oss
            </NavLink>

            <NavLink
              to="/kommuner"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              <img
                className="menu-icon"
                src={municipalityIcon}
                alt=""
              />
              Kommuner
            </NavLink>

            <NavLink
              to="/kontakt"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              <img
                className="menu-icon"
                src={contactIcon}
                alt=""
              />
              Kontakt oss
            </NavLink>
          </nav>

          <section className="social">
            <h2>Følg oss</h2>

            <nav
              className="social-links"
              aria-label="Sosiale medier"
            >
              <a href="#" aria-label="Facebook">
                <img src={facebookIcon} alt="" />
              </a>

              <a href="#" aria-label="Instagram">
                <img src={instagramIcon} alt="" />
              </a>
            </nav>
          </section>
        </aside>

        {/* Sidene og nettadressene */}
        <Routes>
          <Route path="/" element={<HomePage />} />

          <Route
            path="/kurs"
            element={<Courses />}
          />

          <Route
            path="/aktiviteter"
            element={<Activities />}
          />

          <Route
            path="/aktiviteter/ny"
            element={<ActivityEditor />}
          />

          <Route
            path="/aktiviteter/:activityId/rediger"
            element={<ActivityEditor />}
          />

          <Route
            path="/nyheter"
            element={<News />}
          />

          <Route
            path="/om-oss"
            element={<About />}
          />

          <Route
            path="/kommuner"
            element={<Municipalities />}
          />

          <Route
            path="/kontakt"
            element={<Contact />}
          />

          <Route
            path="/sok"
            element={<Search />}
          />

          <Route
            path="/nettbutikk"
            element={<Shop />}
          />

          <Route
            path="/medlemskap"
            element={<Membership />}
          />

          <Route
            path="/medlemskap/rediger"
            element={<MembershipAdminPage />}
          />

          <Route
            path="/admin"
            element={
              <Navigate to="/min-side" replace />
            }
          />

          <Route
            path="/min-side/endre-personopplysninger"
            element={<MemberProfileChange />}
          />

          <Route
            path="/min-side/nytt-passord"
            element={<ResetPassword />}
          />

          <Route
            path="/min-side"
            element={<MyPage />}
          />
        </Routes>
      </section>

      {/* Bunntekst */}
      <footer className="footer">
        <Link className="brand" to="/">
          <img
            className="footer-logo"
            src={logoIcon}
            alt="Østfold Husflidslag"
          />
        </Link>

        <p>Tradisjon | Kreativitet | Fellesskap</p>

        <nav
          className="footer-links"
          aria-label="Kontakt og sosiale medier"
        >
          <a href="#" aria-label="Facebook">
            <img src={facebookIcon} alt="" />
            Facebook
          </a>

          <a href="#" aria-label="Instagram">
            <img src={instagramIcon} alt="" />
            Instagram
          </a>

          <Link to="/kontakt">
            Kontakt oss →
          </Link>
        </nav>
      </footer>
    </>
  );
}

export default App;